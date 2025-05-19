import { ipcMain } from 'electron';
import logger from 'electron-log';
import { openEncryptedDB, lockDB, getDB, isDatabaseExists } from './db';
import { maybeGetKeyFromTouchID, storeKeyInKeychain, canUseTouchID } from './auth';
import { moduleRegistry } from './modules';
import { v4 as uuidv4 } from 'uuid';
import * as keytar from 'keytar';

// Shared application-wide types
import { ChatMessage, AuthState } from '../types';

export function setupIPC() {
  // Auth/password management
  ipcMain.handle('ghost:create-password', async (event, password: string) => {
    logger.info('IPC: create-password called');
    try {
      const db = await openEncryptedDB(password);
      await moduleRegistry.loadModules(db);
      
      // Check if biometric is available and ask to enable
      const canBiometric = await canUseTouchID();
      if (canBiometric) {
        // Store the password for biometric unlock
        await storeKeyInKeychain(password);
      }
      
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
      
      return { success: true };
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to unlock:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('ghost:lock', async () => {
    logger.info('IPC: lock called');
    lockDB();
    return { success: true };
  });

  ipcMain.handle('ghost:get-auth-state', async () => {
    logger.info('IPC: get-auth-state called');
    const db = getDB();
    const canBiometric = await canUseTouchID();
    
    // Check if password is stored in keychain
    let biometricEnabled = false;
    if (canBiometric) {
      try {
        const key = await keytar.getPassword('ghost.e2e', 'master');
        biometricEnabled = !!key;
      } catch (error) {
        logger.error('Error checking keychain:', error as Error);
      }
    }
    
    return {
      isUnlocked: db !== null,
      isFirstRun: !isDatabaseExists(),
      canUseBiometric: canBiometric,
      biometricEnabled
    } as AuthState;
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
}