-- Echo Module Schema
-- Stores a log of all echoed messages

CREATE TABLE IF NOT EXISTS echo_log (
    id TEXT PRIMARY KEY,
    text TEXT NOT NULL,
    ts INTEGER NOT NULL
);

-- Index for timestamp queries
CREATE INDEX IF NOT EXISTS idx_echo_ts ON echo_log(ts);