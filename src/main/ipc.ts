import { ipcMain } from 'electron';
import logger from './utils/logger';
import { openEncryptedDB, lockDB, getDB, isDatabaseExists, getCachedPassphrase } from './db';
import { maybeGetKeyFromTouchID, storeKeyInKeychain, removeKeyFromKeychain, canUseTouchID, setBiometricFlags, getBiometricFlags } from './auth';
import { moduleRegistry } from './modules';
import { v4 as uuidv4 } from 'uuid';
import { syncManager } from './sync';

// Shared application-wide types
import { ChatMessage, AuthState } from '../types';

// Simple in-memory token storage for MVP
let currentAuthToken: string | null = null;

async function getSavedAuthToken(): Promise<string | null> {
  return currentAuthToken;
}

export function setupIPC() {
  // Auth/password management
  ipcMain.handle('ghost:create-password', async (event, password: string) => {
    logger.info('IPC: create-password called');
    try {
      const db = await openEncryptedDB(password);
      await moduleRegistry.loadModules(db);
      
      // Check if biometrics are available so the renderer can prompt.
      const canBiometric = await canUseTouchID();

      // Ensure initial flags exist (defaults handled in migration).
      await setBiometricFlags(false, false);

      return { success: true, canBiometric };
    } catch (error) {
      // TypeScript treats caught errors as unknown, cast to Error for logging
      const err = error as Error;
      logger.error('Failed to create password:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('ghost:unlock', async (event, password?: string) => {
    logger.info('IPC: unlock called');
    try {
      let actualPassword = password;
      
      // Try biometric unlock if no password provided
      if (!password) {
        const bioKey = await maybeGetKeyFromTouchID();
        if (bioKey) {
          actualPassword = bioKey;
        } else {
          throw new Error('No password provided and biometric unlock failed');
        }
      }
      
      const db = await openEncryptedDB(actualPassword!);
      await moduleRegistry.loadModules(db);
      
      // Check if sync should be enabled
      try {
        const supabaseUrl = process.env.SUPABASE_URL;
        const savedToken = await getSavedAuthToken(); // We'll need to implement this
        if (supabaseUrl && savedToken && syncManager.isEnabled()) {
          await syncManager.init({
            db,
            supabaseUrl,
            getAuthToken: async () => savedToken
          });
        }
      } catch (syncError) {
        logger.error('Failed to initialize sync on unlock:', syncError);
        // Don't fail the unlock if sync fails
      }
      
      return { success: true };
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to unlock:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('ghost:lock', async () => {
    logger.info('IPC: lock called');
    
    // Shutdown sync if enabled
    try {
      if (syncManager.isEnabled()) {
        await syncManager.shutdown();
      }
    } catch (error) {
      logger.error('Failed to shutdown sync on lock:', error);
    }
    
    lockDB();
    return { success: true };
  });

  ipcMain.handle('ghost:get-auth-state', async () => {
    logger.info('IPC: get-auth-state called');
    const db = getDB();
    const canBiometric = await canUseTouchID();
    const { enabled: biometricEnabled, declined: biometricDeclined } = await getBiometricFlags();
    
    return {
      isUnlocked: db !== null,
      isFirstRun: !isDatabaseExists(),
      canUseBiometric: canBiometric,
      biometricEnabled,
      biometricDeclined
    } as AuthState;
  });

  // ────────────────────────────────────────────────────────────────
  // Biometric opt-in / opt-out handlers
  // ────────────────────────────────────────────────────────────────

  ipcMain.handle('ghost:enable-biometric', async () => {
    logger.info('[BIO] enableBiometric IPC start');

    // Ensure DB is unlocked so we can read/write system_info.
    const db = getDB();
    if (!db) {
      return { success: false, error: 'Database locked' };
    }

    const passphrase = getCachedPassphrase();
    if (!passphrase) {
      return { success: false, error: 'Passphrase not cached' };
    }

    const stored = await storeKeyInKeychain(passphrase);
    if (!stored) {
      logger.error('[BIO] Failed to store key in Keychain');
      return { success: false, error: 'Keychain error' };
    }

    await setBiometricFlags(true, false);
    return { success: true };
  });

  ipcMain.handle('ghost:disable-biometric', async () => {
    logger.info('[BIO] disableBiometric IPC start');

    const removed = await removeKeyFromKeychain();
    if (!removed) {
      return { success: false, error: 'Failed to delete key from Keychain' };
    }

    await setBiometricFlags(false, true);
    return { success: true };
  });

  // Chat operations
  ipcMain.handle('ghost:get-chat-log', async () => {
    logger.info('IPC: get-chat-log called');
    const db = getDB();
    if (!db) {
      throw new Error('Database not unlocked');
    }
    
    const messages = db.prepare(`
      SELECT * FROM chat_messages 
      ORDER BY timestamp ASC
    `).all() as ChatMessage[];
    
    return messages;
  });

  ipcMain.handle('ghost:send-chat', async (event, text: string) => {
    logger.info('IPC: send-chat called with text length:', text.length);
    const db = getDB();
    if (!db) {
      throw new Error('Database not unlocked');
    }
    
    // Create user message
    const userMessage: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content: text,
      timestamp: Date.now()
    };
    
    // Store user message
    db.prepare(`
      INSERT INTO chat_messages (id, role, content, timestamp, metadata)
      VALUES (?, ?, ?, ?, ?)
    `).run(userMessage.id, userMessage.role, userMessage.content, userMessage.timestamp, null);
    
    // For MVP, just echo back
    const assistantMessage: ChatMessage = {
      id: uuidv4(),
      role: 'assistant',
      content: `Echo: ${text}`,
      timestamp: Date.now()
    };
    
    // Store assistant message
    db.prepare(`
      INSERT INTO chat_messages (id, role, content, timestamp, metadata)
      VALUES (?, ?, ?, ?, ?)
    `).run(assistantMessage.id, assistantMessage.role, assistantMessage.content, assistantMessage.timestamp, null);
    
    return assistantMessage;
  });

  // ────────────────────────────────────────────────────────────────
  // Module registry – list & invoke
  // ────────────────────────────────────────────────────────────────

  ipcMain.handle('ghost:list-modules', () => {
    logger.debug('[IPC] list-modules');
    return moduleRegistry.listModules();
  });

  ipcMain.handle('ghost:invoke-module', async (_event, moduleId: string, fn: string, args: any) => {
    logger.debug('[IPC] invoke-module %s.%s', moduleId, fn);
    try {
      const result = await moduleRegistry.invoke(moduleId, fn, args);
      return result; // raw result
    } catch (error) {
      const err = error as Error;
      logger.error('[IPC] invoke-module error:', err);
      return { error: err.message };
    }
  });

  // Module settings management
  ipcMain.handle('ghost:get-module-settings', async (_event, moduleId: string) => {
    logger.debug('[IPC] get-module-settings %s', moduleId);
    try {
      const db = getDB();
      if (!db) {
        throw new Error('Database not unlocked');
      }

      const result = await db.prepare(
        'SELECT json FROM module_settings WHERE module_id = ?'
      ).get(moduleId) as { json: string } | undefined;

      return result ? JSON.parse(result.json) : {};
    } catch (error) {
      const err = error as Error;
      logger.error('[IPC] get-module-settings error:', err);
      return { error: err.message };
    }
  });

  ipcMain.handle('ghost:patch-module-settings', async (_event, moduleId: string, diff: any) => {
    logger.debug('[IPC] patch-module-settings %s', moduleId);
    try {
      const db = getDB();
      if (!db) {
        throw new Error('Database not unlocked');
      }

      // Get current settings
      const result = await db.prepare(
        'SELECT json FROM module_settings WHERE module_id = ?'
      ).get(moduleId) as { json: string } | undefined;

      const current = result ? JSON.parse(result.json) : {};
      const updated = { ...current, ...diff };

      // TODO: Validate against module schema here
      
      // Save updated settings
      await db.prepare(
        'INSERT OR REPLACE INTO module_settings (module_id, json) VALUES (?, ?)'
      ).run(moduleId, JSON.stringify(updated));

      return { success: true };
    } catch (error) {
      const err = error as Error;
      logger.error('[IPC] patch-module-settings error:', err);
      return { success: false, error: err.message };
    }
  });

  // ────────────────────────────────────────────────────────────────
  // Sync management
  // ────────────────────────────────────────────────────────────────

  ipcMain.handle('ghost:enable-sync', async (event, token: string) => {
    logger.info('IPC: enable-sync called');
    try {
      const db = getDB();
      if (!db) {
        throw new Error('Database not unlocked');
      }

      // Store token for future use
      currentAuthToken = token;

      await syncManager.init({
        db,
        supabaseUrl: process.env.SUPABASE_URL || 'https://your-project.supabase.co',
        getAuthToken: async () => token
      });

      return { success: true };
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to enable sync:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('ghost:disable-sync', async () => {
    logger.info('IPC: disable-sync called');
    try {
      await syncManager.shutdown();
      currentAuthToken = null; // Clear token
      return { success: true };
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to disable sync:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('ghost:get-sync-status', async () => {
    logger.info('IPC: get-sync-status called');
    return syncManager.getStatus();
  });
}