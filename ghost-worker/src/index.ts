import { verifyJWT } from './auth';
import { AIRequestBody } from './types';

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(req.url);
    if (pathname !== '/chat' || req.method !== 'POST')
      return new Response('not found', { status: 404 });

    /* ── 1. AUTH ───────────────────────────────────────── */
    const token = req.headers.get('Authorization')?.split(' ')[1] ?? '';
    try {
      await verifyJWT(token, env);
      console.debug('[AUTH] JWT ok');
    } catch (err) {
      console.error('[AUTH] fail', err);
      return new Response('unauthorized', { status: 401 });
    }

    /* ── 2. PARSE BODY ─────────────────────────────────── */
    let body: AIRequestBody;
    try {
      body = await req.json();
    } catch {
      return new Response('bad json', { status: 400 });
    }

    /* ── 3. CALL AI ────────────────────────────────────── */
    const aiResp = await env.AI.run(
      '@cf/meta/llama-3.3-70b-instruct-fp8-fast' as any,
      {
        stream: true,
        messages: [
          { role: 'system', content: body.system ?? 'You are Ghost AI assistant.' },
          ...body.messages
        ],
        tools: [
          {
            name: 'echo.reply',
            description: 'Echo text',
            parameters: {
              type: 'object',
              properties: { text: { type: 'string' } },
              required: ['text']
            }
          }
        ]
      }
    );

    /* ── 4. TOOL-CALL HOOK ─────────────────────────────── */
    // NB: aiResp is a Response<ReadableStream>; clone() to read side-channel if needed.
    // For MVP we forward tool_calls to Durable Object inside stream pump (TODO).

    return new Response(aiResp as any, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });
  }
} satisfies ExportedHandler<Env>;

export class ReminderQueue {
  queue: any[] = [];
  // TODO: implement when reminder feature is prioritised
}