# GHOST - Local-First, End-to-End-Encrypted AI Assistant Hub

GHOST (Generic Hub for Optimized Secure Technology) is an Electron application that provides a local-first, end-to-end-encrypted AI assistant hub for macOS.

## Features

- **End-to-End Encryption**: All user data is securely encrypted using SQLCipher with AES-256-CBC
- **Local-First Architecture**: Your data stays on your device by default
- **Biometric Authentication**: Support for Touch ID on macOS for secure, convenient unlock
- **Global Hotkey**: Access your AI assistant from anywhere with the ⌘⇧Space hotkey
- **Modular AI Integration**: Run AI agents that can invoke runtime-loaded modules with JSON function calls
- **Secure Sync**: Synchronize encrypted data to Supabase via PowerSync

## Development Status

The application is currently in early development stage. Core components have been implemented:

- ✅ Application framework with Electron + Vite + TypeScript + React
- ✅ HotkeyListener for global ⌘⇧Space shortcut
- ✅ EncryptedDatabaseService with SQLCipher
- ✅ KeychainService with Touch ID integration
- ✅ GhostAnimator component
- ✅ Basic React UI for chat interface

## Getting Started

### Prerequisites

- Node.js 20.x or higher
- npm 8.x or higher
- macOS 14 (Sonoma) or higher (for Touch ID support)

### Installation

1. Clone this repository
2. Install dependencies:

```bash
npm install
```

### Development

Run the application in development mode:

```bash
npm start
```

### Building

Package the application:

```bash
npm run package
```

Create distributables for the current platform:

```bash
npm run make
```

## Architecture

The application follows a secure Electron architecture:

1. **Main Process** (`src/main.ts`): Handles application lifecycle, creates windows, and interfaces with the operating system
2. **Preload Script** (`src/preload.ts`): Provides a secure bridge between the renderer and main processes
3. **Renderer Process** (`src/renderer.tsx` and React components): Handles the UI and user interactions

### Component Overview

- **HotkeyListener**: Registers the global shortcut (⌘⇧Space) for toggling the chat interface
- **EncryptedDatabaseService**: Manages secure data storage with SQLCipher
- **KeychainService**: Handles secure password storage and Touch ID integration
- **GhostAnimator**: Provides animated visuals for the chat interface
- **Chat Interface**: UI for interacting with AI assistant

## Security

- **Context Isolation**: Strict separation between renderer and main processes
- **Restricted IPC**: Carefully limited API exposure through the context bridge
- **End-to-End Encryption**: All user data is encrypted with a master password
- **No Node Integration**: Renderer process has no direct access to Node.js APIs

## License

MIT