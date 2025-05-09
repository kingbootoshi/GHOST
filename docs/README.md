# GHOST Documentation

Welcome to the GHOST documentation. This directory contains detailed information about the architecture, components, and development practices for the GHOST application.

## Overview

GHOST (Generic Hub for Optimized Secure Technology) is a local-first, end-to-end-encrypted AI assistant hub built with Electron, React, and TypeScript. It provides a secure environment for AI interactions with strong encryption, biometric authentication, and modular extensibility.

## Documentation Index

### Architecture and Design
- [Architecture Overview](./ARCHITECTURE.md): High-level architecture and security design
- [Component Reference](./COMPONENTS.md): Detailed information about core components
- [AI Agent Architecture](./AI_AGENT.md): The AI agent system and function calling framework

### Development
- [Development Guide](./DEVELOPMENT.md): Setup, workflow, and best practices
- [README.md](../README.md): Project overview and quick start

## Key Features

- **End-to-End Encryption**: All user data is securely encrypted using SQLCipher with AES-256-CBC
- **Local-First Architecture**: Your data stays on your device by default
- **Biometric Authentication**: Support for Touch ID on macOS for secure, convenient unlock
- **Global Hotkey**: Access your AI assistant from anywhere with the ⌘⇧Space hotkey
- **Modular AI Integration**: Run AI agents that can invoke runtime-loaded modules with JSON function calls
- **Secure Sync**: Synchronize encrypted data to Supabase via PowerSync

## Getting Started

For new developers, we recommend following this sequence:

1. Read the [README.md](../README.md) for a quick overview
2. Review the [Architecture Overview](./ARCHITECTURE.md) to understand the high-level design
3. Follow the [Development Guide](./DEVELOPMENT.md) to set up your environment
4. Explore the [Component Reference](./COMPONENTS.md) for details on specific parts
5. Learn about the [AI Agent Architecture](./AI_AGENT.md) if you're working with the AI system

## Security

Security is a fundamental aspect of GHOST. Key security features include:

- **Context Isolation**: Strict separation between renderer and main processes
- **End-to-End Encryption**: All user data is encrypted with a master password
- **Secure IPC**: Carefully controlled communication between processes
- **Biometric Authentication**: Touch ID integration for convenient, secure access
- **No Node Integration**: Renderer process has no direct access to Node.js APIs

## Contributing

When contributing to GHOST:

1. Follow the existing architecture and security practices
2. Ensure all user data remains encrypted
3. Document new components and APIs
4. Write tests for new functionality
5. Keep security as a top priority

## Additional Resources

- [Electron Documentation](https://www.electronjs.org/docs)
- [React Documentation](https://reactjs.org/docs)
- [TypeScript Documentation](https://www.typescriptlang.org/docs)
- [SQLCipher Documentation](https://www.zetetic.net/sqlcipher/documentation/)