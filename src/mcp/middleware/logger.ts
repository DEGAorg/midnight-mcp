/**
 * Request Logger Middleware for MCP Server
 *
 * Logs all incoming HTTP requests with session context.
 */

import type { Request, Response, NextFunction } from 'express';
import { createLogger } from '@lib/logger/index.js';

const logger = createLogger('mcp-request');

/**
 * Request logging middleware
 *
 * Logs method, path, and agentId (from Mcp-Session-Id header) for all requests.
 */
export function requestLoggerMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const agentId = req.headers['mcp-session-id'];

  logger.debug(
    {
      method: req.method,
      path: req.path,
      agentId,
      contentType: req.headers['content-type']
    },
    'Incoming MCP request'
  );

  next();
}
