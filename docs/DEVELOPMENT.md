# GHOST Development Guide

## Prerequisites

Before starting development on GHOST, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **npm** (v9 or higher)
- **Git**
- **macOS** (for Touch ID features) or **Windows/Linux** (basic features)

## Initial Setup

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/ghost.git
cd ghost
```

### 2. Install Dependencies

```bash
npm install
```

This will:
- Install all dependencies
- Run the postinstall script to rebuild native modules
- Set up Electron-specific binaries

### 3. Environment Configuration

Create a `.env` file for development settings:

```bash
# .env
NODE_ENV=development
LOG_LEVEL=debug
VITE_DEV_SERVER_HOST=localhost
VITE_DEV_SERVER_PORT=5173
```

## Development Workflow

### Starting the Application

```bash
npm start
```

This launches:
- Vite dev server for the renderer process
- Electron main process with hot reload
- DevTools automatically open in development

### Code Structure

```
src/
├── main/           # Main process (Node.js environment)
├── preload/        # Preload scripts (limited environment)
├── renderer/       # Renderer process (browser environment)
└── modules/        # Plugin modules
```

### Making Changes

1. **Main Process Changes** - Automatically reload on save
2. **Renderer Process Changes** - Hot module replacement via Vite
3. **Preload Script Changes** - Requires app restart

## Building and Testing

### Running Tests

```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e
```

### Linting

```bash
# Run ESLint
npm run lint

# Fix auto-fixable issues
npm run lint -- --fix
```

### Type Checking

```bash
# Check TypeScript types
npm run typecheck
```

### Building for Production

```bash
# Package for current platform
npm run package

# Create distributables
npm run make

# Build for all platforms
npm run make -- --platform=all
```

## Key Development Concepts

### 1. Process Separation

GHOST uses three separate processes:

**Main Process:**
- Runs Node.js code
- Manages windows and system APIs
- Handles database operations
- Cannot directly access DOM

**Preload Script:**
- Runs in renderer context before page load
- Bridge between main and renderer
- Limited API access
- Exposes safe APIs to renderer

**Renderer Process:**
- Runs web code (React)
- No direct Node.js access
- Communicates via IPC
- Handles all UI

### 2. IPC Communication

```typescript
// Main process handler
ipcMain.handle('ghost:send-chat', async (event, text) => {
  // Process and return result
  return { success: true, data: response };
});

// Renderer process call
const result = await window.ghost.sendChat('Hello');
```

### 3. Database Operations

```typescript
// Always use prepared statements
const stmt = db.prepare('INSERT INTO messages VALUES (?, ?, ?)');
stmt.run(id, content, timestamp);

// Use transactions for bulk operations
const insertMany = db.transaction((items) => {
  for (const item of items) {
    stmt.run(item.id, item.content, item.timestamp);
  }
});
```

### 4. State Management

```typescript
// Main process state
let db: Database | null = null;

// Renderer process state
const [messages, setMessages] = useState<Message[]>([]);

// Keep states synchronized via IPC
const refreshMessages = async () => {
  const messages = await window.ghost.getChatLog();
  setMessages(messages);
};
```

## Common Development Tasks

### Adding a New IPC Handler

1. Define the handler in `src/main/ipc.ts`:
```typescript
ipcMain.handle('ghost:new-feature', async (event, args) => {
  // Implementation
  return result;
});
```

2. Add to preload API in `src/preload/index.ts`:
```typescript
contextBridge.exposeInMainWorld('ghost', {
  // ... existing methods
  newFeature: (args) => ipcRenderer.invoke('ghost:new-feature', args)
});
```

3. Update type definitions:
```typescript
interface GhostAPI {
  // ... existing methods
  newFeature: (args: any) => Promise<Result>;
}
```

### Creating a New Plugin

1. Create plugin directory:
```bash
mkdir src/modules/my-plugin
touch src/modules/my-plugin/index.ts
```

2. Implement the module:
```typescript
import { AssistantModule } from '../../main/modules';

const myPlugin: AssistantModule = {
  id: 'my-plugin',
  schema: `CREATE TABLE IF NOT EXISTS my_table (...)`,
  functions: [],
  async init(ctx) {
    ctx.log.info('Plugin initialized');
  }
};

export default myPlugin;
```

### Adding a React Component

1. Create component file:
```typescript
// src/renderer/components/MyComponent.tsx
import React from 'react';

interface MyComponentProps {
  title: string;
}

export function MyComponent({ title }: MyComponentProps) {
  return <div>{title}</div>;
}
```

2. Add styles:
```css
/* src/renderer/styles/MyComponent.css */
.my-component {
  /* styles */
}
```

3. Use in parent component:
```typescript
import { MyComponent } from './components/MyComponent';

