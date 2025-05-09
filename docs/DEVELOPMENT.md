# GHOST Development Guide

This guide provides essential information for developers working on or extending the GHOST application.

## Getting Started

### Prerequisites

- Node.js 20.x or later
- npm 8.x or later
- Git
- macOS 14+ (for Touch ID support)
- SQLCipher (required for database encryption)

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/yourorg/ghost.git
   cd ghost
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the application in development mode:
   ```bash
   npm start
   ```

## Development Workflow

### Project Structure

```
/
├── docs/                  # Documentation
├── src/                   # Source code
│   ├── assets/            # Static assets
│   ├── components/        # React components
│   ├── services/          # Main process services
│   ├── types/             # TypeScript type definitions 
│   ├── utils/             # Utility functions
│   ├── main.ts            # Main process entry
│   ├── preload.ts         # Preload script
│   └── renderer.tsx       # Renderer process entry
├── .eslintrc.json         # ESLint configuration
├── package.json           # Project metadata and dependencies
├── tsconfig.json          # TypeScript configuration
└── vite.*.config.ts       # Vite configurations
```

### Architecture

GHOST follows a secure Electron architecture with three main components:

1. **Main Process** (`src/main.ts`): Handles system integration, security, and data
2. **Preload Script** (`src/preload.ts`): Creates the bridge between processes
3. **Renderer Process** (`src/renderer.tsx`): Handles UI and user interaction

For more details, see [ARCHITECTURE.md](./ARCHITECTURE.md).

### Adding New Features

When adding new features, follow these guidelines:

#### Backend (Main Process) Features

1. Create a new service in `src/services/` if needed
2. Expose the service through IPC handlers in `main.ts`
3. Update the preload script to expose the API to the renderer
4. Document the new API in the appropriate docs

Example of adding a new IPC handler:

```typescript
// In main.ts
ipcMain.handle('new-feature:action', async (_, arg1, arg2) => {
  try {
    // Validate inputs
    if (!arg1 || typeof arg1 !== 'string') {
      throw new Error('Invalid argument');
    }
    
    // Call your service
    const result = await yourService.doSomething(arg1, arg2);
    return result;
  } catch (error) {
    logger.error('Error in new-feature:action', error);
    return false;
  }
});

// In preload.ts, add to the electronAPI object:
newFeatureAction: (arg1, arg2) => ipcRenderer.invoke('new-feature:action', arg1, arg2),
```

#### Frontend (Renderer Process) Features

1. Create new React components in `src/components/`
2. Use the exposed `electronAPI` methods for communication with the main process
3. Follow React best practices (functional components, hooks, etc.)
4. Style components consistently with the existing UI

Example of a new React component:

```tsx
import React, { useState, useEffect } from 'react';

interface MyComponentProps {
  someProp: string;
}

const MyComponent: React.FC<MyComponentProps> = ({ someProp }) => {
  const [result, setResult] = useState<string | null>(null);
  
  const handleAction = async () => {
    try {
      const response = await window.electronAPI.newFeatureAction(someProp, 'additional data');
      setResult(response);
    } catch (error) {
      console.error('Error calling new feature:', error);
    }
  };
  
  return (
    <div className="my-component">
      <button onClick={handleAction}>
        Trigger Action
      </button>
      {result && <div className="result">{result}</div>}
    </div>
  );
};

export default MyComponent;
```

### Working with the Database

The application uses SQLCipher for encrypted database storage. Here's how to interact with it:

1. Always use the `encryptedDatabase` service from the main process
2. Never attempt to access the database file directly
3. Use parameterized queries to prevent SQL injection
4. Use transactions for multiple related operations

Example database interaction:

```typescript
// Query example
const users = encryptedDatabase.query(`
  SELECT * FROM users WHERE created_at > ?
`, [yesterday.getTime()]);

// Transaction example
encryptedDatabase.transaction(db => {
  const stmt1 = db.prepare('INSERT INTO items (name) VALUES (?)');
  const stmt2 = db.prepare('UPDATE counts SET value = value + 1 WHERE name = ?');
  
  stmt1.run('New Item');
  stmt2.run('items_count');
});
```

### Working with Touch ID

To use Touch ID in your components:

1. Check if Touch ID is supported and enabled
2. Request authentication when needed
3. Handle success/failure appropriately

Example:

```typescript
const authenticateUser = async () => {
  // Check if Touch ID is available
  const isSupported = await window.electronAPI.isTouchIdSupported();
  const isEnabled = await window.electronAPI.isTouchIdEnabled();
  
  if (isSupported && isEnabled) {
    // Try Touch ID authentication
    const success = await window.electronAPI.authenticateWithTouchId();
    if (success) {
      // Authentication successful, proceed
      return true;
    } else {
      // Authentication failed, fall back to password
      return false;
    }
  } else {
    // Touch ID not available, use password flow
    return false;
  }
};
```

## Testing

### Unit Testing

Use Jest for unit testing:

```bash
npm run test
```

- Service tests: `src/services/__tests__/`
- Component tests: `src/components/__tests__/`
- Utility tests: `src/utils/__tests__/`

### Integration Testing

End-to-end testing with Puppeteer:

```bash
npm run test:e2e
```

## Building and Packaging

### Development Build

```bash
npm run package
```

### Production Build

```bash
npm run make
```

This will create platform-specific distributables in the `out/` directory.

## Security Best Practices

1. **Never** enable Node integration in the renderer process
2. Always use the IPC bridge for main process communication
3. Validate all inputs, especially from the renderer
4. Keep sensitive information (passwords, keys) in memory only as long as necessary
5. Follow the principle of least privilege when exposing APIs
6. Sanitize SQL queries to prevent injection
7. Use parameterized queries for database operations
8. Keep dependencies updated regularly

## Troubleshooting

### Common Issues

**Native Module Build Failures**

If you encounter errors building native modules (like better-sqlite3-sqlcipher or keytar):

1. Ensure you have the necessary build tools installed
2. On macOS, run: `xcode-select --install`
3. Try rebuilding the native modules: `npm rebuild`

**Keychain Access Issues**

If you encounter issues with keytar or Touch ID:

1. Ensure your app has keychain access
2. On macOS, you may need to approve the app's keychain access requests

**Database Encryption Issues**

If SQLCipher is not working properly:

1. Ensure SQLCipher is properly installed
2. Make sure you're using the correct key derivation parameters
3. Check if the database file exists and has the right permissions

## Contributing Guidelines

1. Follow the existing code style and architecture
2. Document public APIs and components
3. Write tests for new functionality
4. Keep commits focused and descriptive
5. Create detailed pull requests with clear explanations of changes