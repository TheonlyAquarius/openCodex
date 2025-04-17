// Logger configuration
import winston from 'winston';
import config from './config.js';

const { combine, timestamp, printf, colorize, json } = winston.format;

// Define custom format for pretty logs
const prettyFormat = printf(({ level, message, timestamp, ...meta }) => {
  const metaString = Object.keys(meta).length 
    ? ` ${JSON.stringify(meta)}` 
    : '';
  return `${timestamp} [${level}]${metaString}: ${message}`;
});

// Create logger based on configuration
const logger = winston.createLogger({
  level: config.logging.level,
  format: config.logging.format === 'json' 
    ? combine(timestamp(), json())
    : combine(
        colorize(),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        prettyFormat
      ),
  transports: [
    new winston.transports.Console()
  ]
});

export default logger;
