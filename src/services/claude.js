require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

// Cached at the API layer. Must stay above 1024 tokens to qualify for
// prompt caching -- keep this prompt detailed.
const ANALYST_SYSTEM = `You are the voice of KickoffAI, a live World Cup 2026 companion app.
Your job is to write match updates that feel like a message from your smartest soccer-obsessed friend --
the one who played at a high level, watches every league, and always has a take worth hearing.

TONE
- Knowledgeable but never clinical. You love the game.
- Slightly opinionated. You have a perspective and you're not afraid to share it.
- Punchy. Short sentences hit harder. Use them.
- Second person where it lands well ("Brazil just went ahead", "you're watching history").
- No hedging phrases like "it seems" or "arguably". Say the thing.
- No bullet points, headers, or numbered lists in your output. Pure flowing prose.
- No em dashes. Use commas, colons, or short sentences instead.

LIVE UPDATE FORMAT (150-200 words, no more)
Every live update must weave in all five of these elements, in any order, as natural prose:
1. Situation: current score, minute, and the most recent key moment
2. Tactical read: who is controlling the match and why, or what has shifted
3. Key player: the one name making the biggest difference right now
4. Stakes: what the current scoreline means for this match and potentially the group
5. Spicy take: one bold prediction or opinion the viewer can argue about

FINAL REPORT FORMAT (300-400 words)
A post-match recap that covers: how the match unfolded (act by act), the decisive moment,
tactical verdict (who got it right, who got it wrong), man of the match, and what the
result means for the standings or knockout stage.

CONSTRAINTS
- Never fabricate player names, goals, or stats not given to you.
- If stats are missing, skip them -- do not guess.
- Write in English only.
- Output only the update text itself. No preamble, no sign-off, no title.`;

class ClaudeService {
  constructor() {
    this.client = new Anthropic();
    this.model = 'claude-sonnet-4-20250514';
  }

  _formatEvents(events) {
    if (!events || !events.length) return 'No events recorded yet.';

    return events
      .filter((e) => ['Goal', 'Card', 'subst'].includes(e.type))
      .map((e) => {
        const min = e.time.extra ? `${e.time.elapsed}+${e.time.extra}` : `${e.time.elapsed}`;
        if (e.type === 'Goal') {
          const og = e.detail === 'Own Goal' ? ' (OG)' : '';
          const pen = e.detail === 'Penalty' ? ' (pen)' : '';
          const assist = e.assist?.name ? `, assist: ${e.assist.name}` : '';
          return `${min}' GOAL -- ${e.player.name}${og}${pen} (${e.team.name}${assist})`;
        }
        if (e.type === 'Card') {
          return `${min}' ${e.detail.toUpperCase()} -- ${e.player.name} (${e.team.name})`;
        }
        if (e.type === 'subst') {
          return `${min}' SUB -- ${e.player.name} on for ${e.assist?.name ?? '?'} (${e.team.name})`;
        }
        return null;
      })
      .filter(Boolean)
      .join('\n');
  }

  _formatStats(match, stats) {
    if (!stats || stats.length < 2) return 'Statistics not yet available.';

    const [homeStats, awayStats] = stats;
    const get = (arr, type) => arr?.statistics?.find((s) => s.type === type)?.value ?? 'N/A';

    const rows = [
      ['Possession',      get(homeStats, 'Ball Possession'),    get(awayStats, 'Ball Possession')],
      ['Shots on target', get(homeStats, 'Shots on Goal'),      get(awayStats, 'Shots on Goal')],
      ['Total shots',     get(homeStats, 'Total Shots'),        get(awayStats, 'Total Shots')],
      ['Corners',         get(homeStats, 'Corner Kicks'),       get(awayStats, 'Corner Kicks')],
      ['Fouls',           get(homeStats, 'Fouls'),              get(awayStats, 'Fouls')],
      ['xG',              get(homeStats, 'expected_goals'),     get(awayStats, 'expected_goals')],
    ].filter(([, h, a]) => h !== 'N/A' || a !== 'N/A');

    const header = `Stat                  ${match.home_team.padEnd(20)} ${match.away_team}`;
    const lines = rows.map(([label, h, a]) => `${label.padEnd(22)}${String(h).padEnd(21)} ${a}`);
    return [header, ...lines].join('\n');
  }

  _buildLiveUpdatePrompt(match, context) {
    const { events, stats } = context;
    const minute = this._deriveMinute(events, match);
    const score = `${match.home_team} ${match.home_score ?? 0} - ${match.away_score ?? 0} ${match.away_team}`;
    const context_line = [match.group_name, match.round].filter(Boolean).join(', ');

    return `LIVE MATCH UPDATE REQUEST
Match: ${score}
Context: ${context_line}
Current minute: ${minute}

EVENTS SO FAR
${this._formatEvents(events)}

STATISTICS
${this._formatStats(match, stats)}

Write a 150-200 word live update following the format in your instructions.`;
  }

  _buildFinalReportPrompt(match, allEvents, stats) {
    const score = `${match.home_team} ${match.home_score ?? 0} - ${match.away_score ?? 0} ${match.away_team}`;
    const context_line = [match.group_name, match.round].filter(Boolean).join(', ');

    return `FINAL MATCH REPORT REQUEST
Match: ${score} (FINAL)
Context: ${context_line}

FULL MATCH EVENTS
${this._formatEvents(allEvents)}

FINAL STATISTICS
${this._formatStats(match, stats)}

Write a 300-400 word final match report following the format in your instructions.`;
  }

  // Derives the current match minute from the most recent event.
  // Falls back to a rough estimate based on the match object if events are empty.
  _deriveMinute(events, match) {
    if (events && events.length) {
      const last = [...events].sort((a, b) => b.time.elapsed - a.time.elapsed)[0];
      if (last?.time?.elapsed) return `${last.time.elapsed}'`;
    }
    return match.status === 'live' ? 'unknown' : '0';
  }

  async generateMatchUpdate(match, context) {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 400,
      system: [
        {
          type: 'text',
          text: ANALYST_SYSTEM,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: this._buildLiveUpdatePrompt(match, context),
        },
      ],
    });

    const text = response.content[0]?.text;
    if (!text) throw new Error('Claude returned empty content for match update');

    console.log(
      `[Claude] Update generated for fixture ${match.fixture_id}.`,
      `Cache: ${response.usage?.cache_read_input_tokens ?? 0} read /`,
      `${response.usage?.cache_creation_input_tokens ?? 0} created.`,
    );

    return text;
  }

  async generateFinalReport(match, allEvents, stats) {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 700,
      system: [
        {
          type: 'text',
          text: ANALYST_SYSTEM,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: this._buildFinalReportPrompt(match, allEvents, stats),
        },
      ],
    });

    const text = response.content[0]?.text;
    if (!text) throw new Error('Claude returned empty content for final report');

    console.log(
      `[Claude] Final report generated for fixture ${match.fixture_id}.`,
      `Cache: ${response.usage?.cache_read_input_tokens ?? 0} read /`,
      `${response.usage?.cache_creation_input_tokens ?? 0} created.`,
    );

    return text;
  }
}

module.exports = ClaudeService;
