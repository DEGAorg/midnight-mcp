/**
 * CORS Middleware for MCP Server
 *
 * Handles Cross-Origin Resource Sharing headers for multi-agent HTTP deployments.
 */

import type { Request, Response, NextFunction } from 'express';

/**
 * HTTP Status Code: OK
 */
const HTTP_STATUS_OK = 200;

/**
 * CORS middleware
 *
 * Adds CORS headers to allow cross-origin requests from AI agents.
 * Supports the Mcp-Session-Id custom header.
 */
export function corsMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Allow all origins (adjust for production)
  res.header('Access-Control-Allow-Origin', '*');

  // Allow common HTTP methods
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  // Allow Content-Type, X-Agent-Id (required), and Mcp-Session-Id (transport session)
  res.header('Access-Control-Allow-Headers', 'Content-Type, X-Agent-Id, Mcp-Session-Id');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.sendStatus(HTTP_STATUS_OK);
    return;
  }

  next();
}
