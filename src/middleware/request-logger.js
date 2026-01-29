/**
 * Request Logger Middleware
 *
 * Logs incoming HTTP requests and their responses.
 * Provides request timing and structured logging.
 */

import logger from '../utils/logger.js';

/**
 * Request logger middleware
 * Logs request details and response time
 */
export function requestLogger(req, res, next) {
  // Skip logging for health check endpoints
  if (req.path === '/health' || req.path === '/ready') {
    return next();
  }

  const startTime = Date.now();

  // Generate unique request ID
  const requestId = generateRequestId();
  req.requestId = requestId;

  // Log incoming request
  logger.debug('Incoming request', {
    requestId,
    method: req.method,
    path: req.path,
    query: Object.keys(req.query).length > 0 ? req.query : undefined,
    ip: req.ip || req.connection?.remoteAddress,
    userAgent: req.get('user-agent'),
  });

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.request(req, res, duration);
  });

  next();
}

/**
 * Generate a simple request ID
 */
function generateRequestId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${random}`;
}

export default requestLogger;
