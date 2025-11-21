/**
 * Error Handler Middleware for MCP Server
 *
 * Catches and handles all unhandled errors in MCP requests.
 */

import type { Request, Response, NextFunction } from 'express';
import { createLogger } from '../../lib/logger/index.js';

const logger = createLogger('mcp-error');

/**
 * HTTP Status Code: Internal Server Error
 */
const HTTP_STATUS_INTERNAL_ERROR = 500;

/**
 * HTTP Status Code: Not Found
 */
const HTTP_STATUS_NOT_FOUND = 404;

/**
 * Error handling middleware
 *
 * Catches unhandled errors and returns proper JSON-RPC error response.
 */
export function errorHandlerMiddleware(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const agentId = req.headers['mcp-session-id'];

  logger.error(
    {
      error: err,
      path: req.path,
      method: req.method,
      agentId,
      stack: err.stack
    },
    'Unhandled MCP error'
  );

  // Return JSON-RPC error format
  res.status(HTTP_STATUS_INTERNAL_ERROR).json({
    jsonrpc: '2.0',
    error: {
      code: -32603,
      message: 'Internal error',
      data: {
        message: err.message,
        type: err.constructor.name
      }
    },
    id: null
  });
}

/**
 * 404 Not Found middleware
 */
export function notFoundMiddleware(req: Request, res: Response): void {
  logger.warn(
    {
      path: req.path,
      method: req.method
    },
    'MCP endpoint not found'
  );

  res.status(HTTP_STATUS_NOT_FOUND).json({
    jsonrpc: '2.0',
    error: {
      code: -32601,
      message: 'Method not found',
      data: {
        path: req.path
      }
    },
    id: null
  });
}
