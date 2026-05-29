const pool = require('./connection');

// ---------------------------------------------------------------------------
// Matches
// ---------------------------------------------------------------------------

async function upsertMatch(match) {
  const {
    fixture_id, home_team, away_team, home_score, away_score,
    status, kickoff_utc, venue, city, round, group_name,
    home_logo_url, away_logo_url, broadcast_info = {},
  } = match;

  const { rows } = await pool.query(
    `INSERT INTO matches
       (fixture_id, home_team, away_team, home_score, away_score,
        status, kickoff_utc, venue, city, round, group_name,
        home_logo_url, away_logo_url, broadcast_info, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW())
     ON CONFLICT (fixture_id) DO UPDATE SET
       home_score    = EXCLUDED.home_score,
       away_score    = EXCLUDED.away_score,
       status        = EXCLUDED.status,
       home_logo_url = EXCLUDED.home_logo_url,
       away_logo_url = EXCLUDED.away_logo_url,
       broadcast_info = EXCLUDED.broadcast_info,
       updated_at    = NOW()
     RETURNING *`,
    [fixture_id, home_team, away_team, home_score, away_score,
     status, kickoff_utc, venue, city, round, group_name,
     home_logo_url, away_logo_url, JSON.stringify(broadcast_info)],
  );
  return rows[0];
}

async function getAllMatches() {
  const { rows } = await pool.query(
    `SELECT * FROM matches ORDER BY kickoff_utc ASC`,
  );
  return rows;
}

async function getLiveMatches() {
  const { rows } = await pool.query(
    `SELECT * FROM matches WHERE status = 'live' ORDER BY kickoff_utc ASC`,
  );
  return rows;
}

async function getMatchByFixtureId(fixtureId) {
  const { rows } = await pool.query(
    `SELECT * FROM matches WHERE fixture_id = $1`,
    [fixtureId],
  );
  return rows[0] || null;
}

// ---------------------------------------------------------------------------
// AI updates
// ---------------------------------------------------------------------------

async function insertAiUpdate({ fixture_id, minute, summary }) {
  const { rows } = await pool.query(
    `INSERT INTO ai_updates (fixture_id, minute, summary)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [fixture_id, minute, summary],
  );
  return rows[0];
}

async function getAiUpdatesForMatch(fixtureId) {
  const { rows } = await pool.query(
    `SELECT * FROM ai_updates WHERE fixture_id = $1 ORDER BY created_at DESC`,
    [fixtureId],
  );
  return rows;
}

// Returns the most recent ai_update for a fixture, or null.
async function getLastAiUpdate(fixtureId) {
  const { rows } = await pool.query(
    `SELECT * FROM ai_updates
     WHERE fixture_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [fixtureId],
  );
  return rows[0] || null;
}

// ---------------------------------------------------------------------------
// Venues
// ---------------------------------------------------------------------------

async function upsertVenues(fixtureId, venueRows) {
  const results = [];
  for (const v of venueRows) {
    const { rows } = await pool.query(
      `INSERT INTO venues
         (fixture_id, place_id, name, address, rating, lat, lng,
          distance_km, maps_url, photo_url, cached_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
       ON CONFLICT (fixture_id, place_id) DO UPDATE SET
         rating      = EXCLUDED.rating,
         distance_km = EXCLUDED.distance_km,
         cached_at   = NOW()
       RETURNING *`,
      [fixtureId, v.place_id, v.name, v.address, v.rating,
       v.lat, v.lng, v.distance_km, v.maps_url, v.photo_url],
    );
    results.push(rows[0]);
  }
  return results;
}

async function getCachedVenues(fixtureId, maxAgeMinutes = 60) {
  const { rows } = await pool.query(
    `SELECT * FROM venues
     WHERE fixture_id = $1
       AND cached_at > NOW() - ($2 || ' minutes')::INTERVAL
     ORDER BY distance_km ASC`,
    [fixtureId, maxAgeMinutes],
  );
  return rows;
}

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------

async function upsertSubscription({ endpoint, p256dh, auth }) {
  const { rows } = await pool.query(
    `INSERT INTO subscriptions (endpoint, p256dh, auth)
     VALUES ($1, $2, $3)
     ON CONFLICT (endpoint) DO UPDATE SET
       p256dh = EXCLUDED.p256dh,
       auth   = EXCLUDED.auth
     RETURNING *`,
    [endpoint, p256dh, auth],
  );
  return rows[0];
}

async function deleteSubscription(endpoint) {
  await pool.query(
    `DELETE FROM subscriptions WHERE endpoint = $1`,
    [endpoint],
  );
}

async function getAllSubscriptions() {
  const { rows } = await pool.query(`SELECT * FROM subscriptions`);
  return rows;
}

module.exports = {
  upsertMatch,
  getAllMatches,
  getLiveMatches,
  getMatchByFixtureId,
  insertAiUpdate,
  getAiUpdatesForMatch,
  getLastAiUpdate,
  upsertVenues,
  getCachedVenues,
  upsertSubscription,
  deleteSubscription,
  getAllSubscriptions,
};
