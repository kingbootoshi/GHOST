import { AssistantModule, ModuleContext } from '../../main/modules';

const echoModule: AssistantModule = {
  id: 'echo',
  
  meta: {
    title: 'Echo',
    icon: '🗣️'
  },
  
  schema: `
    CREATE TABLE IF NOT EXISTS echo_log (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      ts INTEGER NOT NULL
    );
  `,
  
  functions: {
    /** Returns the same text back and logs it to the DB */
    reply: async ({ text }: { text: string }, ctx: ModuleContext): Promise<string> => {
      // Persist to echo_log
      ctx.db.prepare(`INSERT INTO echo_log (id, text, ts) VALUES (?, ?, ?)`)
        .run(Date.now().toString(), text, Date.now());
      ctx.log.info(`Echo logged: ${text}`);
      return text;
    },

    /** Retrieves the latest 50 echo messages */
    'get-log': async (_args: unknown, ctx: ModuleContext): Promise<Array<{ text: string; ts: number }>> => {
      const rows = ctx.db.prepare(`SELECT text, ts FROM echo_log ORDER BY ts DESC LIMIT 50`).all() as Array<{ text: string; ts: number }>;
      return rows;
    }
  },
  
  async init(ctx: ModuleContext) {
    ctx.log.info('Echo module initialised');
  }
};

export default echoModule;