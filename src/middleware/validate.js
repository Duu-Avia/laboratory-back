/**
 * Validation Middleware
 *
 * Provides request validation using simple schema definitions.
 * For a production application, consider using Joi, Zod, or similar.
 */

import { ValidationError } from '../utils/errors.js';

/**
 * Validate request against a schema
 * @param {object} schema - Validation schema { body, query, params }
 * @returns {function} Express middleware function
 *
 * Usage:
 * router.post('/path', validate({ body: reportSchema }), handler);
 */
export function validate(schema) {
  return (req, res, next) => {
    const errors = [];

    // Validate request body
    if (schema.body) {
      const bodyErrors = validateObject(req.body, schema.body, 'body');
      errors.push(...bodyErrors);
    }

    // Validate query parameters
    if (schema.query) {
      const queryErrors = validateObject(req.query, schema.query, 'query');
      errors.push(...queryErrors);
    }

    // Validate route parameters
    if (schema.params) {
      const paramsErrors = validateObject(req.params, schema.params, 'params');
      errors.push(...paramsErrors);
    }

    if (errors.length > 0) {
      throw new ValidationError('Validation failed', errors);
    }

    next();
  };
}

/**
 * Validate an object against a schema
 * @param {object} data - Data to validate
 * @param {object} schema - Validation schema
 * @param {string} location - Location of data (body, query, params)
 * @returns {array} Array of validation errors
 */
function validateObject(data, schema, location) {
  const errors = [];

  for (const [field, rules] of Object.entries(schema)) {
    const value = data[field];
    const fieldErrors = validateField(value, rules, field, location);
    errors.push(...fieldErrors);
  }

  return errors;
}

/**
 * Validate a single field
 * @param {any} value - Field value
 * @param {object} rules - Validation rules
 * @param {string} field - Field name
 * @param {string} location - Location of data
 * @returns {array} Array of validation errors
 */
function validateField(value, rules, field, location) {
  const errors = [];

  // Check required
  if (rules.required && (value === undefined || value === null || value === '')) {
    errors.push({
      field,
      location,
      message: rules.message || `${field} is required`,
      rule: 'required',
    });
    return errors; // Skip other validations if required check fails
  }

  // Skip validation if value is not present and not required
  if (value === undefined || value === null) {
    return errors;
  }

  // Check type
  if (rules.type) {
    const typeValid = checkType(value, rules.type);
    if (!typeValid) {
      errors.push({
        field,
        location,
        message: `${field} must be of type ${rules.type}`,
        rule: 'type',
      });
    }
  }

  // Check min length (for strings and arrays)
  if (rules.minLength !== undefined) {
    const length = typeof value === 'string' ? value.length : Array.isArray(value) ? value.length : 0;
    if (length < rules.minLength) {
      errors.push({
        field,
        location,
        message: `${field} must have at least ${rules.minLength} characters`,
        rule: 'minLength',
      });
    }
  }

  // Check max length
  if (rules.maxLength !== undefined) {
    const length = typeof value === 'string' ? value.length : Array.isArray(value) ? value.length : 0;
    if (length > rules.maxLength) {
      errors.push({
        field,
        location,
        message: `${field} must have at most ${rules.maxLength} characters`,
        rule: 'maxLength',
      });
    }
  }

  // Check min value (for numbers)
  if (rules.min !== undefined && typeof value === 'number') {
    if (value < rules.min) {
      errors.push({
        field,
        location,
        message: `${field} must be at least ${rules.min}`,
        rule: 'min',
      });
    }
  }

  // Check max value
  if (rules.max !== undefined && typeof value === 'number') {
    if (value > rules.max) {
      errors.push({
        field,
        location,
        message: `${field} must be at most ${rules.max}`,
        rule: 'max',
      });
    }
  }

  // Check enum values
  if (rules.enum && !rules.enum.includes(value)) {
    errors.push({
      field,
      location,
      message: `${field} must be one of: ${rules.enum.join(', ')}`,
      rule: 'enum',
    });
  }

  // Check pattern (regex)
  if (rules.pattern && typeof value === 'string') {
    const regex = rules.pattern instanceof RegExp ? rules.pattern : new RegExp(rules.pattern);
    if (!regex.test(value)) {
      errors.push({
        field,
        location,
        message: rules.patternMessage || `${field} has invalid format`,
        rule: 'pattern',
      });
    }
  }

  // Custom validation function
  if (rules.custom && typeof rules.custom === 'function') {
    const customResult = rules.custom(value, field);
    if (customResult !== true) {
      errors.push({
        field,
        location,
        message: typeof customResult === 'string' ? customResult : `${field} is invalid`,
        rule: 'custom',
      });
    }
  }

  return errors;
}

/**
 * Check if value matches expected type
 */
function checkType(value, type) {
  switch (type) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && !Number.isNaN(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'array':
      return Array.isArray(value);
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    case 'date':
      return value instanceof Date || (typeof value === 'string' && !Number.isNaN(Date.parse(value)));
    case 'email':
      return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    case 'integer':
      return Number.isInteger(value);
    default:
      return true;
  }
}

export default validate;
