# GHOST Components Reference

This document provides detailed information about the key components in GHOST and how they interact.

## Core Services

### EncryptedDatabaseService

Located in `src/services/encryptedDatabase.ts`, this service handles all database operations with encryption.

**Key Functionality:**
- Initializes SQLCipher database with AES-256-CBC encryption
- Uses Argon2id for key derivation from master password
- Provides transaction support and query execution
- Manages database schema creation and upgrades

**API:**
```typescript
init(): Promise<void>                     // Initialize the service
open(password: string): Promise<boolean>  // Unlock with password
close(): void                             // Lock database
query<T>(sql: string, params?: any[]): T[] // Execute query
queryOne<T>(sql: string, params?: any[]): T | null // Get first result
transaction<T>(fn: (db) => T): T          // Execute in transaction
databaseExists(): boolean                 // Check if DB file exists
isUnlocked(): boolean                     // Check database status
```

**Usage Example:**
```typescript
await encryptedDatabase.init();
const unlocked = await encryptedDatabase.open('masterpassword');
if (unlocked) {
  const results = encryptedDatabase.query('SELECT * FROM messages LIMIT 10');
  // Process results...
  encryptedDatabase.close();
}
```

**Security Notes:**
- Never store the master password in memory longer than necessary
- Use transactions for multiple operations to ensure data integrity
- Always validate SQL inputs to prevent injection

### KeychainService

Located in `src/services/keychain.ts`, this service manages secure password storage and biometric authentication.

**Key Functionality:**
- Stores master password in system keychain
- Integrates with TouchID for biometric authentication
- Provides secure password retrieval for auto-unlock
- Manages TouchID enablement state

**API:**
```typescript
init(): Promise<void>                             // Initialize service
storeMasterPassword(password: string): Promise<boolean> // Store password
getMasterPassword(): Promise<string | null>       // Retrieve password
deleteMasterPassword(): Promise<boolean>          // Remove password
setTouchIdEnabled(enabled: boolean): Promise<boolean> // Toggle TouchID
isTouchIdEnabled(): Promise<boolean>              // Check if TouchID enabled
isTouchIdSupported(): boolean                     // Check hardware support
authenticateWithTouchId(prompt?: string): Promise<boolean> // Authenticate
```

**Usage Example:**
```typescript
await keychainService.init();
if (keychainService.isTouchIdSupported()) {
  await keychainService.setTouchIdEnabled(true);
  await keychainService.storeMasterPassword('masterpassword');
  const success = await keychainService.authenticateWithTouchId();
  if (success) {
    const pwd = await keychainService.getMasterPassword();
    // Use password to unlock database
  }
}
```

**Security Notes:**
- The system keychain is managed by the OS and provides strong security
- TouchID integration requires macOS and is subject to OS security policies
- Password retrieval should only occur after successful authentication

### HotkeyListener

Located in `src/services/hotkeyListener.ts`, this service manages global shortcuts.

**Key Functionality:**
- Registers the global ⌘⇧Space hotkey
- Sends toggle events to the renderer process
- Manages cleanup on application exit

**API:**
```typescript
init(window: BrowserWindow): void  // Initialize with window reference
// No public methods beyond init - service is self-contained
```

**Usage Example:**
```typescript
// In main.ts after creating the browser window
hotkeyListener.init(mainWindow);
```

**Technical Details:**
- Uses `globalShortcut` from Electron
- Ensures shortcuts are properly unregistered on app quit
- Emits events through IPC for the renderer to consume

### LoggerService

Located in `src/services/logger.ts`, this service provides centralized logging.

**Key Functionality:**
- Configures Winston logger with appropriate levels
- Writes logs to console and files
- Provides structured logging with timestamps

**API:**
```typescript
initLogger(): void  // Initialize logging system
// Standard Winston logger methods:
logger.info(message: string, ...meta)
logger.error(message: string, ...meta)
logger.warn(message: string, ...meta)
logger.debug(message: string, ...meta)
```

