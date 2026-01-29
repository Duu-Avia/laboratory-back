/**
 * Report Validation Schemas
 *
 * Validation rules for report-related endpoints.
 */

/**
 * Schema for creating a new report
 */
export const createReportSchema = {
  body: {
    organization_name: {
      required: true,
      type: 'string',
      minLength: 1,
      maxLength: 255,
      message: 'Organization name is required',
    },
    samples: {
      required: true,
      type: 'array',
      minLength: 1,
      message: 'At least one sample is required',
    },
  },
};

/**
 * Schema for updating a report
 */
export const updateReportSchema = {
  params: {
    id: {
      required: true,
      type: 'integer',
      min: 1,
      message: 'Valid report ID is required',
    },
  },
  body: {
    organization_name: {
      type: 'string',
      minLength: 1,
      maxLength: 255,
    },
    samples: {
      type: 'array',
    },
  },
};

/**
 * Schema for getting report by ID
 */
export const getReportSchema = {
  params: {
    id: {
      required: true,
      pattern: /^\d+$/,
      patternMessage: 'Report ID must be a number',
    },
  },
};

/**
 * Schema for saving test results
 */
export const saveResultsSchema = {
  params: {
    id: {
      required: true,
      pattern: /^\d+$/,
      patternMessage: 'Report ID must be a number',
    },
  },
  body: {
    results: {
      required: true,
      type: 'array',
      minLength: 1,
      message: 'At least one result is required',
    },
  },
};

/**
 * Schema for archiving a report
 */
export const archiveReportSchema = {
  query: {
    report_id: {
      required: true,
      pattern: /^\d+$/,
      patternMessage: 'Valid report ID is required',
    },
  },
};

export default {
  createReportSchema,
  updateReportSchema,
  getReportSchema,
  saveResultsSchema,
  archiveReportSchema,
};
