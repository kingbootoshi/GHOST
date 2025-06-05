# Cloudflare “AI Chat” Worker – Developer Guide  
_v1.0 • 2025-06-04_

> **TL;DR** – The Worker is a stateless proxy that  
> 1. Verifies the caller’s Supabase JWT,  
> 2. Streams a completion from OpenRouter,  
> 3. Forwards the stream to the client as Server-Sent Events (SSE).

---

## 1. High-level Architecture

```

GHOST desktop / web
│  POST /chat  (Bearer <JWT>)
▼
\[ Cloudflare Worker ]
│  (validate JWT → user\_id)
│  (construct OpenRouter payload)
▼
OpenRouter API  (or local fallback)  ← streamed chunks
│
▼
\[ Cloudflare Worker ]
│  SSE frames  data:{"response":"…"}\n\n
▼
Client (`ai-chat` module)

```

* **Cloudflare Worker**: `ghost-worker` (TypeScript, deployed with `wrangler`).  
* **Auth source of truth**: Supabase project `xegknevgslsjbiezyzxv`.  
* **Model backend**: OpenRouter (default) – easily swapped via env vars.  

---

## 2. Environment Variables (set in `wrangler.toml`)

| Var | Example | Purpose |
|-----|---------|---------|
| `SUPABASE_URL` | `https://xegknevgslsjbiezyzxv.supabase.co` | JWKS discovery + RPC |
| `SUPABASE_JWT_AUD` | `authenticated` (default) | Aud claim expected in the JWT |
| `OPENROUTER_API_KEY` | `sk-or-…` | Forwarded as `Authorization: Bearer …` |
| `OPENROUTER_BASE_URL` | `https://openrouter.ai/api/v1/` | Override for staging/local llama |
| `RATE_LIMIT` | `120` | Max requests / user / minute (optional; see §6) |

**Never** commit these; use `wrangler secret put`.

---

## 3. Request & Response Contract

### 3.1 Endpoint

```

POST [https://ghost-worker.ghost-ai.workers.dev/chat](https://ghost-worker.ghost-ai.workers.dev/chat)
Headers:
Authorization: Bearer <Supabase JWT>
Content-Type: application/json
Body:
{
"messages": \[ { "role": "user", "content": "Hello" }, … ],
"system":   "You are a helpful assistant",   // optional
"model":    "@hf/koboldai/koboldcpp/llama3-8b-instruct", // optional
"stream":   true                             // default: true
}

```

### 3.2 Success (response - 200)

**Content-Type:** `text/event-stream; charset=utf-8`

```

event: chunk
data: {"response":"Hello!"}

event: done
data: {}

````

The `ai-chat` module already has an SSE parser; nothing changes.

### 3.3 Errors

| HTTP | Meaning | JSON body |
|------|---------|-----------|
| 401  | Missing / invalid JWT | `{ "error": "UNAUTHENTICATED" }` |
| 403  | Rate limit exceeded | `{ "error": "RATE_LIMIT" }` |
| 502  | Upstream model failed | `{ "error": "UPSTREAM", "detail": "…"} ` |

---

## 4. JWT Verification Logic (Worker)

```ts
import { createRemoteJWKSet, jwtVerify } from 'jose';

const JWKS = createRemoteJWKSet(new URL(`${SUPABASE_URL}/auth/v1/keys`));

async function getUser(jwt: string): Promise<{ id: string }> {
  const { payload } = await jwtVerify(jwt, JWKS, {
    audience: SUPABASE_JWT_AUD,
    issuer: `${SUPABASE_URL}/auth/v1`,
  });
  // payload.sub === user_id; anything else you need lives here
  return { id: payload.sub as string };
}
````

*No Supabase client library inside the Worker:*
verification is pure JOSE; zero network RTT after the first JWKS fetch (CF caches it).

---

## 5. Forwarding to OpenRouter

```ts
const upstream = await fetch(OPENROUTER_BASE_URL + 'chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: body.model ?? '@hf/koboldai/koboldcpp/llama3-8b-instruct',
    messages: [...],
    stream: true,
  }),
});
```

* We do **no** token counting or prompt-surgery in the Worker—keep it thin.
* Upstream errors (e.g., `429 Too Many Requests`) are mapped to `502`.

---

## 6. Local Development

```bash
wrangler dev src/index.ts --inspect
# or
npm run wrangler:dev
```

* Wrangler auto-injects mock secrets from `.dev.vars`.
* Hit `http://localhost:8787/chat` with a **real** Supabase JWT (grab it from a logged-in session).

---

## 7. Deployment Pipeline

| Step              | Command                                                                     |
| ----------------- | --------------------------------------------------------------------------- |
| Manual hot-fix    | `wrangler deploy`                                                           |
| CI (main)         | `wrangler deploy --env=production --minify --compatibility-date 2025-06-04` |
| Canary (optional) | `wrangler deploy --env=staging`                                             |

All deploys are idempotent; secrets are environment-scoped.

---

## 8. Client-side Usage (`ai-chat` module)

Already implemented:

```ts
const response = await fetch(`${WORKER_URL}chat`, {   // env var in .env.local
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${jwt}`,  // Supabase session token
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    messages: [{ role: 'user', content: prompt }],
    system: systemPrompt,
    model,            // optional UI selector
  }),
});
```

**Important** – always fetch a fresh `access_token` right before the call;
Supabase rotates tokens every 60 min.

---

## 9. FAQ / Troubleshooting

| Symptom                     | Likely Cause                         | Fix                                                           |
| --------------------------- | ------------------------------------ | ------------------------------------------------------------- |
| `401 UNAUTHENTICATED`       | Missing or expired JWT               | Ensure `supabase.auth.getSession()` returns a non-null token. |
| `502 UPSTREAM`              | OpenRouter outage / wrong model slug | Check Worker logs → Cloudflare dash → “Functions”.            |
| No events until final chunk | Forgetting `stream:true`             | Worker defaults to streaming; client must parse SSE.          |
| Random 1015 / 1020          | Cloudflare WAF                       | Add your IP to allow-list or tweak zone firewall.             |