import { AssistantModule, ModuleContext } from '../../main/modules';
import { defineTable } from '../../main/sync';

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
      
      // Persist to echo_log with canonical columns
      ctx.db.prepare(`INSERT INTO echo_log (id, user_id, text, _ps_version, updated_at, deleted) VALUES (?, ?, ?, ?, ?, ?)`)
        .run(now.toString(), userId, text, 0, now, 0);
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
    // Define table with canonical columns
    defineTable('echo', 'log', 'text TEXT NOT NULL', ctx.db);
    ctx.log.info('Echo module initialised with sync support');
  }
};

export default echoModule;