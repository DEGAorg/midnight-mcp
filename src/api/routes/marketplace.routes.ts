/**
 * Marketplace Routes
 *
 * Routes for marketplace registration and verification.
 */

import { Router } from 'express';
import { z } from 'zod';
import { MarketplaceController } from '../controllers/marketplace.controller.js';
import { validateRequest } from '../middleware/index.js';
import type { WalletOrchestrator } from '@services/WalletOrchestrator.js';

/**
 * Request validation schemas
 */
const VerifySchema = z.object({
  publicKey: z.string().min(1, 'Public key is required'),
  verificationData: z.object({
    marketplaceAddress: z.string().optional(),
  }).optional(),
});

const RegisterSchema = z.object({
  publicKey: z.string().min(1, 'Public key is required'),
  userData: z.object({
    displayName: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
  }).optional(),
});

/**
 * Create marketplace routes
 */
export function createMarketplaceRoutes(orchestrator: WalletOrchestrator): Router {
  const router = Router();
  const controller = new MarketplaceController(orchestrator);

  // Verification
  router.post(
    '/verify',
    validateRequest(VerifySchema),
    controller.verify
  );

  // Registration
  router.post(
    '/register',
    validateRequest(RegisterSchema),
    controller.register
  );

  return router;
}
