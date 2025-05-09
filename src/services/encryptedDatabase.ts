import Database from 'better-sqlite3';
import path from 'node:path';
import { app } from 'electron';
import crypto from 'crypto';
import fs from 'fs';
import logger from './logger';
import sodium from 'libsodium-wrappers-sumo';

/**
 * Service for managing an encrypted SQLite database with SQLCipher
 */
class EncryptedDatabaseService {
  private db: Database.Database | null = null;
  private _isOpen = false;
  private dbPath: string = '';
  
  /**
   * Check if the database is currently open
   */
  public get isOpen(): boolean {
    return this._isOpen;
  }
  
  // Expose a dynamic way to check if the database is open
  // This is needed for TypeScript since the getter may not be accessible
  public isUnlocked(): boolean {
    return this._isOpen;
  }
  
  /**
   * Initialize the database service
   */
  public async init(): Promise<void> {
    // Wait for app to be ready if used early
    if (!app.isReady()) {
      await new Promise<void>((resolve) => {
        app.once('ready', () => resolve());
      });
    }

    // Set database path in user data directory
    const userDataPath = app.getPath('userData');
    this.dbPath = path.join(userDataPath, 'ghost_data.db');
    
    logger.info('EncryptedDatabaseService initialized');
  }

  /**
   * Open the database with the provided password
   * Uses Argon2id for key derivation
   */
  public async open(password: string): Promise<boolean> {
    logger.info('EncryptedDatabaseService.open called');
    
    try {
      if (this._isOpen) {
        logger.warn('open() called while DB already unlocked');
        return true;
      }
      
      // Derive a 64-byte key using Argon2id (RAM: 256MB, Operations: 4)
      // Note: getSalt() already ensures sodium.ready is awaited
      const salt = await this.getSalt();
      
      // Defensive fallbacks for crypto constants
      const opslimit = typeof sodium.crypto_pwhash_OPSLIMIT_MODERATE === 'number'
                      ? sodium.crypto_pwhash_OPSLIMIT_MODERATE
                      : 4;
                      
      const memlimit = typeof sodium.crypto_pwhash_MEMLIMIT_MODERATE === 'number'
                      ? sodium.crypto_pwhash_MEMLIMIT_MODERATE 
                      : 33554432; // 32 MB
                      
      const algorithm = typeof sodium.crypto_pwhash_ALG_ARGON2ID13 === 'number'
                      ? sodium.crypto_pwhash_ALG_ARGON2ID13
                      : 2;
      
      const keyBytes = sodium.crypto_pwhash(
        64,
        password,
        salt,
        opslimit,
        memlimit,
        algorithm
      );
      
      // Convert to hex for SQLCipher
      const keyHex = Buffer.from(keyBytes).toString('hex');
      logger.debug('Derived keyHex=%s (first 16 chars shown)', keyHex.slice(0,16));

      // Open the database
      this.db = new Database(this.dbPath, { readonly: false });
      
      // Configure encryption settings
      // In a production build, use better-sqlite3-sqlcipher for full SQLCipher support
      // For now, use pragmas that work with regular better-sqlite3
      this.db.pragma(`key = '${keyHex}'`);
      this.db.pragma('cipher_page_size = 4096');
      this.db.pragma('kdf_iter = 64000');
      
      // Test that the database is properly opened
      this.db.prepare('SELECT count(*) FROM sqlite_master').get();
      
      this._isOpen = true;
      logger.info('[DB] Database opened successfully at %s', this.dbPath);
      
      // Initialize database if needed
      this.initializeSchema();
      
      logger.info('EncryptedDatabaseService.open completed success=%s', true);
      return true;
    } catch (error) {
      logger.error('Failed to open database:', error);
      this.close();
      logger.info('EncryptedDatabaseService.open completed success=%s', false);
      return false;
    }
  }
  
  /**
   * Close the database connection
   */
  public close(): void {
    logger.info('EncryptedDatabaseService.close called');
    
    if (this.db) {
      try {
        this.db.close();
        this.db = null;
        this._isOpen = false;
        logger.info('Database closed successfully');
      } catch (error) {
        logger.error('Error closing database:', error);
      }
    } else {
      logger.debug('close() called but database was not open');
    }
    
    logger.info('EncryptedDatabaseService.close completed');
  }
  
