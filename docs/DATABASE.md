# GHOST Database Schema & Operations

## Overview

GHOST uses SQLite with transparent encryption via `better-sqlite3-multiple-ciphers`. All data is encrypted at rest using AES-256-CBC with keys derived from the user's master password.

## Database Architecture

### Encryption Layer

```typescript
// Database initialization with encryption
const db = new Database(DB_PATH);
db.pragma(`cipher='aes256cbc'`);
db.pragma(`key="x'${keyHex}'"`);
db.pragma('journal_mode = WAL');
```

**Key Features:**
- **Cipher**: AES-256-CBC
- **Key Size**: 256 bits 
- **Page Size**: 4096 bytes (default)
- **Journal Mode**: Write-Ahead Logging (WAL)
- **Encoding**: UTF-8

### File Structure

```
~/Library/Application Support/ghost/
├── ghost.db          # Main encrypted database
├── ghost.db-wal      # Write-ahead log
├── ghost.db-shm      # Shared memory file
└── ghost.salt        # Salt for key derivation
```

## Core Schema

### System Tables

```sql
-- System configuration and metadata
CREATE TABLE IF NOT EXISTS system_info (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Application version tracking
INSERT INTO system_info (key, value) VALUES 
  ('schema_version', '1'),
  ('app_version', '1.0.0');
```

### Chat Messages

```sql
-- Main chat history table
CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,                    -- UUID v4
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,                  -- Message content
  timestamp INTEGER NOT NULL,             -- Unix timestamp (ms)
  metadata TEXT,                          -- JSON metadata
  parent_id TEXT,                         -- For conversation threading
  FOREIGN KEY (parent_id) REFERENCES chat_messages(id)
);

-- Indexes for performance
CREATE INDEX idx_messages_timestamp ON chat_messages(timestamp);
CREATE INDEX idx_messages_role ON chat_messages(role);
CREATE INDEX idx_messages_parent ON chat_messages(parent_id);
```

### Plugin Registry

```sql
-- Installed plugins and their state
CREATE TABLE IF NOT EXISTS plugins (
  id TEXT PRIMARY KEY,                    -- Plugin identifier
  name TEXT NOT NULL,                     -- Display name
  version TEXT NOT NULL,                  -- Semantic version
  enabled INTEGER DEFAULT 1,              -- 0=disabled, 1=enabled
  config TEXT,                           -- JSON configuration
  installed_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Plugin-specific schemas are created by each plugin
```

## Plugin Schemas

### Echo Plugin Example

```sql
-- Echo plugin (built-in example)
CREATE TABLE IF NOT EXISTS echo_log (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  ts INTEGER NOT NULL
);

CREATE INDEX idx_echo_ts ON echo_log(ts);
```

### Note Taker Plugin Example

```sql
-- Notes storage
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT,                              -- JSON array of tags
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now')),
  deleted_at INTEGER                      -- Soft delete
);

-- Full-text search
CREATE VIRTUAL TABLE notes_fts USING fts5(
  title, 
  content, 
  tags,
  content=notes
);

-- Trigger to keep FTS in sync
CREATE TRIGGER notes_ai AFTER INSERT ON notes BEGIN
  INSERT INTO notes_fts(rowid, title, content, tags)
  VALUES (new.rowid, new.title, new.content, new.tags);
END;
```

## Database Operations

### Connection Management

```typescript
// Opening encrypted database
export async function openEncryptedDB(passphrase: string): Promise<Database> {
  await sodium.ready;
  
  const salt = await loadOrGenerateSalt();
  const key = deriveKey(passphrase, salt);
  
  const db = new Database(DB_PATH);
  configureEncryption(db, key);
  
  return db;
}

// Safe closure with cleanup
export function lockDB(): void {
  if (db) {
    db.close();
    sodium.memzero(keyBuffer);
  }
}
```

### Transaction Patterns

```typescript
// Single operation
const insertMessage = db.prepare(`
  INSERT INTO chat_messages (id, role, content, timestamp)
  VALUES (?, ?, ?, ?)
`);

// Transaction for multiple operations
const transaction = db.transaction((messages) => {
  for (const msg of messages) {
    insertMessage.run(msg.id, msg.role, msg.content, msg.timestamp);
  }
});

// Execute transaction
transaction(messages);
```

### Query Patterns

```typescript
// Prepared statements for performance
const queries = {
  getMessages: db.prepare(`
    SELECT * FROM chat_messages 
    WHERE timestamp > ? 
    ORDER BY timestamp ASC
    LIMIT ?
  `),
  
  searchMessages: db.prepare(`
    SELECT * FROM chat_messages 
    WHERE content LIKE ? 
    ORDER BY timestamp DESC
  `),
  
  getMessageThread: db.prepare(`
    WITH RECURSIVE thread AS (
      SELECT * FROM chat_messages WHERE id = ?
      UNION ALL
      SELECT m.* FROM chat_messages m
      JOIN thread t ON m.parent_id = t.id
    )
    SELECT * FROM thread
  `)
};

// Usage
const recentMessages = queries.getMessages.all(timestamp, limit);
const searchResults = queries.searchMessages.all(`%${query}%`);
```

## Best Practices

### 1. Always Use Prepared Statements

```typescript
// Bad: SQL injection risk
db.exec(`INSERT INTO messages VALUES ('${id}', '${content}')`);

// Good: Safe parameterized query
const stmt = db.prepare('INSERT INTO messages VALUES (?, ?)');
stmt.run(id, content);
```

