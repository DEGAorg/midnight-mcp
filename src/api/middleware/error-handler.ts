/**
 * Error Handler Middleware
 *
 * Centralized error handling for the API.
 * Provides consistent error responses and logging.
 */

import type { Request, Response, NextFunction } from 'express';
import { createLogger } from '@lib/logger/index.js';
import type { Logger } from 'pino';

const logger: Logger = createLogger('error-handler');

/**
 * Custom API Error class
 */
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string, code?: string, details?: Record<string, unknown>): ApiError {
    return new ApiError(400, message, code ?? 'BAD_REQUEST', details);
  }

  static unauthorized(message = 'Unauthorized'): ApiError {
    return new ApiError(401, message, 'UNAUTHORIZED');
  }

  static forbidden(message = 'Forbidden'): ApiError {
    return new ApiError(403, message, 'FORBIDDEN');
  }

  static notFound(message = 'Resource not found'): ApiError {
    return new ApiError(404, message, 'NOT_FOUND');
  }

  static conflict(message: string, details?: Record<string, unknown>): ApiError {
    return new ApiError(409, message, 'CONFLICT', details);
  }

  static serviceUnavailable(message = 'Service unavailable'): ApiError {
    return new ApiError(503, message, 'SERVICE_UNAVAILABLE');
  }

  static internal(message = 'Internal server error'): ApiError {
    return new ApiError(500, message, 'INTERNAL_ERROR');
  }
}

/**
 * Error response format
 */
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  timestamp: string;
  requestId?: string;
}

/**
 * Global error handler middleware
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = req.headers['x-request-id'] as string | undefined;

  // Log the error
  logger.error({
    err,
    method: req.method,
    path: req.path,
    requestId,
  }, 'Request error');

  // Handle ApiError
  if (err instanceof ApiError) {
    const response: ErrorResponse = {
      success: false,
      error: {
        code: err.code ?? 'ERROR',
        message: err.message,
        details: err.details,
      },
      timestamp: new Date().toISOString(),
      requestId,
    };

    res.status(err.statusCode).json(response);
    return;
  }

  // Handle validation errors (from Zod or similar)
  if (err.name === 'ZodError') {
    const zodError = err as unknown as { issues: Array<{ path: string[]; message: string }> };
    const response: ErrorResponse = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: {
          issues: zodError.issues?.map(issue => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
      },
      timestamp: new Date().toISOString(),
      requestId,
    };

    res.status(400).json(response);
    return;
  }

  // Handle unknown errors
  const response: ErrorResponse = {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred'
        : err.message,
    },
    timestamp: new Date().toISOString(),
    requestId,
  };

  res.status(500).json(response);
}

/**
 * Not found handler for undefined routes
 */
export function notFoundHandler(req: Request, res: Response): void {
  const response: ErrorResponse = {
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
    timestamp: new Date().toISOString(),
    requestId: req.headers['x-request-id'] as string | undefined,
  };

  res.status(404).json(response);
}
