require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

const SYSTEM = 'You are a sharp, opinionated soccer analyst giving a friend live match updates. Be punchy, smart, and slightly opinionated. No bullet points. No em dashes. Write like a knowledgeable friend texting, not a press release.';

class ClaudeService {
  constructor() {
    this.client = new Anthropic();
    this.model  = 'claude-sonnet-4-6';
  }

  _formatEvents(events) {
    const relevant = (events || []).filter((e) =>
      ['Goal', 'Card', 'subst'].includes(e.type),
    );
    if (!relevant.length) return 'No events yet.';

    return relevant.map((e) => {
      const min = e.time.extra
        ? `${e.time.elapsed}+${e.time.extra}`
        : `${e.time.elapsed}`;
      if (e.type === 'Goal') {
        const og  = e.detail === 'Own Goal' ? ' [OG]' : '';
        const pen = e.detail === 'Penalty'  ? ' [pen]' : '';
        return `${min}' GOAL - ${e.player.name}${og}${pen} (${e.team.name})`;
      }
      if (e.type === 'Card') {
        return `${min}' ${e.detail.toUpperCase()} - ${e.player.name} (${e.team.name})`;
      }
      return `${min}' SUB - ${e.player.name} on (${e.team.name})`;
    }).join('\n');
  }

  _buildPrompt(match, events, stats) {
    const homeStats = stats?.[0]?.statistics || [];
    const awayStats = stats?.[1]?.statistics || [];
    const get = (arr, type) => arr.find((s) => s.type === type)?.value ?? 'N/A';

    return `Match: ${match.home_team} vs ${match.away_team}
Competition: FIFA World Cup 2026, ${match.round ?? 'Group Stage'}
Score: ${match.home_score ?? 0} - ${match.away_score ?? 0} (Minute: ${match.minute ?? 0})
Status: ${match.status}

Events so far:
${this._formatEvents(events)}

Stats:
- Possession: ${get(homeStats, 'Ball Possession')} / ${get(awayStats, 'Ball Possession')}
- Shots on target: ${get(homeStats, 'Shots on Goal')} / ${get(awayStats, 'Shots on Goal')}
- Corners: ${get(homeStats, 'Corner Kicks')} / ${get(awayStats, 'Corner Kicks')}

Write a 150-word match analysis covering:
1. What is happening right now
2. Which team is in control and why
3. One key player making a difference
4. What each team needs to do in the next 15 minutes
5. One spicy prediction

Max 150 words. No em dashes. Punchy and opinionated.`;
  }

  async analyzeMatch(match, events, stats) {
    const response = await this.client.messages.create({
      model:      this.model,
      max_tokens: 350,
      system:     SYSTEM,
      messages:   [{ role: 'user', content: this._buildPrompt(match, events, stats) }],
    });

    const text = response.content[0]?.text;
    if (!text) throw new Error('Claude returned empty content');
    return text;
  }
}

module.exports = ClaudeService;
