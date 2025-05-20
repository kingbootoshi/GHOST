export type ChatRole = 'user' | 'assistant' | 'system';

/**
 * A single chat message stored in the encrypted database and exchanged
 * between the main and renderer processes.
 */
export interface ChatMessage {
  /** Unique identifier (uuidv4) */
  id: string;
  /** Origin of the message */
  role: ChatRole;
  /** Plain-text content of the message */
  content: string;
  /** Unix epoch (ms) timestamp */
  timestamp: number;
  /** Optional metadata such as tool responses, etc. */
  metadata?: unknown;
}

/**
 * Current authentication / unlock status for the running session.
 * Returned by `ghost:get-auth-state` IPC handler.
 */
export interface AuthState {
  /** `true` when the DB is unlocked and ready */
  isUnlocked: boolean;
  /** `true` when the app is being run for the very first time */
  isFirstRun: boolean;
  /** Indicates whether TouchID / biometrics is available on this device */
  canUseBiometric: boolean;
  /** Whether the user has enabled biometric unlock */
  biometricEnabled: boolean;
  /** Whether the user explicitly declined biometric usage */
  biometricDeclined: boolean;
} 