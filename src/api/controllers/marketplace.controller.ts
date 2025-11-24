/**
 * Marketplace Controller
 *
 * Handles HTTP requests for marketplace operations.
 */

import type { Request, Response, NextFunction } from 'express';
import type { WalletOrchestrator } from '@services/WalletOrchestrator.js';
import { createLogger } from '@lib/logger/index.js';
import { ApiError } from '../middleware/index.js';
import { successResponse } from '../routes/index.js';
import type { Logger } from 'pino';

export class MarketplaceController {
  private logger: Logger;
  private orchestrator: WalletOrchestrator;

  constructor(orchestrator: WalletOrchestrator) {
    this.orchestrator = orchestrator;
    this.logger = createLogger('marketplace-controller');
  }

  /**
   * Get the marketplace service or throw if unavailable
   */
  private getMarketplaceServiceOrThrow() {
    const marketplaceService = this.orchestrator.getMarketplaceService();
    if (!marketplaceService) {
      throw ApiError.serviceUnavailable('Marketplace service not available');
    }
    return marketplaceService;
  }

  /**
   * Verify a user's registration in the marketplace
   */
  verify = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { publicKey, verificationData } = req.body;
      const marketplaceService = this.getMarketplaceServiceOrThrow();

      const isRegistered = await marketplaceService.isUserRegistered(publicKey);

      res.json(successResponse({
        valid: isRegistered,
        publicKey,
        marketplaceAddress: verificationData?.marketplaceAddress,
      }));
    } catch (error) {
      this.logger.error({ err: error }, 'Error verifying in marketplace');
      next(error);
    }
  };

  /**
   * Register a user in the marketplace
   */
  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { publicKey, userData } = req.body;
      const marketplaceService = this.getMarketplaceServiceOrThrow();

      const result = await marketplaceService.registerUser({
        userId: publicKey,
        displayName: userData?.displayName,
        metadata: userData?.metadata,
      });

      res.json(successResponse({
        transactionId: result,
        publicKey,
      }));
    } catch (error) {
      this.logger.error({ err: error }, 'Error registering in marketplace');
      next(error);
    }
  };
}
