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
  
  functions: [{
    name: 'reply',
    description: 'Returns the same text back to the user',
    parameters: {
      type: 'object',
      properties: {
        text: {
          type: 'string'
        }
      },
      required: ['text']
    },
    handler: async ({ text }: { text: string }) => {
      return text;
    }
  },
  {
    name: 'get-log',
    description: 'Returns the last 50 echo messages',
    parameters: {
      type: 'object',
      properties: {},
      additionalProperties: false
    },
    handler: async (_args: unknown, _ctx?: unknown) => {
      // `ctx` is unused here because we inject DB logic in `init` where we
      // have access to the ModuleContext.
      return [];
    }
  }],
  
  async init(ctx: ModuleContext) {
    ctx.log.info('Echo plugin ready');
    
    // Log all echo invocations
    const originalHandler = this.functions[0].handler;
    this.functions[0].handler = async (args) => {
      const result = await originalHandler(args);
      
      // Store in database
      const stmt = ctx.db.prepare(`
        INSERT INTO echo_log (id, text, ts) 
        VALUES (?, ?, ?)
      `);
      
      stmt.run(
        Date.now().toString(),
        args.text,
        Date.now()
      );
      
      ctx.log.info(`Echo logged: ${args.text}`);
      return result;
    };

    // Wire up get-log handler now that we have DB access
    const getLog = async () => {
      const rows = ctx.db
        .prepare(`SELECT text, ts FROM echo_log ORDER BY ts DESC LIMIT 50`)
        .all() as Array<{ text: string; ts: number }>;
      return rows.map((r) => ({ text: r.text, ts: r.ts }));
    };

    // Index 1 because we pushed reply earlier
    this.functions[1].handler = async () => getLog();
  }
};

export default echoModule;