function Parent() {
  return <MyComponent title="Hello" />;
}
```

## Debugging

### Main Process Debugging

1. Add debugger statement:
```typescript
debugger; // Breakpoint here
```

2. Start with inspector:
```bash
npm start -- --inspect
```

3. Open Chrome DevTools:
```
chrome://inspect
```

### Renderer Process Debugging

- DevTools open automatically in development
- Use React Developer Tools extension
- Console logs appear in DevTools console

### Database Debugging

```typescript
// Log SQL queries
db.on('trace', (sql) => {
  console.log('SQL:', sql);
});

// Check query performance
const start = Date.now();
const result = stmt.all();
console.log(`Query took ${Date.now() - start}ms`);
```

## Performance Optimization

### 1. React Optimization

```typescript
// Memoize expensive components
const ExpensiveComponent = React.memo(({ data }) => {
  return <div>{/* render */}</div>;
});

// Use useMemo for calculations
const filtered = useMemo(() => {
  return items.filter(item => item.active);
}, [items]);

// Use useCallback for functions
const handleClick = useCallback(() => {
  // handle click
}, [dependencies]);
```

### 2. Database Optimization

```typescript
// Create indexes for frequent queries
db.exec('CREATE INDEX idx_messages_timestamp ON messages(timestamp)');

// Use EXPLAIN to analyze queries
const plan = db.prepare('EXPLAIN QUERY PLAN SELECT ...').all();
console.log(plan);

// Batch operations in transactions
const transaction = db.transaction(() => {
  // Multiple operations
});
```

### 3. IPC Optimization

```typescript
// Batch IPC calls
const results = await Promise.all([
  window.ghost.getChatLog(),
  window.ghost.getAuthState(),
  window.ghost.getSettings()
]);

// Use debouncing for frequent updates
const debouncedSave = debounce(async (data) => {
  await window.ghost.saveData(data);
}, 500);
```

## Security Best Practices

### 1. Input Validation

```typescript
// Validate all user input
function validateMessage(text: string): boolean {
  if (!text || text.length > 10000) {
    return false;
  }
  return true;
}

// Sanitize for SQL
const stmt = db.prepare('SELECT * FROM messages WHERE id = ?');
stmt.get(sanitizedId); // Use parameters, never concatenate
```

### 2. Secure IPC

```typescript
// Validate IPC arguments
ipcMain.handle('ghost:action', async (event, args) => {
  if (!isValidArgs(args)) {
    throw new Error('Invalid arguments');
  }
  // Process safely
});
```

### 3. Logging

```typescript
// Never log sensitive data
logger.info('Processing message', { 
  length: message.length,
  // NOT: content: message.content
});
```

## Troubleshooting

### Common Issues

**1. Native module errors**
```bash
# Rebuild native modules
npm run postinstall
```

**2. TypeScript errors**
```bash
# Clean and rebuild
rm -rf dist .vite
npm run typecheck
```

**3. Database locked**
```bash
# Remove lock files
rm ~/Library/Application\ Support/ghost/ghost.db-wal
rm ~/Library/Application\ Support/ghost/ghost.db-shm
```

### Debug Logging

Enable verbose logging:
```typescript
// In main process
logger.transports.console.level = 'debug';
logger.transports.file.level = 'debug';
```

## Code Style Guide

### TypeScript

- Use strict mode
- Prefer interfaces over types
- Use explicit return types
- Document complex functions

### React

- Use functional components
- Prefer hooks over classes
- Keep components small
- Use proper prop types

### General

- Clear variable names
- Comments for complex logic
- Consistent formatting
- Error handling everywhere

## Release Process

### 1. Version Bump

```bash
npm version patch|minor|major
```

### 2. Build and Test

```bash
npm run test
npm run build
npm run package
```

### 3. Code Signing (macOS)

```bash
# Set up certificates
export APPLE_ID="your-apple-id"
export APPLE_PASSWORD="your-app-specific-password"

# Sign and notarize
npm run make
```

### 4. Distribution

- Upload to GitHub Releases
- Update documentation
- Notify users

## Contributing

### Pull Request Process

1. Fork the repository
2. Create feature branch
3. Make changes with tests
4. Run linting and tests
5. Submit pull request

### Code Review Checklist

- [ ] Tests pass
- [ ] Linting passes
- [ ] TypeScript compiles
- [ ] Security considered
- [ ] Performance impact assessed
- [ ] Documentation updated

## Resources

- [Electron Documentation](https://www.electronjs.org/docs)
- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [SQLite Documentation](https://www.sqlite.org/docs.html)
- [Vite Documentation](https://vitejs.dev/guide/)

## Support

- GitHub Issues: Report bugs
- Discussions: Ask questions
- Discord: Community chat
- Email: dev@ghost.app