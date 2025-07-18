import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class Logger {
  constructor() {
    this.logLevel = config.logLevel;
    this.logToFile = config.logToFile;
    this.logFilePath = path.join(__dirname, '../../logs/app.log');
    
    // Create logs directory if it doesn't exist
    if (this.logToFile) {
      const logsDir = path.dirname(this.logFilePath);
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }
    }

    // Log levels (lower number = higher priority)
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };

    this.currentLevel = this.levels[this.logLevel] || this.levels.info;
  }

  /**
   * Format log message with timestamp and level
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Object} data - Additional data to log
   * @returns {string} Formatted log message
   */
  formatMessage(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const levelUpper = level.toUpperCase().padEnd(5);
    
    let formattedMessage = `[${timestamp}] ${levelUpper} ${message}`;
    
    if (data !== null && data !== undefined) {
      if (typeof data === 'object') {
        formattedMessage += `\n${JSON.stringify(data, null, 2)}`;
      } else {
        formattedMessage += ` ${data}`;
      }
    }
    
    return formattedMessage;
  }

  /**
   * Write log to console and optionally to file
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Object} data - Additional data
   */
  writeLog(level, message, data = null) {
    if (this.levels[level] > this.currentLevel) {
      return; // Skip if below current log level
    }

    const formattedMessage = this.formatMessage(level, message, data);

    // Console output with colors
    this.writeToConsole(level, formattedMessage);

    // File output
    if (this.logToFile) {
      this.writeToFile(formattedMessage);
    }
  }

  /**
   * Write to console with appropriate colors
   * @param {string} level - Log level
   * @param {string} message - Formatted message
   */
  writeToConsole(level, message) {
    const colors = {
      error: '\x1b[31m', // Red
      warn: '\x1b[33m',  // Yellow
      info: '\x1b[36m',  // Cyan
      debug: '\x1b[37m'  // White
    };

    const reset = '\x1b[0m';
    const color = colors[level] || colors.info;

    console.log(`${color}${message}${reset}`);
  }

  /**
   * Write to log file
   * @param {string} message - Formatted message
   */
  writeToFile(message) {
    try {
      fs.appendFileSync(this.logFilePath, message + '\n');
    } catch (error) {
      console.error('Failed to write to log file:', error.message);
    }
  }

  /**
   * Log error message
   * @param {string} message - Error message
   * @param {Object} data - Additional error data
   */
  error(message, data = null) {
    this.writeLog('error', message, data);
  }

  /**
   * Log warning message
   * @param {string} message - Warning message
   * @param {Object} data - Additional data
   */
  warn(message, data = null) {
    this.writeLog('warn', message, data);
  }

  /**
   * Log info message
   * @param {string} message - Info message
   * @param {Object} data - Additional data
   */
  info(message, data = null) {
    this.writeLog('info', message, data);
  }

  /**
   * Log debug message
   * @param {string} message - Debug message
   * @param {Object} data - Additional data
   */
  debug(message, data = null) {
    this.writeLog('debug', message, data);
  }

  /**
   * Log request information
   * @param {Object} req - Express request object
   * @param {string} additionalInfo - Additional info
   */
  logRequest(req, additionalInfo = '') {
    const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';
    const method = req.method;
    const url = req.originalUrl || req.url;
    
    this.info(`${method} ${url} from ${clientIP} ${additionalInfo}`, {
      userAgent: userAgent.substring(0, 100), // Limit user agent length
      body: method === 'POST' ? req.body : undefined
    });
  }

  /**
   * Log API response
   * @param {number} statusCode - HTTP status code
   * @param {number} duration - Response time in ms
   * @param {string} endpoint - API endpoint
   * @param {boolean} success - Whether request was successful
   */
  logResponse(statusCode, duration, endpoint, success = true) {
    const level = statusCode >= 400 ? 'warn' : 'info';
    const status = success ? '✅' : '❌';
    
    this.writeLog(level, `${status} ${statusCode} ${endpoint} - ${duration}ms`);
  }

  /**
   * Log performance metrics
   * @param {string} operation - Operation name
   * @param {number} duration - Duration in ms
   * @param {Object} metrics - Additional metrics
   */
  logPerformance(operation, duration, metrics = {}) {
    const level = duration > 5000 ? 'warn' : 'info'; // Warn if > 5 seconds
    
    this.writeLog(level, `⏱️  ${operation} completed in ${duration}ms`, metrics);
  }

  /**
   * Log cache operations
   * @param {string} operation - Cache operation (hit, miss, set, clear)
   * @param {string} key - Cache key
   * @param {Object} metadata - Additional metadata
   */
  logCache(operation, key = '', metadata = {}) {
    const emojis = {
      hit: '🎯',
      miss: '❌',
      set: '💾',
      clear: '🗑️'
    };
    
    const emoji = emojis[operation] || '📦';
    this.debug(`${emoji} Cache ${operation} ${key}`, metadata);
  }

  /**
   * Get log statistics
   * @returns {Object} Log statistics
   */
  getStats() {
    const stats = {
      logLevel: this.logLevel,
      logToFile: this.logToFile,
      logFilePath: this.logToFile ? this.logFilePath : null,
      fileSize: null
    };

    if (this.logToFile && fs.existsSync(this.logFilePath)) {
      try {
        const stat = fs.statSync(this.logFilePath);
        stats.fileSize = stat.size;
      } catch (error) {
        this.warn('Failed to get log file size:', error.message);
      }
    }

    return stats;
  }

  /**
   * Rotate log file (for production use)
   */
  rotateLogs() {
    if (!this.logToFile || !fs.existsSync(this.logFilePath)) {
      return;
    }

    try {
      const timestamp = new Date().toISOString().split('T')[0];
      const rotatedPath = this.logFilePath.replace('.log', `-${timestamp}.log`);
      
      fs.renameSync(this.logFilePath, rotatedPath);
      this.info(`Log file rotated to ${rotatedPath}`);
    } catch (error) {
      this.error('Failed to rotate log file:', error.message);
    }
  }
}

// Create singleton logger instance
export const logger = new Logger();

// Log startup information
logger.info('🚀 Logger initialized', {
  level: logger.logLevel,
  fileLogging: logger.logToFile,
  environment: config.nodeEnv
});