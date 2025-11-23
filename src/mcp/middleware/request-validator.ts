/**
 * MCP Request Validator
 *
 * Validates incoming MCP HTTP requests for JSON-RPC 2.0 compliance
 * and agent authentication.
 */

import type { Request, Response } from 'express';
import { SeedManager } from '../../lib/utils/seed-manager.js';
import { createLogger } from '../../lib/logger/index.js';
import { randomUUID } from 'crypto';

const logger = createLogger('mcp-request-validator');

/**
 * JSON-RPC 2.0 Error Codes
 * @see https://www.jsonrpc.org/specification#error_object
 */
export const JsonRpcErrorCode = {
  /** Invalid JSON was received */
  PARSE_ERROR: -32700,
  /** The JSON sent is not a valid Request object */
  INVALID_REQUEST: -32600,
  /** The method does not exist or is not available */
  METHOD_NOT_FOUND: -32601,
  /** Invalid method parameters */
  INVALID_PARAMS: -32602,
  /** Internal JSON-RPC error */
  INTERNAL_ERROR: -32603,
  /** Agent not registered (custom) */
  AGENT_NOT_REGISTERED: -32001
} as const;

/**
 * HTTP Status Codes
 */
export const HttpStatus = {
  OK: 200,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  INTERNAL_ERROR: 500
} as const;

/**
 * Validated MCP request context
 */
export interface ValidatedRequest {
  /** Pre-registered agent ID */
  agentId: string;
  /** Transport session ID (auto-generated if not provided) */
  transportSessionId: string;
  /** JSON-RPC request body */
  body: Record<string, unknown>;
}

/**
 * Validation error details
 */
export interface ValidationError {
  /** HTTP status code */
  httpStatus: number;
  /** JSON-RPC error code */
  code: number;
  /** Error message */
  message: string;
  /** Additional context */
  data?: Record<string, unknown>;
}

/**
 * Validation result (discriminated union)
 */
export type ValidationResult =
  | { valid: true; context: ValidatedRequest }
  | { valid: false; error: ValidationError };

/**
 * Create a JSON-RPC 2.0 error response
 */
export function createJsonRpcError(
  code: number,
  message: string,
  data?: Record<string, unknown>
): object {
  return {
    jsonrpc: '2.0',
    error: {
      code,
      message,
      ...(data && { data })
    },
    id: null
  };
}

/**
 * Send validation error response
 */
export function sendValidationError(res: Response, error: ValidationError): void {
  res.status(error.httpStatus).json(
    createJsonRpcError(error.code, error.message, error.data)
  );
}

/**
 * Validate request body structure
 */
function validateBody(body: unknown): body is Record<string, unknown> {
  return body !== null && typeof body === 'object' && !Array.isArray(body);
}

/**
 * Validate JSON-RPC version
 */
function validateJsonRpcVersion(body: Record<string, unknown>): boolean {
  return body['jsonrpc'] === '2.0';
}

/**
 * Extract and validate agent ID from headers
 */
function extractAgentId(headers: Request['headers']): string | undefined {
  const agentId = headers['x-agent-id'];
  if (typeof agentId === 'string' && agentId.trim().length > 0) {
    return agentId.trim();
  }
  return undefined;
}

/**
 * Generate transport session ID
 */
function generateTransportSessionId(): string {
  return `session-${randomUUID()}`;
}

/**
 * Extract or generate transport session ID
 */
function extractTransportSessionId(headers: Request['headers']): string {
  const sessionId = headers['mcp-session-id'];
  if (typeof sessionId === 'string' && sessionId.trim().length > 0) {
    return sessionId.trim();
  }
  return generateTransportSessionId();
}

/**
 * Validate MCP request
 *
 * Performs comprehensive validation of incoming MCP HTTP requests:
 * 1. Request body must be a valid object
 * 2. JSON-RPC version must be "2.0"
 * 3. X-Agent-Id header is required
 * 4. Agent must be registered (has seed in SeedManager)
 *
 * @param req - Express request object
 * @returns Validation result with either validated context or error
 */
export function validateMcpRequest(req: Request): ValidationResult {
  const ip = req.ip;

  // 1. Validate request body exists and is an object
  if (!validateBody(req.body)) {
    logger.warn({ ip }, 'Invalid request body');
    return {
      valid: false,
      error: {
        httpStatus: HttpStatus.BAD_REQUEST,
        code: JsonRpcErrorCode.INVALID_REQUEST,
        message: 'Request body must be a valid JSON object'
      }
    };
  }

  const body = req.body as Record<string, unknown>;

  // 2. Validate JSON-RPC version
  if (!validateJsonRpcVersion(body)) {
    logger.warn({ ip, jsonrpc: body['jsonrpc'] }, 'Invalid JSON-RPC version');
    return {
      valid: false,
      error: {
        httpStatus: HttpStatus.BAD_REQUEST,
        code: JsonRpcErrorCode.INVALID_REQUEST,
        message: 'Invalid JSON-RPC version: must be "2.0"'
      }
    };
  }

  // 3. Extract and validate agent ID
  const agentId = extractAgentId(req.headers);
  if (!agentId) {
    logger.warn({ ip }, 'Missing X-Agent-Id header');
    return {
      valid: false,
      error: {
        httpStatus: HttpStatus.BAD_REQUEST,
        code: JsonRpcErrorCode.INVALID_REQUEST,
        message: 'X-Agent-Id header is required',
        data: {
          hint: 'Register an agent first: npm run setup-agent -- --agent-id=<your-agent-id>'
        }
      }
    };
  }

  // 4. Verify agent is registered
  if (!SeedManager.hasAgentSeed(agentId)) {
    logger.warn({ agentId, ip }, 'Agent not registered');
    return {
      valid: false,
      error: {
        httpStatus: HttpStatus.UNAUTHORIZED,
        code: JsonRpcErrorCode.AGENT_NOT_REGISTERED,
        message: `Agent '${agentId}' is not registered`,
        data: {
          agentId,
          hint: `Register this agent: npm run setup-agent -- --agent-id=${agentId}`
        }
      }
    };
  }

  // Extract transport session ID
  const transportSessionId = extractTransportSessionId(req.headers);

  logger.debug({ agentId, ip, transportSessionId }, 'Request validated');

  return {
    valid: true,
    context: {
      agentId,
      transportSessionId,
      body
    }
  };
}
