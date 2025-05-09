// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from 'electron';

// Send debug logs to console
console.log('Preload script running');

/**
 * Expose protected methods that allow the renderer process to use
 * specific Electron APIs safely through the contextBridge
 */
contextBridge.exposeInMainWorld('electronAPI', {
  // Test function to manually trigger chat toggle - for development only
  testToggleChat: () => {
    ipcRenderer.send('test-toggle-chat');
  },
  
  // Listen for chat toggle event
  onToggleChat: (callback: () => void) => {
    console.log('Setting up chat toggle listener');
    ipcRenderer.on('toggle-chat', () => {
      console.log('Toggle chat event received');
      callback();
    });
    // Return a function to remove the listener
    return () => {
      console.log('Removing chat toggle listener');
      ipcRenderer.removeAllListeners('toggle-chat');
    };
  },

  // System information
  getPlatform: () => process.platform,
  
  // Database operations
  unlockDatabase: (password: string) => ipcRenderer.invoke('database:unlock', password),
  lockDatabase: () => ipcRenderer.invoke('database:lock'),
  isDatabaseUnlocked: () => ipcRenderer.invoke('database:isUnlocked'),
  databaseExists: () => ipcRenderer.invoke('database:exists'),
  
  // Touch ID and keychain operations
  isTouchIdSupported: () => ipcRenderer.invoke('auth:isTouchIdSupported'),
  isTouchIdEnabled: () => ipcRenderer.invoke('auth:isTouchIdEnabled'),
  setTouchIdEnabled: (enabled: boolean) => ipcRenderer.invoke('auth:setTouchIdEnabled', enabled),
  authenticateWithTouchId: () => ipcRenderer.invoke('auth:authenticateWithTouchId'),
  
  // Database access (with proper validation in main process)
  executeQuery: (sql: string, params: any[]) => ipcRenderer.invoke('database:query', sql, params),
  executeTransaction: (operations: Array<{sql: string, params: any[]}>) => 
    ipcRenderer.invoke('database:transaction', operations),
});

// Type definitions to be used in the renderer process
// These will need to be added to a type declaration file later
export type ElectronAPI = {
  onToggleChat: (callback: () => void) => () => void;
  getPlatform: () => string;
  
  // Database operations
  unlockDatabase: (password: string) => Promise<boolean>;
  lockDatabase: () => Promise<boolean>;
  isDatabaseUnlocked: () => Promise<boolean>;
  
  // Touch ID and keychain operations
  isTouchIdSupported: () => Promise<boolean>;
  isTouchIdEnabled: () => Promise<boolean>;
  setTouchIdEnabled: (enabled: boolean) => Promise<boolean>;
  authenticateWithTouchId: () => Promise<boolean>;
  
  // Database access
  executeQuery: (sql: string, params: any[]) => Promise<any[]>;
  executeTransaction: (operations: Array<{sql: string, params: any[]}>) => Promise<boolean>;
};
