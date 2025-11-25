/**
 * Request Validator Unit Tests
 *
 * Tests for MCP HTTP request validation middleware.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { Request, Response } from 'express';

// Mock dependencies before imports
jest.mock('../../../../src/lib/logger/index.js', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

jest.mock('../../../../src/lib/utils/seed-manager.js', () => ({
  SeedManager: {
    hasAgentSeed: jest.fn(),
  },
}));

import {
  validateMcpRequest,
  sendValidationError,
  createJsonRpcError,
  JsonRpcErrorCode,
  HttpStatus,
} from '../../../../src/mcp/middleware/request-validator.js';
import { SeedManager } from '../../../../src/lib/utils/seed-manager.js';

// Helper to create mock request
function createMockRequest(options: {
  body?: unknown;
  headers?: Record<string, string | undefined>;
  ip?: string;
}): Request {
  return {
    body: options.body,
    headers: options.headers ?? {},
    ip: options.ip ?? '127.0.0.1',
  } as Request;
}

// Helper to create mock response
function createMockResponse(): Response & { statusCode?: number; jsonData?: unknown } {
  const res: any = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res;
}

describe('Request Validator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateMcpRequest', () => {
    describe('body validation', () => {
      it('should reject null body', () => {
        const req = createMockRequest({ body: null });
        const result = validateMcpRequest(req);

        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error.httpStatus).toBe(HttpStatus.BAD_REQUEST);
          expect(result.error.code).toBe(JsonRpcErrorCode.INVALID_REQUEST);
          expect(result.error.message).toContain('valid JSON object');
        }
      });

      it('should reject array body', () => {
        const req = createMockRequest({ body: [] });
        const result = validateMcpRequest(req);

        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error.code).toBe(JsonRpcErrorCode.INVALID_REQUEST);
        }
      });

      it('should reject string body', () => {
        const req = createMockRequest({ body: 'string' });
        const result = validateMcpRequest(req);

        expect(result.valid).toBe(false);
      });

      it('should accept valid object body', () => {
        (SeedManager.hasAgentSeed as jest.Mock).mockReturnValue(true);

        const req = createMockRequest({
          body: { jsonrpc: '2.0', method: 'test' },
          headers: { 'x-agent-id': 'agent-1' },
        });
        const result = validateMcpRequest(req);

        expect(result.valid).toBe(true);
      });
    });

    describe('JSON-RPC version validation', () => {
      it('should reject missing jsonrpc field', () => {
        const req = createMockRequest({
          body: { method: 'test' },
          headers: { 'x-agent-id': 'agent-1' },
        });
        const result = validateMcpRequest(req);

        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error.code).toBe(JsonRpcErrorCode.INVALID_REQUEST);
          expect(result.error.message).toContain('2.0');
        }
      });

      it('should reject wrong jsonrpc version', () => {
        const req = createMockRequest({
          body: { jsonrpc: '1.0', method: 'test' },
          headers: { 'x-agent-id': 'agent-1' },
        });
        const result = validateMcpRequest(req);

        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error.message).toContain('2.0');
        }
      });

      it('should accept jsonrpc 2.0', () => {
        (SeedManager.hasAgentSeed as jest.Mock).mockReturnValue(true);

        const req = createMockRequest({
          body: { jsonrpc: '2.0', method: 'test' },
          headers: { 'x-agent-id': 'agent-1' },
        });
        const result = validateMcpRequest(req);

        expect(result.valid).toBe(true);
      });
    });

    describe('agent ID validation', () => {
      it('should reject missing X-Agent-Id header', () => {
        const req = createMockRequest({
          body: { jsonrpc: '2.0', method: 'test' },
          headers: {},
        });
        const result = validateMcpRequest(req);

        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error.httpStatus).toBe(HttpStatus.BAD_REQUEST);
          expect(result.error.code).toBe(JsonRpcErrorCode.INVALID_REQUEST);
          expect(result.error.message).toContain('X-Agent-Id');
        }
      });

      it('should reject empty X-Agent-Id header', () => {
        const req = createMockRequest({
          body: { jsonrpc: '2.0', method: 'test' },
          headers: { 'x-agent-id': '' },
        });
        const result = validateMcpRequest(req);

        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error.message).toContain('X-Agent-Id');
        }
      });

      it('should reject whitespace-only X-Agent-Id header', () => {
        const req = createMockRequest({
          body: { jsonrpc: '2.0', method: 'test' },
          headers: { 'x-agent-id': '   ' },
        });
        const result = validateMcpRequest(req);

        expect(result.valid).toBe(false);
      });

      it('should trim X-Agent-Id header', () => {
        (SeedManager.hasAgentSeed as jest.Mock).mockReturnValue(true);

        const req = createMockRequest({
          body: { jsonrpc: '2.0', method: 'test' },
          headers: { 'x-agent-id': '  agent-1  ' },
        });
        const result = validateMcpRequest(req);

        expect(result.valid).toBe(true);
        if (result.valid) {
          expect(result.context.agentId).toBe('agent-1');
        }
      });
    });

    describe('agent registration validation', () => {
      it('should reject unregistered agent', () => {
        (SeedManager.hasAgentSeed as jest.Mock).mockReturnValue(false);

        const req = createMockRequest({
          body: { jsonrpc: '2.0', method: 'test' },
          headers: { 'x-agent-id': 'unregistered-agent' },
        });
        const result = validateMcpRequest(req);

        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error.httpStatus).toBe(HttpStatus.UNAUTHORIZED);
          expect(result.error.code).toBe(JsonRpcErrorCode.AGENT_NOT_REGISTERED);
          expect(result.error.message).toContain('not registered');
          expect(result.error.data?.agentId).toBe('unregistered-agent');
        }
      });

      it('should accept registered agent', () => {
        (SeedManager.hasAgentSeed as jest.Mock).mockReturnValue(true);

        const req = createMockRequest({
          body: { jsonrpc: '2.0', method: 'test' },
          headers: { 'x-agent-id': 'registered-agent' },
        });
        const result = validateMcpRequest(req);

        expect(result.valid).toBe(true);
        if (result.valid) {
          expect(result.context.agentId).toBe('registered-agent');
          expect(result.context.body).toEqual({ jsonrpc: '2.0', method: 'test' });
        }
      });
    });

    describe('successful validation', () => {
      it('should return validated context with agentId and body', () => {
        (SeedManager.hasAgentSeed as jest.Mock).mockReturnValue(true);

        const requestBody = { jsonrpc: '2.0', method: 'tools/list', id: 1 };
        const req = createMockRequest({
          body: requestBody,
          headers: { 'x-agent-id': 'my-agent' },
        });
        const result = validateMcpRequest(req);

        expect(result.valid).toBe(true);
        if (result.valid) {
          expect(result.context.agentId).toBe('my-agent');
          expect(result.context.body).toBe(requestBody);
        }
      });
    });
  });

  describe('createJsonRpcError', () => {
    it('should create error without data', () => {
      const error = createJsonRpcError(-32600, 'Invalid Request');

      expect(error).toEqual({
        jsonrpc: '2.0',
        error: {
          code: -32600,
          message: 'Invalid Request',
        },
        id: null,
      });
    });

    it('should create error with data', () => {
      const error = createJsonRpcError(-32001, 'Agent not found', { agentId: 'test' });

      expect(error).toEqual({
        jsonrpc: '2.0',
        error: {
          code: -32001,
          message: 'Agent not found',
          data: { agentId: 'test' },
        },
        id: null,
      });
    });
  });

  describe('sendValidationError', () => {
    it('should send error response with correct status and body', () => {
      const res = createMockResponse();
      const error = {
        httpStatus: 401,
        code: -32001,
        message: 'Agent not registered',
        data: { hint: 'Register first' },
      };

      sendValidationError(res, error);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        jsonrpc: '2.0',
        error: {
          code: -32001,
          message: 'Agent not registered',
          data: { hint: 'Register first' },
        },
        id: null,
      });
    });

    it('should send error response without data when not provided', () => {
      const res = createMockResponse();
      const error = {
        httpStatus: 400,
        code: -32600,
        message: 'Invalid Request',
      };

      sendValidationError(res, error);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        jsonrpc: '2.0',
        error: {
          code: -32600,
          message: 'Invalid Request',
        },
        id: null,
      });
    });
  });

  describe('JsonRpcErrorCode constants', () => {
    it('should have standard JSON-RPC 2.0 error codes', () => {
      expect(JsonRpcErrorCode.PARSE_ERROR).toBe(-32700);
      expect(JsonRpcErrorCode.INVALID_REQUEST).toBe(-32600);
      expect(JsonRpcErrorCode.METHOD_NOT_FOUND).toBe(-32601);
      expect(JsonRpcErrorCode.INVALID_PARAMS).toBe(-32602);
      expect(JsonRpcErrorCode.INTERNAL_ERROR).toBe(-32603);
    });

    it('should have custom agent error code', () => {
      expect(JsonRpcErrorCode.AGENT_NOT_REGISTERED).toBe(-32001);
    });
  });

  describe('HttpStatus constants', () => {
    it('should have standard HTTP status codes', () => {
      expect(HttpStatus.OK).toBe(200);
      expect(HttpStatus.BAD_REQUEST).toBe(400);
      expect(HttpStatus.UNAUTHORIZED).toBe(401);
      expect(HttpStatus.INTERNAL_ERROR).toBe(500);
    });
  });
});
