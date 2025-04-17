// Router to load and manage plugins
import { Router, Request, Response, NextFunction } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { pluginRegistry, Plugin } from './plugins/base-plugin.js';
import config from './config.js';
import logger from './logger.js';

// Dynamic plugin loading
import v1ResponsesPlugin from './plugins/v1-responses.js';

export async function setupRouter(): Promise<Router> {
  const router = Router();

  // Register enabled plugins
  const enabledPluginConfigs = config.plugins.filter(p => p.enabled);
  
  // Map of plugin names to instances
  const pluginMap = {
    'v1-responses': v1ResponsesPlugin
    // Add new plugins here as they're created
  };
  
  // Register enabled plugins
  for (const pluginConfig of enabledPluginConfigs) {
    const plugin = pluginMap[pluginConfig.name];
    if (plugin) {
      logger.info(`Registering plugin: ${plugin.name}`);
      pluginRegistry.register(plugin);
    } else {
      logger.warn(`Plugin '${pluginConfig.name}' not found or could not be loaded`);
    }
  }

  // Health check endpoint
  router.get('/healthz', async (req: Request, res: Response) => {
    try {
      const upstreamHealth = await checkUpstreamHealth();
      
      if (upstreamHealth) {
        res.status(200).json({ 
          status: 'ok',
          upstream: config.upstream.baseURL, 
          plugins: pluginRegistry.getAll().map(p => p.name)
        });
      } else {
        res.status(503).json({ 
          status: 'degraded', 
          upstream: config.upstream.baseURL,
          reason: 'Upstream server is not responding' 
        });
      }
    } catch (error) {
      logger.error('Health check error', { error: (error as Error).message });
      res.status(500).json({ 
        status: 'error',
        error: (error as Error).message 
      });
    }
  });

  // Plugin handler middleware
  router.use(async (req: Request, res: Response, next: NextFunction) => {
    logger.debug(`${req.method} ${req.path}`);
    
    // Find a plugin that can handle this request
    const handler = pluginRegistry.findHandler(req);
    
    // If a handler is found, use it
    if (handler) {
      try {
        const handled = await handler.handle(req, res);
        if (handled) {
          // Request was handled by the plugin
          return;
        }
      } catch (error) {
        logger.error('Plugin error', { 
          plugin: handler.name, 
          error: (error as Error).message 
        });
        
        // Try to fall back to generic proxy
        logger.info('Falling back to generic proxy after plugin error');
      }
    }
    
    // No handler or handler didn't handle it, pass to next middleware
    next();
  });

  // Generic proxy middleware as a fallback
  router.use(createProxyMiddleware({
    target: config.upstream.baseURL,
    changeOrigin: true,
    pathRewrite: (path) => path,
    onProxyReq: (proxyReq) => {
      if (config.upstream.apiKeyValue) {
        proxyReq.setHeader(
          config.upstream.apiKeyHeader, 
          `Bearer ${config.upstream.apiKeyValue}`
        );
      }
    },
    onProxyRes: (proxyRes, req, res) => {
      logger.debug('Proxied response', { 
        status: proxyRes.statusCode,
        method: req.method,
        path: req.url
      });
    },
    onError: (err, req, res) => {
      logger.error('Proxy error', { error: err.message });
      res.status(502).json({ 
        error: {
          message: `Proxy error: ${err.message}`,
          type: 'proxy_error'
        }
      });
    }
  }));

  return router;
}

// Check if the upstream server is healthy
async function checkUpstreamHealth(): Promise<boolean> {
  const enabledPlugins = pluginRegistry.getAll();
  
  if (enabledPlugins.length === 0) {
    // If no plugins, do a basic health check
    try {
      const response = await fetch(`${config.upstream.baseURL}${config.upstream.healthCheckPath}`, {
        headers: {
          [config.upstream.apiKeyHeader]: `Bearer ${config.upstream.apiKeyValue}`
        },
        timeout: config.timeouts.healthCheck
      });
      return response.ok;
    } catch (error) {
      logger.error('Basic upstream health check failed', { error: (error as Error).message });
      return false;
    }
  }

  // Check health of all plugins
  const results = await Promise.all(
    enabledPlugins.map(async (plugin) => {
      try {
        return await plugin.checkHealth();
      } catch (error) {
        logger.error(`Plugin ${plugin.name} health check failed`, { error: (error as Error).message });
        return false;
      }
    })
  );

  // Upstream is healthy if at least one plugin is healthy
  return results.some(result => result === true);
}

export default setupRouter;
