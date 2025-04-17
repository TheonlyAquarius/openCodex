Thanks for providing the logs - this gives me exactly what I needed! Now I can see the actual format of requests that Codex-CLI sends to the `/v1/responses` endpoint, which is crucial for building the transformation logic.

Based on this information, I'll create a more robust implementation that matches what was promised. Let me build this out for you:

# OpenAI Proxy Directory Structure



```
openai-proxy/ 
├── src/
│   ├── index.ts             # Entrypoint, spins up the server
│   ├── plugins/
│   │   ├── v1-responses.ts  # Logic for handling /v1/responses → /v1/chat/completions
│   │   └── base-plugin.ts   # Base interface for plugins
│   ├── router.ts            # Loads available plugins and mounts them
│   └── config.ts            # Endpoint rules, timeouts, fallbacks
├── test/
│   └── contract.test.ts     # Sends mocks against each plugin version
├── package.json
└── README.md
```

```
{
  "name": "openai-proxy",
  "version": "1.0.0",
  "description": "A resilient proxy for translating between OpenAI API formats",
  "main": "dist/index.js",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "ts-node-esm src/index.ts",
    "test": "jest",
    "lint": "eslint src/**/*.ts"
  },
  "dependencies": {
    "body-parser": "^1.20.2",
    "express": "^4.18.2",
    "http-proxy-middleware": "^2.0.6",
    "node-fetch": "^3.3.2",
    "winston": "^3.11.0"
  },
  "devDependencies": {
    "@types/body-parser": "^1.19.5",
    "@types/express": "^4.17.21",
    "@types/jest": "^29.5.12",
    "@types/node": "^20.11.10",
    "@typescript-eslint/eslint-plugin": "^6.19.1",
    "@typescript-eslint/parser": "^6.19.1",
    "eslint": "^8.56.0",
    "jest": "^29.7.0",
    "supertest": "^6.3.4",
    "ts-jest": "^29.1.2",
    "ts-node": "^10.9.2",
    "typescript": "^5.3.3"
  }
}

```

```
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "sourceMap": true,
    "declaration": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test"]
}
```

```
// Configuration management for the OpenAI proxy
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Default configuration
const defaultConfig = {
  port: 5678,
  upstream: {
    baseURL: "http://localhost:1234/v1",
    apiKeyHeader: "Authorization",
    apiKeyValue: "",
    healthCheckPath: "/models"
  },
  plugins: [
    { name: "v1-responses", enabled: true }
  ],
  logging: {
    level: "info", // debug, info, warn, error
    format: "pretty" // pretty, json
  },
  timeouts: {
    request: 60000, // 60 seconds
    healthCheck: 5000 // 5 seconds
  }
};

// Configuration types
export interface PluginConfig {
  name: string;
  enabled: boolean;
}

export interface UpstreamConfig {
  baseURL: string;
  apiKeyHeader: string;
  apiKeyValue: string;
  healthCheckPath: string;
}

export interface LoggingConfig {
  level: "debug" | "info" | "warn" | "error";
  format: "pretty" | "json";
}

export interface TimeoutsConfig {
  request: number;
  healthCheck: number;
}

export interface ProxyConfig {
  port: number;
  upstream: UpstreamConfig;
  plugins: PluginConfig[];
  logging: LoggingConfig;
  timeouts: TimeoutsConfig;
}

// Load configuration from environment variables
function loadFromEnv(): Partial<ProxyConfig> {
  return {
    port: process.env.PROXY_PORT ? parseInt(process.env.PROXY_PORT, 10) : undefined,
    upstream: {
      baseURL: process.env.OPENAI_UPSTREAM_BASE_URL?.replace(/\/$/, "") || undefined,
      apiKeyHeader: process.env.OPENAI_API_KEY_HEADER || undefined,
      apiKeyValue: process.env.OPENAI_API_KEY || undefined,
      healthCheckPath: process.env.OPENAI_HEALTH_CHECK_PATH || undefined
    },
    logging: {
      level: (process.env.LOG_LEVEL as "debug" | "info" | "warn" | "error") || undefined,
      format: (process.env.LOG_FORMAT as "pretty" | "json") || undefined
    },
    timeouts: {
      request: process.env.REQUEST_TIMEOUT ? parseInt(process.env.REQUEST_TIMEOUT, 10) : undefined,
      healthCheck: process.env.HEALTH_CHECK_TIMEOUT ? parseInt(process.env.HEALTH_CHECK_TIMEOUT, 10) : undefined
    }
  };
}

// Try to load configuration file
function loadFromFile(configPath?: string): Partial<ProxyConfig> {
  const filePath = configPath || path.join(__dirname, '../config.json');
  try {
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(fileContent);
    }
  } catch (error) {
    console.warn(`Failed to load config file from ${filePath}:`, error);
  }
  return {};
}

// Merge configurations with priority: env > file > default
export function getConfig(configPath?: string): ProxyConfig {
  const fileConfig = loadFromFile(configPath);
  const envConfig = loadFromEnv();
  
  // Deep merge, with environment taking precedence over file,
  // and file taking precedence over defaults
  return {
    ...defaultConfig,
    ...fileConfig,
    ...envConfig,
    upstream: {
      ...defaultConfig.upstream,
      ...(fileConfig.upstream || {}),
      ...(envConfig.upstream || {})
    },
    logging: {
      ...defaultConfig.logging,
      ...(fileConfig.logging || {}),
      ...(envConfig.logging || {})
    },
    timeouts: {
      ...defaultConfig.timeouts,
      ...(fileConfig.timeouts || {}),
      ...(envConfig.timeouts || {})
    },
    // For plugins, we only override if env/file explicitly provides a value
    plugins: envConfig.plugins || fileConfig.plugins || defaultConfig.plugins
  };
}

export default getConfig();
```

