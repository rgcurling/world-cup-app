const express = require('express');
const router  = express.Router();
const ApiFootballService = require('../services/apiFootball');

const api = new ApiFootballService();

// In-memory cache -- standings only change when a match finishes, so a
// 10-minute TTL is more than fresh enough and costs zero extra API requests.
let cache = { data: null, at: 0 };
const TTL_MS = 10 * 60 * 1000;

// GET /api/standings
router.get('/', async (req, res) => {
  try {
    if (cache.data && Date.now() - cache.at < TTL_MS) {
      return res.json(cache.data);
    }

    const standings = await api.fetchStandings();
    cache = { data: standings, at: Date.now() };
    res.json(standings);
  } catch (err) {
    console.error('[Route] GET /standings:', err.message);
    if (cache.data) return res.json(cache.data); // serve stale rather than error
    res.status(500).json({ error: 'Failed to fetch standings' });
  }
});

module.exports = router;
