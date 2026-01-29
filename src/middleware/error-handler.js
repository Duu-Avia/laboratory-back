/**
 * Error Handler Middleware
 *
 * Centralized error handling for the application.
 * Catches all errors and returns consistent error responses.
 */

import { AppError } from '../utils/errors.js';
import logger from '../utils/logger.js';

/**
 * Error handler middleware
 * Should be registered as the last middleware in the Express app
 */
export function errorHandler(err, req, res, next) {
  // Log the error
  logger.error('Request error', {
    error: err,
    path: req.path,
    method: req.method,
    body: req.body,
    query: req.query,
    params: req.params,
  });

  // Handle known operational errors
  if (err instanceof AppError) {
    return res.status(err.statusCode).json(err.toJSON());
  }

  // Handle SQL Server errors
  if (err.name === 'RequestError' || err.code?.startsWith('E')) {
    const isDev = process.env.NODE_ENV === 'development';
    return res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: isDev ? err.message : 'A database error occurred',
        ...(isDev && { originalError: err.message }),
      },
    });
  }

  // Handle JSON parsing errors
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_JSON',
        message: 'Invalid JSON in request body',
      },
    });
  }

  // Handle unknown errors
  const isDev = process.env.NODE_ENV === 'development';
  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: isDev ? err.message : 'An unexpected error occurred',
      ...(isDev && { stack: err.stack }),
    },
  });
}

/**
 * Not found handler middleware
 * Catches requests to undefined routes
 */
export function notFoundHandler(req, res, next) {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
}

/**
 * Async handler wrapper
 * Wraps async route handlers to catch errors and pass them to the error handler
 *
 * Usage:
 * router.get('/path', asyncHandler(async (req, res) => { ... }));
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export default { errorHandler, notFoundHandler, asyncHandler };
