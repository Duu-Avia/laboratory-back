/**
 * Custom Error Classes
 *
 * Provides standardized error types for consistent error handling
 * throughout the application.
 */

/**
 * Base application error class
 * All custom errors should extend this class
 */
export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true; // Distinguishes operational errors from programming errors
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        ...(process.env.NODE_ENV === 'development' && { stack: this.stack }),
      },
    };
  }
}

/**
 * 400 Bad Request
 * Use when the request is malformed or contains invalid data
 */
export class BadRequestError extends AppError {
  constructor(message = 'Bad Request', code = 'BAD_REQUEST') {
    super(message, 400, code);
  }
}

/**
 * 401 Unauthorized
 * Use when authentication is required but not provided or invalid
 */
export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', code = 'UNAUTHORIZED') {
    super(message, 401, code);
  }
}

/**
 * 403 Forbidden
 * Use when the user is authenticated but doesn't have permission
 */
export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', code = 'FORBIDDEN') {
    super(message, 403, code);
  }
}

/**
 * 404 Not Found
 * Use when a requested resource doesn't exist
 */
export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', code = 'NOT_FOUND') {
    super(message, 404, code);
  }
}

/**
 * 409 Conflict
 * Use when there's a conflict with the current state (e.g., duplicate entry)
 */
export class ConflictError extends AppError {
  constructor(message = 'Resource conflict', code = 'CONFLICT') {
    super(message, 409, code);
  }
}

/**
 * 422 Unprocessable Entity
 * Use when the request is well-formed but contains semantic errors
 */
export class ValidationError extends AppError {
  constructor(message = 'Validation failed', errors = [], code = 'VALIDATION_ERROR') {
    super(message, 422, code);
    this.errors = errors;
  }

  toJSON() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        details: this.errors,
        ...(process.env.NODE_ENV === 'development' && { stack: this.stack }),
      },
    };
  }
}

/**
 * 429 Too Many Requests
 * Use when rate limit is exceeded
 */
export class TooManyRequestsError extends AppError {
  constructor(message = 'Too many requests', code = 'RATE_LIMIT_EXCEEDED') {
    super(message, 429, code);
  }
}

/**
 * 500 Internal Server Error
 * Use for unexpected server errors
 */
export class InternalError extends AppError {
  constructor(message = 'Internal server error', code = 'INTERNAL_ERROR') {
    super(message, 500, code);
  }
}

/**
 * 503 Service Unavailable
 * Use when a dependent service is unavailable (e.g., database down)
 */
export class ServiceUnavailableError extends AppError {
  constructor(message = 'Service temporarily unavailable', code = 'SERVICE_UNAVAILABLE') {
    super(message, 503, code);
  }
}

/**
 * Database Error
 * Wraps database-related errors with appropriate context
 */
export class DatabaseError extends AppError {
  constructor(message = 'Database error', originalError = null, code = 'DATABASE_ERROR') {
    super(message, 500, code);
    this.originalError = originalError;
  }
}
