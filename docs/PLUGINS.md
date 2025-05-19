# GHOST Plugin Development Guide

## Overview

GHOST's plugin system allows developers to extend the application with new AI capabilities, data sources, and integrations. Plugins run within the main process and have access to the encrypted database while maintaining security boundaries.

## Plugin Architecture

### Core Concepts

1. **AssistantModule** - The main plugin interface
2. **ToolDef** - Functions that can be called by the AI
3. **ModuleContext** - Runtime environment for plugins
4. **Schema** - Database tables specific to the plugin

### Module Structure

```typescript
interface AssistantModule {
  id: string;                            // Unique identifier
  schema: string;                        // SQL CREATE statements
  functions: ToolDef[];                  // Exposed functions
  init(ctx: ModuleContext): Promise<void>; // Initialization hook
}
```

## Creating a Plugin

### 1. Project Structure

```
src/modules/my-plugin/
├── index.ts       # Main module file
├── schema.sql     # Database schema
├── tools.ts       # Tool implementations
└── README.md      # Documentation
```

### 2. Basic Plugin Example

```typescript
// src/modules/my-plugin/index.ts
import { AssistantModule, ModuleContext } from '../../main/modules';

const myPlugin: AssistantModule = {
  id: 'my-plugin',
  
  schema: `
    CREATE TABLE IF NOT EXISTS my_plugin_data (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    );
  `,
  
  functions: [{
    name: 'store-data',
    description: 'Stores data in the plugin table',
    parameters: {
      type: 'object',
      properties: {
        content: { type: 'string' }
      },
      required: ['content']
    },
    handler: async ({ content }) => {
      // Implementation here
      return { success: true };
    }
  }],
  
  async init(ctx: ModuleContext) {
    ctx.log.info('My plugin initialized');
  }
};

export default myPlugin;
```

### 3. Database Schema

Plugins can define their own tables:

```sql
-- schema.sql
CREATE TABLE IF NOT EXISTS my_plugin_data (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  user_id TEXT,
  metadata TEXT, -- JSON data
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX idx_my_plugin_user ON my_plugin_data(user_id);
```

### 4. Tool Implementation

```typescript
// tools.ts
import { ToolDef } from '../../main/modules';

export const searchTool: ToolDef = {
  name: 'search',
  description: 'Search for content in the database',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      limit: { type: 'number', default: 10 }
    },
    required: ['query']
  },
  handler: async ({ query, limit = 10 }, ctx) => {
    const results = ctx.db.prepare(`
      SELECT * FROM my_plugin_data 
      WHERE content LIKE ? 
      LIMIT ?
    `).all(`%${query}%`, limit);
    
    return results;
  }
};
```

## Advanced Features

### 1. State Management

```typescript
class MyPlugin implements AssistantModule {
  private state: Map<string, any> = new Map();
  
  async init(ctx: ModuleContext) {
    // Initialize state
    this.state.set('initialized', true);
    
    // Set up periodic tasks
    setInterval(() => {
      this.performMaintenance(ctx);
    }, 60000); // Every minute
  }
  
  private async performMaintenance(ctx: ModuleContext) {
    ctx.log.info('Running maintenance task');
    // Cleanup old data, etc.
  }
}
```

### 2. Inter-Plugin Communication

```typescript
// Plugin A exposes a service
const pluginA: AssistantModule = {
  id: 'plugin-a',
  
  async init(ctx: ModuleContext) {
    // Register a service
    ctx.registerService('data-provider', {
      getData: async (key: string) => {
        return ctx.db.prepare('SELECT * FROM data WHERE key = ?').get(key);
      }
    });
  }
};

// Plugin B uses the service
const pluginB: AssistantModule = {
  id: 'plugin-b',
  
  async init(ctx: ModuleContext) {
    // Use service from Plugin A
    const dataProvider = ctx.getService('data-provider');
    const data = await dataProvider.getData('some-key');
  }
};
```

### 3. Event Handling

```typescript
const eventPlugin: AssistantModule = {
  id: 'event-handler',
  
  async init(ctx: ModuleContext) {
    // Subscribe to events
    ctx.on('chat:message', async (message) => {
      ctx.log.info('New message:', message.id);
      await this.processMessage(message);
    });
    
    // Emit events
    ctx.emit('plugin:ready', { pluginId: this.id });
  }
};
```