  /**
   * Execute a query and return all results
   */
  public query<T = any>(sql: string, params: any[] = []): T[] {
    if (!this._isOpen || !this.db) {
      throw new Error('Database not open');
    }
    
    try {
      const statement = this.db.prepare(sql);
      if (sql.trim().toLowerCase().startsWith('select')) {
        return statement.all(...params) as T[];
      } else {
        statement.run(...params);
        return [] as T[];
      }
    } catch (error) {
      logger.error('Query error:', error, sql);
      throw error;
    }
  }
  
  /**
   * Execute a query and return the first result
   */
  public queryOne<T = any>(sql: string, params: any[] = []): T | null {
    if (!this._isOpen || !this.db) {
      throw new Error('Database not open');
    }
    
    try {
      const statement = this.db.prepare(sql);
      return statement.get(...params) as T || null;
    } catch (error) {
      logger.error('QueryOne error:', error, sql);
      throw error;
    }
  }
  
  /**
   * Execute a transaction function
   */
  public transaction<T>(fn: (db: Database.Database) => T): T {
    if (!this._isOpen || !this.db) {
      throw new Error('Database not open');
    }
    
    const transaction = this.db.transaction(fn);
    return transaction(this.db);
  }
  
  /**
   * Check if the database file exists
   */
  public databaseExists(): boolean {
    return fs.existsSync(this.dbPath);
  }
  
  /**
   * Get or create the salt for key derivation
   * Stores the salt in a separate file in the user data directory
   * @returns Promise resolving to the salt as Uint8Array
   */
  private async getSalt(): Promise<Uint8Array> {
    await sodium.ready;  // block until WASM loaded
    
    // Add defensive fallback for crypto constants
    const SALT_LEN = typeof sodium.crypto_pwhash_SALTBYTES === 'number' 
                     ? sodium.crypto_pwhash_SALTBYTES 
                     : 16;  // ✨ defensive fallback
    
    const SALT_FILE = path.join(app.getPath('userData'), 'key_derivation.salt');
    
    // Log salt length for debugging
    logger.debug('[DB] Using libsodium sumo build — SALT_LEN=%d', SALT_LEN);
    
    try {
      // If salt exists, use it
      if (fs.existsSync(SALT_FILE)) {
        logger.debug('Salt file found → reusing existing salt');
        const salt = fs.readFileSync(SALT_FILE);
        logger.info('[DB] Salt loaded (%dB)', SALT_LEN);
        return salt;
      }
      
      // Otherwise, create a new salt
      const salt = sodium.randombytes_buf(SALT_LEN);
      fs.writeFileSync(SALT_FILE, Buffer.from(salt));
      logger.info('[DB] Salt created & loaded (%dB)', SALT_LEN);
      return salt;
    } catch (error) {
      // If there's any error, generate a salt but don't save it
      // This is less secure but prevents complete failure
      logger.error('Error handling salt file:', error);
      
      // Ensure sodium is ready before generating random bytes
      await sodium.ready;
      return sodium.randombytes_buf(SALT_LEN);
    }
  }
  
  /**
   * Initialize database schema
   */
  private initializeSchema(): void {
    if (!this._isOpen || !this.db) {
      return;
    }
    
    try {
      this.transaction((db) => {
        // Create users table
        db.exec(`
          CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
          );
        `);
        
        // Create conversations table
        db.exec(`
          CREATE TABLE IF NOT EXISTS conversations (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
          );
        `);
        
        // Create messages table
        db.exec(`
          CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            conversation_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE CASCADE
          );
        `);
        
        // Create modules table for loadable AI agent modules
        db.exec(`
          CREATE TABLE IF NOT EXISTS modules (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            version TEXT NOT NULL,
            enabled INTEGER NOT NULL DEFAULT 1,
            source TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
          );
        `);
        
        // Create sync_status table for tracking sync with Supabase
        db.exec(`
          CREATE TABLE IF NOT EXISTS sync_status (
            id INTEGER PRIMARY KEY CHECK (id = 1), -- Only one row
            last_sync_at INTEGER,
            sync_status TEXT,
            sync_error TEXT
          );
        `);
        
        // Initialize sync_status if needed
        const syncStatusExists = db.prepare('SELECT 1 FROM sync_status LIMIT 1').get();
        if (!syncStatusExists) {
          db.prepare('INSERT INTO sync_status (id, sync_status) VALUES (1, ?)').run('initialized');
        }
      });
      
      logger.info('Database schema initialized');
    } catch (error) {
      logger.error('Error initializing database schema:', error);
    }
  }
}

export default new EncryptedDatabaseService();