import { systemPreferences } from 'electron';
import * as keytar from 'keytar';
import logger from './utils/logger';

const KEYCHAIN_SERVICE = 'ghost.e2e';
const KEYCHAIN_ACCOUNT = 'master';

export async function canUseTouchID(): Promise<boolean> {
  if (process.platform !== 'darwin') {
    return false;
  }
  return systemPreferences.canPromptTouchID();
}

export async function maybeGetKeyFromTouchID(): Promise<string | null> {
  try {
    if (!await canUseTouchID()) {
      logger.info('Touch ID not available on this system');
      return null;
    }
    
    logger.info('Prompting for Touch ID authentication');
    await systemPreferences.promptTouchID('Unlock GHOST with Touch ID');
    logger.info('Touch ID authentication successful');
    
    const storedKey = await keytar.getPassword(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT);
    if (!storedKey) {
      logger.warn('No key found in Keychain after Touch ID success');
      return null;
    }
    
    logger.info('Retrieved key from Keychain');
    return storedKey;
  } catch (error) {
    logger.error('Touch ID authentication failed:', error);
    return null;
  }
}

export async function storeKeyInKeychain(key: string): Promise<boolean> {
  try {
    await keytar.setPassword(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT, key);
    logger.info('Successfully stored key in Keychain');
    return true;
  } catch (error) {
    logger.error('Failed to store key in Keychain:', error);
    return false;
  }
}

export async function removeKeyFromKeychain(): Promise<boolean> {
  try {
    const result = await keytar.deletePassword(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT);
    logger.info('Removed key from Keychain');
    return result;
  } catch (error) {
    logger.error('Failed to remove key from Keychain:', error);
    return false;
  }
}

export type AppState = 
  | 'FRESH_INSTALL'
  | 'PASSWORD_CREATED'
  | 'BIOMETRIC_ENABLED'
  | 'BIOMETRIC_DECLINED'
  | 'UNLOCKED'
  | 'LOCKED';

export interface AuthState {
  currentState: AppState;
  isBiometricEnabled: boolean;
  isFirstRun: boolean;
}

/**
 * Persists the biometric preference flags in the `system_info` table.
 * Uses an UPSERT so the same code path works for both first‐time insert and updates.
 *
 * @param {boolean} enabled   - Whether biometric unlock is enabled
 * @param {boolean} declined  - Whether the user has explicitly declined biometrics
 * @returns {Promise<void>}   Resolves once the values are written
 */
export async function setBiometricFlags(enabled: boolean, declined: boolean): Promise<void> {
  // Lazy import to avoid circular dependency issues
  const { getDB } = await import('./db');

  const db = getDB();
  if (!db) {
    throw new Error('Database must be unlocked before setting biometric flags');
  }

  // Coerce booleans to SQLite‐friendly strings
  const enabledVal = enabled ? '1' : '0';
  const declinedVal = declined ? '1' : '0';

  db.prepare(
    `INSERT INTO system_info (key, value)
       VALUES ('biometric_enabled', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value;`
  ).run(enabledVal);

  db.prepare(
    `INSERT INTO system_info (key, value)
       VALUES ('biometric_declined', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value;`
  ).run(declinedVal);
}

/**
 * Retrieves the biometric preference flags from the database.
 * Falls back to sensible defaults (`false`) when the keys are not present
 * (e.g. fresh install before migration runs).
 *
 * @returns {Promise<{ enabled: boolean; declined: boolean }>} Current flag values
 */
export async function getBiometricFlags(): Promise<{ enabled: boolean; declined: boolean }> {
  const { getDB } = await import('./db');
  const db = getDB();

  if (!db) {
    // If DB is not unlocked yet we can't read flags – default to disabled.
    return { enabled: false, declined: false };
  }

  const rowEnabled = db.prepare(`SELECT value FROM system_info WHERE key = 'biometric_enabled'`).get() as { value?: string } | undefined;
  const rowDeclined = db.prepare(`SELECT value FROM system_info WHERE key = 'biometric_declined'`).get() as { value?: string } | undefined;

  return {
    enabled: rowEnabled?.value === '1',
    declined: rowDeclined?.value === '1',
  };
}