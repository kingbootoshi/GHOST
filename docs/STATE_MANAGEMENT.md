# GHOST State Management

## Overview

GHOST's state management encompasses authentication states, application lifecycle, database connections, and UI state. This document details how state flows through the application and how different components interact.

## Application States

### 1. Authentication States

```typescript
type AppState = 
  | 'FRESH_INSTALL'      // First time user
  | 'PASSWORD_CREATED'   // Password set, not unlocked
  | 'BIOMETRIC_ENABLED'  // Touch ID configured
  | 'BIOMETRIC_DECLINED' // User opted out of Touch ID
  | 'UNLOCKED'          // Database accessible
  | 'LOCKED';           // Database locked
```

### 2. State Transitions

```
FRESH_INSTALL
    ↓ (create password)
PASSWORD_CREATED
    ↓ (check biometric)
BIOMETRIC_ENABLED or BIOMETRIC_DECLINED
    ↓ (unlock)
UNLOCKED
    ↓ (lock/quit)
LOCKED
    ↓ (unlock)
UNLOCKED
```

## Main Process State

### Database State

```typescript
// db.ts
let db: Database | null = null;
let keyBuffer: Uint8Array | null = null;

// State accessors
export function getDB(): Database | null {
  return db;
}

export function isDatabaseExists(): boolean {
  return fs.existsSync(DB_PATH);
}
```

### Authentication State

```typescript
// auth.ts
export interface AuthState {
  currentState: AppState;
  isBiometricEnabled: boolean;
  isFirstRun: boolean;
}

// IPC handler provides current state
ipcMain.handle('ghost:get-auth-state', async () => {
  return {
    isUnlocked: db !== null,
    isFirstRun: !isDatabaseExists(),
    canUseBiometric: await canUseTouchID(),
    biometricEnabled: await isBiometricStored()
  };
});
```

### Module State

```typescript
// modules.ts
class ModuleRegistry {
  private modules: Map<string, AssistantModule> = new Map();
  private tools: Map<string, ToolDef> = new Map();
  private db: Database | null = null;
  
  // State is rebuilt on each unlock
  async loadModules(db: Database) {
    this.db = db;
    // Load all modules...
  }
}
```

## Renderer Process State

### React State Management

```typescript
// app.tsx
function App() {
  const [currentView, setCurrentView] = useState<AppView>('loading');
  const [authState, setAuthState] = useState<AuthState | null>(null);
  
  // State synchronization
  useEffect(() => {
    checkAuthState();
  }, []);
  
  const checkAuthState = async () => {
    const state = await window.ghost.getAuthState();
    setAuthState(state);
    
    // Determine view based on state
    if (state.isFirstRun) {
      setCurrentView('onboarding');
    } else if (!state.isUnlocked) {
      setCurrentView('unlock');
    } else {
      setCurrentView('chat');
    }
  };
}
```

### Component-Level State

```typescript
// Chat.tsx
export function Chat({ onLock }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Load initial state
  useEffect(() => {
    loadChatHistory();
  }, []);
  
  // Update state on user action
  const handleSend = async () => {
    setLoading(true);
    try {
      const response = await window.ghost.sendChat(input);
      await loadChatHistory(); // Refresh full state
    } finally {
      setLoading(false);
    }
  };
}
```

## State Persistence

### Database-Backed State

```typescript
// Persistent state in encrypted database
CREATE TABLE IF NOT EXISTS system_info (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

// Store application settings
db.prepare('INSERT OR REPLACE INTO system_info (key, value) VALUES (?, ?)')
  .run('theme', 'dark');
```

### Memory-Only State

```typescript
// Sensitive data never persisted
let keyBuffer: Uint8Array | null = null;  // Encryption key
let sessionToken: string | null = null;    // Session data

// Clear on lock
function lockDB() {
  if (keyBuffer) {
    sodium.memzero(keyBuffer);
    keyBuffer = null;
  }
}
```

## State Synchronization

### IPC State Updates

```typescript
// Main process notifies renderer of state changes
function notifyStateChange(state: AppState) {
  if (mainWindow) {
    mainWindow.webContents.send('state-changed', state);
  }
}

// Renderer listens for updates
useEffect(() => {
  const handleStateChange = (event, state) => {
    setAppState(state);
  };
  
  window.ghost.on('state-changed', handleStateChange);
  return () => window.ghost.off('state-changed', handleStateChange);
}, []);
```

