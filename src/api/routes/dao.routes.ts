/**
 * DAO Routes
 *
 * Routes for DAO governance operations.
 */

import { Router } from 'express';
import { z } from 'zod';
import { DaoController } from '../controllers/dao.controller.js';
import { validateRequest, AmountSchema } from '../middleware/index.js';
import type { WalletOrchestrator } from '@services/WalletOrchestrator.js';

/**
 * Request validation schemas
 */
const ElectionSchema = z.object({
  electionId: z.string().min(1, 'Election ID is required'),
});

const CastVoteSchema = z.object({
  voteType: z.enum(['yes', 'no', 'absence'], {
    errorMap: () => ({ message: 'Vote type must be yes, no, or absence' }),
  }),
});

const FundTreasurySchema = z.object({
  amount: AmountSchema,
});

/**
 * Create DAO routes
 */
export function createDaoRoutes(orchestrator: WalletOrchestrator): Router {
  const router = Router();
  const controller = new DaoController(orchestrator);

  // State queries
  router.get('/state', controller.getDaoState);
  router.get('/election-status', controller.getElectionStatus);

  // Election management
  router.post(
    '/open-election',
    validateRequest(ElectionSchema),
    controller.openElection
  );
  router.post(
    '/close-election',
    validateRequest(ElectionSchema),
    controller.closeElection
  );

  // Voting
  router.post(
    '/cast-vote',
    validateRequest(CastVoteSchema),
    controller.castVote
  );

  // Treasury
  router.post(
    '/fund-treasury',
    validateRequest(FundTreasurySchema),
    controller.fundTreasury
  );

  return router;
}
