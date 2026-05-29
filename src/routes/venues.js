const express = require('express');
const router  = express.Router();
const GooglePlacesService = require('../services/googlePlaces');

const places = new GooglePlacesService();

// GET /api/venues?lat=&lng=&matchId=
router.get('/', async (req, res) => {
  const { lat, lng, matchId } = req.query;

  const latNum     = parseFloat(lat);
  const lngNum     = parseFloat(lng);
  const fixtureId  = parseInt(matchId, 10);

  if (isNaN(latNum) || isNaN(lngNum)) {
    return res.status(400).json({ error: 'lat and lng query params are required' });
  }
  if (isNaN(fixtureId)) {
    return res.status(400).json({ error: 'matchId query param is required' });
  }
  if (latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
    return res.status(400).json({ error: 'lat or lng out of valid range' });
  }

  try {
    const venues = await places.getNearbyBars(fixtureId, latNum, lngNum);
    res.json(venues);
  } catch (err) {
    console.error('[Route] GET /venues:', err.message);
    res.status(500).json({ error: 'Failed to fetch nearby venues' });
  }
});

module.exports = router;
