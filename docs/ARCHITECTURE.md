# GHOST Architecture (v0.2)

```

Main Process            Renderer                Supabase
┌─────────────┐ IPC  ┌────────────┐  HTTPS  ┌──────────────┐
│ Core Agent  │─────►│ React UI   │────────►│ PowerSync    │
│ Module Reg. │◄─────│ Preload    │         └──────────────┘
└─────┬───────┘      └────┬───────┘
│ ctx.invoke()      │  window\.ghost.\*
▼                   ▼
┌──────────────────────────────────────────┐
│   Plug-in (echo)  |  Plug-in (todo)      │
│   mini-agent      |  mini-agent          │
└──────────────────────────────────────────┘

````

## 1. Process Roles

| Process | Code entry | Responsibilities |
|---------|-----------|------------------|
| **Main** | `src/main/bootstrap.ts` | encryption, DB, module host, global shortcuts |
| **Preload** | `src/preload/index.ts` | **sole** bridge; typed IPC helpers |
| **Renderer** | `src/renderer/app.tsx` | React UI, state hooks, no Node APIs |

## 2. Encryption

* AES-256-CBC (SQLCipher)  
* Key = Argon2id(passphrase, salt)  
* Wiped with `sodium.memzero` after `lockDB()`  
* **Every plug-in table is created through `defineTable()`** → inherits encryption automatically.

## 3. Sync Pipeline (optional)

1. Plug-in calls `defineTable('todo','items', ..., { sync: true })`  
2. `syncManager.registerTable()` builds canonical columns (`_ps_version`, `updated_at`, …).  
3. When the user toggles **Settings ▸ Enable Sync**, PowerSync starts delta streaming to Supabase storage bucket.

See `src/main/sync.ts`.

## 4. Core / Module / Mini-Agent flow

1. Renderer asks the Core Agent for a reply.  
2. Core Agent decides whether a module tool is needed.  
3. `moduleRegistry.invoke('todo','create-task', args)` runs inside the module’s isolated context.  
4. The module’s **mini-agent** (if defined) can loop back via `ctx.invoke()`.

> All messages are plain JSON. No circular references, no DOM objects.