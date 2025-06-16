import { ModuleContext } from '../_schema';
import { defineTable } from '../../main/sync';
import { ensureEchoLogSchema } from './migration';

// After migration we expect the legacy `ts` column to be gone.  The flag is
// kept solely as a defensive measure in case future databases re-introduce it
// for whatever reason.
let hasLegacyTsColumn = false;

export async function init(ctx: ModuleContext): Promise<void> {
  // ---------------------------------------------------------------------
  // 1) Forward-only schema migration (runs once on startup)
  // ---------------------------------------------------------------------
  const { migrated, details } = ensureEchoLogSchema(ctx.db);
  if (migrated) {
    ctx.logger.info(`Echo schema migrated – columns added: [${details.join(', ')}]`);
  }

  // ---------------------------------------------------------------------
  // 2) Ensure table & indices exist using PowerSync helper.  **Important:**
  //    For fresh installs this call creates `echo_log` without the legacy
  //    `ts` column so future inserts can omit it.
  // ---------------------------------------------------------------------
  defineTable('echo', 'log', 'text TEXT NOT NULL', ctx.db);

  // Confirm legacy column removal.
  const colRows = ctx.db.prepare('PRAGMA table_info(echo_log)').all() as Array<{ name: string }>;
  hasLegacyTsColumn = colRows.some((c) => c.name === 'ts');
  ctx.logger.debug(`echo_log hasLegacyTsColumn (post-migration) = ${hasLegacyTsColumn}`);
  ctx.logger.info('Echo module initialised with sync support');
}

/** Returns the same text back and logs it to the DB */
export async function reply(ctx: ModuleContext, { text }: { text: string }): Promise<string> {
  // Get current user ID (for MVP, use a default)
  const userId = 'default-user';
  const now = Date.now();
  
  // Persist to echo_log.  If the DB still contains the legacy `ts` column
  // we must include it in the INSERT to avoid a NOT NULL constraint
  // violation.  New installations created after the migration will *not*
  // have this column, hence the conditional logic.
  const insertBase = `INSERT INTO echo_log (id, user_id, text, _ps_version, updated_at, deleted`;
  const valuesBase = `VALUES (?, ?, ?, ?, ?, ?`;

  const stmt = hasLegacyTsColumn
    ? ctx.db.prepare(
        `${insertBase}, ts) ${valuesBase}, ?)`
      )
    : ctx.db.prepare(`${insertBase}) ${valuesBase})`);

  if (hasLegacyTsColumn) {
    stmt.run(now.toString(), userId, text, 0, now, 0, now);
  } else {
    stmt.run(now.toString(), userId, text, 0, now, 0);
  }
  ctx.logger.info(`Echo logged: ${text}`);
  return text;
}

/** Retrieves the latest echo messages */
export async function getLog(ctx: ModuleContext, _args?: unknown): Promise<Array<{ text: string; updated_at: number }>> {
  const settings = await ctx.getSettings<{ maxLogEntries?: number }>();
  const limit = settings?.maxLogEntries || 50;
  
  const rows = ctx.db.prepare(
    `SELECT text, updated_at FROM echo_log WHERE deleted = 0 ORDER BY updated_at DESC LIMIT ?`
  ).all(limit) as Array<{ text: string; updated_at: number }>;
  return rows;
}