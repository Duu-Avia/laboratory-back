/**
 * CORS Middleware Configuration
 *
 * Configures Cross-Origin Resource Sharing based on environment.
 */

import cors from 'cors';
import config from '../config/index.js';
import logger from '../utils/logger.js';

/**
 * Get CORS options based on environment
 */
function getCorsOptions() {
  const { origins } = config.cors;

  // In development, allow all origins if configured that way
  if (config.isDevelopment && origins.includes('*')) {
    logger.warn('CORS is configured to allow all origins - not recommended for production');
    return {
      origin: true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    };
  }

  return {
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) {
        return callback(null, true);
      }

      if (origins.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn('CORS blocked origin', { origin, allowedOrigins: origins });
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
    maxAge: 86400, // 24 hours
  };
}

/**
 * Create CORS middleware with configuration
 */
export function createCorsMiddleware() {
  const options = getCorsOptions();
  return cors(options);
}

export default createCorsMiddleware;
