# AI Agent Architecture

GHOST's AI agent system is designed as a modular, extensible framework that allows the AI to perform actions through function calling. This document outlines the architecture, components, and implementation details.

## Overview

The AI agent consists of several key components:

1. **Agent Core**: Central orchestrator that processes user input and manages function calls
2. **Module System**: Extensible framework for loading and executing custom functionality
3. **Function Schema Registry**: System for registering, validating, and documenting available functions
4. **Execution Environment**: Secure sandbox for running modules with controlled access to system capabilities

## Agent Core

The Agent Core (`src/services/agentCore.ts`) is the central component that:

- Processes user messages
- Determines when to invoke functions
- Manages conversations and context
- Handles function routing, validation, and execution
- Returns results to the user

### API

```typescript
processMessage(message: string): Promise<AgentResponse>
registerFunction(schema: FunctionSchema): boolean
unregisterFunction(name: string): boolean
getRegisteredFunctions(): FunctionSchema[]
```

### Message Flow

1. User sends message via chat interface
2. Message is passed to the Agent Core
3. Core sends message to LLM (GPT-4-o) with registered function schemas
4. LLM determines if a function should be called
5. If yes, function details are extracted and validated
6. Function is executed in the appropriate module
7. Results are sent back to LLM for final response generation
8. Complete response is returned to user

## Module System

The Module System (`src/services/moduleHost.ts`) manages loading, validation, and execution of modules that extend the AI's capabilities.

### Module Structure

Each module is a JavaScript file with a standard structure:

```typescript
// Example module: weather.ts
import { defineModule } from '../utils/moduleUtils';

export default defineModule({
  name: 'weather',
  description: 'Weather information retrieval functions',
  version: '1.0.0',
  functions: [
    {
      name: 'getCurrentWeather',
      description: 'Get current weather for a location',
      parameters: {
        type: 'object',
        properties: {
          location: { type: 'string', description: 'City name or coordinates' },
          units: { type: 'string', enum: ['celsius', 'fahrenheit'], default: 'celsius' }
        },
        required: ['location']
      },
      async handler({ location, units = 'celsius' }) {
        // Implementation
        return { temperature: 22, conditions: 'Sunny', humidity: 45 };
      }
    }
  ]
});
```

### Module Loading

Modules are loaded from the `modules/` directory at application startup. The loading process:

1. Discovers available module files
2. Validates module structure and schemas
3. Registers module functions with the Agent Core
4. Prepares execution environment for each module

### Module Isolation

Each module runs in a controlled environment with:

- Limited access to system resources
- Specific permissions based on module requirements
- No direct access to the database or filesystem
- Controlled API for specific operations

## Function Schema Registry

The Function Schema Registry maintains a catalog of all available functions that the AI can invoke.

### Schema Format

Functions follow the OpenAI function calling schema format:

```typescript
interface FunctionSchema {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description?: string;
      enum?: string[];
      default?: any;
    }>;
    required?: string[];
  };
}
```

### Schema Validation

When the AI attempts to invoke a function:

1. The requested function name is matched against registered functions
2. Provided parameters are validated against the schema
3. Required parameters are checked
4. Type validation is performed
5. If validation succeeds, the function is invoked
6. If validation fails, an error is returned to the AI

## Execution Environment

Function execution occurs in a sandboxed environment for security.

### Execution Context

Each module receives a controlled context with:

- `coreAPI`: Limited API for specific system operations
- `logger`: Logging facility for debugging
- `storage`: Module-specific persistent storage
- Custom capabilities based on module requirements

### Security Measures

To maintain security:

1. Modules run in separate worker threads
2. Direct access to Node.js APIs is restricted
3. Network access is controlled and monitored
4. File system access is limited to specific directories
5. Database access is mediated through controlled APIs

## Core API

Modules can access system functionality through a controlled CoreAPI:

```typescript
interface CoreAPI {
  // Database operations (read-only or specific tables)
  db: {
    query(sql: string, params?: any[]): Promise<any[]>;
  };
  
  // Network operations (controlled)
  network: {
    fetch(url: string, options?: FetchOptions): Promise<any>;
  };
  
  // Module storage (module-specific)
  storage: {
    get(key: string): Promise<any>;
    set(key: string, value: any): Promise<void>;
    delete(key: string): Promise<void>;
  };
}
```

## Integration with LLM

The AI Agent integrates with OpenAI's GPT-4-o using the function calling capabilities:

1. Function schemas are sent with each API request
2. The model decides when to call functions based on user input
3. Function calls are executed locally
4. Results are sent back to complete the conversation

### Example Request

```typescript
const response = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [
    { role: "system", content: "You are GHOST, an AI assistant..." },
    { role: "user", content: "What's the weather in New York?" }
  ],
  tools: [
    {
      type: "function",
      function: {
        name: "getCurrentWeather",
        description: "Get current weather for a location",
        parameters: {
          type: "object",
          properties: {
            location: {
              type: "string",
              description: "City name or coordinates"
            },
            units: {
              type: "string",
              enum: ["celsius", "fahrenheit"],
              default: "celsius"
            }
          },
          required: ["location"]
        }
      }
    }
  ]
});
```

## Extending the AI Agent

To add new capabilities to the AI:

1. Create a new module in `src/modules/`
2. Define functions with proper schemas
3. Implement function handlers
4. Register any required permissions
5. The module will be automatically loaded at startup

### Example Module Implementation

```typescript
// src/modules/calendar.ts
import { defineModule } from '../utils/moduleUtils';

export default defineModule({
  name: 'calendar',
  description: 'Calendar management functions',
  version: '1.0.0',
  permissions: ['calendar'],
  functions: [
    {
      name: 'addEvent',
      description: 'Add an event to the calendar',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Event title' },
          startTime: { type: 'string', description: 'Start time (ISO format)' },
          endTime: { type: 'string', description: 'End time (ISO format)' },
          description: { type: 'string', description: 'Event description' }
        },
        required: ['title', 'startTime', 'endTime']
      },
      async handler({ title, startTime, endTime, description = '' }, context) {
        // Implementation using context.coreAPI
        const event = await context.coreAPI.calendar.createEvent({
          title, startTime, endTime, description
        });
        
        return {
          success: true,
          eventId: event.id,
          message: `Event "${title}" added to calendar`
        };
      }
    }
  ]
});
```

## Error Handling

The AI agent implements robust error handling:

1. **Validation Errors**: When function parameters don't match schema
2. **Execution Errors**: When functions fail during execution
3. **Module Errors**: When modules fail to load or register
4. **Permission Errors**: When modules attempt unauthorized operations

All errors are:
- Logged for debugging
- Presented to the user in a friendly format
- Used to improve future interactions

## Future Extensions

The AI agent architecture is designed to support future enhancements:

1. **Multi-agent collaboration**: Multiple specialized agents working together
2. **Persistent memory**: Long-term storage of user preferences and history
3. **Advanced reasoning**: Multi-step planning and task decomposition
4. **Enhanced security**: Finer-grained permissions and capabilities
5. **User customization**: User-defined modules and preferences