require('dotenv').config();
const express         = require('express');
const cors            = require('cors');
const path            = require('path');
const FootballService = require('./services/football');
const ClaudeService   = require('./services/claude');
const PlacesService   = require('./services/places');

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const football = new FootballService();
const claude   = new ClaudeService();
const places   = new PlacesService();

// ---------------------------------------------------------------------------
// Cache factory
// ---------------------------------------------------------------------------
function makeCache(ttlMs) {
  const store = new Map();
  return {
    get(key) {
      const e = store.get(key);
      return e && Date.now() - e.ts < ttlMs ? e.data : null;
    },
    set(key, data) { store.set(key, { data, ts: Date.now() }); },
  };
}

const scheduleCache  = makeCache(5  * 60 * 1000); // 5 min
const liveCache      = makeCache(60 * 1000);       // 60 sec
const matchCache     = makeCache(60 * 1000);       // 60 sec -- also prevents double Claude calls
const standingsCache = makeCache(5  * 60 * 1000); // 5 min

// ---------------------------------------------------------------------------
// GET /api/matches -- full WC schedule, grouped by date on the frontend
// ---------------------------------------------------------------------------
app.get('/api/matches', async (req, res) => {
  try {
    const cached = scheduleCache.get('all');
    if (cached) return res.json(cached);

    const raw     = await football.getSchedule();
    const matches = raw.map((item) => football.normalizeFixture(item));
    scheduleCache.set('all', matches);
    res.json(matches);
  } catch (err) {
    console.error('[/api/matches]', err.message);
    res.status(500).json({ error: 'Failed to fetch matches' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/matches/live -- currently live matches only
// ---------------------------------------------------------------------------
app.get('/api/matches/live', async (req, res) => {
  try {
    const cached = liveCache.get('live');
    if (cached) return res.json(cached);

    const raw     = await football.getLiveMatches();
    const matches = raw.map((item) => football.normalizeFixture(item));
    liveCache.set('live', matches);
    res.json(matches);
  } catch (err) {
    console.error('[/api/matches/live]', err.message);
    res.status(500).json({ error: 'Failed to fetch live matches' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/match/:id -- full match detail + AI analysis
// Claude is only called once per 60-second cache window per match.
// ---------------------------------------------------------------------------
app.get('/api/match/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid match ID' });

  try {
    const cached = matchCache.get(id);
    if (cached) return res.json(cached);

    const [fixtureArr, events, lineups, stats] = await Promise.all([
      football.getMatch(id),
      football.getEvents(id),
      football.getLineups(id),
      football.getStats(id),
    ]);

    if (!fixtureArr.length) return res.status(404).json({ error: 'Match not found' });

    const match = football.normalizeFixture(fixtureArr[0]);

    let analysis = null;
    if (match.status === 'live' || match.status === 'finished') {
      try {
        analysis = await claude.analyzeMatch(match, events, stats);
      } catch (e) {
        console.error('[Claude]', e.message);
        // non-fatal -- return match data without analysis
      }
    }

    const result = { match, events, lineups, stats, analysis };
    matchCache.set(id, result);
    res.json(result);
  } catch (err) {
    console.error(`[/api/match/${id}]`, err.message);
    res.status(500).json({ error: 'Failed to fetch match detail' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/venues?lat=&lng=
// ---------------------------------------------------------------------------
app.get('/api/venues', async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);

  if (isNaN(lat) || isNaN(lng)) {
    return res.status(400).json({ error: 'lat and lng query params are required' });
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.status(400).json({ error: 'lat or lng out of valid range' });
  }

  try {
    res.json(await places.getNearbyBars(lat, lng));
  } catch (err) {
    console.error('[/api/venues]', err.message);
    res.status(500).json({ error: 'Failed to fetch venues' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/standings
// ---------------------------------------------------------------------------
app.get('/api/standings', async (req, res) => {
  try {
    const cached = standingsCache.get('standings');
    if (cached) return res.json(cached);

    const standings = await football.getStandings();
    standingsCache.set('standings', standings);
    res.json(standings);
  } catch (err) {
    console.error('[/api/standings]', err.message);
    res.status(500).json({ error: 'Failed to fetch standings' });
  }
});

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------
app.get('/health', (_req, res) =>
  res.json({ status: 'ok', ts: new Date().toISOString() }),
);

// Temporary debug -- shows raw api-football response to diagnose empty fixtures
app.get('/api/debug', async (req, res) => {
  try {
    const axios  = require('axios');
    const league = req.query.league || 1;
    const season = req.query.season || 2026;
    const result = await axios.get('https://v3.football.api-sports.io/fixtures', {
      params:  { league, season },
      headers: { 'x-apisports-key': process.env.API_SPORTS_KEY },
      timeout: 10000,
    });
    res.json({
      errors:  result.data.errors,
      results: result.data.results,
      paging:  result.data.paging,
      sample:  result.data.response?.slice(0, 2),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve React PWA in production
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`[Server] KickoffAI running on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
});

module.exports = app;
