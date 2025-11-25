/**
 * API Module Index
 *
 * Exports all API components for external use.
 */

// Server
export { ApiServer, startApiServer, type ApiServerConfig } from './server.js';

// Entry point
export { createServer } from './http-server.js';

// Controllers
export {
  WalletController,
  TokenController,
  DaoController,
  MarketplaceController,
} from './controllers/index.js';

// Routes
export {
  createApiRoutes,
  createWalletRoutes,
  createTokenRoutes,
  createDaoRoutes,
  createMarketplaceRoutes,
  successResponse,
  type ApiResponse,
} from './routes/index.js';

// Middleware
export {
  errorHandler,
  notFoundHandler,
  ApiError,
  requestLogger,
  validateRequest,
  validateQuery,
  validateParams,
  MidnightAddressSchema,
  AmountSchema,
  TransactionIdSchema,
  TokenNameSchema,
  PaginationSchema,
  UUIDSchema,
} from './middleware/index.js';
