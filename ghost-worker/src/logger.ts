export const log = {
  debug: (...a: unknown[]) => console.debug('[DEBUG]', ...a),
  info : (...a: unknown[]) => console.info ('[INFO ]', ...a),
  warn : (...a: unknown[]) => console.warn ('[WARN ]', ...a),
  error: (...a: unknown[]) => console.error('[ERROR]', ...a),
};