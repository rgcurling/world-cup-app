async function req(path, options) {
  const res = await fetch(path, options);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export const fetchMatches    = ()          => req('/api/matches');
export const fetchLiveMatches = ()         => req('/api/matches/live');
export const fetchMatch      = (id)        => req(`/api/matches/${id}`);
export const fetchUpdates    = (id)        => req(`/api/matches/${id}/updates`);
export const fetchStandings  = ()          => req('/api/standings');
export const fetchVapidKey   = ()          => req('/api/vapid-public-key');

export const fetchVenues = (matchId, lat, lng) =>
  req(`/api/venues?matchId=${matchId}&lat=${lat}&lng=${lng}`);

export const saveSubscription = (sub) =>
  req('/api/subscribe', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ endpoint: sub.endpoint, keys: sub.toJSON().keys }),
  });

export const removeSubscription = (endpoint) =>
  req('/api/subscribe', {
    method:  'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ endpoint }),
  });
