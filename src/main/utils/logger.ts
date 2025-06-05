import * as winston from 'winston';
import { TransformableInfo } from 'logform';
import * as path from 'path';
import * as fs from 'fs';
import { app, ipcMain } from 'electron';

/**
 * Centralized Winston logger configuration for the **main process**.
 *
 * The logger replicates the previous `electron-log` API to minimise refactors
 * while giving us full control over formatting & transports.
 *
 * Key features:
 * 1. **Timestamped output** – `YYYY-MM-DD HH:mm:ss.SSS` for easy correlation.
 * 2. **File & console transports** – All logs are persisted in `userData/logs`.
 * 3. **Scope support** – `logger.scope('bootstrap')` returns a child logger that
 *    automatically appends the provided `label` to each message. This mirrors
 *    the old `electron-log` behaviour and lets callers identify the file/module
 *    the log originated from.
 * 4. **Renderer relay** – The `setupRendererLogging` helper wires up an IPC
 *    listener so renderer-side logs end up in the same central log stream.
 *
 * Usage (main process):
 * ```ts
 * import logger from './utils/logger';
 * const log = logger.scope('bootstrap');
 * log.info('Window created :)');
 * ```
 *
 * Usage (renderer process): see `src/renderer/utils/logger.ts`.
 */

// ---------------------------------------------------------------------------
// Transports & formatting
// ---------------------------------------------------------------------------

const userLogDir = path.join(app.getPath('userData'), 'logs');
if (!fs.existsSync(userLogDir)) {
  fs.mkdirSync(userLogDir, { recursive: true });
}

const baseFormat = winston.format.printf((info: TransformableInfo) => {
  const { timestamp, level, message, label } = info;
  // `label` comes from child loggers (see `scope` below)
  const scope = label ? `[${label}]` : '';
  return `${timestamp} ${scope} ${level.toUpperCase()} › ${message}`;
});

const createWinstonLogger = () =>
  winston.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
      winston.format.colorize({ all: true }),
      winston.format.label({ label: undefined }), // placeholder so `label` is defined
      baseFormat
    ),
    transports: [
      new winston.transports.Console(),
      new winston.transports.File({
        filename: path.join(userLogDir, 'ghost.log'),
        maxsize: 5 * 1024 * 1024, // 5 MB
        maxFiles: 5,
      }),
      new winston.transports.File({
        filename: path.join(userLogDir, 'error.log'),
        level: 'error',
        maxsize: 5 * 1024 * 1024,
        maxFiles: 5,
      }),
    ],
  });

// The **root** logger instance. We deliberately do **not** export this directly
// so callers are nudged towards creating scoped loggers.
const rootLogger = createWinstonLogger();

// Helper: stringifies unknown values similar to console.log/electron-log.
function stringifyArgs(args: unknown[]): string {
  return args
    .map((arg) => {
      if (typeof arg === 'string') return arg;
      try {
        return JSON.stringify(arg, null, 2);
      } catch {
        return String(arg);
      }
    })
    .join(' ');
}

// ---------------------------------------------------------------------------
// API shim – mimic electron-log (info/warn/error/… & scope())
// ---------------------------------------------------------------------------

type WinstonLevel = 'error' | 'warn' | 'info' | 'http' | 'verbose' | 'debug' | 'silly';
type LogMethod = (...args: unknown[]) => void;

function bind(level: WinstonLevel): LogMethod {
  return (...args: unknown[]) => {
    rootLogger.log(level, stringifyArgs(args));
  };
}

// Base logger shim with console-like API
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
type BaseShim = {
  info: LogMethod;
  warn: LogMethod;
  error: LogMethod;
  debug: LogMethod;
  verbose: LogMethod;
  silly: LogMethod;
  http: LogMethod;
  scope: (label: string) => BaseShim;
};

const baseShim: BaseShim = {
  info: bind('info'),
  warn: bind('warn'),
  error: bind('error'),
  debug: bind('debug'),
  verbose: bind('verbose'),
  silly: bind('silly'),
  http: bind('http'),
  scope(label: string): BaseShim {
    // Child logger that injects `label` meta so format can include it
    const child = rootLogger.child({ label });

    function bindChild(level: WinstonLevel): LogMethod {
      return (...args: unknown[]) => child.log(level, stringifyArgs(args));
    }

    return {
      info: bindChild('info'),
      warn: bindChild('warn'),
      error: bindChild('error'),
      debug: bindChild('debug'),
      verbose: bindChild('verbose'),
      silly: bindChild('silly'),
      http: bindChild('http'),
      scope: (nested) => baseShim.scope(`${label}:${nested}`),
    };
  },
};

// Default export – maintains previous `import logger from 'electron-log'` style.
export default baseShim;

// Export Logger class for compatibility
export class Logger {
  private logger: BaseShim;
  
  constructor(scope: string) {
    this.logger = baseShim.scope(scope);
  }
  
  info(...args: unknown[]): void {
    this.logger.info(...args);
  }
  
  warn(...args: unknown[]): void {
    this.logger.warn(...args);
  }
  
  error(...args: unknown[]): void {
    this.logger.error(...args);
  }
  
  debug(...args: unknown[]): void {
    this.logger.debug(...args);
  }
}

// ---------------------------------------------------------------------------
// Renderer logging setup
// ---------------------------------------------------------------------------

/**
 * Hooks renderer logging into the main Winston logger.
 * Must be called **once** during app startup (e.g. in `bootstrap.ts`).
 */
export function setupRendererLogging(): void {
  // Ensure we do not register the handler multiple times.
  if ((setupRendererLogging as any)._registered) return;
  (setupRendererLogging as any)._registered = true;

  ipcMain.on('log', (_, { level, label, message }) => {
    rootLogger.log(level, message, { label });
  });
} 