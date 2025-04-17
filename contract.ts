// test/contract.test.ts

import { Request, Response } from 'express';
import { V1ResponsesPlugin } from '../src/plugins/v1-responses';
import { OpenAIResponsesFormat, OpenAIChatFormat } from '../src/plugins/base-plugin';
import logger from '../src/logger';
import config from '../src/config';

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

describe('V1ResponsesPlugin', () => {
  let plugin: V1ResponsesPlugin;

  beforeEach(() => {
    jest.clearAllMocks();
    plugin = new V1ResponsesPlugin();
    jest.spyOn(logger, 'debug').mockImplementation(() => {});
    jest.spyOn(logger, 'error').mockImplementation(() => {});
  });

  describe('canHandle', () => {
    test('should return true for POST /v1/responses', () => {
      const req = mockRequest('POST', '/v1/responses', {});
      expect(plugin.canHandle(req as Request)).toBe(true);
    });

    test('should return false for other paths', () => {
      const req = mockRequest('POST', '/v1/other', {});
      expect(plugin.canHandle(req as Request)).toBe(false);
    });

    test('should return false for non-POST methods', () => {
      const req = mockRequest('GET', '/v1/responses', {});
      expect(plugin.canHandle(req as Request)).toBe(false);
    });
  });

  describe('transformRequest', () => {
    test('should transform basic request with instructions and input', () => {
      const input: OpenAIResponsesFormat = {
        model: 'gpt-4',
        instructions: 'You are a helpful assistant.',
        input: [{ role: 'user', content: 'Hello!' }],
      };

      const expected: OpenAIChatFormat = {
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Hello!' },
        ],
        temperature: 0.7,
        max_tokens: -1,
        stream: false,
      };

      const result = (plugin as any).transformRequest(input);
      expect(result).toEqual(expected);
    });

    test('should handle streaming requests', () => {
      const input: OpenAIResponsesFormat = {
        model: 'gpt-4',
        stream: true,
        input: [{ role: 'user', content: 'Stream this!' }],
      };

      const result = (plugin as any).transformRequest(input);
      expect(result.stream).toBe(true);
      expect(result.messages).toContainEqual({ role: 'user', content: 'Stream this!' });
    });

    test('should handle tools and parallel_tool_calls', () => {
      const input: OpenAIResponsesFormat = {
        model: 'gpt-4',
        tools: [{ type: 'function', function: { name: 'test' } }],
        parallel_tool_calls: true,
      };

      const result = (plugin as any).transformRequest(input);
      expect(result.tools).toEqual([{ type: 'function', function: { name: 'test' } }]);
      expect(result.parallel_tool_calls).toBe(true);
    });

    test('should normalize complex content', () => {
      const input: OpenAIResponsesFormat = {
        model: 'gpt-4',
        input: [
          { role: 'user', content: [{ type: 'input_text', text: 'Test' }] },
        ],
      };

      const result = (plugin as any).transformRequest(input);
      expect(result.messages).toContainEqual({
        role: 'user',
        content: [{ type: 'text', text: 'Test' }],
      });
    });
  });

  describe('handle', () => {
    test('should handle non-streaming request successfully', async () => {
      const req = mockRequest('POST', '/vbce1/responses', {
        model: 'gpt-4',
        input: [{ role: 'user', content: 'Hello!' }],
      });
      const res = mockResponse();
      const mockResponseData = { choices: [{ message: { content: 'Hi!' } }] };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponseData),
      });

      const handled = await plugin.handle(req as Request, res as Response);
      expect(handled).toBe(true);
      expect(res.json).toHaveBeenCalledWith(mockResponseData);
      expect(global.fetch).toHaveBeenCalledWith(
        `${config.upstream.baseURL}/chat/completions`,
        expect.any(Object)
      );
    });

    test('should handle streaming request successfully', async () => {
      const req = mockRequest('POST', '/v1/responses', {
        model: 'gpt-4',
        stream: true,
        input: [{ role: 'user', content: 'Stream this!' }],
      });
      const res = mockResponse();

      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield Buffer.from('data: {"choices":[{"delta":{"content":"Hi!"}}]}\n\n');
          yield Buffer.from('data: [DONE]\n\n');
        },
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        body: mockStream,
      });

      const handled = await plugin.handle(req as Request, res as Response);
      expect(handled).toBe(true);
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
      expect(res.write).toHaveBeenCalled();
      expect(res.end).toHaveBeenCalled();
    });

    test('should handle upstream error for non-streaming request', async () => {
      const req = mockRequest('POST', '/v1/responses', {
        model: 'gpt-4',
        input: [{ role: 'user', content: 'Hello!' }],
      });
      const res = mockResponse();

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        text: jest.fn().mockResolvedValue('Bad request'),
      });

      const handled = await plugin.handle(req as Request, res as Response);
      expect(handled).toBe(true);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith('Bad request');
    });

    test('should handle fetch error', async () => {
      const req = mockRequest('POST', '/v1/responses', {
        model: 'gpt-4',
        input: [{ role: 'user', content: 'Hello!' }],
      });
      const res = mockResponse();

      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const handled = await plugin.handle(req as Request, res as Response);
      expect(handled).toBe(true);
      expect(res.status).toHaveBeenCalledWith(502);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Error forwarding request: Network error',
      });
    });
  });

  describe('checkHealth', () => {
    test('should return true for successful health check', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
      const result = await plugin.checkHealth();
      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        `${config.upstream.baseURL}${config.upstream.healthCheckPath}`,
        expect.any(Object)
      );
    });

    test('should return false for failed health check', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Health check failed'));
      const result = await plugin.checkHealth();
      expect(result).toBe(false);
    });
  });
});
