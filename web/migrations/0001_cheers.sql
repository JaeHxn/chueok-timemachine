CREATE TABLE IF NOT EXISTS cheers (
  id TEXT PRIMARY KEY,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS cheers_created_at ON cheers(created_at DESC);
CREATE TABLE IF NOT EXISTS cheer_limits (
  key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS cheer_limits_window_start ON cheer_limits(window_start);
