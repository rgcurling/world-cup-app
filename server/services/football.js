require('dotenv').config();
const axios = require('axios');

const LIVE_STATUSES     = new Set(['1H', 'HT', '2H', 'ET', 'BT', 'P', 'SUSP', 'INT']);
const FINISHED_STATUSES = new Set(['FT', 'AET', 'PEN']);

class FootballService {
  constructor() {
    this.client = axios.create({
      baseURL: 'https://v3.football.api-sports.io',
      headers: { 'x-apisports-key': process.env.API_SPORTS_KEY },
      timeout: 10000,
    });
  }

  async _get(path, params = {}) {
    const res = await this.client.get(path, { params });
    if (!res.data || !Array.isArray(res.data.response)) {
      throw new Error(`api-football: unexpected response for ${path}`);
    }
    return res.data.response;
  }

  normalizeFixture(item) {
    const { fixture, teams, goals, league } = item;
    const short = fixture.status.short;
    return {
      id:           fixture.id,
      home_team:    teams.home.name,
      away_team:    teams.away.name,
      home_logo:    teams.home.logo  ?? null,
      away_logo:    teams.away.logo  ?? null,
      home_score:   goals.home,
      away_score:   goals.away,
      status:       LIVE_STATUSES.has(short) ? 'live' : FINISHED_STATUSES.has(short) ? 'finished' : 'scheduled',
      status_short: short,
      minute:       fixture.status.elapsed ?? null,
      kickoff:      fixture.date,
      venue:        fixture.venue?.name ?? null,
      city:         fixture.venue?.city ?? null,
      round:        league.round        ?? null,
      group:        league.group        ?? null,
    };
  }

  async getSchedule()    { return this._get('/fixtures', { league: 1, season: process.env.WC_SEASON || 2026 }); }
  async getLiveMatches() { return this._get('/fixtures', { league: 1, season: process.env.WC_SEASON || 2026, live: 'all' }); }
  async getMatch(id)     { return this._get('/fixtures', { id }); }
  async getEvents(id)    { return this._get('/fixtures/events',     { fixture: id }); }
  async getLineups(id)   { return this._get('/fixtures/lineups',    { fixture: id }); }
  async getStats(id)     { return this._get('/fixtures/statistics', { fixture: id }); }
  async getStandings()   { return this._get('/standings', { league: 1, season: process.env.WC_SEASON || 2026 }); }
}

module.exports = FootballService;
