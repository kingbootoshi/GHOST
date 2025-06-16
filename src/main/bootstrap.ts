import { app, BrowserWindow, globalShortcut } from 'electron';
import logger, { setupRendererLogging } from './utils/logger';
import * as path from 'path';
import { setupIPC } from './ipc';
import { lockDB, getDB } from './db';
import { canUseTouchID } from './auth';
import * as keytar from 'keytar';

// Vite plugin for Electron defines these globals at build time. Declaring
// them here prevents TypeScript/ESLint complaints while still allowing the
// real values to be injected during the Vite build.
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

// -----------------------------------------------------------------------------
// Register a TypeScript require-hook in **development** so that the main process
// can `require()` raw .ts / .tsx files (e.g. module entry points) without
// tripping the "ERR_UNKNOWN_FILE_EXTENSION" error.  This happens *before* any
// runtime code attempts to load a user module.
// -----------------------------------------------------------------------------
if (process.env.NODE_ENV === 'development') {
  /* eslint-disable @typescript-eslint/no-var-requires */
  // `transpileOnly` keeps the hook lightweight – we rely on Vite/TS for type
  // checking.  Compiler options mirror the target the rest of the main bundle
  // is compiled for so that emitted code is compatible with the current Node
  // version shipped with Electron.
  require('ts-node').register({
    transpileOnly: true,
    compilerOptions: {
      target: 'es2020',
      module: 'commonjs',
      jsx: 'react-jsx',
    },
  });
  /* eslint-enable @typescript-eslint/no-var-requires */
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

logger.info('App starting, env=' + process.env.NODE_ENV);

let mainWindow: BrowserWindow | null = null;

const createWindow = () => {
  // Resolve the preload path dynamically so that it works in both the
  // development environment (Vite dev server, bundle in `.vite/build`) and the
  // packaged application (preload ends up in a sibling `../preload` folder).
  let preloadPath = path.join(__dirname, '../preload/index.js');
  if (!require('fs').existsSync(preloadPath)) {
    // Fallback to dev location next to the compiled main bundle
    preloadPath = path.join(__dirname, 'index.js');
  }

  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Load the index.html of the app
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
};

// This method will be called when Electron has finished initialization
app.on('ready', () => {
  // Register IPC relay for renderer logs BEFORE anything else touches IPC
  setupRendererLogging();

  logger.info('App ready');
  
  // Set up IPC handlers
  setupIPC();
  
  // Create window
  createWindow();
  
  // After creating the window, attempt automatic biometric unlock if
  // the feature is enabled and the database is still locked.
  (async () => {
    try {
      if (getDB() || !mainWindow) return; // Already unlocked or no window

      const biometricAvailable = await canUseTouchID();
      if (!biometricAvailable) return;

      const keyExists = await keytar.getPassword('ghost.e2e', 'master');
      if (keyExists) {
        logger.info('[BIO] Auto biometric attempt queued');
        mainWindow.webContents.once('did-finish-load', () => {
          mainWindow!.webContents.send('auto-bio-start');
        });
      } else {
        logger.verbose('[BIO] No key in keychain – skip auto login');
      }
    } catch (error) {
      logger.error('[BIO] Failed to queue auto biometric attempt', error as Error);
    }
  })();
  
  // Register global shortcut (Cmd+Shift+G on macOS, Ctrl+Shift+G on others)
  const shortcut = process.platform === 'darwin' ? 'Cmd+Shift+G' : 'Ctrl+Shift+G';
  globalShortcut.register(shortcut, () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
      }
    }
  });
  
  logger.info(`Registered global shortcut: ${shortcut}`);
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  logger.info('All windows closed');
  lockDB();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Clean up on quit
app.on('will-quit', () => {
  logger.info('App will quit');
  globalShortcut.unregisterAll();
  lockDB();
});

// Handle any unhandled promise rejections
process.on('unhandledRejection', (error) => {
  logger.error('Unhandled promise rejection:', error);
});

export { mainWindow };