# Testing GHOST Features

This guide helps you test the currently implemented features in GHOST.

## Starting the Application

1. Run the application in development mode:
   ```bash
   npm start
   ```

2. The application should launch with the test interface.

## Testing HotkeyListener

The HotkeyListener component registers a global shortcut (⌘⇧Space) that toggles the chat interface.

**To test:**

1. Press `⌘⇧Space` (Command + Shift + Space) on your keyboard.
2. You should see a message in the debug console indicating a hotkey event was received.
3. The ghost animation should toggle (show/hide).
4. Alternatively, click the "Test Hotkey Event" button to simulate the hotkey.

## Testing EncryptedDatabaseService

The EncryptedDatabaseService manages the encrypted SQLite database using SQLCipher.

**To test:**

1. Enter a password in the "Master Password" field (e.g., "testpassword123").
2. Click "Unlock Database".
3. The status should change to "UNLOCKED" and the debug console should show success.
4. Click "Lock Database" to lock it again.
5. Try unlocking with an incorrect password to verify validation.

**Note:** The first time you run this, a new encrypted database will be created. On subsequent runs, you'll need to use the same password to unlock the existing database.

## Testing KeychainService and Touch ID

If your Mac supports Touch ID, you can test the biometric authentication.

**To test:**

1. First unlock the database with a password to store it in the keychain.
2. Lock the database.
3. If your system supports Touch ID, you should see a "Unlock with Touch ID" button.
4. Click it and use your fingerprint to authenticate.
5. The database should unlock without requiring a password.

**Note:** Touch ID support requires macOS and appropriate hardware. The application should gracefully handle systems without Touch ID support.

## Testing GhostAnimator

The GhostAnimator component provides the animated ghost visualization.

**To test:**

1. The ghost animation should be visible in the center of the app.
2. Click the "Hide Ghost" button to hide it.
3. Click the "Show Ghost" button to make it visible again.
4. The ghost should animate continuously when visible.

## Verifying Security Measures

1. **Context Isolation:** The application uses a secure bridge between the main and renderer processes. You can verify this by checking that `window.electronAPI` exists but direct Node.js APIs like `require` are not available.

2. **Database Encryption:** Once you've created an encrypted database, you can verify it's actually encrypted by:
   - Looking for the database file in the user data directory
   - Attempting to open it with a regular SQLite browser (it should fail)

## Debugging

If you encounter issues:

1. Check the debug console in the application for real-time logs.
2. Look for error messages in the terminal where you started the app.
3. Check the application logs in the user data directory.

## Common Issues

- **Native Module Errors:** If you see errors related to native modules (like better-sqlite3 or keytar), you may need to rebuild them for your Electron version.

- **Permission Errors:** On macOS, you may need to grant permissions for Touch ID or keychain access the first time you use these features.

- **Hot Reload Issues:** If changes don't appear to take effect, try restarting the application completely.

## What to Expect

At this stage of development:

- The database encryption, Touch ID integration, and hotkey functionality should work.
- The full chat UI and AI agent integration is coming in future updates.
- Some features may have limited functionality as they're still being developed.

## Reporting Issues

If you encounter bugs or unexpected behavior, please file an issue with:

1. A clear description of the problem
2. Steps to reproduce
3. Expected vs. actual behavior
4. Any error messages or logs
5. Your system information (OS, Node version, etc.)