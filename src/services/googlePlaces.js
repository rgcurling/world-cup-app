require('dotenv').config();
const axios = require('axios');
const { getCachedVenues, upsertVenues } = require('../db/queries');

// If the nearest cached bar is within this many km of the user, treat the
// cached results as relevant (same metro area). Beyond this we fetch fresh.
const CACHE_RELEVANCE_KM = 20;

class GooglePlacesService {
  constructor() {
    this.apiKey = process.env.GOOGLE_PLACES_API_KEY;
    this.client = axios.create({
      baseURL: 'https://maps.googleapis.com/maps/api',
      timeout: 8000,
    });
  }

  // Haversine distance in km between two lat/lng points.
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

  _photoUrl(photoRef) {
    if (!photoRef) return null;
    return (
      `https://maps.googleapis.com/maps/api/place/photo` +
      `?maxwidth=400&photo_reference=${photoRef}&key=${this.apiKey}`
    );
  }

  _mapsUrl(placeId) {
    return `https://www.google.com/maps/place/?q=place_id:${placeId}`;
  }

  _normalize(place, userLat, userLng) {
    const { lat, lng } = place.geometry.location;
    return {
      place_id:    place.place_id,
      name:        place.name,
      address:     place.vicinity         ?? null,
      rating:      place.rating           ?? null,
      lat,
      lng,
      distance_km: Math.round(this._distanceKm(userLat, userLng, lat, lng) * 100) / 100,
      maps_url:    this._mapsUrl(place.place_id),
      photo_url:   this._photoUrl(place.photos?.[0]?.photo_reference ?? null),
      open_now:    place.opening_hours?.open_now ?? null,
    };
  }

  // Returns true when the nearest cached bar is within CACHE_RELEVANCE_KM of
  // the user -- i.e. the cached results are for the same metro area.
  _isCacheRelevant(cachedVenues, userLat, userLng) {
    if (!cachedVenues.length) return false;
    const nearest = cachedVenues.reduce((best, v) => {
      const d = this._distanceKm(userLat, userLng, Number(v.lat), Number(v.lng));
      return d < best.d ? { d, v } : best;
    }, { d: Infinity, v: null });
    return nearest.d < CACHE_RELEVANCE_KM;
  }

  // Fetches nearby sports bars for a given match and user location.
  // Returns up to `limit` results sorted by distance.
  // Caches results per fixture per metro area (60-minute TTL).
  async getNearbyBars(fixtureId, lat, lng, { limit = 8, radius = 2000 } = {}) {
    const cached = await getCachedVenues(fixtureId, 60);
    if (this._isCacheRelevant(cached, lat, lng)) {
      console.log(`[GooglePlaces] Cache hit for fixture ${fixtureId} near ${lat},${lng}.`);
      return cached.slice(0, limit);
    }

    const res = await this.client.get('/place/nearbysearch/json', {
      params: {
        location: `${lat},${lng}`,
        radius,
        keyword: 'sports bar',
        type:    'bar',
        key:     this.apiKey,
      },
    });

    const { status, error_message, results = [] } = res.data;

    if (status !== 'OK' && status !== 'ZERO_RESULTS') {
      throw new Error(`Google Places error: ${status}${error_message ? ' - ' + error_message : ''}`);
    }

    const venues = results
      .slice(0, limit)
      .map((p) => this._normalize(p, lat, lng))
      .sort((a, b) => a.distance_km - b.distance_km);

    if (venues.length) {
      await upsertVenues(fixtureId, venues);
      console.log(`[GooglePlaces] Cached ${venues.length} venues for fixture ${fixtureId}.`);
    }

    return venues;
  }
}

module.exports = GooglePlacesService;
