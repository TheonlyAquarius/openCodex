// Main entry point for the OpenAI proxy
import express from 'express';
import bodyParser from 'body-parser';
import config from './config.js';
import logger from './logger.js';
import { setupRouter } from './router.js';

async function startServer() {
  try {
    const app = express();
    
    // Configure middleware
    app.use(bodyParser.json({ limit: '50mb' }));
    app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
    
    // Route logging middleware
    app.use((req, res, next) => {
      logger.debug(`Received request: ${req.method} to ${req.path}`);
      next();
    });
    
    // Set up the router with all plugins
    const router = await setupRouter();
    app.use('/v1', router);
    
    // Handle 404
    app.use((req, res) => {
      logger.warn(`Route not found: ${req.method} ${req.path}`);
      res.status(404).json({ error: 'Not found' });
    });
    
    // Start the server
    const PORT = config.port;
    app.listen(PORT, () => {
      logger.info(`🚀 OpenAI proxy server started on http://localhost:${PORT}/v1`);
      logger.info(`Upstream: ${config.upstream.baseURL}`);
      logger.info(`Health check: http://localhost:${PORT}/v1/healthz`);
    });
  } catch (error) {
    logger.error('Failed to start server', { error: (error as Error).message });
    process.exit(1);
  }
}

// Start the server
startServer().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
