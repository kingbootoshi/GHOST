import keytar from 'keytar';
import { app, systemPreferences } from 'electron';
import logger from './logger';

// Service name used for keytar
const SERVICE_NAME = 'ghost-app';
const ACCOUNT_NAME = 'master-password';
const TOUCH_ID_ENABLED_KEY = 'touch-id-enabled';

/**
 * KeychainService handles secure storage of the master password
 * and biometric authentication with Touch ID
 */
class KeychainService {
  private isTouchIdAvailable: boolean = false;
  
  /**
   * Initialize the keychain service
   */
  public async init(): Promise<void> {
    // Wait for app to be ready if used early
    if (!app.isReady()) {
      await new Promise<void>((resolve) => {
        app.once('ready', () => resolve());
      });
    }
    
    // Check if Touch ID is available
    this.isTouchIdAvailable = this.checkTouchIdAvailability();
    logger.info(`KeychainService initialized. Touch ID available: ${this.isTouchIdAvailable}`);
  }
  
  /**
   * Store the master password in the keychain
   */
  public async storeMasterPassword(password: string): Promise<boolean> {
    try {
      await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, password);
      logger.info('Master password stored in keychain');
      return true;
    } catch (error) {
      logger.error('Failed to store master password in keychain:', error);
      return false;
    }
  }
  
  /**
   * Retrieve the master password from the keychain
   */
  public async getMasterPassword(): Promise<string | null> {
    try {
      const password = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
      return password;
    } catch (error) {
      logger.error('Failed to retrieve master password from keychain:', error);
      return null;
    }
  }
  
  /**
   * Delete the master password from the keychain
   */
  public async deleteMasterPassword(): Promise<boolean> {
    try {
      const result = await keytar.deletePassword(SERVICE_NAME, ACCOUNT_NAME);
      if (result) {
        logger.info('Master password deleted from keychain');
      } else {
        logger.warn('Master password not found in keychain when attempting to delete');
      }
      return result;
    } catch (error) {
      logger.error('Failed to delete master password from keychain:', error);
      return false;
    }
  }
  
  /**
   * Enable or disable Touch ID for authentication
   */
  public async setTouchIdEnabled(enabled: boolean): Promise<boolean> {
    try {
      await keytar.setPassword(SERVICE_NAME, TOUCH_ID_ENABLED_KEY, enabled ? 'true' : 'false');
      logger.info(`Touch ID ${enabled ? 'enabled' : 'disabled'}`);
      return true;
    } catch (error) {
      logger.error(`Failed to ${enabled ? 'enable' : 'disable'} Touch ID:`, error);
      return false;
    }
  }
  
  /**
   * Check if Touch ID is enabled for authentication
   */
  public async isTouchIdEnabled(): Promise<boolean> {
    try {
      const value = await keytar.getPassword(SERVICE_NAME, TOUCH_ID_ENABLED_KEY);
      return value === 'true';
    } catch (error) {
      logger.error('Failed to check if Touch ID is enabled:', error);
      return false;
    }
  }
  
  /**
   * Check if Touch ID is available on this device
   */
  public isTouchIdSupported(): boolean {
    return this.isTouchIdAvailable;
  }
  
  /**
   * Authenticate with Touch ID
   * Returns true if authentication successful, false otherwise
   */
  public async authenticateWithTouchId(prompt: string = 'Authenticate to unlock GHOST'): Promise<boolean> {
    // Not supported on non-macOS platforms or if Touch ID not available
    if (!this.isTouchIdAvailable) {
      logger.warn('Touch ID authentication attempted but not available');
      return false;
    }
    
    try {
      const touchIdEnabled = await this.isTouchIdEnabled();
      if (!touchIdEnabled) {
        logger.warn('Touch ID authentication attempted but not enabled');
        return false;
      }
      
      // Prompt for Touch ID
      const result = await systemPreferences.promptTouchID(prompt);
      logger.info('Touch ID authentication successful');
      return true;
    } catch (error) {
      // This error is expected when user cancels or fails authentication
      logger.warn('Touch ID authentication failed:', error);
      return false;
    }
  }
  
  /**
   * Check if Touch ID hardware is available
   */
  private checkTouchIdAvailability(): boolean {
    // Touch ID is only available on macOS
    if (process.platform !== 'darwin') {
      return false;
    }
    
    try {
      return systemPreferences.canPromptTouchID();
    } catch (error) {
      logger.error('Error checking Touch ID availability:', error);
      return false;
    }
  }
}

export default new KeychainService();