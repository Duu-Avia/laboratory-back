import express from 'express';
import config from './config/index.js';
import { getConnection } from './config/connection-db.js';
import {
  createCorsMiddleware,
  requestLogger,
  errorHandler,
  notFoundHandler,
} from './middleware/index.js';
import logger from './utils/logger.js';

// Import routers
import reportsRouter from './router/reports.js';
import sampleTypeRouter from './router/sample-types.js';
import indicatorsRouter from './router/indicators.js';
import { locationRouters } from './router/locations.js';
import routerExample from './router/route-example.js';
import { authMiddleware } from './middleware/auth-middleware.js';
import resultsRouter from './router/results.js';

// Initialize Express app
const app = express();

// ==============================================
// Middleware Stack
// ==============================================

// CORS - must be before other middleware
app.use(createCorsMiddleware());

// Request logging
app.use(requestLogger);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ==============================================
// Health Check Endpoints
// ==============================================

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: config.env,
  });
});

app.get('/ready', async (req, res) => {
  try {
    await getConnection();
    res.status(200).json({
      status: 'ready',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      database: 'disconnected',
      timestamp: new Date().toISOString(),
    });
  }
});

// ==============================================
// API Routes
// ==============================================

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Laboratory API',
    version: '1.0.0',
    status: 'running',
    environment: config.env,
    endpoints: {
      health: '/health',
      ready: '/ready',
      reports: '/reports',
      samples: '/sample',
      sampleTypes: '/sample-types',
      indicators: '/indicators',
      locations: '/locations',
    },
  });
});

//Auth routes
app.use('/auth',routerExample);
// Mount routers
app.use('/reports', authMiddleware, reportsRouter);
app.use('/sample-types',authMiddleware, sampleTypeRouter);
app.use('/indicators',authMiddleware, indicatorsRouter);
app.use('/locations',authMiddleware, locationRouters);
app.use('/results',authMiddleware, resultsRouter);


// ==============================================
// Error Handling
// ==============================================

// 404 handler for undefined routes
app.use(notFoundHandler);

// Global error handler - must be last
app.use(errorHandler);

// ==============================================
// Server Startup
// ==============================================

async function startServer() {
  try {
    // Test database connection
    await getConnection();
    logger.info('Database connected successfully', {
      server: config.database.server,
      database: config.database.database,
    });

    // Start HTTP server
    const { port, host } = config.server;
    app.listen(port, () => {
      logger.info(`Server started`, {
        url: `http://${host}:${port}`,
        environment: config.env,
        nodeVersion: process.version,
      });

      // Log available routes in development
      if (config.isDevelopment) {
        logger.debug('Available endpoints:', {
          'GET /': 'API info',
          'GET /health': 'Health check',
          'GET /ready': 'Readiness check',
          '/reports': 'Report management',
          '/sample': 'Sample operations',
          '/sample-types': 'Sample type listing',
          '/indicators': 'Indicator management',
          '/locations': 'Location management',
        });
      }
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error });
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise });
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start the server
startServer();

export default app;
