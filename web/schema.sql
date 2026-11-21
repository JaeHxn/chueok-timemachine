-- Cloudflare D1 Database Schema for chueok-timemachine
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  year INTEGER NOT NULL,
  month INTEGER,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  author TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  target_id TEXT NOT NULL,
  year INTEGER NOT NULL,
  author TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
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

CREATE INDEX IF NOT EXISTS idx_posts_year ON posts(year);
CREATE INDEX IF NOT EXISTS idx_comments_year ON comments(year);
CREATE INDEX IF NOT EXISTS idx_reactions_year ON reactions(year);
