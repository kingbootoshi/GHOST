# GHOST Developer Documentation

Welcome, Operator.  
GHOST is a **zero-knowledge, AI-first desktop shell** with first-class plug-in support and end-to-end data sync.

| Section | What you’ll learn |
|---------|-------------------|
| [Architecture](./ARCHITECTURE.md) | How all processes talk, encrypt & sync |
| [Development](./DEVELOPMENT.md) | Getting a hacking loop in ≤2 min |
| [Plug-ins](./PLUGINS.md) | Authoring mini-agents & schemas |
| [IPC Contract](./IPC.md) | Every renderer ⇄ main call, typed |
| [Style Guide](./STYLE_GUIDE.md) | TS, React & Git best-practice |

> **TL;DR** for a new plug-in:  
> ```bash
> npx ghost-cli create-module my-todo
> ```