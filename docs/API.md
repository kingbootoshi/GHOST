# GHOST API Reference

## Overview

This document provides a comprehensive reference for all APIs in the GHOST application, including IPC contracts, plugin interfaces, and internal APIs.

## IPC API

The IPC API is exposed to the renderer process through the context bridge. All methods are async and return promises.

### Authentication

#### `ghost.createPassword(password: string)`

Creates the master password for first-time setup.

**Parameters:**
- `password` (string): The master password to encrypt the database

**Returns:**
```typescript
{
  success: boolean;
  canBiometric?: boolean;  // Whether Touch ID is available
  error?: string;         // Error message if failed
}
```

**Example:**
```typescript
const result = await window.ghost.createPassword('mySecurePassword123');
if (result.success) {
  console.log('Password created successfully');
}
```

#### `ghost.unlock(password?: string)`

Unlocks the database with password or biometric authentication.

**Parameters:**
- `password` (string, optional): Master password. If not provided, attempts biometric unlock.

**Returns:**
```typescript
{
  success: boolean;
  error?: string;  // Error message if failed
}
```

**Example:**
```typescript
// Password unlock
await window.ghost.unlock('myPassword');

// Biometric unlock
await window.ghost.unlock();
```

#### `ghost.lock()`

Locks the database and clears encryption keys from memory.

**Returns:**
```typescript
{
  success: boolean;
}
```

**Example:**
```typescript
await window.ghost.lock();
```

#### `ghost.getAuthState()`

Gets the current authentication state.

**Returns:**
```typescript
{
  isUnlocked: boolean;      // Whether database is unlocked
  isFirstRun: boolean;      // Whether this is first app launch
  canUseBiometric: boolean; // Whether biometric is available
  biometricEnabled: boolean; // Whether biometric is set up
}
```

**Example:**
```typescript
const state = await window.ghost.getAuthState();
if (state.isFirstRun) {
  // Show onboarding
}
```

### Chat Operations

#### `ghost.getChatLog()`

Retrieves all chat messages from the database.

**Returns:**
```typescript
Array<{
  id: string;                          // UUID
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;                   // Unix timestamp (ms)
  metadata?: any;                      // Optional metadata
}>
```

**Example:**
```typescript
const messages = await window.ghost.getChatLog();
messages.forEach(msg => {
  console.log(`${msg.role}: ${msg.content}`);
});
```

#### `ghost.sendChat(text: string)`

Sends a chat message and receives a response.

**Parameters:**
- `text` (string): The message content

**Returns:**
```typescript
{
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: any;
}
```

**Example:**
```typescript
const response = await window.ghost.sendChat('Hello, GHOST!');
console.log('Assistant:', response.content);
```

#### `ghost.invokeModule(moduleId: string, fn: string, args: any)`

Invokes a function from a plugin.

**Parameters:**
- `moduleId` (string): The ID of the plugin
- `fn` (string): The name of the function to invoke
- `args` (any): The arguments to pass to the function

**Returns:**
```typescript
any (whatever the called module returns)
```

**Throws:**
```typescript
Error('FUNCTION_NOT_FOUND' | <module-specific error>)
```

## Plugin API

### AssistantModule Interface

The main interface that all plugins must implement.

```typescript
interface AssistantModule {
  id: string;                       // Stable identifier
  schema?: string;                  // Optional SQL (executed once)
  meta: { title: string; icon?: string };

  /** Key change ↓ ------------------------------------------- */
  functions: Record<string, ModuleFunction>;
  /** -------------------------------------------------------- */

  init?(ctx: ModuleContext): Promise<void>;
}
```

### ModuleContext Interface

Context provided to plugins during initialization.

```typescript
type ModuleFunction = (args: any, ctx: ModuleContext) => Promise<any>;

interface ModuleContext {
  db: Database;
  log: Logger;
  /** NEW — call any other module tool */
  invoke: (moduleId: string, fn: string, args: any) => Promise<any>;
}
```

### ToolDef Interface

Definition for plugin-exposed functions.

```typescript
interface ToolDef {
  name: string;              // Function name
  description: string;       // Human-readable description
  parameters: JSONSchema;    // Parameter schema
  handler: (args: any) => Promise<unknown>; // Implementation
}
```

### JSONSchema Interface

JSON Schema for parameter validation.

```typescript
interface JSONSchema {
  type: string;
  properties?: Record<string, JSONSchema>;
  required?: string[];
  additionalProperties?: boolean;
  default?: any;
}
```

## Database API

### Database Operations

```typescript
// Prepare statement
const stmt = db.prepare('SELECT * FROM messages WHERE id = ?');

// Get single row
const row = stmt.get(id);

// Get all rows
const rows = stmt.all();

// Run insert/update/delete
const info = stmt.run(id, content);
console.log('Rows affected:', info.changes);

// Transaction
const transaction = db.transaction(() => {
  insertStmt.run(...);
  updateStmt.run(...);
});
transaction();
```

### Common Patterns

#### Prepared Statements

