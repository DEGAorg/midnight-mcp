/**
 * Wallet Routes
 *
 * Routes for wallet status, balance, and transaction operations.
 */

import { Router } from 'express';
import { z } from 'zod';
import { WalletController } from '../controllers/wallet.controller.js';
import { validateRequest, validateParams, AmountSchema, TransactionIdSchema } from '../middleware/index.js';
import type { WalletOrchestrator } from '@services/WalletOrchestrator.js';

/**
 * Request validation schemas
 */
const SendFundsSchema = z.object({
  destinationAddress: z.string().min(1, 'Destination address is required'),
  amount: AmountSchema,
});

const VerifyTransactionSchema = z.object({
  identifier: TransactionIdSchema,
});

const TransactionParamsSchema = z.object({
  transactionId: TransactionIdSchema,
});

/**
 * Create wallet routes
 */
export function createWalletRoutes(orchestrator: WalletOrchestrator): Router {
  const router = Router();
  const controller = new WalletController(orchestrator);

  // Status endpoints
  router.get('/status', controller.getStatus);
  router.get('/address', controller.getAddress);
  router.get('/balance', controller.getBalance);
  router.get('/config', controller.getWalletConfig);

  // Transaction endpoints
  router.get('/transactions', controller.getTransactions);
  router.get('/pending-transactions', controller.getPendingTransactions);
  router.get(
    '/transaction/:transactionId',
    validateParams(TransactionParamsSchema),
    controller.getTransactionStatus
  );
  router.post(
    '/send',
    validateRequest(SendFundsSchema),
    controller.sendFunds
  );
  router.post(
    '/verify-transaction',
    validateRequest(VerifyTransactionSchema),
    controller.verifyTransaction
  );

  return router;
}
