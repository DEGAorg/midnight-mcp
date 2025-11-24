/**
 * Request Logger Middleware
 *
 * Logs incoming requests and outgoing responses with timing information.
 */

import type { Request, Response, NextFunction } from 'express';
import { createLogger } from '@lib/logger/index.js';
import { randomUUID } from 'crypto';
import type { Logger } from 'pino';

const logger: Logger = createLogger('http');

/**
 * Extend Express Request to include requestId
 */
declare global {
  namespace Express {
    interface Request {
      requestId: string;
      startTime: number;
    }
  }
}

/**
 * Request logger middleware
 * Assigns a unique request ID and logs request/response details
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  // Assign request ID (from header or generate new)
  req.requestId = (req.headers['x-request-id'] as string) ?? randomUUID();
  req.startTime = Date.now();

  // Set request ID in response header
  res.setHeader('x-request-id', req.requestId);

  // Log incoming request
  logger.info({
    type: 'request',
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    query: Object.keys(req.query).length > 0 ? req.query : undefined,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  }, `-> ${req.method} ${req.path}`);

  // Capture response finish
  res.on('finish', () => {
    const duration = Date.now() - req.startTime;

    const logData = {
      type: 'response',
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
    };

    // Log based on status code
    if (res.statusCode >= 500) {
      logger.error(logData, `<- ${req.method} ${req.path} ${res.statusCode} (${duration}ms)`);
    } else if (res.statusCode >= 400) {
      logger.warn(logData, `<- ${req.method} ${req.path} ${res.statusCode} (${duration}ms)`);
    } else {
      logger.info(logData, `<- ${req.method} ${req.path} ${res.statusCode} (${duration}ms)`);
    }
  });

  next();
}
