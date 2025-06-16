import { ModuleContext } from '../_schema';
import { v4 as uuidv4 } from 'uuid';
import fetch from 'node-fetch';
import { createParser } from 'eventsource-parser';
import { BrowserWindow } from 'electron';

const WORKER_URL = process.env.VITE_WORKER_URL || 'https://ghost-worker.ghost-ai.workers.dev/';

interface StreamChunk {
  response?: string;
  tool_calls?: Array<{
    name: string;
    arguments: Record<string, any>;
  }>;
}

export async function init(ctx: ModuleContext): Promise<void> {
  // Execute schema directly
  ctx.db.exec(`
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
  `);
  
  ctx.logger.info('[ai-chat] module ready');
}

export async function chat(ctx: ModuleContext, args: { 
  prompt: string; 
  systemPrompt?: string; 
  model?: string; 
  jwt: string;
  temperature?: number;
  maxTokens?: number;
  seed?: number;
  tools?: Array<{
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required?: string[];
    };
  }>;
}): Promise<string> {
  const now = Date.now();
  const userId = 'default-user';
  const userMsgId = uuidv4();
  
  // Get module settings
  const settings = await ctx.getSettings<{
    model?: string;
    temperature?: number;
    maxTokens?: number;
  }>();
  
  // Insert user message
  ctx.db.prepare(`
    INSERT INTO ai_chat_log (id, user_id, role, content, tool_calls, _ps_version, updated_at, deleted)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(userMsgId, userId, 'user', args.prompt, null, 0, now, 0);
  
  ctx.logger.debug('[ai-chat] send prompt len=%d model=%s', args.prompt.length, args.model || settings?.model || 'default');
  
  // Stream from worker
  const assistantBuf: string[] = [];
  const toolCalls: any[] = [];
  
  try {
    const response = await fetch(`${WORKER_URL}chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${args.jwt}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: args.prompt }],
        system: args.systemPrompt,
        model: args.model || settings?.model || '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
        temperature: args.temperature ?? settings?.temperature ?? 0.7,
        max_tokens: args.maxTokens ?? settings?.maxTokens ?? 2000,
        seed: args.seed,
      })
    });
    
    if (!response.ok) {
      throw new Error(`Worker responded with ${response.status}: ${response.statusText}`);
    }
    
    const reader = response.body;
    if (!reader) {
      throw new Error('No response body from worker');
    }
    
    let buffer = '';
    const decoder = new TextDecoder();
    
    const parser = createParser({
      onEvent: (event) => {
        if (event.data) {
          try {
            const chunk: StreamChunk = JSON.parse(event.data);
            
            if (chunk.response) {
              assistantBuf.push(chunk.response);
              // Send partial update to renderer via IPC
              const mainWindow = BrowserWindow.getFocusedWindow();
              if (mainWindow) {
                mainWindow.webContents.send('ai-chat:partial', { chunk: chunk.response });
              }
            }
            
            if (chunk.tool_calls) {
              toolCalls.push(...chunk.tool_calls);
              // Handle tool calls
              for (const tool of chunk.tool_calls) {
                ctx.logger.debug('[ai-chat] tool call: %s', tool.name);
                // TODO: Implement tool invocation through module loader
              }
            }
          } catch (err) {
            ctx.logger.error('[ai-chat] failed to parse chunk: %o', err);
          }
        }
      }
    });
    
    // Read the stream using proper node-fetch iteration
    const readableStream = reader as any;
    for await (const chunk of readableStream) {
      const text = decoder.decode(chunk as Uint8Array, { stream: true });
      buffer += text;
      
      // Parse SSE frames
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer
      
      for (const line of lines) {
        parser.feed(line + '\n');
      }
    }
    
    // Parse any remaining buffer
    if (buffer) {
      parser.feed(buffer);
    }
    
  } catch (error) {
    ctx.logger.error('[ai-chat] stream error %o', error);
    throw error;
  }
  
  const assistantContent = assistantBuf.join('');
  const assistantMsgId = uuidv4();
  
  // Insert assistant message
  ctx.db.prepare(`
    INSERT INTO ai_chat_log (id, user_id, role, content, tool_calls, _ps_version, updated_at, deleted)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    assistantMsgId, 
    userId, 
    'assistant', 
    assistantContent, 
    toolCalls.length > 0 ? JSON.stringify(toolCalls) : null,
    0, 
    Date.now(), 
    0
  );
  
  ctx.logger.info('[ai-chat] streamed %d chars', assistantContent.length);
  return assistantContent;
}

export async function getHistory(ctx: ModuleContext, _args?: unknown): Promise<Array<{ role: string; content: string; updated_at: number }>> {
  const rows = ctx.db.prepare(`
    SELECT role, content, updated_at 
    FROM ai_chat_log 
    WHERE deleted = 0 
    ORDER BY updated_at ASC 
    LIMIT 100
  `).all() as Array<{ role: string; content: string; updated_at: number }>;
  return rows;
}