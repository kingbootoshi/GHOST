import Database from 'better-sqlite3-multiple-ciphers';
import sodium from 'libsodium-wrappers-sumo';
import logger from './utils/logger';
import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

let db: Database.Database | null = null;
let keyBuffer: Uint8Array | null = null;
let cachedPassphrase: string | null = null;

const DB_PATH = path.join(app.getPath('userData'), 'ghost.db');
const SALT_PATH = path.join(app.getPath('userData'), 'ghost.salt');

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

async function loadOrGenerateSalt(): Promise<Uint8Array> {
  if (fs.existsSync(SALT_PATH)) {
    return new Uint8Array(fs.readFileSync(SALT_PATH));
  }
  
  await sodium.ready;
  const salt = sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES);
  fs.writeFileSync(SALT_PATH, Buffer.from(salt));
  logger.info('Generated new salt for password derivation');
  return salt;
}

export async function openEncryptedDB(passphrase: string): Promise<Database.Database> {
  try {
    cachedPassphrase = passphrase;
    await sodium.ready;
    
    const salt = await loadOrGenerateSalt();
    
    // Derive key using Argon2id
    keyBuffer = sodium.crypto_pwhash(
      32,
      passphrase,
      salt,
      sodium.crypto_pwhash_OPSLIMIT_MODERATE,
      sodium.crypto_pwhash_MEMLIMIT_MODERATE,
      sodium.crypto_pwhash_ALG_DEFAULT
    );
    
    const keyHex = Buffer.from(keyBuffer).toString('hex');
    
    // Open database
    db = new Database(DB_PATH);
    
    // Configure encryption
    db.pragma(`cipher='aes256cbc'`);
    db.pragma(`key="x'${keyHex}'"`);
    db.pragma('journal_mode = WAL');
    
    // Test connection by creating system tables
    db.exec(`
      CREATE TABLE IF NOT EXISTS system_info (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      );
      
      CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
        content TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        metadata TEXT
      );
    `);
    
    logger.info('DB opened successfully, cipher=aes256cbc, WAL enabled');
    return db;
  } catch (error) {
    logger.error('Failed to open encrypted database:', error);
    lockDB();
    throw new AuthError('Failed to decrypt database - incorrect password?');
  }
}

export function lockDB(): void {
  if (db) {
    try {
      db.close();
      logger.info('Database closed');
    } catch (error) {
      logger.error('Error closing database:', error);
    } finally {
      db = null;
    }
  }
  
  if (keyBuffer) {
    sodium.memzero(keyBuffer);
    keyBuffer = null;
    logger.info('Key material zeroized');
  }

  if (cachedPassphrase) {
    cachedPassphrase = null;
  }
}

export function getDB(): Database.Database | null {
  return db;
}

export function isDatabaseExists(): boolean {
  return fs.existsSync(DB_PATH);
}

export function getCachedPassphrase(): string | null {
  return cachedPassphrase;
}