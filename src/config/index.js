/**
 * Configuration Module
 *
 * Centralized configuration management with environment-specific settings.
 * Validates required environment variables and provides type-safe config access.
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

// Determine which .env file to load based on NODE_ENV
const envFile = process.env.NODE_ENV
  ? `.env.${process.env.NODE_ENV}`
  : '.env.development';

// Load environment variables from the appropriate file
const envPath = path.resolve(rootDir, envFile);
const result = dotenv.config({ path: envPath });

// Fallback to .env if specific env file doesn't exist
if (result.error) {
  dotenv.config({ path: path.resolve(rootDir, '.env') });
}

/**
 * Required environment variables that must be present
 */
const requiredEnvVars = [
  'DB_SERVER',
  'DB_DATABASE',
  'DB_USER',
  'DB_PASSWORD',
];

/**
 * Validate that all required environment variables are present
 */
function validateEnv() {
  const missing = requiredEnvVars.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      `Please check your ${envFile} file.`
    );
  }
}

// Validate environment on startup (skip in test mode for flexibility)
if (process.env.NODE_ENV !== 'test') {
  validateEnv();
}

/**
 * Parse boolean environment variable
 */
function parseBoolean(value, defaultValue = false) {
  if (value === undefined || value === null) return defaultValue;
  return value.toLowerCase() === 'true';
}

/**
 * Parse integer environment variable
 */
function parseInt(value, defaultValue) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Parse comma-separated list
 */
function parseList(value, defaultValue = []) {
  if (!value) return defaultValue;
  return value.split(',').map(item => item.trim()).filter(Boolean);
}

/**
 * Application configuration object
 * All configuration values should be accessed through this object
 */
const config = {
  // Environment
  env: process.env.NODE_ENV || 'development',
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',

  // Server
  server: {
    port: parseInt(process.env.PORT, 8000),
    host: process.env.HOST || 'localhost',
  },

  // Database
  database: {
    server: process.env.DB_SERVER || 'localhost',
    database: process.env.DB_DATABASE || 'laboratoryDB',
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || '',
    port: parseInt(process.env.DB_PORT, 1433),
    options: {
      encrypt: parseBoolean(process.env.DB_ENCRYPT, false),
      trustServerCertificate: parseBoolean(process.env.DB_TRUST_SERVER_CERTIFICATE, true),
    },
    pool: {
      min: parseInt(process.env.DB_POOL_MIN, 0),
      max: parseInt(process.env.DB_POOL_MAX, 10),
      idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT, 30000),
    },
  },

  // CORS
  cors: {
    origins: parseList(process.env.CORS_ORIGINS, ['http://localhost:3000']),
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'debug',
  },

  // API
  api: {
    version: process.env.API_VERSION || 'v1',
    prefix: process.env.API_PREFIX || '/api',
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 60000),
    max: parseInt(process.env.RATE_LIMIT_MAX, 100),
  },

  // File Storage
  storage: {
    uploadDir: process.env.UPLOAD_DIR || './uploads',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10485760),
  },

  // PDF Generation
  pdf: {
    templatePath: process.env.PDF_TEMPLATE_PATH || './assets/templates',
    fontPath: process.env.PDF_FONT_PATH || './assets/fonts',
  },

  // Paths
  paths: {
    root: rootDir,
    src: path.resolve(rootDir, 'src'),
    assets: path.resolve(rootDir, 'assets'),
  },
};

export default config;
export { config, validateEnv };
