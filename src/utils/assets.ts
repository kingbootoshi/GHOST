import path from 'node:path';
import { app } from 'electron';
import fs from 'fs';
import logger from '../services/logger';

/**
 * Utility to handle asset loading
 */
class AssetManager {
  private baseDir: string = '';
  private initialized: boolean = false;

  /**
   * Initialize the asset manager
   */
  public async init(): Promise<void> {
    if (this.initialized) return;

    // Wait for app to be ready if used early
    if (!app.isReady()) {
      await new Promise<void>((resolve) => {
        app.once('ready', () => resolve());
      });
    }

    // Set base directory for assets
    this.baseDir = path.join(app.getAppPath(), 'src', 'assets');
    this.initialized = true;
    logger.info(`AssetManager initialized with base directory: ${this.baseDir}`);
  }

  /**
   * Get the path to an asset
   */
  public getAssetPath(assetName: string): string {
    if (!this.initialized) {
      // Initialize synchronously if needed
      this.baseDir = path.join(app.getAppPath(), 'src', 'assets');
      this.initialized = true;
      logger.warn('AssetManager used before initialization');
    }

    const assetPath = path.join(this.baseDir, assetName);
    
    // Verify the asset exists
    if (!fs.existsSync(assetPath)) {
      logger.warn(`Asset not found: ${assetPath}`);
    }
    
    return assetPath;
  }

  /**
   * Get the URL for an asset (for use in the renderer)
   */
  public getAssetUrl(assetName: string): string {
    // In development, use the file protocol with the full path
    if (process.env.NODE_ENV !== 'production') {
      return `file://${this.getAssetPath(assetName)}`;
    }
    
    // In production, assets may be in a different location
    // This would need to be updated based on your electron-forge config
    return `asset://${assetName}`;
  }
}

export default new AssetManager();