```
// Logger configuration
import winston from 'winston';
import config from './config.js';

const { combine, timestamp, printf, colorize, json } = winston.format;

// Define custom format for pretty logs
const prettyFormat = printf(({ level, message, timestamp, ...meta }) => {
  const metaString = Object.keys(meta).length 
    ? ` ${JSON.stringify(meta)}` 
    : '';
  return `${timestamp} [${level}]${metaString}: ${message}`;
});

// Create logger based on configuration
const logger = winston.createLogger({
  level: config.logging.level,
  format: config.logging.format === 'json' 
    ? combine(timestamp(), json())
    : combine(
        colorize(),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        prettyFormat
      ),
  transports: [
    new winston.transports.Console()
  ]
});

export default logger;

```

```
// Base plugin interface and types
import { Request, Response } from 'express';

// Basic plugin interface that all plugins must implement
export interface Plugin {
  name: string;
  description: string;
  // Pattern for the URL path this plugin handles (e.g., "/v1/responses")
  pathPattern: RegExp;
  // Method this plugin handles (e.g., "POST")
  method: string;
  // Function to determine if this plugin can handle a given request
  canHandle: (req: Request) => boolean;
  // Function to handle the request - returns true if handled, false if not
  handle: (req: Request, res: Response) => Promise<boolean>;
  // Function to check if the plugin can connect to the necessary upstream endpoints
  checkHealth: () => Promise<boolean>;
}

// Base class that plugins can extend
export abstract class BasePlugin implements Plugin {
  abstract name: string;
  abstract description: string;
  abstract pathPattern: RegExp;
  abstract method: string;

  // Default implementation checks if the URL path and method match
  canHandle(req: Request): boolean {
    return this.pathPattern.test(req.path) && req.method === this.method;
  }

  // Abstract method to be implemented by specific plugins
  abstract handle(req: Request, res: Response): Promise<boolean>;
  
  // Default health check
  async checkHealth(): Promise<boolean> {
    return true;
  }
}

// Common request and response types
export interface OpenAIBasicFormat {
  model: string;
  [key: string]: any;
}

export interface OpenAIResponsesFormat extends OpenAIBasicFormat {
  instructions?: string;
  input?: any;
  stream?: boolean;
  parallel_tool_calls?: boolean;
  tools?: any[];
  [key: string]: any;
}

export interface OpenAIChatFormat extends OpenAIBasicFormat {
  messages: Array<{
    role: string;
    content: string | Array<any>;
    [key: string]: any;
  }>;
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  [key: string]: any;
}

// Registry for all plugins
export class PluginRegistry {
  private plugins: Plugin[] = [];

  // Register a new plugin
  register(plugin: Plugin): void {
    this.plugins.push(plugin);
  }

  // Get all registered plugins
  getAll(): Plugin[] {
    return this.plugins;
  }

  // Find the first plugin that can handle a request
  findHandler(req: Request): Plugin | undefined {
    return this.plugins.find(plugin => plugin.canHandle(req));
  }
}

// Create and export a singleton registry
export const pluginRegistry = new PluginRegistry();
```

