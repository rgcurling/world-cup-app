require('dotenv').config();
const cron = require('node-cron');
const ApiFootballService = require('../services/apiFootball');
const ClaudeService      = require('../services/claude');
const WebPushService     = require('../services/webPush');
const {
  getLiveMatches,
  getMatchByFixtureId,
  getLastAiUpdate,
  insertAiUpdate,
} = require('../db/queries');

const AI_COOLDOWN_MINUTES = 14;

// Derive current match minute from the most recent event without reaching
// into ClaudeService internals.
function minuteFromEvents(events) {
  if (!events?.length) return null;
  return [...events].sort((a, b) => b.time.elapsed - a.time.elapsed)[0]?.time?.elapsed ?? null;
}

class MatchScheduler {
  constructor() {
    this.api      = new ApiFootballService();
    this.claude   = new ClaudeService();
    this.webPush  = new WebPushService();
    // fixtureId (number) -> 'scheduled' | 'live' | 'finished'
    this.previousStatuses = new Map();
    this.tasks = [];
  }

  // Populate previousStatuses from DB so a mid-match restart doesn't trigger
  // false kickoff notifications for already-live matches.
  async _loadInitialStatuses() {
    const live = await getLiveMatches();
    for (const m of live) {
      this.previousStatuses.set(m.fixture_id, 'live');
    }
    console.log(`[Scheduler] Loaded ${live.length} in-progress match(es) from DB.`);
  }

  // -------------------------------------------------------------------------
  // Job 1: Sync full schedule (once per day, 1 API request)
  // -------------------------------------------------------------------------
  async _runScheduleSync() {
    try {
      await this.api.syncSchedule();
    } catch (err) {
      console.error('[Scheduler] Schedule sync failed:', err.message);
    }
  }

  // -------------------------------------------------------------------------
  // Job 2: Live poll (every 5 min, 1 API request)
  // Detects kickoffs and full-time transitions.
  // -------------------------------------------------------------------------
  async _runLivePoll() {
    try {
      const updatedMatches = await this.api.syncLiveMatches();
      const currentLiveIds = new Set(updatedMatches.map((m) => m.fixture_id));

      // Kickoff detection: match is now live but wasn't before.
      for (const match of updatedMatches) {
        const prev = this.previousStatuses.get(match.fixture_id);
        if (!prev || prev === 'scheduled') {
          console.log(`[Scheduler] Kickoff: ${match.home_team} vs ${match.away_team}`);
          this.webPush
            .notifyKickoff(match)
            .catch((e) => console.error('[Scheduler] Kickoff notify failed:', e.message));
        }
        this.previousStatuses.set(match.fixture_id, 'live');
      }

      // Full-time detection: match was live last poll but is gone from live feed.
      for (const [fixtureId, prevStatus] of this.previousStatuses) {
        if (prevStatus === 'live' && !currentLiveIds.has(fixtureId)) {
          await this._handleFullTime(fixtureId);
          this.previousStatuses.set(fixtureId, 'finished');
        }
      }
    } catch (err) {
      console.error('[Scheduler] Live poll failed:', err.message);
    }
  }

  async _handleFullTime(fixtureId) {
    try {
      const match = await getMatchByFixtureId(fixtureId);
      if (!match) return;

      console.log(
        `[Scheduler] Full time: ${match.home_team} ${match.home_score ?? 0}-${match.away_score ?? 0} ${match.away_team}`,
      );

      const context = await this.api.fetchMatchContext(fixtureId);
      const report  = await this.claude.generateFinalReport(match, context.events, context.stats);

      await insertAiUpdate({ fixture_id: fixtureId, minute: 90, summary: report });
      await this.webPush.notifyFullTime(match, report);
    } catch (err) {
      console.error(`[Scheduler] Full-time handling failed for fixture ${fixtureId}:`, err.message);
    }
  }

  // -------------------------------------------------------------------------
  // Job 3: AI updates (every 15 min, 2 API requests per live match)
  // -------------------------------------------------------------------------
  async _runAiUpdates() {
    try {
      const liveMatches = await getLiveMatches();
      if (!liveMatches.length) return;

      for (const match of liveMatches) {
        await this._generateAiUpdate(match);
      }
    } catch (err) {
      console.error('[Scheduler] AI update run failed:', err.message);
    }
  }

  async _generateAiUpdate(match) {
    try {
      const lastUpdate = await getLastAiUpdate(match.fixture_id);
      if (lastUpdate) {
        const minutesSince =
          (Date.now() - new Date(lastUpdate.created_at).getTime()) / 60000;
        if (minutesSince < AI_COOLDOWN_MINUTES) {
          console.log(
            `[Scheduler] Skipping AI update for fixture ${match.fixture_id}` +
            ` (${minutesSince.toFixed(1)} min since last).`,
          );
          return;
        }
      }

      const context  = await this.api.fetchMatchContext(match.fixture_id);
      const summary  = await this.claude.generateMatchUpdate(match, context);
      const minute   = minuteFromEvents(context.events);
      const minuteStr = minute != null ? `${minute}'` : 'unknown';

      await insertAiUpdate({ fixture_id: match.fixture_id, minute, summary });
      await this.webPush.notifyMatchUpdate(match, summary, minuteStr);

      console.log(
        `[Scheduler] AI update sent for ${match.home_team} vs ${match.away_team} at ${minuteStr}.`,
      );
    } catch (err) {
      console.error(
        `[Scheduler] AI update failed for fixture ${match.fixture_id}:`, err.message,
      );
    }
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------
  start() {
    // Sync schedule immediately on startup, then nightly at midnight UTC.
    this._runScheduleSync();
    this.tasks.push(
      cron.schedule('0 0 * * *', () => this._runScheduleSync(), { timezone: 'UTC' }),
    );

    // Load initial statuses before starting live polling so restarts
    // mid-match don't fire false kickoff notifications.
    this._loadInitialStatuses()
      .then(() => {
        this.tasks.push(
          cron.schedule('*/5 * * * *', () => this._runLivePoll()),
        );
        this.tasks.push(
          cron.schedule('*/15 * * * *', () => this._runAiUpdates()),
        );
        console.log('[Scheduler] All jobs started.');
      })
      .catch((err) => {
        console.error('[Scheduler] Startup failed:', err.message);
      });
  }

  stop() {
    for (const task of this.tasks) task.stop();
    console.log('[Scheduler] All jobs stopped.');
  }
}

module.exports = MatchScheduler;
