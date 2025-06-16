import { ModuleManifest } from '../_schema';

const manifest: ModuleManifest = {
  id: 'echo',
  version: 1,
  title: 'Echo',
  icon: '🗣️',
  capabilities: {
    db: true
  },
  entry: {
    main: './index.ts'
  },
  settingsSchema: {
    type: 'object',
    properties: {
      logLevel: {
        type: 'string',
        title: 'Log Level',
        description: 'Set the logging level for echo module',
        enum: ['debug', 'info', 'warn', 'error'],
        default: 'info'
      },
      maxLogEntries: {
        type: 'number',
        title: 'Max Log Entries',
        description: 'Maximum number of log entries to retrieve',
        minimum: 10,
        maximum: 100,
        default: 50
      }
    }
  }
};

export default manifest;