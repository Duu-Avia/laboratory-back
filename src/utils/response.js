/**
 * Response Utilities
 *
 * Provides consistent API response formatting throughout the application.
 * All API responses should use these utilities to maintain consistency.
 */

/**
 * Standard success response
 * @param {object} res - Express response object
 * @param {object} data - Response data
 * @param {string} message - Optional success message
 * @param {number} statusCode - HTTP status code (default: 200)
 */
export function success(res, data = null, message = 'Success', statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Created response (201)
 * @param {object} res - Express response object
 * @param {object} data - Created resource data
 * @param {string} message - Optional success message
 */
export function created(res, data = null, message = 'Resource created successfully') {
  return success(res, data, message, 201);
}

/**
 * No content response (204)
 * @param {object} res - Express response object
 */
export function noContent(res) {
  return res.status(204).send();
}

/**
 * Paginated response
 * @param {object} res - Express response object
 * @param {array} data - Array of items
 * @param {object} pagination - Pagination metadata
 * @param {string} message - Optional success message
 */
export function paginated(res, data, pagination, message = 'Success') {
  return res.status(200).json({
    success: true,
    message,
    data,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      totalItems: pagination.totalItems,
      totalPages: Math.ceil(pagination.totalItems / pagination.limit),
      hasNextPage: pagination.page < Math.ceil(pagination.totalItems / pagination.limit),
      hasPrevPage: pagination.page > 1,
    },
    timestamp: new Date().toISOString(),
  });
}

/**
 * Error response
 * @param {object} res - Express response object
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code (default: 500)
 * @param {string} code - Error code
 * @param {array|object} details - Additional error details
 */
export function error(res, message = 'Internal server error', statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
  const response = {
    success: false,
    error: {
      code,
      message,
    },
    timestamp: new Date().toISOString(),
  };

  if (details) {
    response.error.details = details;
  }

  return res.status(statusCode).json(response);
}

/**
 * Bad request response (400)
 */
export function badRequest(res, message = 'Bad request', details = null) {
  return error(res, message, 400, 'BAD_REQUEST', details);
}

/**
 * Unauthorized response (401)
 */
export function unauthorized(res, message = 'Unauthorized') {
  return error(res, message, 401, 'UNAUTHORIZED');
}

/**
 * Forbidden response (403)
 */
export function forbidden(res, message = 'Forbidden') {
  return error(res, message, 403, 'FORBIDDEN');
}

/**
 * Not found response (404)
 */
export function notFound(res, message = 'Resource not found') {
  return error(res, message, 404, 'NOT_FOUND');
}

/**
 * Validation error response (422)
 */
export function validationError(res, errors, message = 'Validation failed') {
  return error(res, message, 422, 'VALIDATION_ERROR', errors);
}

/**
 * Response helper object for convenience
 */
const response = {
  success,
  created,
  noContent,
  paginated,
  error,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  validationError,
};

export default response;
