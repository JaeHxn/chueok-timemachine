-- Cloudflare D1 Database Schema for chueok-timemachine
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  year INTEGER NOT NULL,
  month INTEGER,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  author TEXT NOT NULL,
  created_at TEXT NOT NULL,
  password_hash TEXT,
  status TEXT DEFAULT 'approved',
  reports INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  target_id TEXT NOT NULL,
  year INTEGER NOT NULL,
  author TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  password_hash TEXT
);

CREATE TABLE IF NOT EXISTS reactions (
  target_id TEXT NOT NULL,
  year INTEGER NOT NULL,
  type TEXT NOT NULL,
  count INTEGER DEFAULT 0,
  PRIMARY KEY (target_id, type)
);

CREATE TABLE IF NOT EXISTS cheers (
  id TEXT PRIMARY KEY,
  name TEXT,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cheer_limits (
  key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_posts_year ON posts(year);
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
CREATE INDEX IF NOT EXISTS idx_comments_year ON comments(year);
CREATE INDEX IF NOT EXISTS idx_reactions_year ON reactions(year);
CREATE INDEX IF NOT EXISTS idx_cheers_created_at ON cheers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cheer_limits_window_start ON cheer_limits(window_start);
