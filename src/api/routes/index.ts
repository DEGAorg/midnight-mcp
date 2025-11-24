/**
 * API Routes Index
 *
 * Aggregates all route modules and creates the main router.
 */

import { Router, type Request, type Response } from 'express';
import { createWalletRoutes } from './wallet.routes.js';
import { createTokenRoutes } from './token.routes.js';
import { createDaoRoutes } from './dao.routes.js';
import { createMarketplaceRoutes } from './marketplace.routes.js';
import type { WalletOrchestrator } from '@services/WalletOrchestrator.js';

/**
 * API response wrapper for successful responses
 */
export interface ApiResponse<T = unknown> {
  success: true;
  data: T;
  timestamp: string;
}

/**
 * Create success response
 */
export function successResponse<T>(data: T): ApiResponse<T> {
  return {
    success: true,
    data,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create all API routes
 */
export function createApiRoutes(orchestrator: WalletOrchestrator): Router {
  const router = Router();

  // Health check
  router.get('/health', (_req: Request, res: Response) => {
    res.json(successResponse({
      status: 'healthy',
      uptime: process.uptime(),
      version: process.env.npm_package_version ?? '2.0.0',
    }));
  });

  // API info
  router.get('/', (_req: Request, res: Response) => {
    res.json(successResponse({
      name: 'Midnight MCP API',
      version: '2.0.0',
      endpoints: {
        wallet: '/wallet/*',
        tokens: '/tokens/*',
        dao: '/dao/*',
        marketplace: '/marketplace/*',
      },
    }));
  });

  // Mount domain routes
  router.use('/wallet', createWalletRoutes(orchestrator));
  router.use('/tokens', createTokenRoutes(orchestrator));
  router.use('/dao', createDaoRoutes(orchestrator));
  router.use('/marketplace', createMarketplaceRoutes(orchestrator));

  return router;
}

export { createWalletRoutes } from './wallet.routes.js';
export { createTokenRoutes } from './token.routes.js';
export { createDaoRoutes } from './dao.routes.js';
export { createMarketplaceRoutes } from './marketplace.routes.js';
