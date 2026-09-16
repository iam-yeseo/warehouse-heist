PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS game_sessions (
  id TEXT PRIMARY KEY,
  claim_token_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  client_version TEXT NOT NULL,
  last_stage INTEGER NOT NULL DEFAULT 0 CHECK (last_stage BETWEEN 0 AND 3),
  last_stage_at TEXT,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS game_stage_clears (
  session_id TEXT NOT NULL,
  stage INTEGER NOT NULL CHECK (stage BETWEEN 1 AND 3),
  cleared_at TEXT NOT NULL,
  client_elapsed_seconds REAL NOT NULL,
  lives_remaining INTEGER NOT NULL CHECK (lives_remaining BETWEEN 0 AND 3),
  PRIMARY KEY (session_id, stage),
  FOREIGN KEY (session_id) REFERENCES game_sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reward_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  part1 TEXT NOT NULL CHECK (length(part1) = 4),
  part2 TEXT NOT NULL CHECK (length(part2) = 4),
  part3 TEXT NOT NULL CHECK (length(part3) = 4),
  session_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  created_date TEXT NOT NULL,
  created_time TEXT NOT NULL,
  valid INTEGER NOT NULL DEFAULT 1 CHECK (valid IN (0, 1)),
  sheet_sync_status TEXT NOT NULL DEFAULT 'pending' CHECK (sheet_sync_status IN ('pending', 'synced')),
  sheet_sync_attempts INTEGER NOT NULL DEFAULT 0,
  sheet_synced_at TEXT,
  sheet_sync_error TEXT,
  FOREIGN KEY (session_id) REFERENCES game_sessions(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_game_sessions_completed_at ON game_sessions(completed_at);
CREATE INDEX IF NOT EXISTS idx_reward_codes_sheet_sync_status ON reward_codes(sheet_sync_status);
