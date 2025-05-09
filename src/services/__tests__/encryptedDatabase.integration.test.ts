import fs from 'fs';
import path from 'path';
import os from 'os';

// Create a test-specific temp directory path
const testTempDir = path.join(os.tmpdir(), 'ghost-test-' + Date.now());

// Mock the Electron app.getPath to use a temp directory
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn().mockReturnValue(testTempDir),
    isReady: jest.fn().mockReturnValue(true)
  }
}));

// Import after mocking
import encryptedDatabase from '../encryptedDatabase';

// Mock better-sqlite3 to avoid actual DB operations
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

// Mock logger to silence output during tests
jest.mock('../logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

// DO NOT mock libsodium-wrappers-sumo - we want to use the real library for this test

describe('EncryptedDatabaseService Integration', () => {
  const testUserDataPath = testTempDir;
  const saltPath = path.join(testUserDataPath, 'key_derivation.salt');
  const dbPath = path.join(testUserDataPath, 'ghost_data.db');
  
  // Create test directory before running tests
  beforeEach(() => {
    // Create temp directory if it doesn't exist
    if (!fs.existsSync(testUserDataPath)) {
      fs.mkdirSync(testUserDataPath, { recursive: true });
    }
  });
  
  // Clean up test directory after tests
  afterEach(() => {
    // Clean up any files created during tests
    if (fs.existsSync(saltPath)) {
      fs.unlinkSync(saltPath);
    }
    // Try to remove the test directory
    try {
      fs.rmdirSync(testUserDataPath);
    } catch (err) {
      // Ignore errors if directory isn't empty
    }
  });
  
  it('should successfully initialize and open database with sumo build on first run', async () => {
    // First, check that test directory is fresh
    expect(fs.existsSync(saltPath)).toBe(false);
    
    // Initialize the database service
    await encryptedDatabase.init();
    
    // Test password-based unlocking
    const success = await encryptedDatabase.open('Pwd123!!!');
    
    // Verify the database was successfully opened
    expect(success).toBe(true);
    
    // Verify salt file was created
    expect(fs.existsSync(saltPath)).toBe(true);
    
    // Verify salt file contains valid data
    const saltData = fs.readFileSync(saltPath);
    expect(saltData.length).toBeGreaterThan(0);
    
    // Cleanup
    encryptedDatabase.close();
  });
  
  it('should handle libsodium constants correctly', async () => {
    // Initialize the service
    await encryptedDatabase.init();
    
    // Use private method to access salt generation, which uses the constants
    // We're testing if the method runs without throwing exceptions
    // @ts-ignore - accessing private method for testing
    const salt = await encryptedDatabase['getSalt']();
    
    // Verify salt was generated with correct length
    expect(salt.length).toBeGreaterThan(0);
    
    // Cleanup
    encryptedDatabase.close();
  });
});