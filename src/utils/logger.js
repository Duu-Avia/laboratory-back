/**
 * Logger Utility
 *
 * Provides structured logging with different log levels.
 * In production, this could be replaced with a proper logging library
 * like Winston or Pino.
 */

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

// Get log level from environment
const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL?.toLowerCase()] ?? LOG_LEVELS.debug;

/**
 * Format log message with timestamp and level
 */
function formatMessage(level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  const metaString = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';

  return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaString}`;
}

/**
 * Check if a log level should be printed
 */
function shouldLog(level) {
  return LOG_LEVELS[level] <= currentLevel;
}

/**
 * Logger object with methods for each log level
 */
const logger = {
  /**
   * Log error messages
   * @param {string} message - The error message
   * @param {object} meta - Additional metadata (error object, context, etc.)
   */
  error(message, meta = {}) {
    if (shouldLog('error')) {
      const formatted = formatMessage('error', message, meta);
      console.error(formatted);

      // Log stack trace if error object is provided
      if (meta.error instanceof Error) {
        console.error(meta.error.stack);
      }
    }
  },

  /**
   * Log warning messages
   * @param {string} message - The warning message
   * @param {object} meta - Additional metadata
   */
  warn(message, meta = {}) {
    if (shouldLog('warn')) {
      console.warn(formatMessage('warn', message, meta));
    }
  },

  /**
   * Log informational messages
   * @param {string} message - The info message
   * @param {object} meta - Additional metadata
   */
  info(message, meta = {}) {
    if (shouldLog('info')) {
      console.info(formatMessage('info', message, meta));
    }
  },

  /**
   * Log debug messages
   * @param {string} message - The debug message
   * @param {object} meta - Additional metadata
   */
  debug(message, meta = {}) {
    if (shouldLog('debug')) {
      console.log(formatMessage('debug', message, meta));
    }
  },

  /**
   * Log HTTP request details
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   * @param {number} duration - Request duration in ms
   */
  request(req, res, duration) {
    const meta = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip || req.connection?.remoteAddress,
      userAgent: req.get('user-agent'),
    };

    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    this[level](`${req.method} ${req.originalUrl}`, meta);
  },

  /**
   * Log database queries (only in development/debug mode)
   * @param {string} query - SQL query
   * @param {object} params - Query parameters
   * @param {number} duration - Query duration in ms
   */
  query(query, params = {}, duration = null) {
    if (process.env.NODE_ENV === 'development' && shouldLog('debug')) {
      const meta = {
        params: Object.keys(params).length > 0 ? params : undefined,
        duration: duration ? `${duration}ms` : undefined,
      };
      this.debug('SQL Query', { query: query.substring(0, 200), ...meta });
    }
  },

  /**
   * Create a child logger with preset context
   * @param {object} context - Default context to include in all logs
   */
  child(context) {
    return {
      error: (message, meta = {}) => logger.error(message, { ...context, ...meta }),
      warn: (message, meta = {}) => logger.warn(message, { ...context, ...meta }),
      info: (message, meta = {}) => logger.info(message, { ...context, ...meta }),
      debug: (message, meta = {}) => logger.debug(message, { ...context, ...meta }),
    };
  },
};

export default logger;
export { logger, LOG_LEVELS };
