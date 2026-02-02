/**
 * Application Constants
 *
 * Centralized location for magic strings and constant values.
 * Prevents typos and makes refactoring easier.
 */

/**
 * Report status values
 */
export const REPORT_STATUS = {
  PENDING: 'pending',
  TESTED: 'tested',
  APPROVED: 'approved',
  DELETED: 'deleted',
};

/**
 * Sample status values
 */
export const SAMPLE_STATUS = {
  ACTIVE: 'active',
  DELETED: 'deleted',
};

/**
 * Sample types
 */
export const lab_typeS = {
  WATER: 'water',
  AIR: 'air',
  SWAB: 'swab',
};

/**
 * Input types for indicators
 */
export const INPUT_TYPES = {
  NUMBER: 'number',
  TEXT: 'text',
  BOOLEAN: 'boolean',
};

/**
 * HTTP status codes
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
};

/**
 * Pagination defaults
 */
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
};

/**
 * Date formats
 */
export const DATE_FORMATS = {
  ISO: 'YYYY-MM-DD',
  DISPLAY: 'DD/MM/YYYY',
  DATETIME: 'YYYY-MM-DD HH:mm:ss',
};

export default {
  REPORT_STATUS,
  SAMPLE_STATUS,
  lab_typeS,
  INPUT_TYPES,
  HTTP_STATUS,
  PAGINATION,
  DATE_FORMATS,
};
