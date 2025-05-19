import { systemPreferences } from 'electron';
import * as keytar from 'keytar';
import logger from 'electron-log';

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