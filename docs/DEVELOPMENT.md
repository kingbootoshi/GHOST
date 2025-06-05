# Development Guide

## 0. Prereqs

| Tool | Version |
|------|---------|
| Node | 18 +    |
| npm  | 9 +     |
| macOS| 12 + (Touch ID) |

## 1. Quick start

```bash
git clone https://github.com/your-org/ghost.git
cd ghost
npm install
npm start             # electron + vite HMR <2 s
````

* Vite opens DevTools automatically.
* Hitting **⌘ ⌥ R** reloads both main & renderer.

## 2. Scripts

| Script                  | What it does              |
| ----------------------- | ------------------------- |
| `npm start`             | Dev run                   |
| `npm run make`          | Cross-platform installers |
| `npm run lint -- --fix` | ESLint + TS               |
| `npm test`              | Jest (coming soon)        |

## 3. Debugging

### Main process

```bash
npm start -- --inspect=9229
chrome://inspect       # attach
```

### Renderer hot keys

* **⌘ ⌥ I** – toggle DevTools
* **⌘ ⇧ G** – global show/hide window (set in `bootstrap.ts`)

## 4. How to add IPC

```ts
// main/ipc.ts
ipcMain.handle('ghost:do-thing', async (e, foo: string) => { ... });

// preload/index.ts
doThing: (foo) => ipcRenderer.invoke('ghost:do-thing', foo)

// renderer
await window.ghost.doThing('bar');
```

Run `npm run typecheck` – the generated `src/types.ts` will flag mismatches.