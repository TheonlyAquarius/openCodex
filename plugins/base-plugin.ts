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
