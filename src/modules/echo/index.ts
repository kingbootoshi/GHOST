import { AssistantModule, ModuleContext } from '../../main/modules';

const echoModule: AssistantModule = {
  id: 'echo',
  
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
  }
};

export default echoModule;