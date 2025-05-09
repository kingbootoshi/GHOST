import encryptedDatabase from '../encryptedDatabase';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import sodium from 'libsodium-wrappers-sumo';

// Mock the dependencies
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn().mockReturnValue('/tmp/ghost-test'),
    isReady: jest.fn().mockReturnValue(true)
  }
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn()
}));

// Mock libsodium-wrappers-sumo
jest.mock('libsodium-wrappers-sumo', () => ({
  ready: Promise.resolve(),
  crypto_pwhash_SALTBYTES: 16,
  crypto_pwhash_OPSLIMIT_MODERATE: 4,
  crypto_pwhash_MEMLIMIT_MODERATE: 33554432, // 32 MB
  crypto_pwhash_ALG_ARGON2ID13: 2,
  crypto_pwhash: jest.fn().mockReturnValue(new Uint8Array(64)),
  randombytes_buf: jest.fn().mockReturnValue(new Uint8Array(16))
}));

// Mock SQLite
jest.mock('better-sqlite3', () => {
  return jest.fn().mockImplementation(() => ({
    pragma: jest.fn(),
    prepare: jest.fn().mockReturnValue({
      get: jest.fn().mockReturnValue({}),
      run: jest.fn(),
      all: jest.fn().mockReturnValue([])
    }),
    exec: jest.fn(),
    transaction: jest.fn().mockImplementation((fn) => {
      return () => fn({
        prepare: jest.fn().mockReturnValue({
          get: jest.fn().mockReturnValue(null),
          run: jest.fn()
        }),
        exec: jest.fn()
      });
    }),
    close: jest.fn()
  }));
});

jest.mock('../logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

describe('EncryptedDatabaseService salt initialisation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset service state
    encryptedDatabase['_isOpen'] = false;
    encryptedDatabase['db'] = null;
    // Setup default mock behaviors
    (fs.existsSync as jest.Mock).mockReturnValue(false);
  });

  it('should open the database successfully on first run', async () => {
    // First run with a new salt (salt file doesn't exist)
    (fs.existsSync as jest.Mock)
      .mockReturnValueOnce(false)  // database file doesn't exist
      .mockReturnValueOnce(false); // salt file doesn't exist

    await encryptedDatabase.init();
    const success = await encryptedDatabase.open('TestPassword123!');
    
    // Verify the success and that salt file was created
    expect(success).toBe(true);
    expect(fs.writeFileSync).toHaveBeenCalled();
    expect(sodium.randombytes_buf).toHaveBeenCalled();
    expect(encryptedDatabase.isUnlocked()).toBe(true);
    
    // Clean up
    encryptedDatabase.close();
  });

  it('should use existing salt file when available', async () => {
    // Mock both fs.existsSync and fs.readFileSync before the test
    const mockSalt = Buffer.from(new Uint8Array(16));
    
    // Clear all mocks first
    jest.clearAllMocks();
    
    // Always return true for existsSync when checking for salt file
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    
    // Always return our mock salt for readFileSync
    (fs.readFileSync as jest.Mock).mockReturnValue(mockSalt);
    
    // Spy on getSalt directly
    const getSaltSpy = jest.spyOn(encryptedDatabase as any, 'getSalt');

    await encryptedDatabase.init();
    const success = await encryptedDatabase.open('TestPassword123!');
    
    // Verify that getSalt was called
    expect(success).toBe(true);
    expect(getSaltSpy).toHaveBeenCalled();
    
    // Restore the spy
    getSaltSpy.mockRestore();
    
    // Clean up
    encryptedDatabase.close();
  });

  it('should handle multiple open calls gracefully', async () => {
    // Set up mocks for a successful first open
    (fs.existsSync as jest.Mock)
      .mockReturnValue(false);  // No files exist
    
    await encryptedDatabase.init();
    
    // First open should succeed
    const firstResult = await encryptedDatabase.open('TestPassword123!');
    expect(firstResult).toBe(true);
    
    // Mock that the DB is now open (directly set the internal state)
    encryptedDatabase['_isOpen'] = true;
    
    // Second open should not throw and should warn about already open
    const secondResult = await encryptedDatabase.open('AnotherPassword');
    expect(secondResult).toBe(true);
    
    // Clean up
    encryptedDatabase.close();
  });
});