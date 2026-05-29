-- KickoffAI database schema

CREATE TABLE IF NOT EXISTS subscriptions (
  id          SERIAL PRIMARY KEY,
  endpoint    TEXT UNIQUE NOT NULL,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS matches (
  id              SERIAL PRIMARY KEY,
  fixture_id      INTEGER UNIQUE NOT NULL,
  home_team       TEXT NOT NULL,
  away_team       TEXT NOT NULL,
  home_score      INTEGER,
  away_score      INTEGER,
  status          TEXT NOT NULL DEFAULT 'scheduled',
  kickoff_utc     TIMESTAMPTZ NOT NULL,
  venue           TEXT,
  city            TEXT,
  round           TEXT,
  group_name      TEXT,
  home_logo_url   TEXT,
  away_logo_url   TEXT,
  broadcast_info  JSONB NOT NULL DEFAULT '{}',
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_matches_kickoff    ON matches (kickoff_utc);
CREATE INDEX IF NOT EXISTS idx_matches_status     ON matches (status);
CREATE INDEX IF NOT EXISTS idx_matches_fixture_id ON matches (fixture_id);

CREATE TABLE IF NOT EXISTS ai_updates (
  id          SERIAL PRIMARY KEY,
  fixture_id  INTEGER NOT NULL REFERENCES matches (fixture_id) ON DELETE CASCADE,
  minute      INTEGER,
  summary     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_updates_fixture_id ON ai_updates (fixture_id);

-- Venues are keyed on (fixture_id, lat_grid, lng_grid) so the same bar can be
-- cached for different location buckets without duplication.
CREATE TABLE IF NOT EXISTS venues (
  id           SERIAL PRIMARY KEY,
  fixture_id   INTEGER NOT NULL REFERENCES matches (fixture_id) ON DELETE CASCADE,
  place_id     TEXT NOT NULL,
  name         TEXT NOT NULL,
  address      TEXT,
  rating       NUMERIC(2,1),
  lat          NUMERIC(10,7),
  lng          NUMERIC(10,7),
  distance_km  NUMERIC(6,3),
  maps_url     TEXT,
  photo_url    TEXT,
  cached_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (fixture_id, place_id)
);

CREATE INDEX IF NOT EXISTS idx_venues_fixture_id ON venues (fixture_id);
