import { AssistantModule, ModuleContext } from '../../main/modules';
import { defineTable } from '../../main/sync';
import { ensureEchoLogSchema } from './migration';

// After migration we expect the legacy `ts` column to be gone.  The flag is
// kept solely as a defensive measure in case future databases re-introduce it
// for whatever reason.
let hasLegacyTsColumn = false;

const echoModule: AssistantModule = {
  id: 'echo',
  
  meta: {
    title: 'Echo',
    icon: '🗣️'
  },
  
  // Schema will be applied in init() using defineTable
  schema: '',
  
  functions: {
    /** Returns the same text back and logs it to the DB */
    reply: async ({ text }: { text: string }, ctx: ModuleContext): Promise<string> => {
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
      ctx.log.info(`Echo logged: ${text}`);
      return text;
    },

    /** Retrieves the latest 50 echo messages */
    'get-log': async (_args: unknown, ctx: ModuleContext): Promise<Array<{ text: string; updated_at: number }>> => {
      const rows = ctx.db.prepare(`SELECT text, updated_at FROM echo_log WHERE deleted = 0 ORDER BY updated_at DESC LIMIT 50`).all() as Array<{ text: string; updated_at: number }>;
      return rows;
    }
  },
  
  async init(ctx: ModuleContext) {
    // ---------------------------------------------------------------------
    // 1) Forward-only schema migration (runs once on startup)
    // ---------------------------------------------------------------------
    const { migrated, details } = ensureEchoLogSchema(ctx.db);
    if (migrated) {
      ctx.log.info(`Echo schema migrated – columns added: [${details.join(', ')}]`);
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
    ctx.log.debug(`echo_log hasLegacyTsColumn (post-migration) = ${hasLegacyTsColumn}`);
    ctx.log.info('Echo module initialised with sync support');
  }
};

export default echoModule;