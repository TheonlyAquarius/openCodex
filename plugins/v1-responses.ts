
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
