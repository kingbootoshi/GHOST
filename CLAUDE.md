# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GHOST is an Electron application built with TypeScript and Vite. It uses Electron Forge for building and packaging.

## Commands

### Development

- Start the application in development mode:
  ```bash
  npm start
  ```

### Building

- Package the application:
  ```bash
  npm run package
  ```

- Create distributables for the current platform:
  ```bash
  npm run make
  ```

- Publish the application:
  ```bash
  npm run publish
  ```

### Code Quality

- Run ESLint to check for code issues:
  ```bash
  npm run lint
  ```

## Architecture

This is an Electron application that follows the standard Electron architecture:

1. **Main Process** (`src/main.ts`): Handles application lifecycle, creates windows, and interfaces with the operating system
2. **Preload Script** (`src/preload.ts`): Runs in a privileged environment with access to Node.js and Electron APIs
3. **Renderer Process** (`src/renderer.ts` and `index.html`): Renders the UI using web technologies

### Build System

- Uses Vite for bundling and development server
- Uses Electron Forge for packaging and distribution
- Three separate Vite configurations for main, preload, and renderer processes

### Configuration Files

- `forge.config.ts`: Configures Electron Forge build options, packaging, and distribution settings
- `vite.*.config.ts`: Controls how Vite bundles different parts of the application
- `tsconfig.json`: TypeScript compiler options

## Security

The application uses Electron Fuses to secure the application at package time:
- Cookie encryption enabled
- Node.js integration disabled in renderer process
- ASAR integrity validation enabled