require('dotenv').config();
const axios = require('axios');

const cache   = new Map();
const TTL_MS  = 10 * 60 * 1000; // 10 minutes

function getCached(key) {
  const entry = cache.get(key);
  return entry && Date.now() - entry.ts < TTL_MS ? entry.data : null;
}
function setCached(key, data) { cache.set(key, { data, ts: Date.now() }); }

class PlacesService {
  constructor() {
    this.apiKey = process.env.GOOGLE_PLACES_API_KEY;
    this.client = axios.create({
      baseURL: 'https://maps.googleapis.com/maps/api',
      timeout: 8000,
    });
  }

  // Round to ~1km grid for cache key
  _gridKey(lat, lng) {
    return `${Math.round(lat * 10) / 10},${Math.round(lng * 10) / 10}`;
  }

  _distanceKm(lat1, lng1, lat2, lng2) {
    const R    = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a    =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  _normalize(place, userLat, userLng) {
    const { lat, lng } = place.geometry.location;
    return {
      place_id:    place.place_id,
      name:        place.name,
      address:     place.vicinity                       ?? null,
      rating:      place.rating                         ?? null,
      lat,
      lng,
      distance_km: Math.round(this._distanceKm(userLat, userLng, lat, lng) * 100) / 100,
      maps_url:    `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
      photo_url:   place.photos?.[0]?.photo_reference
        ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${place.photos[0].photo_reference}&key=${this.apiKey}`
        : null,
      open_now:    place.opening_hours?.open_now ?? null,
    };
  }

  async getNearbyBars(lat, lng) {
    const key    = this._gridKey(lat, lng);
    const cached = getCached(key);
    if (cached) return cached;

    const res = await this.client.get('/place/nearbysearch/json', {
      params: {
        location: `${lat},${lng}`,
        radius:   2000,
        keyword:  'sports bar',
        type:     'bar',
        key:      this.apiKey,
      },
    });

    const { status, error_message, results = [] } = res.data;
    if (status !== 'OK' && status !== 'ZERO_RESULTS') {
      throw new Error(`Places API: ${status}${error_message ? ' - ' + error_message : ''}`);
    }

    const venues = results
      .slice(0, 6)
      .map((p) => this._normalize(p, lat, lng))
      .sort((a, b) => a.distance_km - b.distance_km);

    setCached(key, venues);
    return venues;
  }
}

module.exports = PlacesService;
