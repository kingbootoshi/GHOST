import { verifyJWT } from './auth';
import { AIRequestBody } from './types';
import { log } from './logger';

const MODELS = new Set([
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  '@cf/google/gemma-7b-it'
]);

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method !== 'POST' || new URL(req.url).pathname !== '/chat') {
      return new Response('not found', { status: 404 });
    }

    // --- Auth --------------------------------------------------
    const token = req.headers.get('Authorization')?.split(' ')[1] ?? '';
    try {
      await verifyJWT(token, env);
      log.debug('JWT ok');
    } catch (e) {
      log.warn('JWT fail', e);
      return new Response('unauthorized', { status: 401 });
    }

    // --- Parse -------------------------------------------------
    let body: AIRequestBody;
    try {
      body = await req.json();
    } catch {
      return new Response('bad json', { status: 400 });
    }

    const model = body.model ?? '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
    if (!MODELS.has(model)) {
      return new Response('model blocked', { status: 403 });
    }

    // --- Forward ----------------------------------------------
    const aiResp = await env.AI.run(model as any, {
      stream: true,
      messages: [
        { role: 'system', content: body.system ?? 'Ghost AI' },
        ...body.messages
      ],
      tools: body.tools ?? [],
      temperature: body.temperature,
      max_tokens: body.max_tokens,
      seed: body.seed
    });

    log.info('proxied request to %s', model);

    return new Response(aiResp as any, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });
  }
} satisfies ExportedHandler<Env>;