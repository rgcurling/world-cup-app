/* global __API_URL__ */
const BASE = typeof __API_URL__ !== 'undefined' ? __API_URL__ : '';

async function req(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export const fetchMatches      = ()         => req('/api/matches');
export const fetchLiveMatches  = ()         => req('/api/matches/live');
export const fetchMatch        = (id)       => req(`/api/match/${id}`);
export const fetchPlayerRatings = (id)      => req(`/api/match/${id}/players`);
export const fetchStandings    = ()         => req('/api/standings');
export const fetchTopScorers   = ()         => req('/api/topscorers');
export const fetchVenues       = (lat, lng) => req(`/api/venues?lat=${lat}&lng=${lng}`);
