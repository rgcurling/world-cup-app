require('dotenv').config();
const webpush = require('web-push');
const { getAllSubscriptions, deleteSubscription } = require('../db/queries');

// Max push notification body length across Chrome/Safari/Firefox.
const MAX_BODY_CHARS = 200;

class WebPushService {
  constructor() {
    webpush.setVapidDetails(
      process.env.VAPID_EMAIL,
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY,
    );
  }

  // Pulls the first two sentences out of an AI summary for the notification body.
  // Splits on punctuation followed by whitespace + capital letter so abbreviations
  // like "Jr." or "U.S." don't cause false breaks.
  _extractPreview(text) {
    const parts = text.split(/(?<=[.!?])\s+(?=[A-Z])/);
    const preview = parts.slice(0, 2).join(' ').trim();
    if (preview.length <= MAX_BODY_CHARS) return preview;
    return preview.slice(0, MAX_BODY_CHARS - 1) + '…';
  }

  _buildPayload(title, body, url, ttl = 900) {
    return {
      payload: JSON.stringify({ title, body, url }),
      options: { TTL: ttl },
    };
  }

  async _sendOne(sub, payload, options) {
    const pushSub = {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh, auth: sub.auth },
    };
    await webpush.sendNotification(pushSub, payload, options);
  }

  // Sends a notification to every subscriber. Removes subscriptions that are
  // gone (HTTP 410/404) and logs transient failures without crashing.
  async _broadcast(title, body, url, ttl) {
    const subs = await getAllSubscriptions();
    if (!subs.length) return { sent: 0, failed: 0 };

    const { payload, options } = this._buildPayload(title, body, url, ttl);

    const results = await Promise.allSettled(
      subs.map((sub) =>
        this._sendOne(sub, payload, options).catch(async (err) => {
          if (err.statusCode === 410 || err.statusCode === 404) {
            await deleteSubscription(sub.endpoint);
            console.log(`[WebPush] Removed stale subscription ...${sub.endpoint.slice(-20)}`);
          } else {
            console.error(`[WebPush] Failed ...${sub.endpoint.slice(-20)}: ${err.message}`);
          }
          throw err;
        }),
      ),
    );

    const sent   = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;
    console.log(`[WebPush] Broadcast complete: ${sent} sent, ${failed} failed of ${subs.length}.`);
    return { sent, failed };
  }

  // Called when a match kicks off.
  async notifyKickoff(match) {
    const context = [match.group_name, match.round].filter(Boolean).join(' - ');
    const title = `KICK OFF - ${match.home_team} vs ${match.away_team}`;
    const body  = context ? `${context}. Tap for live updates and AI commentary.` : 'Tap for live updates and AI commentary.';
    return this._broadcast(title, body, `/match/${match.fixture_id}`, 300);
  }

  // Called every 15 minutes with the latest AI summary.
  // minute should be a string like "67'" derived from match events.
  async notifyMatchUpdate(match, aiSummary, minute) {
    const score = `${match.home_score ?? 0}-${match.away_score ?? 0}`;
    const title = `LIVE - ${match.home_team} ${score} ${match.away_team} ${minute}`;
    const body  = this._extractPreview(aiSummary);
    // TTL of 14 minutes -- stale after the next update cycle.
    return this._broadcast(title, body, `/match/${match.fixture_id}`, 840);
  }

  // Called at full time with the AI-generated final report.
  async notifyFullTime(match, reportSummary) {
    const score = `${match.home_score ?? 0}-${match.away_score ?? 0}`;
    const title = `FULL TIME - ${match.home_team} ${score} ${match.away_team}`;
    const body  = this._extractPreview(reportSummary);
    // TTL of 30 minutes -- still relevant for a while after the whistle.
    return this._broadcast(title, body, `/match/${match.fixture_id}`, 1800);
  }
}

module.exports = WebPushService;
