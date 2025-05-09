/**
 * Type definitions for the Electron API exposed through the preload script
 */

declare global {
  interface Window {
    electronAPI: {
      // IPC event listeners
      onToggleChat: (callback: () => void) => () => void;
      
      // System information
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
  }
}

export {};