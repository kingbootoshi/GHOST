# GHOST - Electron Application

## Overview

GHOST is an Electron desktop application built with TypeScript, Vite, and Electron Forge. It's currently a basic Electron starter template with a simple "Hello World" interface.

## Project Structure

```
GHOST/
├── src/
│   ├── main.ts        # Main process entry point
│   ├── preload.ts     # Preload script (currently minimal)
│   ├── renderer.ts    # Renderer process entry point
│   └── index.css      # Styles for the renderer
├── index.html         # Main HTML file
├── forge.config.ts    # Electron Forge configuration
├── tsconfig.json      # TypeScript configuration
├── vite.*.config.ts   # Vite configurations (main, preload, renderer)
├── package.json       # Package dependencies and scripts
└── .eslintrc.json     # ESLint configuration
```

## Technologies & Tools

### Core Stack
- **Electron** (v36.2.1): Desktop application framework
- **TypeScript** (v4.5.4): Type-safe JavaScript
- **Vite** (v5.4.19): Fast build tool
- **Electron Forge** (v7.8.1): Electron application tooling

### Development Tools
- **ESLint**: Code linting with TypeScript support
- **Electron Squirrel**: Windows installer support

## Application Architecture

### Main Process (`src/main.ts`)
- Creates the main BrowserWindow
- Handles application lifecycle events
- Manages window creation/closing
- Opens DevTools automatically

### Preload Script (`src/preload.ts`)
- Currently minimal with no functionality
- Can be used to expose selective APIs to renderer

### Renderer Process (`src/renderer.ts`)
- Entry point for the web content
- Imports CSS and logs a welcome message
- Node.js integration is disabled by default for security

## Available Scripts

```bash
npm start         # Start the application in development mode
npm run package   # Package the application
npm run make      # Build distributable packages
npm run publish   # Publish the application
npm run lint      # Run ESLint on TypeScript files
```

## Configuration

### TypeScript Configuration
- Target: ESNext
- Module: CommonJS
- Source maps enabled
- No implicit any enabled
- JSON modules supported

### Vite Configuration
- Separate configs for main, preload, and renderer
- Currently using default configurations

### Electron Forge Configuration
- Asar packaging enabled
- Multiple makers configured (Squirrel, ZIP, DEB, RPM)
- Vite plugin for build process
- Fuses plugin for security (various protections enabled)

## Security Features

The application uses Electron Fuses to enhance security:
- RunAsNode: disabled
- Cookie encryption: enabled
- Node options environment variable: disabled
- Node CLI inspect arguments: disabled
- Embedded Asar integrity validation: enabled
- Only load app from Asar: enabled

## Current State

This is a freshly initialized Electron project with:
- Basic window creation
- Minimal HTML interface ("Hello World")
- TypeScript setup
- Build tooling configured
- No tests implemented yet
- No custom functionality beyond the template

## Next Steps

To develop this application further:
1. Add actual functionality to the preload script if needed
2. Implement the main application logic in the renderer
3. Add tests (no testing framework currently configured)
4. Customize the UI beyond the basic template
5. Add application-specific features
6. Configure environment-specific settings
7. Set up CI/CD if needed

## Notes

- The project is not yet committed to git (all files are untracked)
- No README.md exists yet
- No testing framework is configured
- DevTools open automatically during development