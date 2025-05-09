# GHOST Architecture Overview

GHOST is built using a secure, modern Electron architecture with strict context isolation between the main and renderer processes. This document outlines the core architecture, security considerations, and component interactions.

## Process Model

GHOST follows Electron's multi-process architecture:

1. **Main Process** (`src/main.ts`):
   - Manages application lifecycle
   - Handles privileged operations (file system, database, native APIs)
   - Registers global hotkeys
   - Provides IPC handlers for the renderer process
   - Manages security policies

2. **Preload Script** (`src/preload.ts`):
   - Creates a secure bridge between main and renderer processes
   - Exposes a controlled set of APIs via contextBridge
   - Prevents direct access to Node.js APIs from the renderer
   - Handles IPC communication

3. **Renderer Process** (`src/renderer.tsx` and React components):
   - Handles UI rendering and user interactions
   - Communicates with the main process only through the exposed API
   - Cannot access Node.js or Electron APIs directly (for security)

## Security Architecture

GHOST is built with security as a foundation:

### Context Isolation

The application uses strict context isolation to prevent renderer processes from accessing Node.js APIs or accessing the main process except through explicitly permitted channels.

### End-to-End Encryption

All user data is stored in an encrypted SQLite database using SQLCipher with AES-256-CBC encryption. The database cannot be accessed without the master password.

### Key Derivation

The master password is processed using the Argon2id key derivation function to generate a strong encryption key. This process is computationally intensive to protect against brute force attacks.

### Secure IPC

All IPC (Inter-Process Communication) is carefully controlled through predefined channels. The renderer process can only access APIs that are explicitly exposed through the context bridge.

### TouchID Integration

On macOS, the application can use TouchID for biometric authentication. The master password is stored securely in the system keychain and can only be accessed after successful biometric authentication.

## Core Services

### EncryptedDatabaseService

Manages the SQLCipher-encrypted database:
- Handles secure database creation and opening
- Manages encryption keys derived from the master password
- Provides transaction support and query execution
- Initializes the database schema

### KeychainService

Manages secure password storage and biometric authentication:
- Stores the master password in the system keychain
- Integrates with TouchID for biometric authentication
- Provides secure password retrieval for auto-unlock

### HotkeyListener

Manages global shortcuts:
- Registers the global ⌘⇧Space hotkey
- Sends toggle events to the renderer process
- Manages cleanup on application exit

## Data Flow

1. **Authentication Flow**:
   - User provides master password or uses TouchID
   - Password is used to derive encryption key
   - Database is unlocked with the derived key
   - Success/failure is communicated to the UI

2. **Chat Interaction Flow**:
   - User triggers chat via hotkey or UI
   - Input is sent to AI agent via main process
   - Agent may invoke system functions through the module system
   - Responses are displayed in the UI

3. **Data Synchronization Flow**:
   - Changes are made to local database
   - PowerSync adapter detects changes
   - Encrypted data is synchronized to Supabase
   - Remote changes are pulled and merged locally

## Module System

GHOST features a modular system for extending the AI assistant's capabilities:

1. **Module Host**:
   - Loads modules from predefined locations
   - Provides a sandboxed environment for execution
   - Exposes a limited API for modules to use

2. **Module Structure**:
   - Each module defines functions it can perform
   - Functions include schemas for validation
   - Modules register with the AI agent for invocation

3. **Function Calling**:
   - AI agent identifies appropriate function
   - Module host locates and executes the function
   - Results are returned to the agent

## Directory Structure

```
/src
  /components        # React UI components
  /services          # Main process services
    - encryptedDatabase.ts
    - keychain.ts
    - hotkeyListener.ts
    - logger.ts
  /utils             # Shared utility functions
  /types             # TypeScript type definitions
  /assets            # Static assets (images, etc.)
  /hooks             # React hooks
  main.ts            # Main process entry
  preload.ts         # Preload script for context bridge
  renderer.tsx       # Renderer process entry
```

## Security Considerations for Developers

When extending GHOST:

1. **Main Process**: Any code that needs access to Node.js APIs or system resources must run in the main process. Never add Node.js integration to the renderer.

2. **IPC Communication**: When adding new IPC channels, carefully validate all inputs and limit the functionality exposed.

3. **Error Handling**: Ensure errors are properly caught and don't expose sensitive information.

4. **Updates**: Keep dependencies up to date, especially Electron, to benefit from security patches.

5. **Data Handling**: All user data should remain encrypted at rest. Never store sensitive data unencrypted.

6. **Modules**: When implementing new modules, ensure they are properly sandboxed and cannot access the broader system.