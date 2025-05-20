# GHOST Documentation

GHOST is a secure, encrypted, plugin-ready AI chat application built with Electron and React. This documentation covers the architecture, implementation details, and development guidelines for the project.

## Table of Contents

1. [Architecture Overview](./ARCHITECTURE.md) - High-level system design and component interaction
2. [Security Model](./SECURITY.md) - Encryption implementation and security considerations
3. [Plugin System](./PLUGINS.md) - How to build and integrate plugins
4. [State Management](./STATE_MANAGEMENT.md) - Application state flow and authentication states
5. [Database Schema](./DATABASE.md) - Encrypted database structure and operations
6. [API Reference](./API.md) - IPC communication contracts and interfaces
7. [Development Guide](./DEVELOPMENT.md) - Setup, building, and debugging
8. [UI Components](./UI_COMPONENTS.md) - React component structure and flow

## Quick Start

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm start
```

3. Build for production:
```bash
npm run make
```

## Core Features

- **Encrypted Local Storage**: All data is encrypted using AES-256-CBC with Argon2id key derivation
- **Touch ID Integration**: Optional biometric unlock on macOS
- **Plugin Architecture**: Record-based function map with cross-module calls and compile-time UI loading
- **Secure IPC**: Context-isolated communication between processes
- **React UI**: Modern, responsive interface with dark theme

## Technology Stack

- **Electron** - Desktop application framework
- **React** - UI library
- **better-sqlite3-multiple-ciphers** - Encrypted SQLite database
- **libsodium-wrappers** - Cryptographic operations
- **keytar** - System keychain integration
- **electron-log** - Logging system
- **Vite** - Build tool

## Project Structure

```
GHOST/
├── docs/                 # Documentation
├── src/
│   ├── main/            # Main process
│   │   ├── bootstrap.ts # App initialization
│   │   ├── db.ts       # Database operations
│   │   ├── auth.ts     # Authentication logic
│   │   ├── modules.ts  # Plugin system
│   │   └── ipc.ts      # IPC handlers
│   ├── preload/        # Preload scripts
│   │   └── index.ts    # Context bridge
│   ├── renderer/       # Renderer process
│   │   ├── app.tsx     # Main React app
│   │   ├── views/      # UI components
│   │   └── hooks/      # React hooks
│   └── modules/        # Plugin modules
│       └── echo/       # Example plugin
├── forge.config.ts     # Electron Forge config
├── tsconfig.json       # TypeScript config
└── vite.*.config.ts    # Vite configurations
```