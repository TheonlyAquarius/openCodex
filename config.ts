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
    level: "info",   // debug, info, warn, error
    format: "pretty" // pretty, json
  },
  timeouts: {
    request: 60000,    // 60 seconds
    healthCheck: 5000  // 5 seconds
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
    // For plugins, only override if explicitly provided by file or env
    plugins: envConfig.plugins || fileConfig.plugins || defaultConfig.plugins
  };
}

// Export the resolved configuration
export default getConfig();
