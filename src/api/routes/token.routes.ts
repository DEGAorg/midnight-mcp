/**
 * Token Routes
 *
 * Routes for token operations (list, balance, send, register).
 */

import { Router } from 'express';
import { z } from 'zod';
import { TokenController } from '../controllers/token.controller.js';
import { validateRequest, validateParams, AmountSchema, TokenNameSchema } from '../middleware/index.js';
import type { WalletOrchestrator } from '@services/WalletOrchestrator.js';

/**
 * Request validation schemas
 */
const TokenParamsSchema = z.object({
  tokenName: TokenNameSchema,
});

const SendTokenSchema = z.object({
  tokenId: z.string().min(1, 'Token ID is required'),
  toAddress: z.string().min(1, 'Destination address is required'),
  amount: AmountSchema,
});

const RegisterTokenSchema = z.object({
  name: z.string().min(1, 'Token name is required').max(50),
  symbol: z.string().min(1, 'Token symbol is required').max(10),
  contractAddress: z.string().min(1, 'Contract address is required'),
  domainSeparator: z.string().optional(),
  decimals: z.number().int().min(0).max(18).optional(),
});

const RegisterTokensBatchSchema = z.object({
  tokens: z.array(RegisterTokenSchema).min(1, 'At least one token required'),
});

/**
 * Create token routes
 */
export function createTokenRoutes(orchestrator: WalletOrchestrator): Router {
  const router = Router();
  const controller = new TokenController(orchestrator);

  // List and balance
  router.get('/list', controller.listTokens);
  router.get(
    '/balance/:tokenName',
    validateParams(TokenParamsSchema),
    controller.getTokenBalance
  );

  // Send tokens
  router.post(
    '/send',
    validateRequest(SendTokenSchema),
    controller.sendToken
  );

  // Registration
  router.post(
    '/register',
    validateRequest(RegisterTokenSchema),
    controller.registerToken
  );
  router.post(
    '/batch',
    validateRequest(RegisterTokensBatchSchema),
    controller.registerTokensBatch
  );

  return router;
}