```

// Plugin to handle /v1/responses endpoint and transform to /v1/chat/completions
import { Request, Response } from 'express';
import { BasePlugin, OpenAIResponsesFormat, OpenAIChatFormat } from './base-plugin.js';
import logger from '../logger.js';
import fetch from 'node-fetch';
import config from '../config.js';

export class V1ResponsesPlugin extends BasePlugin {
  name = 'v1-responses';
  description = 'Transforms /v1/responses to /v1/chat/completions format';
  pathPattern = /^\/v1\/responses$/;
  method = 'POST';

  async handle(req: Request, res: Response): Promise<boolean> {
    try {
      logger.debug(`Handling ${req.method} request to ${req.path}`);
      
      const requestBody = req.body as OpenAIResponsesFormat;
      
      // Transform request to chat/completions format
      const transformedBody = this.transformRequest(requestBody);
      logger.debug('Transformed request body', { original: requestBody, transformed: transformedBody });
  
      // If it's a streaming request, we need to handle it differently
      if (requestBody.stream) {
        return await this.handleStreamingRequest(transformedBody, res);
      } else {
        return await this.handleNonStreamingRequest(transformedBody, res);
      }
    } catch (error) {
      logger.error('Error handling request', { error: (error as Error).message });
      res.status(500).json({ 
        error: {
          message: `Error handling request: ${(error as Error).message}`,
          type: 'proxy_error'
        }
      });
      return true;
    }
  }

  private transformRequest(original: OpenAIResponsesFormat): OpenAIChatFormat {
    const transformed: OpenAIChatFormat = {
      model: original.model,
      messages: [],
      temperature: 0.7,  // Default value
      max_tokens: -1,    // Default to no limit
      stream: original.stream || false
    };

    // Add system message if instructions are present
    if (original.instructions) {
      transformed.messages.push({
        role: 'system',
        content: original.instructions
      });
    }

    // Convert input to messages
    if (original.input && Array.isArray(original.input)) {
      for (const item of original.input) {
        // Handle different input structures
        if (item.role && (item.content || item.text)) {
          transformed.messages.push({
            role: item.role,
            content: this.normalizeContent(item.content || item.text)
          });
        }
      }
    }

    // Add tools if present
    if (original.tools && original.tools.length > 0) {
      transformed.tools = original.tools;
    }

    // Copy other properties that might be needed
    if (original.temperature !== undefined) transformed.temperature = original.temperature;
    if (original.max_tokens !== undefined) transformed.max_tokens = original.max_tokens;
    if (original.parallel_tool_calls !== undefined) transformed.parallel_tool_calls = original.parallel_tool_calls;
    
    return transformed;
  }

  private normalizeContent(content: any): string | Array<any> {
    if (typeof content === 'string') {
      return content;
    }
    
    if (Array.isArray(content)) {
      if (content.every(item => typeof item === 'string')) {
        return content.join('\\n');
      }
      
      // Transform content items that have type and text fields
      if (content.every(item => item.type && (item.text !== undefined))) {
        return content.map(item => {
          if (item.type === 'input_text') {
            return { type: 'text', text: item.text };
          }
          return item;
        });
      }
      
      return content;
    }
    
    return JSON.stringify(content);
  }

  private async handleNonStreamingRequest(body: OpenAIChatFormat, res: Response): Promise<boolean> {
    const upstream = config.upstream.baseURL;
    try {
      const response = await fetch(`${upstream}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [config.upstream.apiKeyHeader]: `Bearer ${config.upstream.apiKeyValue}`
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        logger.error('Upstream error', { 
          status: response.status, 
          statusText: response.statusText 
        });
        
        const errorText = await response.text();
        logger.error('Upstream error detail', { error: errorText });
        
        res.status(response.status).send(errorText);
        return true;
      }

      const data = await response.json();
      res.json(data);
      return true;
    } catch (error) {
      logger.error('Error forwarding request', { error: (error as Error).message });
      res.status(502).json({ error: `Error forwarding request: ${(error as Error).message}` });
      return true;
    }
  }

  private async handleStreamingRequest(body: OpenAIChatFormat, res: Response): Promise<boolean> {
    const upstream = config.upstream.baseURL;
    try {
      const response = await fetch(`${upstream}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [config.upstream.apiKeyHeader]: `Bearer ${config.upstream.apiKeyValue}`,
          'Accept': 'text/event-stream'
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        logger.error('Upstream error', { 
          status: response.status, 
          statusText: response.statusText 
        });
        
        const errorText = await response.text();
        logger.error('Upstream error detail', { error: errorText });
        
        res.status(response.status).send(errorText);
        return true;
      }

      // Set up streaming response
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      
      // Stream the response
      const stream = response.body;
      if (!stream) {
        res.status(502).json({ error: 'No response stream from upstream' });
        return true;
      }
      
      for await (const chunk of stream) {
        res.write(chunk);
      }
      
      res.end();
      return true;
    } catch (error) {
      logger.error('Error streaming response', { error: (error as Error).message });
      res.status(502).json({ error: `Error streaming response: ${(error as Error).message}` });
      return true;
    }
  }

  async checkHealth(): Promise<boolean> {
    const upstream = config.upstream.baseURL;
    try {
      const response = await fetch(`${upstream}${config.upstream.healthCheckPath}`, {
        headers: {
          [config.upstream.apiKeyHeader]: `Bearer ${config.upstream.apiKeyValue}`
        },
        timeout: config.timeouts.healthCheck
      });
      
      return response.ok;
    } catch (error) {
      logger.error('Health check failed', { error: (error as Error).message });
      return false;
    }
  }
}

// Export an instance of the plugin
export default new V1ResponsesPlugin();
```

```
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


```


```

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


```
// Contract tests for plugins
import { Request, Response } from 'express';
import v1ResponsesPlugin from '../src/plugins/v1-responses.js';

// Mock Express Request and Response
const mockRequest = (method: string, path: string, body: any): Partial<Request> => ({
  method,
  path,
  body,
});

const mockResponse = (): Partial<Response> => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  res.write = jest.fn();
  res.end = jest.fn();
  return res;
};

// Mock fetch
global.fetch = jest.fn();

describe('v1-responses plugin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should correctly identify requests it can handle', () => {
    const
