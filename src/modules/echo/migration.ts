/**
 * @file migration.ts
 * @description Forward-only schema migration for the Echo module. Ensures the
 *              existing `echo_log` table – potentially created by legacy
 *              versions of the application – contains every canonical column
 *              required by the current PowerSync-aware implementation. The
 *              migration is intentionally lightweight: it runs exactly once at
 *              startup *before* `defineTable()` attempts to create indices on
 *              the canonical columns. Running in this order prevents the
 *              `SQLITE_ERROR` observed during the unlock flow when the column
 *              `user_id` is missing.
 */

import type { Database as BetterSqlite3Database } from 'better-sqlite3-multiple-ciphers';
import { Logger } from '../../main/utils/logger';

const log = new Logger('echo:migration');

/**
 * Structured result object returned by {@link ensureEchoLogSchema}.
 */
export interface MigrationResult {
  /** Indicates whether the migration executed any DDL statements. */
  migrated: boolean;
  /** Human-readable list of columns that were added during the run. */
  details: string[];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Performs an in-place schema upgrade of the `echo_log` table, adding any
 * canonical PowerSync columns that are missing. The operation is idempotent and
 * encapsulated within a single transaction.
 *
 * Why we don't use `CREATE TABLE IF NOT EXISTS ...` here:
 *   – The table already exists on legacy installations, therefore the `CREATE`
 *     statement executed later by `defineTable()` is a no-op. However, the
 *     *index* statements inside `defineTable()` will still run and expect the
 *     canonical columns to be present. By ensuring the columns exist *first*
 *     we avoid runtime errors during index creation.
 *
 * @param db   A handle to the opened, decrypted Better-SQLite3 database.
 * @returns    {@link MigrationResult} describing the outcome of the run.
 */
export function ensureEchoLogSchema(db: BetterSqlite3Database): MigrationResult {
  // Guard: do nothing for fresh installs where the table doesn't yet exist.
  const tableInfo = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'echo_log'"
    )
    .get() as { name?: string } | undefined;

  if (!tableInfo?.name) {
    log.debug('`echo_log` table absent – no migration necessary');
    return { migrated: false, details: [] };
  }

  // -------------------------------------------------------------------------
  // Inspect current schema
  // -------------------------------------------------------------------------
  const columnRows = db.prepare('PRAGMA table_info(echo_log)').all() as Array<{
    name: string;
  }>;
  const existingColumns = new Set(columnRows.map((c) => c.name));
  log.debug('Existing columns in `echo_log`:', Array.from(existingColumns).join(', '));

  // Canonical columns the table *must* have for PowerSync to function.
  const requiredColumns: Record<string, string> = {
    // Note: SQLite (especially older versions) prohibits non-constant DEFAULT
    // expressions when adding a column via ALTER TABLE. Therefore we stick to
    // *constant* defaults here and run a manual UPDATE afterwards to
    // back-fill reasonable values.
    user_id: "TEXT NOT NULL DEFAULT 'legacy-user'",
    _ps_version: 'INTEGER NOT NULL DEFAULT 0',
    updated_at: 'INTEGER NOT NULL DEFAULT 0',
    deleted: 'INTEGER NOT NULL DEFAULT 0',
  };

  const added: string[] = [];

  // Flag for whether we need to rebuild the table to remove the legacy `ts`
  // column which is no longer part of the canonical schema.  We *could* keep
  // the column but that introduces unnecessary branching and potential future
  // bugs.  A one-time rebuild guarantees a clean schema going forward.
  const hasLegacyTs = existingColumns.has('ts');

  // -------------------------------------------------------------------------
  // Execute migration inside a single transaction for atomicity.
  // -------------------------------------------------------------------------
  const migrate = db.transaction(() => {
    for (const [column, ddl] of Object.entries(requiredColumns)) {
      if (existingColumns.has(column)) continue;

      const sql = `ALTER TABLE echo_log ADD COLUMN ${column} ${ddl};`;
      log.debug('Applying DDL:', sql);
      db.exec(sql);
      added.push(column);
    }

    // -------------------------------------------------------------------
    // Back-fill newly added columns so they comply with NOT NULL constraints
    // and future index creation.
    // -------------------------------------------------------------------
    if (added.includes('user_id')) {
      db.exec("UPDATE echo_log SET user_id = 'legacy-user' WHERE user_id IS NULL OR user_id = '';" );
    }
    if (added.includes('_ps_version')) {
      db.exec('UPDATE echo_log SET _ps_version = 0 WHERE _ps_version IS NULL;');
    }
    if (added.includes('updated_at')) {
      db.exec("UPDATE echo_log SET updated_at = strftime('%s','now') WHERE updated_at IS NULL OR updated_at = 0;");
    }
    if (added.includes('deleted')) {
      db.exec('UPDATE echo_log SET deleted = 0 WHERE deleted IS NULL;');
    }

    // -------------------------------------------------------------------
    // Phase 2 – rebuild the table if the *legacy* `ts` column exists.
    // -------------------------------------------------------------------
    if (hasLegacyTs) {
      log.info('Legacy "ts" column detected – rebuilding echo_log without it');

      // The old index must be removed prior to dropping the table otherwise
      // SQLite will complain about a dangling reference.
      db.exec('DROP INDEX IF EXISTS idx_echo_ts;');

      // 1) Create a new table with the correct schema (no `ts`).
      db.exec(`
        CREATE TABLE IF NOT EXISTS echo_log_new (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          text TEXT NOT NULL,
          _ps_version INTEGER NOT NULL DEFAULT 0,
          updated_at INTEGER NOT NULL,
          deleted INTEGER NOT NULL DEFAULT 0
        );
      `);

      // 2) Copy data across, converting legacy values on the fly.
      db.exec(`
        INSERT INTO echo_log_new (id, user_id, text, _ps_version, updated_at, deleted)
        SELECT
          id,
          COALESCE(user_id, 'legacy-user'),
          text,
          COALESCE(_ps_version, 0),
          CASE
            WHEN updated_at IS NULL OR updated_at = 0 THEN COALESCE(ts, strftime('%s','now'))
            ELSE updated_at
          END,
          COALESCE(deleted, 0)
        FROM echo_log;
      `);

      // 3) Drop old table and rename.
      db.exec('DROP TABLE echo_log;');
      db.exec('ALTER TABLE echo_log_new RENAME TO echo_log;');

      // 4) Recreate indices expected by PowerSync.
      db.exec('CREATE INDEX IF NOT EXISTS idx_echo_log_user_id ON echo_log(user_id);');
      db.exec('CREATE INDEX IF NOT EXISTS idx_echo_log_updated_at ON echo_log(updated_at);');
      db.exec('CREATE INDEX IF NOT EXISTS idx_echo_log_deleted ON echo_log(deleted);');

      log.info('Rebuild complete – legacy "ts" column removed');
    }
  });

  migrate();

  const migrationRan = added.length > 0 || hasLegacyTs;

  if (migrationRan) {
    const finalCols = db.prepare('PRAGMA table_info(echo_log)').all() as Array<{ name: string }>;
    log.info(`Schema migration complete – added [${added.join(', ')}], removed legacy 'ts': ${hasLegacyTs}`);
    log.debug(
      'Final columns in `echo_log` after migration:',
      finalCols.map((c) => c.name).join(', ')
    );
  } else {
    log.info('`echo_log` schema already up-to-date – no changes applied');
  }

  return { migrated: migrationRan, details: added };
} 