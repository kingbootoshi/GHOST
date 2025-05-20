import { ipcRenderer } from 'electron';

/**
 * Renderer-side logger proxy. Mirrors the API exposed by the main-process
 * logger shim so renderer code can simply `import logger from '../utils/logger'`
 * and call `logger.info()` just like on the main side.
 *
 * Under the hood each call is forwarded via IPC to the main process where the
 * actual Winston instance lives.  This keeps all log persistence logic in a
 * single place while still giving renderer components fine-grained scope
 * control.
 */

// ---------------------------------------------------------------------------
// Types & helpers
// ---------------------------------------------------------------------------

type LogLevel = 'error' | 'warn' | 'info' | 'http' | 'verbose' | 'debug' | 'silly';

interface IpcLogPayload {
  level: LogLevel;
  message: string;
  label?: string;
}

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

function send(level: LogLevel, label: string | undefined, args: unknown[]): void {
  const payload: IpcLogPayload = {
    level,
    label,
    message: stringifyArgs(args),
  };
  ipcRenderer.send('log', payload);
}

// ---------------------------------------------------------------------------
// Public shim – mirrors main/logger API (info/warn/… & scope())
// ---------------------------------------------------------------------------

type LogMethod = (...args: unknown[]) => void;

type LoggerShim = {
  info: LogMethod;
  warn: LogMethod;
  error: LogMethod;
  debug: LogMethod;
  verbose: LogMethod;
  silly: LogMethod;
  http: LogMethod;
  scope: (label: string) => LoggerShim;
};

function createShim(label?: string): LoggerShim {
  const bind = (level: LogLevel): LogMethod => (...args: unknown[]) => send(level, label, args);

  return {
    info: bind('info'),
    warn: bind('warn'),
    error: bind('error'),
    debug: bind('debug'),
    verbose: bind('verbose'),
    silly: bind('silly'),
    http: bind('http'),
    scope: (nested) => createShim(label ? `${label}:${nested}` : nested),
  };
}

const defaultShim = createShim();
export default defaultShim; 