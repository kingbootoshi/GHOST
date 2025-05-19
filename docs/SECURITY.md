# GHOST Security Model

## Overview

GHOST implements a comprehensive security model designed to protect user data through multiple layers of encryption, process isolation, and authentication. This document details the security measures and their implementation.

## Threat Model

GHOST is designed to protect against:
- Unauthorized local access to stored data
- Memory snooping and key extraction
- Process injection attacks
- Malicious plugins
- Data leakage through logs or temp files

## Encryption Implementation

### Database Encryption

```typescript
// Algorithm: AES-256-CBC
db.pragma(`cipher='aes256cbc'`);
db.pragma(`key="x'${keyHex}'"`);
```

- **Cipher**: AES-256-CBC (via SQLCipher)
- **Key Size**: 256 bits
- **IV**: Randomly generated per page
- **Authentication**: HMAC-SHA256

### Key Derivation

```typescript
keyBuffer = sodium.crypto_pwhash(
  32,                                      // key length
  passphrase,                             // user password
  salt,                                   // random salt
  sodium.crypto_pwhash_OPSLIMIT_MODERATE, // operations limit
  sodium.crypto_pwhash_MEMLIMIT_MODERATE, // memory limit
  sodium.crypto_pwhash_ALG_DEFAULT        // Argon2id
);
```

- **Algorithm**: Argon2id (recommended by OWASP)
- **Operations**: Moderate (balanced security/performance)
- **Memory**: 256MB
- **Salt**: 16 bytes, randomly generated

### Key Management

1. **Generation**: Keys derived from user password using Argon2id
2. **Storage**: Never stored in plaintext
3. **Memory**: Keys zeroized after use
4. **Escrow**: Optional Touch ID via system keychain

```typescript
// Key zeroization
if (keyBuffer) {
  sodium.memzero(keyBuffer);
  keyBuffer = null;
}
```

## Authentication Security

### Password Requirements

- Minimum 8 characters (enforced in UI)
- No maximum length
- No complexity requirements (length preferred)
- Stored as Argon2id hash, never plaintext

### Biometric Authentication

```typescript
// macOS Touch ID integration
await systemPreferences.promptTouchID('Unlock GHOST with Touch ID');
```

- Touch ID available only on macOS
- Password stored in system keychain
- Keychain access requires Touch ID
- Fallback to password always available

### Session Management

- No persistent sessions
- Database locked on app close
- Keys cleared from memory
- Re-authentication required on restart

## Process Isolation

### Electron Security Settings

```typescript
// Main window configuration
webPreferences: {
  contextIsolation: true,    // Enable context isolation
  nodeIntegration: false,    // Disable Node.js in renderer
  preload: preloadPath       // Controlled API exposure
}
```

### Context Bridge

```typescript
// Minimal API surface
contextBridge.exposeInMainWorld('ghost', {
  createPassword: (password: string) => { /* ... */ },
  unlock: (password?: string) => { /* ... */ },
  // Limited, typed methods only
});
```

### Electron Fuses

```typescript
// Security fuses enabled in forge.config.ts
[FuseV1Options.RunAsNode]: false,
[FuseV1Options.EnableCookieEncryption]: true,
[FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
[FuseV1Options.EnableNodeCliInspectArguments]: false,
```

## Plugin Security

### Sandboxing

Plugins run in the main process but with limited access:
- No direct filesystem access
- No network access
- Database access only through context
- Cannot modify core application

### API Restrictions

```typescript
interface ModuleContext {
  db: Database;           // Shared encrypted database
  registerTool: Function; // Tool registration only
  log: Logger;           // Scoped logger
  // No access to: fs, net, electron, etc.
}
```

## Data Protection

### At Rest

- All data encrypted with AES-256-CBC
- Keys never written to disk
- Salt stored separately from database
- No temporary files with sensitive data

### In Transit

- No network communication in current version
- IPC messages in-memory only
- No external API calls
- Future: TLS for any network features

### In Memory

- Keys zeroized after use
- No sensitive data in renderer process
- Passwords cleared after processing
- Minimal retention period

## Logging Security

```typescript
// Sanitized logging
logger.info('IPC: create-password called');
// Never: logger.info('Password: ' + password);
```

- No passwords in logs
- No keys in logs
- Truncated data (text length only)
- User-configurable log levels

## Platform Security

### macOS

- Touch ID integration
- Keychain services
- Code signing (when distributed)
- Notarization (when distributed)

### Windows

- Windows Hello (future)
- Credential Manager (future)
- Code signing (when distributed)

### Linux

- Secret Service API (future)
- GPG integration (future)

## Security Best Practices

### For Core Development

1. Never log sensitive data
2. Always zeroize keys after use
3. Validate all IPC inputs
4. Use TypeScript strict mode
5. Keep dependencies updated

### For Plugin Development

1. Never store secrets outside database
2. Use provided crypto functions
3. Validate all user inputs
4. Follow principle of least privilege
5. Document security considerations

## Vulnerability Response

### Reporting

Security issues should be reported to:
- Email: security@ghost.app (future)
- GitHub Security Advisories

### Response Timeline

- **0-24h**: Initial response
- **1-7d**: Vulnerability assessment
- **7-30d**: Patch development
- **30-60d**: Public disclosure

## Security Audit Trail

### Completed

- ✅ Database encryption implementation
- ✅ Key derivation with Argon2id
- ✅ Process isolation setup
- ✅ Context bridge minimization
- ✅ Touch ID integration

### Planned

- ⏳ Plugin sandboxing enhancement
- ⏳ Code signing setup
- ⏳ Security audit by third party
- ⏳ Penetration testing
- ⏳ FIPS compliance evaluation

## Compliance Considerations

### Data Protection

- Zero-knowledge architecture
- User controls all data
- No telemetry or analytics
- Local-first design

### Cryptographic Standards

- NIST-approved algorithms
- OWASP recommendations
- Industry best practices
- Regular security updates