## Best Practices

### 1. Error Handling

```typescript
handler: async (params) => {
  try {
    // Validate inputs
    if (!params.content || params.content.length > 10000) {
      throw new Error('Invalid content');
    }
    
    // Perform operation
    const result = await performOperation(params);
    return { success: true, data: result };
    
  } catch (error) {
    ctx.log.error('Operation failed:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
}
```

### 2. Database Transactions

```typescript
async function complexOperation(ctx: ModuleContext) {
  const transaction = ctx.db.transaction(() => {
    // Multiple database operations
    ctx.db.prepare('INSERT INTO table1 ...').run();
    ctx.db.prepare('UPDATE table2 ...').run();
    ctx.db.prepare('DELETE FROM table3 ...').run();
  });
  
  try {
    transaction();
    ctx.log.info('Transaction completed');
  } catch (error) {
    ctx.log.error('Transaction failed:', error);
    throw error;
  }
}
```

### 3. Performance Optimization

```typescript
// Prepare statements for reuse
class MyPlugin {
  private statements: {
    insert?: any;
    select?: any;
  } = {};
  
  async init(ctx: ModuleContext) {
    // Prepare frequently used statements
    this.statements.insert = ctx.db.prepare(
      'INSERT INTO my_table (id, data) VALUES (?, ?)'
    );
    
    this.statements.select = ctx.db.prepare(
      'SELECT * FROM my_table WHERE id = ?'
    );
  }
  
  async insertData(id: string, data: any) {
    return this.statements.insert.run(id, JSON.stringify(data));
  }
}
```

## Testing Plugins

### 1. Unit Testing

```typescript
// __tests__/my-plugin.test.ts
import { createTestContext } from '../../../test/helpers';
import myPlugin from '../index';

describe('MyPlugin', () => {
  let ctx: ModuleContext;
  
  beforeEach(() => {
    ctx = createTestContext();
  });
  
  test('initializes correctly', async () => {
    await myPlugin.init(ctx);
    expect(ctx.log.info).toHaveBeenCalledWith('My plugin initialized');
  });
  
  test('stores data correctly', async () => {
    const handler = myPlugin.functions[0].handler;
    const result = await handler({ content: 'test' }, ctx);
    expect(result.success).toBe(true);
  });
});
```

### 2. Integration Testing

```typescript
// Test with real database
import Database from 'better-sqlite3';
import { createRealContext } from '../../../test/integration';

test('plugin works with encrypted database', async () => {
  const ctx = await createRealContext();
  await myPlugin.init(ctx);
  
  // Test actual database operations
  const result = await myPlugin.functions[0].handler(
    { content: 'test data' }, 
    ctx
  );
  
  expect(result.success).toBe(true);
});
```

## Plugin Distribution

### 1. Package Structure

```
my-ghost-plugin/
├── package.json
├── README.md
├── LICENSE
├── dist/
│   ├── index.js
│   └── index.d.ts
└── src/
    └── index.ts
```

### 2. Publishing

```json
// package.json
{
  "name": "@ghost-plugins/my-plugin",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "ghost": {
    "version": "^1.0.0",
    "moduleId": "my-plugin"
  }
}
```

### 3. Installation

Future versions will support:
```bash
ghost install @ghost-plugins/my-plugin
```

## Security Guidelines

### Do's
- ✅ Validate all user inputs
- ✅ Use prepared statements
- ✅ Handle errors gracefully
- ✅ Log important events
- ✅ Clean up resources

### Don'ts
- ❌ Store secrets in code
- ❌ Execute raw SQL from users
- ❌ Access filesystem directly
- ❌ Make network requests without user consent
- ❌ Log sensitive information

## Example Plugins

### 1. Echo Plugin (Built-in)
Simple example that echoes user input

### 2. Note Taker
Stores and retrieves encrypted notes

### 3. Task Manager
Todo list with due dates and priorities

### 4. Web Clipper
Save and search web content

### 5. API Connector
Interface with external services

## Future Enhancements

1. **Plugin Marketplace** - Central repository for plugins
2. **Sandboxing** - Enhanced isolation for untrusted plugins
3. **Hot Reloading** - Update plugins without restart
4. **Version Management** - Handle plugin compatibility
5. **Dependency Resolution** - Manage plugin dependencies