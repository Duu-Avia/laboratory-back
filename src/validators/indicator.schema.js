/**
 * Indicator Validation Schemas
 *
 * Validation rules for indicator-related endpoints.
 */

/**
 * Schema for creating a new indicator
 */
export const createIndicatorSchema = {
  body: {
    indicator_name: {
      required: true,
      type: 'string',
      minLength: 1,
      maxLength: 255,
      message: 'Indicator name is required',
    },
    lab_type_id: {
      required: true,
      type: 'number',
      min: 1,
      message: 'Valid sample type ID is required',
    },
    unit: {
      type: 'string',
      maxLength: 50,
    },
    input_type: {
      type: 'string',
      enum: ['number', 'text', 'boolean'],
    },
  },
};

/**
 * Schema for getting indicators by sample type
 */
export const getIndicatorsBySampleTypeSchema = {
  params: {
    id: {
      required: true,
      pattern: /^\d+$/,
      patternMessage: 'Sample type ID must be a number',
    },
  },
};

export default {
  createIndicatorSchema,
  getIndicatorsBySampleTypeSchema,
};
