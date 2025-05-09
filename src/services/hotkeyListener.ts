import { globalShortcut, BrowserWindow, ipcMain } from 'electron';
import logger from './logger';

/**
 * HotkeyListener class to register global shortcuts and toggle chat pop-over
 */
class HotkeyListener {
  private mainWindow: BrowserWindow | null = null;
  private isRegistered = false;
  private readonly shortcut = 'CommandOrControl+Shift+Space';

  /**
   * Initialize hotkey listener with the main browser window
   * @param window Main browser window
   */
  public init(window: BrowserWindow): void {
    this.mainWindow = window;
    
    // Register the global shortcut
    this.register();

    // Clean up on app quit
    this.mainWindow.on('closed', () => {
      this.unregister();
      this.mainWindow = null;
    });

    logger.info('HotkeyListener initialized');
  }

  /**
   * Register the global shortcut
   */
  private register(): void {
    if (this.isRegistered) {
      logger.info('Hotkey already registered, skipping registration');
      return;
    }

    try {
      // Register the shortcut
      logger.info('Attempting to register hotkey: ' + this.shortcut);
      const registered = globalShortcut.register(this.shortcut, () => {
        logger.info('🔥 Hotkey triggered: ' + this.shortcut);
        
        if (this.mainWindow) {
          logger.info('Sending toggle-chat event to renderer process');
          // Send an IPC event to toggle the chat
          this.mainWindow.webContents.send('toggle-chat');
          
          logger.info('Emitting toggle-chat event for main process listeners');
          // Emit event for other main process listeners
          ipcMain.emit('toggle-chat');
        } else {
          logger.warn('Main window not available when hotkey triggered');
        }
      });

      if (!registered) {
        logger.error('Failed to register hotkey: ' + this.shortcut);
      } else {
        this.isRegistered = true;
        logger.info('Registered hotkey: ' + this.shortcut);
      }
    } catch (error) {
      logger.error('Error registering hotkey:', error);
    }
  }

  /**
   * Unregister the global shortcut
   */
  private unregister(): void {
    if (!this.isRegistered) {
      return;
    }

    try {
      globalShortcut.unregister(this.shortcut);
      this.isRegistered = false;
      logger.info('Unregistered hotkey: ' + this.shortcut);
    } catch (error) {
      logger.error('Error unregistering hotkey:', error);
    }
  }
}

export default new HotkeyListener();