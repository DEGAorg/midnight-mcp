/**
 * Request Timeout Middleware for MCP Server
 *
 * Sets timeout for all incoming requests to prevent hanging connections.
 */

import type { Request, Response, NextFunction } from 'express';

/**
 * Default timeout (2 minutes)
 * MCP tool calls can take a while (wallet sync, blockchain operations)
 */
const DEFAULT_TIMEOUT = 120000;

/**
 * Request timeout middleware factory
 *
 * @param timeout - Timeout in milliseconds (default: 2 minutes)
 * @returns Middleware function
 */
export function requestTimeoutMiddleware(timeout = DEFAULT_TIMEOUT) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    req.setTimeout(timeout);
    next();
  };
}
