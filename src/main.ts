import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import started from 'electron-squirrel-startup';
import hotkeyListener from './services/hotkeyListener';
import { initLogger } from './services/logger';
import logger from './services/logger';
import encryptedDatabase from './services/encryptedDatabase';
import keychainService from './services/keychain';

// Disable hardware acceleration to reduce memory usage
app.disableHardwareAcceleration();

// Improve performance on macOS
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// Keep a global reference of the window object to prevent it from being garbage collected
let mainWindow: BrowserWindow | null = null;

// Set up IPC handlers for database and authentication operations
const setupIpcHandlers = () => {
  // Add test handler for toggle-chat
  ipcMain.on('test-toggle-chat', () => {
    logger.info('Test toggle-chat received, forwarding to main window');
    if (mainWindow) {
      mainWindow.webContents.send('toggle-chat');
      // Also trigger main process event for existing listeners
      ipcMain.emit('toggle-chat');
    }
  });
  // Database operations
  ipcMain.handle('database:unlock', async (_, password: string) => {
    try {
      return await encryptedDatabase.open(password);
    } catch (error) {
      logger.error('Error unlocking database:', error);
      return false;
    }
  });
  
  ipcMain.handle('database:lock', () => {
    try {
      encryptedDatabase.close();
      return true;
    } catch (error) {
      logger.error('Error locking database:', error);
      return false;
    }
  });
  
  ipcMain.handle('database:isUnlocked', () => {
    try {
      // Use the method instead of the property
      return encryptedDatabase.isUnlocked();
    } catch (error) {
      logger.error('Error checking if database is unlocked:', error);
      return false;
    }
  });
  
  ipcMain.handle('database:exists', () => {
    try {
      return encryptedDatabase.databaseExists();
    } catch (error) {
      logger.error('Error checking if database exists:', error);
      return false;
    }
  });
  
  ipcMain.handle('database:query', async (_, sql: string, params: any[]) => {
    try {
      // Add security checks here to prevent SQL injection
      // For example, check if the sql string contains only allowed queries
      return encryptedDatabase.query(sql, params);
    } catch (error) {
      logger.error('Error executing query:', error);
      return [];
    }
  });
  
  ipcMain.handle('database:transaction', async (_, operations: Array<{sql: string, params: any[]}>) => {
    try {
      encryptedDatabase.transaction((db) => {
        for (const op of operations) {
          // Add security checks here
          const stmt = db.prepare(op.sql);
          stmt.run(...op.params);
        }
      });
      return true;
    } catch (error) {
      logger.error('Error executing transaction:', error);
      return false;
    }
  });
  
  // Touch ID and keychain operations
  ipcMain.handle('auth:isTouchIdSupported', () => {
    try {
      return keychainService.isTouchIdSupported();
    } catch (error) {
      logger.error('Error checking Touch ID support:', error);
      return false;
    }
  });
  
  ipcMain.handle('auth:isTouchIdEnabled', async () => {
    try {
      return await keychainService.isTouchIdEnabled();
    } catch (error) {
      logger.error('Error checking if Touch ID is enabled:', error);
      return false;
    }
  });
  
  ipcMain.handle('auth:setTouchIdEnabled', async (_, enabled: boolean) => {
    try {
      return await keychainService.setTouchIdEnabled(enabled);
    } catch (error) {
      logger.error('Error setting Touch ID:', error);
      return false;
    }
  });
  
  /** Touch-ID setup: store pw + flip flag */
  ipcMain.handle('auth:setupTouchId', async (_, password:string) => {
    try {
      if (!keychainService.isTouchIdSupported()) {
        logger.warn('[TouchID] setup attempted on unsupported device');
        return false;
      }
      await keychainService.storeMasterPassword(password);      // 1️⃣
      await keychainService.setTouchIdEnabled(true);            // 2️⃣
      logger.info('[TouchID] Enabled via IPC');
      return true;
    } catch (err) {
      logger.error('[TouchID] setup failed:', err);
      return false;
    }
  });
  
  ipcMain.handle('auth:authenticateWithTouchId', async () => {
    try {
      const success = await keychainService.authenticateWithTouchId();
      if (success) {
        // If Touch ID successful, get the master password from keychain
        const password = await keychainService.getMasterPassword();
        if (password) {
          // Auto-unlock the database with the retrieved password
          return await encryptedDatabase.open(password);
        }
      }
      return false;
    } catch (error) {
      logger.error('Error authenticating with Touch ID:', error);
      return false;
    }
  });
};

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, // Security: isolate preload script from renderer
      nodeIntegration: false, // Security: prevent direct access to Node APIs
      sandbox: true, // Security: enable sandboxing for renderer
    },
    // Set window behavior for better UX
    show: false, // Don't show the window until it's ready
    backgroundColor: '#f0f0f0', // Set background color to reduce flicker
  });

  // Initialize services that need the main window
  hotkeyListener.init(mainWindow);

  // Show window once it's ready to prevent flashing
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // and load the html of the app
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    // Enable debug mode with a query parameter
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  // Open the DevTools in development mode
  if (process.env.NODE_ENV !== 'production') {
    mainWindow.webContents.openDevTools();
  }

  // Clear the reference when the window is closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // Initialize logger
  initLogger();
  
  // Initialize services
  await encryptedDatabase.init();
  await keychainService.init();
  
  // Setup IPC handlers for renderer communication
  setupIpcHandlers();
  
  // Create the main window
  createWindow();
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Handle app before quit to clean up resources
app.on('before-quit', () => {
  // Close database connection
  encryptedDatabase.close();
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
