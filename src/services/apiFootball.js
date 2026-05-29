require('dotenv').config();
const axios = require('axios');
const { upsertMatch } = require('../db/queries');

const LIVE_STATUSES = new Set(['1H', 'HT', '2H', 'ET', 'BT', 'P', 'SUSP', 'INT']);
const FINISHED_STATUSES = new Set(['FT', 'AET', 'PEN']);

// Hardcoded US broadcast rights for all WC 2026 matches.
// broadcast_info is stored as JSONB so per-match overrides can be added later
// without a schema change.
const US_BROADCAST = {
  tv: ['Fox', 'FS1', 'Telemundo', 'Universo'],
  streaming: ['Peacock', 'Fubo', 'Sling TV', 'YouTube TV'],
};

class ApiFootballService {
  constructor() {
    this.client = axios.create({
      baseURL: 'https://api-football-v3.p.rapidapi.com',
      headers: {
        'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
        'X-RapidAPI-Host': 'api-football-v3.p.rapidapi.com',
      },
      timeout: 10000,
    });
  }

  async _get(path, params = {}) {
    const res = await this.client.get(path, { params });
    if (!res.data || !Array.isArray(res.data.response)) {
      throw new Error(`Unexpected api-football response for ${path}`);
    }
    return res.data.response;
  }

  _normalizeStatus(short) {
    if (LIVE_STATUSES.has(short)) return 'live';
    if (FINISHED_STATUSES.has(short)) return 'finished';
    return 'scheduled';
  }

  _normalizeFixture(item) {
    const { fixture, teams, goals, league } = item;
    return {
      fixture_id:    fixture.id,
      home_team:     teams.home.name,
      away_team:     teams.away.name,
      home_score:    goals.home,
      away_score:    goals.away,
      status:        this._normalizeStatus(fixture.status.short),
      kickoff_utc:   fixture.date,
      venue:         fixture.venue?.name  ?? null,
      city:          fixture.venue?.city  ?? null,
      round:         league.round         ?? null,
      group_name:    league.group         ?? null,
      home_logo_url: teams.home.logo      ?? null,
      away_logo_url: teams.away.logo      ?? null,
      broadcast_info: US_BROADCAST,
    };
  }

  // Fetches the full WC 2026 schedule and upserts every match into the DB.
  // Called once per day by the scheduler (1 API request).
  async syncSchedule() {
    const data = await this._get('/fixtures', { league: 1, season: 2026 });
    let synced = 0;
    for (const item of data) {
      await upsertMatch(this._normalizeFixture(item));
      synced++;
    }
    console.log(`[ApiFootball] Synced schedule: ${synced} matches.`);
    return synced;
  }

  // Fetches only the currently live matches and updates scores/status in DB.
  // Called every 5 minutes by the scheduler (1 API request regardless of
  // how many matches are live).
  async syncLiveMatches() {
    const data = await this._get('/fixtures', { league: 1, season: 2026, live: 'all' });
    const updated = [];
    for (const item of data) {
      const match = await upsertMatch(this._normalizeFixture(item));
      updated.push(match);
    }
    if (updated.length) {
      console.log(`[ApiFootball] Updated ${updated.length} live match(es).`);
    }
    return updated;
  }

  // Returns raw events + stats for a live match.
  // Called every 15 minutes by the AI update job (2 API requests per match).
  async fetchMatchContext(fixtureId) {
    const [events, stats] = await Promise.all([
      this._get('/fixtures/events',     { fixture: fixtureId }),
      this._get('/fixtures/statistics', { fixture: fixtureId }),
    ]);
    return { events, stats };
  }

  // Returns starting lineups (called once per match when lineups are confirmed).
  async fetchLineups(fixtureId) {
    return this._get('/fixtures/lineups', { fixture: fixtureId });
  }

  // Returns group stage standings.
  async fetchStandings() {
    return this._get('/standings', { league: 1, season: 2026 });
  }
}

module.exports = ApiFootballService;
