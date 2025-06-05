CREATE TABLE IF NOT EXISTS ai_chat_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  tool_calls TEXT,
  _ps_version INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_ai_chat_log_user_id ON ai_chat_log(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_log_updated_at ON ai_chat_log(updated_at);