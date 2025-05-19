# GHOST Architecture

## Overview

GHOST follows a multi-process architecture typical of Electron applications, with additional security layers for encrypted storage and plugin isolation. The application is designed around three core principles:

1. **Zero-knowledge encryption** - The application cannot access user data without the master password
2. **Process isolation** - Clear separation between main, preload, and renderer processes
3. **Plugin extensibility** - Modular architecture for adding AI capabilities

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Interface                          │
│                    (React + TypeScript)                         │
└──────────────────────┬────────────────────┬────────────────────┘
                       │                    │
                       │   Context Bridge   │
                       │    (Preload)       │
                       │                    │
┌──────────────────────▼────────────────────▼────────────────────┐
│                         Main Process                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │
│  │   Auth      │  │   Database  │  │   Modules   │           │
│  │  Manager    │  │   Manager   │  │   System    │           │
│  └─────────────┘  └─────────────┘  └─────────────┘           │
│         │                │                │                    │
│         ▼                ▼                ▼                    │
│  ┌─────────────────────────────────────────────┐              │
│  │          Encrypted SQLite Database          │              │
│  │         (better-sqlite3-multiple-ciphers)   │              │
│  └─────────────────────────────────────────────┘              │
└───────────────────────────────────────────────────────────────┘
```

## Process Model

### Main Process

The main process (`src/main/`) handles:
- Window management and lifecycle
- Database encryption/decryption
- Authentication and Touch ID integration
- Plugin loading and management
- IPC request handling
- Global shortcut registration

Key components:
- `bootstrap.ts` - Application initialization and window management
- `db.ts` - Encrypted database operations
- `auth.ts` - Authentication logic and biometric integration
- `modules.ts` - Plugin loader and registry
- `ipc.ts` - IPC communication handlers

### Preload Script

The preload script (`src/preload/index.ts`) provides:
- Secure context bridge between main and renderer
- Type-safe API exposure
- No direct access to Node.js APIs

### Renderer Process

The renderer process (`src/renderer/`) contains:
- React application with TypeScript
- View components for different app states
- Hooks for state management
- All UI logic and styling

## Data Flow

1. **User Input** → Renderer captures user action
2. **IPC Call** → Renderer invokes preload API
3. **Main Handler** → Main process handles request
4. **Database Operation** → Encrypted read/write if needed
5. **Response** → Result sent back through IPC
6. **UI Update** → Renderer updates based on response

## Security Architecture

### Encryption Layer

- **Algorithm**: AES-256-CBC
- **Key Derivation**: Argon2id with moderate settings
- **Salt**: Randomly generated and stored separately
- **Database**: Fully encrypted at rest

### Process Isolation

- Context isolation enabled
- Node integration disabled in renderer
- Minimal API surface exposed through preload
- All sensitive operations in main process

### Authentication Flow

```
┌──────────────┐
│ First Launch │
└──────┬───────┘
       ▼
┌──────────────┐     ┌─────────────┐
│ Set Password │────▶│ Touch ID?   │
└──────────────┘     └──────┬──────┘
                            ▼
                    ┌───────────────┐
                    │ Store in      │
                    │ Keychain      │
                    └───────┬───────┘
                            ▼
                    ┌───────────────┐
                    │   Unlocked    │
                    └───────────────┘
```

## Plugin Architecture

Plugins are isolated modules that:
- Define their own database schemas
- Register callable functions (tools)
- Cannot access main process directly
- Inherit encryption transparently

### Module Structure

```typescript
interface AssistantModule {
  id: string;                    // Unique identifier
  schema: string;                // SQL schema definition
  functions: ToolDef[];          // Available functions
  init(ctx: ModuleContext): Promise<void>;  // Initialization
}
```

## State Management

The application maintains several state layers:

1. **Authentication State** - Tracks login status and permissions
2. **Database State** - Manages encrypted connection
3. **UI State** - Component-level state in React
4. **Plugin State** - Module-specific state

## Communication Protocol

All IPC communication follows a request/response pattern:

```typescript
// Request from renderer
window.ghost.sendChat('Hello')

// Main process handling
ipcMain.handle('ghost:send-chat', async (event, text) => {
  // Process and return response
})

// Response to renderer
{ id: '...', role: 'assistant', content: '...', timestamp: ... }
```

## Performance Considerations

- Database operations are synchronous but fast due to SQLite
- Encryption overhead is minimal for typical usage
- Plugin loading happens once at unlock
- React renders are optimized with proper state management

## Scalability

The architecture supports:
- Multiple plugin modules
- Various authentication methods
- Different encryption algorithms (via configuration)
- Platform-specific features (Touch ID on macOS)

## Future Architecture Considerations

1. **Plugin Sandboxing** - Further isolate plugins for security
2. **Multi-window Support** - Allow multiple chat windows
3. **Remote Sync** - Optional encrypted cloud backup
4. **Plugin Marketplace** - Distribution system for plugins