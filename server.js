// server.js
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config } from './src/config/config.js';
import { logger } from './src/utils/logger.js';
import { CorporateEventPlannerGraph } from './src/core/CorporateEventPlannerGraph.js';
import { setupApiRoutes } from './src/api/routes.js';

async function startServer() {
  try {
    config.validate();
    
    const app = express();
    
    app.use(cors());
    app.use(express.json({ limit: '1mb' }));
    app.use(express.urlencoded({ extended: true }));
    
    app.use(express.static('public'));
    
    app.use((req, res, next) => {
      logger.logRequest(req);
      next();
    });
    
    const limiter = rateLimit({
      windowMs: config.rateLimitWindow,
      max: config.rateLimitRequests,
      message: {
        success: false,
        error: 'Too many requests, please try again later'
      },
      standardHeaders: true,
      legacyHeaders: false,
    });
    app.use('/api/', limiter);
    
    const eventPlannerGraph = new CorporateEventPlannerGraph();
    
    setupApiRoutes(app, eventPlannerGraph);
    
    app.get('/api', (req, res) => {
      res.json({
        service: 'Corporate Event Planner API',
        version: '2.0.0',
        architecture: 'State Graph Flow',
        status: 'running',
        config: config.getSummary(),
        endpoints: {
          'POST /api/generate-event-plan': 'Generate event plan using graph flow',
          'POST /api/refine-plan': 'Refine existing plan with tweaks',
          'GET /api/examples': 'Get example inputs',
          'GET /api/health': 'Health check',
          'GET /api/graph/stats': 'Graph execution statistics',
          'GET /api/docs': 'API documentation'
        },
        graphFlow: {
          nodes: ['parse', 'validate', 'plan', 'venueSearch', 'error'],
          features: ['sequential execution', 'plan refinement', 'caching', 'error handling']
        }
      });
    });
    
    app.use('/api/*', (req, res) => {
      res.status(404).json({
        success: false,
        error: 'API endpoint not found',
        availableEndpoints: [
          'POST /api/generate-event-plan',
          'POST /api/refine-plan',
          'GET /api/examples',
          'GET /api/health',
          'GET /api/graph/stats',
          'GET /api/docs'
        ]
      });
    });
    
    app.use((error, req, res, next) => {
      logger.error('Unhandled error:', error);
      
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: config.nodeEnv === 'development' ? error.message : 'Something went wrong'
      });
    });
    
    const server = app.listen(config.port, () => {
      logger.info(`🚀 Graph-based Corporate Event Planner API started successfully`);
      logger.info(`📡 Server running on port ${config.port}`);
      logger.info(`🌐 Web interface: http://localhost:${config.port}`);
      logger.info(`📚 API docs: http://localhost:${config.port}/api/docs`);
      logger.info(`🏗️  Architecture: State Graph Flow`);
      logger.info(`🔧 Environment: ${config.nodeEnv}`);
      
    });
    
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully...');
      
      server.close(() => {
        logger.info('HTTP server closed');
        eventPlannerGraph.clearCache();
        process.exit(0);
      });
    });
    
    process.on('SIGINT', () => {
      logger.info('SIGINT received, shutting down gracefully...');
      
      server.close(() => {
        logger.info('HTTP server closed');
        eventPlannerGraph.clearCache();
        process.exit(0);
      });
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });
    
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      process.exit(1);
    });
    
  } catch (error) {
    logger.error('Failed to start server:', error.message);
    process.exit(1);
  }
}
startServer();