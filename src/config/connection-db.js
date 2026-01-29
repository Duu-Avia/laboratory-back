
import sql from 'mssql';
import appConfig from './index.js';
import logger from '../utils/logger.js';

/**
 * SQL Server connection configuration
 * Built from environment-specific settings
 */
const dbConfig = {
  server: appConfig.database.server,
  database: appConfig.database.database,
  user: appConfig.database.user,
  password: appConfig.database.password,
  port: appConfig.database.port,
  options: {
    trustServerCertificate: appConfig.database.options.trustServerCertificate,
    encrypt: appConfig.database.options.encrypt,
  },
  pool: {
    min: appConfig.database.pool.min,
    max: appConfig.database.pool.max,
    idleTimeoutMillis: appConfig.database.pool.idleTimeoutMillis,
  },
};

/**
 * Cached connection pool instance
 */
let pool = null;

/**
 * Get or create a database connection pool
 * @returns {Promise<sql.ConnectionPool>} The connection pool
 */
export async function getConnection() {
  if (!pool) {
    try {
      pool = await sql.connect(dbConfig);
      logger.debug('Database pool created', {
        server: dbConfig.server,
        database: dbConfig.database,
        poolMin: dbConfig.pool.min,
        poolMax: dbConfig.pool.max,
      });
    } catch (error) {
      logger.error('Failed to create database connection', { error });
      throw error;
    }
  }
  return pool;
}

/**
 * Close the database connection pool
 * Useful for graceful shutdown or testing
 */
export async function closeConnection() {
  if (pool) {
    try {
      await pool.close();
      pool = null;
      logger.info('Database connection closed');
    } catch (error) {
      logger.error('Error closing database connection', { error });
      throw error;
    }
  }
}

/**
 * Check if database connection is healthy
 * @returns {Promise<boolean>}
 */
export async function isHealthy() {
  try {
    const connection = await getConnection();
    await connection.request().query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

export { sql };
export default dbConfig;
