-- Additive migration: existing pending rewards are immediately eligible for retry.
ALTER TABLE reward_codes ADD COLUMN sheet_next_attempt_at TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z';
ALTER TABLE reward_codes ADD COLUMN sheet_sync_lease_token TEXT;
ALTER TABLE reward_codes ADD COLUMN sheet_sync_lease_until TEXT;
CREATE INDEX idx_reward_codes_retry ON reward_codes(sheet_sync_status, sheet_next_attempt_at, id);
CREATE INDEX idx_game_sessions_abandoned ON game_sessions(created_at) WHERE completed_at IS NULL;
