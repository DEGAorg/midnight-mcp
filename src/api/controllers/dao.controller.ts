/**
 * DAO Controller
 *
 * Handles HTTP requests for DAO governance operations.
 */

import type { Request, Response, NextFunction } from 'express';
import type { WalletOrchestrator } from '@services/WalletOrchestrator.js';
import { createLogger } from '@lib/logger/index.js';
import { ApiError } from '../middleware/index.js';
import { successResponse } from '../routes/index.js';
import type { Logger } from 'pino';

export class DaoController {
  private logger: Logger;
  private orchestrator: WalletOrchestrator;

  constructor(orchestrator: WalletOrchestrator) {
    this.orchestrator = orchestrator;
    this.logger = createLogger('dao-controller');
  }

  /**
   * Get the current DAO service or throw if unavailable
   */
  private getDaoServiceOrThrow() {
    const _daoService = this.orchestrator.getDaoService();
    if (!_daoService) {
      throw ApiError.serviceUnavailable('DAO service not available');
    }
    return _daoService;
  }

  /**
   * Get current DAO state
   */
  getDaoState = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const _daoService = this.getDaoServiceOrThrow();

      // TODO: Implement getDaoState in DaoService
      res.json(successResponse({
        available: true,
        message: 'DAO state retrieval not yet implemented',
      }));
    } catch (error) {
      this.logger.error({ err: error }, 'Error getting DAO state');
      next(error);
    }
  };

  /**
   * Get current election status
   */
  getElectionStatus = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const _daoService = this.getDaoServiceOrThrow();

      // TODO: Implement getElectionStatus in DaoService
      res.json(successResponse({
        available: true,
        message: 'Election status retrieval not yet implemented',
      }));
    } catch (error) {
      this.logger.error({ err: error }, 'Error getting DAO election status');
      next(error);
    }
  };

  /**
   * Open a new election
   */
  openElection = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { electionId } = req.body;
      const _daoService = this.getDaoServiceOrThrow();

      const result = await _daoService.openElection(electionId);

      res.json(successResponse(result));
    } catch (error) {
      this.logger.error({ err: error }, 'Error opening DAO election');
      next(error);
    }
  };

  /**
   * Close an existing election
   */
  closeElection = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { electionId } = req.body;
      const _daoService = this.getDaoServiceOrThrow();

      const result = await _daoService.closeElection(electionId);

      res.json(successResponse(result));
    } catch (error) {
      this.logger.error({ err: error }, 'Error closing DAO election');
      next(error);
    }
  };

  /**
   * Cast a vote in the current election
   */
  castVote = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { voteType } = req.body;
      const _daoService = this.getDaoServiceOrThrow();

      const result = await _daoService.castVote(voteType);

      res.json(successResponse(result));
    } catch (error) {
      this.logger.error({ err: error }, 'Error casting DAO vote');
      next(error);
    }
  };

  /**
   * Fund the DAO treasury
   */
  fundTreasury = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { amount } = req.body;
      const _daoService = this.getDaoServiceOrThrow();

      const result = await _daoService.fundTreasury(amount);

      res.json(successResponse(result));
    } catch (error) {
      this.logger.error({ err: error }, 'Error funding DAO treasury');
      next(error);
    }
  };
}
