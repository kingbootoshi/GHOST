-- Echo Module Schema
-- Stores a log of all echoed messages

CREATE TABLE IF NOT EXISTS echo_log (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    text TEXT NOT NULL,
    _ps_version INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL,
    deleted INTEGER NOT NULL DEFAULT 0
);

-- Indices required by PowerSync
CREATE INDEX IF NOT EXISTS idx_echo_log_user_id ON echo_log(user_id);
CREATE INDEX IF NOT EXISTS idx_echo_log_updated_at ON echo_log(updated_at);
CREATE INDEX IF NOT EXISTS idx_echo_log_deleted ON echo_log(deleted);