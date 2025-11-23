/**
 * MCP Server Middleware
 *
 * Express middleware for MCP protocol HTTP server.
 */

export { corsMiddleware } from './cors.js';
export { requestLoggerMiddleware } from './logger.js';
export { requestTimeoutMiddleware } from './timeout.js';
export { errorHandlerMiddleware, notFoundMiddleware } from './errorHandler.js';

// Request validation
export {
  validateMcpRequest,
  sendValidationError,
  createJsonRpcError,
  JsonRpcErrorCode,
  HttpStatus,
  type ValidatedRequest,
  type ValidationError,
  type ValidationResult
} from './request-validator.js';
