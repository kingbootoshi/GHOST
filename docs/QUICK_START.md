# GHOST Quick Start Guide

## What is GHOST?

GHOST is a secure, encrypted, plugin-ready AI chat application built with Electron. It features:

- 🔐 Zero-knowledge encryption (AES-256-CBC)
- 🔑 Touch ID support on macOS
- 🔌 Extensible plugin architecture
- 🚀 Modern React UI
- 💾 Local-first data storage

## Getting Started

### 1. Clone and Install

```bash
git clone https://github.com/your-org/ghost.git
cd ghost
npm install
```

### 2. Run Development Mode

```bash
npm start
```

This starts:
- Electron app with hot reload
- React dev server on http://localhost:5173
- DevTools automatically open

### 3. First Launch

1. **Set Master Password** - This encrypts all your data
2. **Optional: Enable Touch ID** - For quick unlock (macOS only)
3. **Start Chatting** - Messages are stored encrypted locally

## Understanding the Code

### Project Structure

```
GHOST/
├── src/
│   ├── main/         # Electron main process
│   │   ├── db.ts     # Encrypted database
│   │   ├── auth.ts   # Authentication
│   │   └── ipc.ts    # IPC handlers
│   ├── renderer/     # React UI
│   │   ├── app.tsx   # Main app
│   │   └── views/    # UI components
│   └── modules/      # Plugins
```

### Key Concepts

1. **Encryption First** - All data encrypted with user's password
2. **Process Isolation** - Secure separation between main/renderer
3. **Plugin System** - Extend with custom modules
4. **Type Safety** - Full TypeScript throughout

## Common Tasks

### Add an IPC Handler

```typescript
// In src/main/ipc.ts
ipcMain.handle('ghost:my-handler', async (event, arg) => {
  // Implementation
  return result;
});

// In src/preload/index.ts
contextBridge.exposeInMainWorld('ghost', {
  myHandler: (arg) => ipcRenderer.invoke('ghost:my-handler', arg)
});
```

### Create a React Component

```typescript
// src/renderer/components/MyComponent.tsx
export function MyComponent({ title }: Props) {
  return <div className="my-component">{title}</div>;
}
```

### Write a Plugin

```typescript
// src/modules/my-plugin/index.ts
export default {
  id: 'my-plugin',
  meta: { title: 'My Plugin', icon: '🔌' },
  schema: 'CREATE TABLE ...',
  functions: {
    myFunction: async (args, ctx) => {
      // Implementation using ctx.db, ctx.log, ctx.invoke
      return { result: 'success' };
    }
  },
  init: async (ctx) => {
    ctx.log.info('Plugin ready');
  }
};
```

## Architecture at a Glance

```
┌─────────────────┐
│   React UI      │
└────────┬────────┘
         │ IPC
┌────────▼────────┐
│  Main Process   │
├─────────────────┤
│ • Encryption    │
│ • Database      │
│ • Auth          │
│ • Plugins       │
└─────────────────┘
```

## Security Model

- **Zero Knowledge** - App can't decrypt without password
- **Memory Safety** - Keys cleared after use
- **Process Isolation** - Limited API exposure
- **No Telemetry** - Your data stays local

## Development Flow

1. **Make Changes** - Code updates hot reload
2. **Test Locally** - Run `npm test`
3. **Lint Code** - Run `npm run lint`
4. **Build App** - Run `npm run make`

## Need Help?

- 📚 [Full Documentation](./README.md)
- 🏗️ [Architecture Guide](./ARCHITECTURE.md)
- 🔒 [Security Model](./SECURITY.md)
- 🔌 [Plugin Guide](./PLUGINS.md)
- 🛠️ [Development Guide](./DEVELOPMENT.md)

## Next Steps

1. Read the [Architecture](./ARCHITECTURE.md) document
2. Try building a [plugin](./PLUGINS.md)
3. Explore the [API Reference](./API.md)
4. Check [security best practices](./SECURITY.md)

Happy coding! 🚀