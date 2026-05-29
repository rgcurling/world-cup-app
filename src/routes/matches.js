const express = require('express');
const router  = express.Router();
const {
  getAllMatches,
  getLiveMatches,
  getMatchByFixtureId,
  getAiUpdatesForMatch,
} = require('../db/queries');

// GET /api/matches -- full schedule from DB, sorted by kickoff
router.get('/', async (req, res) => {
  try {
    res.json(await getAllMatches());
  } catch (err) {
    console.error('[Route] GET /matches:', err.message);
    res.status(500).json({ error: 'Failed to fetch matches' });
  }
});

// GET /api/matches/live -- must be before /:id so "live" is not captured as a param
router.get('/live', async (req, res) => {
  try {
    res.json(await getLiveMatches());
  } catch (err) {
    console.error('[Route] GET /matches/live:', err.message);
    res.status(500).json({ error: 'Failed to fetch live matches' });
  }
});

// GET /api/matches/:id -- match record from DB (score, status, teams, broadcast_info)
router.get('/:id', async (req, res) => {
  const fixtureId = parseInt(req.params.id, 10);
  if (isNaN(fixtureId)) return res.status(400).json({ error: 'Invalid match ID' });

  try {
    const match = await getMatchByFixtureId(fixtureId);
    if (!match) return res.status(404).json({ error: 'Match not found' });
    res.json(match);
  } catch (err) {
    console.error(`[Route] GET /matches/${fixtureId}:`, err.message);
    res.status(500).json({ error: 'Failed to fetch match' });
  }
});

// GET /api/matches/:id/updates -- AI commentary feed, newest first
router.get('/:id/updates', async (req, res) => {
  const fixtureId = parseInt(req.params.id, 10);
  if (isNaN(fixtureId)) return res.status(400).json({ error: 'Invalid match ID' });

  try {
    res.json(await getAiUpdatesForMatch(fixtureId));
  } catch (err) {
    console.error(`[Route] GET /matches/${fixtureId}/updates:`, err.message);
    res.status(500).json({ error: 'Failed to fetch updates' });
  }
});

module.exports = router;