**Usage Example:**
```typescript
import logger from './services/logger';

logger.info('Application started');
try {
  // Do something
} catch (error) {
  logger.error('Failed to execute operation:', error);
}
```

## UI Components

### GhostAnimator

Located in `src/components/GhostAnimator.tsx`, this component provides the animated ghost visualization.

**Props:**
- `visible: boolean` - Controls visibility
- `size?: number` - Optional size in pixels (default: 300)

**Key Features:**
- Uses Framer Motion for smooth animations
- SVG-based animation (no external dependencies)
- Responsive sizing

**Usage Example:**
```jsx
<GhostAnimator visible={true} size={200} />
```

### App

Located in `src/components/App.tsx`, this is the main application component.

**Key Functionality:**
- Manages application state (locked/unlocked)
- Conditionally renders UnlockScreen or ChatInterface
- Handles database unlock/lock operations

**Usage Example:**
```jsx
// In renderer.tsx
<App />
```

### UnlockScreen

Located in `src/components/UnlockScreen.tsx`, this component handles authentication.

**Props:**
- `onUnlock: (password: string) => Promise<boolean>`
- `onTouchIdAuth: () => Promise<boolean>`

**Key Functionality:**
- Provides password input and submission
- Offers TouchID authentication if available
- Handles new user password creation
- Displays authentication errors

### ChatInterface

Located in `src/components/ChatInterface.tsx`, this component provides the chat UI.

**Props:**
- `onLock: () => void` - Callback to lock the database

**Key Functionality:**
- Displays chat messages
- Provides input for user messages
- Responds to hotkey toggle events
- Manages AI assistant interactions

## IPC Communication

Communication between the main and renderer processes is managed through IPC (Inter-Process Communication) with strictly defined channels:

### From Renderer to Main

| Channel | Purpose | Parameters | Return |
|---------|---------|------------|--------|
| `database:unlock` | Unlock database | `password: string` | `Promise<boolean>` |
| `database:lock` | Lock database | None | `Promise<boolean>` |
| `database:isUnlocked` | Check status | None | `Promise<boolean>` |
| `database:query` | Execute query | `sql: string, params: any[]` | `Promise<any[]>` |
| `database:transaction` | Execute transaction | `operations: {sql, params}[]` | `Promise<boolean>` |
| `auth:isTouchIdSupported` | Check TouchID availability | None | `Promise<boolean>` |
| `auth:isTouchIdEnabled` | Check TouchID status | None | `Promise<boolean>` |
| `auth:setTouchIdEnabled` | Toggle TouchID | `enabled: boolean` | `Promise<boolean>` |
| `auth:authenticateWithTouchId` | Authenticate with TouchID | None | `Promise<boolean>` |
| `test-toggle-chat` | Test hotkey (dev only) | None | None |

### From Main to Renderer

| Channel | Purpose | Data |
|---------|---------|------|
| `toggle-chat` | Toggle chat visibility | None |

## Electron API Bridge

The preload script (`src/preload.ts`) creates a secure bridge between processes, exposing a controlled API:

```typescript
window.electronAPI = {
  // Chat toggle
  onToggleChat: (callback: () => void) => /* ... */,
  
  // System info
  getPlatform: () => /* ... */,
  
  // Database operations
  unlockDatabase: (password: string) => /* ... */,
  lockDatabase: () => /* ... */,
  isDatabaseUnlocked: () => /* ... */,
  
  // TouchID operations
  isTouchIdSupported: () => /* ... */,
  isTouchIdEnabled: () => /* ... */,
  setTouchIdEnabled: (enabled: boolean) => /* ... */,
  authenticateWithTouchId: () => /* ... */,
  
  // Database access
  executeQuery: (sql: string, params: any[]) => /* ... */,
  executeTransaction: (operations: Array<{sql, params}>) => /* ... */
};
```

This design ensures the renderer process can only access specifically exposed APIs, maintaining security through context isolation.