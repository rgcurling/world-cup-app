require('dotenv').config();
const axios = require('axios');

const LIVE_STATUSES     = new Set(['1H', 'HT', '2H', 'ET', 'BT', 'P', 'SUSP', 'INT']);
const FINISHED_STATUSES = new Set(['FT', 'AET', 'PEN']);
const SEASON            = () => process.env.WC_SEASON || 2026;

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

  // Attempts a call and returns null instead of throwing -- used for enrichment
  // endpoints that may be unavailable on the free plan.
  async _tryGet(path, params = {}) {
    try { return await this._get(path, params); }
    catch { return null; }
  }

  normalizeFixture(item) {
    const { fixture, teams, goals, league } = item;
    const short = fixture.status.short;
    return {
      id:           fixture.id,
      home_team:    teams.home.name,
      home_team_id: teams.home.id,
      away_team:    teams.away.name,
      away_team_id: teams.away.id,
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

  // Core match data
  async getSchedule()    { return this._get('/fixtures',           { league: 1, season: SEASON() }); }
  async getLiveMatches() { return this._get('/fixtures',           { league: 1, season: SEASON(), live: 'all' }); }
  async getMatch(id)     { return this._get('/fixtures',           { id }); }
  async getEvents(id)    { return this._get('/fixtures/events',    { fixture: id }); }
  async getLineups(id)   { return this._get('/fixtures/lineups',   { fixture: id }); }
  async getStats(id)     { return this._get('/fixtures/statistics',{ fixture: id }); }
  async getStandings()   { return this._get('/standings',          { league: 1, season: SEASON() }); }

  // Enrichment (non-fatal on free plan)
  async getPredictions(fixtureId) {
    return this._tryGet('/predictions', { fixture: fixtureId });
  }

  async getInjuries(fixtureId) {
    return this._tryGet('/injuries', { fixture: fixtureId });
  }

  async getH2H(homeId, awayId) {
    const data = await this._tryGet('/fixtures/headtohead', { h2h: `${homeId}-${awayId}`, last: 10 });
    if (!data) return null;
    return data
      .sort((a, b) => new Date(b.fixture.date) - new Date(a.fixture.date))
      .slice(0, 5)
      .map((item) => ({
        id:         item.fixture.id,
        date:       item.fixture.date,
        home_team:  item.teams.home.name,
        away_team:  item.teams.away.name,
        home_logo:  item.teams.home.logo,
        away_logo:  item.teams.away.logo,
        home_score: item.goals.home,
        away_score: item.goals.away,
        league:     item.league.name,
      }));
  }

  async getPlayerRatings(fixtureId) {
    return this._tryGet('/players', { fixture: fixtureId });
  }

  async getTopScorers() {
    return this._tryGet('/players/topscorers', { league: 1, season: SEASON() });
  }

  async getTopAssists() {
    return this._tryGet('/players/topassists', { league: 1, season: SEASON() });
  }
}

module.exports = FootballService;