### 2. Handle JSON Data Properly

```typescript
// Storing JSON
const metadata = { tags: ['important'], source: 'web' };
stmt.run(id, JSON.stringify(metadata));

// Retrieving JSON
const row = db.prepare('SELECT metadata FROM messages WHERE id = ?').get(id);
const metadata = JSON.parse(row.metadata);
```

### 3. Use Transactions for Bulk Operations

```typescript
// Bad: Individual inserts (slow)
for (const item of items) {
  db.prepare('INSERT INTO items VALUES (?, ?)').run(item.id, item.data);
}

// Good: Transactional bulk insert (fast)
const insert = db.prepare('INSERT INTO items VALUES (?, ?)');
const insertMany = db.transaction((items) => {
  for (const item of items) {
    insert.run(item.id, item.data);
  }
});
insertMany(items);
```

### 4. Implement Soft Deletes

```sql
-- Add deleted_at column
ALTER TABLE messages ADD COLUMN deleted_at INTEGER;

-- Soft delete
UPDATE messages SET deleted_at = strftime('%s', 'now') WHERE id = ?;

-- Query only active records
SELECT * FROM messages WHERE deleted_at IS NULL;
```

### 5. Optimize with Indexes

```sql
-- Create indexes for frequent queries
CREATE INDEX idx_messages_user_time ON messages(user_id, timestamp);

-- Use EXPLAIN QUERY PLAN to verify index usage
EXPLAIN QUERY PLAN 
SELECT * FROM messages WHERE user_id = ? ORDER BY timestamp DESC;
```

## Migration Strategy

### Schema Versioning

```typescript
// Check current schema version
const getSchemaVersion = (): number => {
  const row = db.prepare('SELECT value FROM system_info WHERE key = ?')
    .get('schema_version');
  return parseInt(row?.value || '0');
};

// Apply migrations
const migrations = [
  // Version 1
  () => {
    db.exec(`CREATE TABLE IF NOT EXISTS users (...)`);
  },
  // Version 2
  () => {
    db.exec(`ALTER TABLE messages ADD COLUMN edited_at INTEGER`);
  }
];

const migrate = () => {
  const currentVersion = getSchemaVersion();
  
  for (let i = currentVersion; i < migrations.length; i++) {
    db.transaction(() => {
      migrations[i]();
      db.prepare('UPDATE system_info SET value = ? WHERE key = ?')
        .run(i + 1, 'schema_version');
    })();
  }
};
```

## Backup & Recovery

### Export Decrypted Backup

```typescript
export async function exportBackup(password: string, outputPath: string) {
  // Verify password
  const db = await openEncryptedDB(password);
  
  // Create unencrypted backup
  const backupDb = new Database(outputPath);
  db.backup(backupDb);
  backupDb.close();
  
  // Re-encrypt backup with different password if needed
  const reEncryptedDb = new Database(outputPath);
  reEncryptedDb.pragma(`cipher='aes256cbc'`);
  reEncryptedDb.pragma(`key="x'${newKeyHex}'"`);
  reEncryptedDb.close();
}
```

### Import Backup

```typescript
export async function importBackup(backupPath: string, password: string) {
  // Open backup with its password
  const backupDb = new Database(backupPath);
  backupDb.pragma(`cipher='aes256cbc'`);
  backupDb.pragma(`key="x'${keyHex}'"`);
  
  // Restore to main database
  const mainDb = await openEncryptedDB(password);
  backupDb.backup(mainDb);
  
  backupDb.close();
  mainDb.close();
}
```

## Performance Optimization

### 1. Connection Settings

```sql
-- Optimize for desktop usage
PRAGMA cache_size = -64000;       -- 64MB cache
PRAGMA temp_store = MEMORY;       -- Temp tables in memory
PRAGMA mmap_size = 268435456;     -- 256MB memory map
PRAGMA synchronous = NORMAL;      -- Balance safety/speed
```

### 2. Vacuum Periodically

```typescript
// Maintenance task
export function performMaintenance() {
  db.exec('VACUUM');                    // Rebuild database
  db.exec('ANALYZE');                   // Update statistics
  db.exec('PRAGMA optimize');           // Query planner optimization
}
```

### 3. Monitor Performance

```typescript
// Query timing
const start = Date.now();
const results = stmt.all();
const duration = Date.now() - start;
logger.debug(`Query took ${duration}ms`);

// Database statistics
const stats = db.prepare('SELECT * FROM sqlite_stat1').all();
```

## Security Considerations

1. **Never log sensitive data**
   ```typescript
   // Bad
   logger.info(`Inserting message: ${content}`);
   
   // Good
   logger.info(`Inserting message with length: ${content.length}`);
   ```

2. **Validate all inputs**
   ```typescript
   if (!isValidUUID(id)) {
     throw new Error('Invalid message ID');
   }
   ```

3. **Use parameterized queries exclusively**
   ```typescript
   // Never use string concatenation for SQL
   const stmt = db.prepare('SELECT * FROM messages WHERE id = ?');
   ```

4. **Clear sensitive data from memory**
   ```typescript
   // After use
   sodium.memzero(sensitiveBuffer);
   ```

## Future Enhancements

1. **Database Sharding** - Split large databases
2. **Replication** - Read replicas for performance
3. **Change Data Capture** - Track all modifications
4. **Time-Series Storage** - Optimize for temporal data
5. **Graph Relationships** - Add graph database features