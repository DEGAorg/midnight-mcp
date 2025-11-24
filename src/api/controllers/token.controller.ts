/**
 * Token Controller
 *
 * Handles HTTP requests for token operations.
 */

import type { Request, Response, NextFunction } from 'express';
import type { WalletOrchestrator } from '@services/WalletOrchestrator.js';
import { createLogger } from '@lib/logger/index.js';
import { successResponse } from '../routes/index.js';
import type { Logger } from 'pino';

export class TokenController {
  private logger: Logger;
  private orchestrator: WalletOrchestrator;

  constructor(orchestrator: WalletOrchestrator) {
    this.orchestrator = orchestrator;
    this.logger = createLogger('token-controller');
  }

  /**
   * List all registered tokens
   */
  listTokens = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tokenService = this.orchestrator.getTokenService();
      const tokens = tokenService.listTokens();

      res.json(successResponse({ tokens }));
    } catch (error) {
      this.logger.error({ err: error }, 'Error listing tokens');
      next(error);
    }
  };

  /**
   * Get balance for a specific token
   */
  getTokenBalance = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { tokenName } = req.params;
      const tokenService = this.orchestrator.getTokenService();
      const balance = tokenService.getTokenBalance(tokenName);

      res.json(successResponse({
        tokenName,
        balance: balance.toString(),
      }));
    } catch (error) {
      this.logger.error({ err: error }, 'Error getting token balance');
      next(error);
    }
  };

  /**
   * Send tokens to an address
   */
  sendToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { tokenId, toAddress, amount } = req.body;

      const amountBigInt = BigInt(amount);
      const tokenService = this.orchestrator.getTokenService();
      const txId = await tokenService.sendShieldedToken(tokenId, toAddress, amountBigInt);

      const transactionService = this.orchestrator.getTransactionService();
      const transaction = transactionService.getTransaction(txId);

      res.json(successResponse({
        id: txId,
        state: transaction?.state ?? 'pending',
        tokenId,
        toAddress,
        amount: amount.toString(),
        createdAt: transaction?.timestamp ?? new Date().toISOString(),
      }));
    } catch (error) {
      this.logger.error({ err: error }, 'Error sending token');
      next(error);
    }
  };

  /**
   * Register a new token
   */
  registerToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { name, symbol, contractAddress, domainSeparator, decimals } = req.body;

      const tokenService = this.orchestrator.getTokenService();
      const result = tokenService.registerToken(
        name,
        symbol,
        contractAddress,
        decimals,
        domainSeparator
      );

      res.json(successResponse(result));
    } catch (error) {
      this.logger.error({ err: error }, 'Error registering token');
      next(error);
    }
  };

  /**
   * Register multiple tokens at once
   */
  registerTokensBatch = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { tokens } = req.body;

      const tokenService = this.orchestrator.getTokenService();
      const results = tokenService.registerTokensBatch(tokens);

      res.json(successResponse({ results }));
    } catch (error) {
      this.logger.error({ err: error }, 'Error batch registering tokens');
      next(error);
    }
  };
}