### Polling Strategy

```typescript
// Periodic state checks for resilience
const useAuthState = () => {
  const [state, setState] = useState(null);
  
  useEffect(() => {
    let interval;
    
    const checkState = async () => {
      const newState = await window.ghost.getAuthState();
      setState(newState);
    };
    
    checkState(); // Initial check
    interval = setInterval(checkState, 5000); // Poll every 5s
    
    return () => clearInterval(interval);
  }, []);
  
  return state;
};
```

## State Recovery

### Crash Recovery

```typescript
// bootstrap.ts
app.on('ready', async () => {
  // Check for clean shutdown
  const cleanShutdown = await checkCleanShutdown();
  
  if (!cleanShutdown) {
    // Force lock if unclean shutdown
    lockDB();
    logger.warn('Unclean shutdown detected, database locked');
  }
  
  createWindow();
});
```

### Error States

```typescript
// Graceful error handling
const [error, setError] = useState<string | null>(null);

const handleUnlock = async (password: string) => {
  try {
    const result = await window.ghost.unlock(password);
    if (!result.success) {
      setError(result.error || 'Failed to unlock');
    }
  } catch (err) {
    setError('Unexpected error occurred');
    logger.error('Unlock failed:', err);
  }
};
```

## State Debugging

### Logging State Transitions

```typescript
// Log all state changes
function transitionState(from: AppState, to: AppState) {
  logger.info(`State transition: ${from} → ${to}`);
  currentState = to;
  notifyStateChange(to);
}
```

### Development Tools

```typescript
// Expose state for debugging (dev only)
if (process.env.NODE_ENV === 'development') {
  (window as any).__GHOST_STATE__ = {
    getAuth: () => authState,
    getDB: () => !!db,
    getModules: () => moduleRegistry.getAllModules()
  };
}
```

## Best Practices

### 1. Single Source of Truth

```typescript
// Bad: Multiple state sources
let isUnlocked = false;  // Main process
let dbOpen = false;      // Another variable

// Good: Single source
function isUnlocked(): boolean {
  return db !== null;
}
```

### 2. Immutable Updates

```typescript
// Bad: Mutating state
messages.push(newMessage);
setMessages(messages);

// Good: Immutable update
setMessages([...messages, newMessage]);
```

### 3. State Validation

```typescript
// Validate state transitions
function canTransition(from: AppState, to: AppState): boolean {
  const validTransitions = {
    'FRESH_INSTALL': ['PASSWORD_CREATED'],
    'PASSWORD_CREATED': ['BIOMETRIC_ENABLED', 'BIOMETRIC_DECLINED'],
    'LOCKED': ['UNLOCKED'],
    'UNLOCKED': ['LOCKED']
  };
  
  return validTransitions[from]?.includes(to) ?? false;
}
```

### 4. Cleanup on Unmount

```typescript
useEffect(() => {
  let mounted = true;
  
  const loadData = async () => {
    const data = await fetchData();
    if (mounted) {
      setData(data);
    }
  };
  
  loadData();
  
  return () => {
    mounted = false;
  };
}, []);
```

## Performance Considerations

### 1. Minimize Re-renders

```typescript
// Use React.memo for expensive components
export const ChatMessage = React.memo(({ message }) => {
  return <div>{message.content}</div>;
});

// Use useMemo for expensive calculations
const filteredMessages = useMemo(() => {
  return messages.filter(m => m.role === 'user');
}, [messages]);
```

### 2. Batch State Updates

```typescript
// Bad: Multiple updates
setLoading(true);
setError(null);
setData(null);

// Good: Single update
setState(prev => ({
  ...prev,
  loading: true,
  error: null,
  data: null
}));
```

### 3. Lazy State Initialization

```typescript
// Load expensive state only when needed
const [heavyData, setHeavyData] = useState<HeavyData | null>(null);

const loadHeavyData = useCallback(async () => {
  if (!heavyData) {
    const data = await fetchHeavyData();
    setHeavyData(data);
  }
}, [heavyData]);
```

## Future Enhancements

1. **Redux/Zustand Integration** - For complex state management
2. **State Persistence** - Save UI preferences
3. **Undo/Redo** - State history tracking
4. **Real-time Sync** - Multi-device state sync
5. **State Migrations** - Handle state schema changes