```typescript
// Create reusable prepared statement
const insert = db.prepare(`
  INSERT INTO messages (id, content, timestamp)
  VALUES (?, ?, ?)
`);

// Use multiple times
insert.run(id1, content1, Date.now());
insert.run(id2, content2, Date.now());
```

#### Transactions

```typescript
// Batch operations
const insertMany = db.transaction((messages) => {
  for (const msg of messages) {
    insert.run(msg.id, msg.content, msg.timestamp);
  }
});

// Execute as single transaction
insertMany(messages);
```

## Main Process APIs

### Database Management

```typescript
// Open encrypted database
openEncryptedDB(passphrase: string): Promise<Database>

// Lock database and clear keys
lockDB(): void

// Get current database connection
getDB(): Database | null

// Check if database exists
isDatabaseExists(): boolean
```

### Authentication

```typescript
// Check if Touch ID is available
canUseTouchID(): Promise<boolean>

// Get key from Touch ID
maybeGetKeyFromTouchID(): Promise<string | null>

// Store key in keychain
storeKeyInKeychain(key: string): Promise<boolean>

// Remove key from keychain
removeKeyFromKeychain(): Promise<boolean>
```

### Module Registry

```typescript
// Load all plugins
moduleRegistry.loadModules(db: Database): Promise<void>

// Get specific tool
moduleRegistry.getTool(name: string): ToolDef | undefined

// Get all tools
moduleRegistry.getAllTools(): ToolDef[]
```

## UI Component Props

### Onboarding Component

```typescript
interface OnboardingProps {
  onPasswordCreated: () => void;
}
```

### Unlock Component

```typescript
interface UnlockProps {
  onUnlocked: () => void;
  canUseBiometric?: boolean;
  biometricEnabled?: boolean;
}
```

### Chat Component

```typescript
interface ChatProps {
  onLock: () => void;
}
```

## Error Types

### AuthError

Thrown when authentication fails.

```typescript
class AuthError extends Error {
  constructor(message: string);
}
```

### Common Error Messages

- `"Failed to decrypt database - incorrect password?"` - Wrong password
- `"No password provided and biometric unlock failed"` - Biometric failure
- `"Database not unlocked"` - Attempting operation on locked database

## Event System

### IPC Events (Future)

```typescript
// Listen for state changes
window.ghost.on('state-changed', (newState) => {
  console.log('State changed to:', newState);
});

// Listen for new messages
window.ghost.on('message-received', (message) => {
  console.log('New message:', message);
});
```

### Plugin Events (Future)

```typescript
// In plugin
ctx.on('message:created', async (message) => {
  // React to new messages
});

ctx.emit('plugin:ready', { pluginId: 'my-plugin' });
```

## Type Definitions

### ChatMessage

```typescript
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: any;
  parent_id?: string;  // For threading
}
```

### AuthState

```typescript
interface AuthState {
  isUnlocked: boolean;
  isFirstRun: boolean;
  canUseBiometric: boolean;
  biometricEnabled: boolean;
}
```

### Plugin Metadata

```typescript
interface PluginMetadata {
  id: string;
  name: string;
  version: string;
  author?: string;
  description?: string;
  homepage?: string;
}
```

## Platform-Specific APIs

### macOS

```typescript
// Touch ID
systemPreferences.canPromptTouchID(): boolean
systemPreferences.promptTouchID(reason: string): Promise<void>

// Keychain (via keytar)
keytar.setPassword(service, account, password): Promise<void>
keytar.getPassword(service, account): Promise<string | null>
keytar.deletePassword(service, account): Promise<boolean>
```

### Windows (Future)

```typescript
// Windows Hello
windowsHello.isAvailable(): Promise<boolean>
windowsHello.authenticate(reason: string): Promise<boolean>
```

### Linux (Future)

```typescript
// Secret Service API
secretService.store(key, value): Promise<void>
secretService.get(key): Promise<string | null>
```

## Development APIs

### Logging

```typescript
// Available log levels
logger.info(message: string, ...args: any[])
logger.warn(message: string, ...args: any[])
logger.error(message: string, ...args: any[])
logger.debug(message: string, ...args: any[])

// Scoped logging
const scopedLog = logger.scope('my-plugin');
scopedLog.info('Plugin initialized');
```

### Debug Utilities

```typescript
// Development only
if (process.env.NODE_ENV === 'development') {
  // Expose internal state
  (window as any).__GHOST_STATE__ = getInternalState();
  
  // Enable verbose logging
  logger.transports.console.level = 'debug';
}
```

## Migration APIs

### Schema Versioning

```typescript
// Get current schema version
getSchemaVersion(): number

// Apply migrations
applyMigrations(migrations: Array<() => void>): void

// Check migration status
needsMigration(): boolean
```

## Future APIs

These APIs are planned for future versions:

1. **Settings API** - User preferences management
2. **Theme API** - UI customization
3. **Export API** - Data export functionality
4. **Sync API** - Multi-device synchronization
5. **Backup API** - Automated backup management