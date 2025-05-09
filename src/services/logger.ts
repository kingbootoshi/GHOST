import winston from 'winston';
import path from 'node:path';
import { app } from 'electron';

const getLogPath = () => {
  const userDataPath = app?.getPath('userData') || '.';
  return path.join(userDataPath, 'logs');
};

// Create logger instance
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'ghost' },
  transports: [
    // Write all logs to console
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
    // Write logs to files
    new winston.transports.File({ 
      filename: path.join(getLogPath(), 'error.log'),
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: path.join(getLogPath(), 'combined.log') 
    }),
  ],
});

// Function to ensure the log directory exists
export const initLogger = () => {
  // Ensure the log directory exists
  try {
    // This will be called after app is ready
    const logPath = getLogPath();
    // Logger will create the directory as needed
    logger.info(`Logger initialized. Logs directory: ${logPath}`);
  } catch (error) {
    console.error('Failed to initialize logger:', error);
  }
};

export default logger;