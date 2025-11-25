/**
 * Wallet Controller
 *
 * Handles HTTP requests for wallet status, balance, and transaction operations.
 */

import type { Request, Response, NextFunction } from 'express';
import type { WalletOrchestrator } from '@services/WalletOrchestrator.js';
import { createLogger } from '@lib/logger/index.js';
import { config } from '@lib/config/env.js';
import { successResponse } from '../routes/index.js';
import { ApiError } from '../middleware/index.js';
import type { Logger } from 'pino';

export class WalletController {
  private logger: Logger;
  private orchestrator: WalletOrchestrator;

  constructor(orchestrator: WalletOrchestrator) {
    this.orchestrator = orchestrator;
    this.logger = createLogger('wallet-controller');
  }

  /**
   * Get comprehensive wallet status
   */
  getStatus = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const walletService = this.orchestrator.getWalletService();
      const syncProgress = walletService.getSyncProgress();

      res.json(successResponse({
        ready: walletService.isReady(),
        address: walletService.isReady() ? walletService.getAddress() : null,
        balances: {
          native: walletService.getBalance().toString(),
          pending: walletService.getPendingBalance().toString(),
        },
        syncProgress: {
          synced: syncProgress.synced,
          percentage: syncProgress.syncPercentage,
          applyGap: syncProgress.applyGap.toString(),
          sourceGap: syncProgress.sourceGap.toString(),
        },
      }));
    } catch (error) {
      this.logger.error({ err: error }, 'Error getting wallet status');
      next(error);
    }
  };

  /**
   * Get wallet address
   */
  getAddress = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const walletService = this.orchestrator.getWalletService();
      res.json(successResponse({ address: walletService.getAddress() }));
    } catch (error) {
      this.logger.error({ err: error }, 'Error getting wallet address');
      next(error);
    }
  };

  /**
   * Get wallet balance
   */
  getBalance = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const walletService = this.orchestrator.getWalletService();
      res.json(successResponse({
        balance: walletService.getBalance().toString(),
        pendingBalance: walletService.getPendingBalance().toString(),
      }));
    } catch (error) {
      this.logger.error({ err: error }, 'Error getting wallet balance');
      next(error);
    }
  };

  /**
   * Get wallet configuration
   */
  getWalletConfig = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.json(successResponse({
        indexer: config.INDEXER!,
        mnNode: config.MN_NODE!,
        proofServer: config.PROOF_SERVER!,
        networkId: config.NETWORK_ID!,
      }));
    } catch (error) {
      this.logger.error({ err: error }, 'Error getting wallet config');
      next(error);
    }
  };

  /**
   * Get all transactions
   */
  getTransactions = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const transactionService = this.orchestrator.getTransactionService();
      const transactions = transactionService.getAllTransactions();
      res.json(successResponse({ transactions }));
    } catch (error) {
      this.logger.error({ err: error }, 'Error getting transactions');
      next(error);
    }
  };

  /**
   * Get pending transactions
   */
  getPendingTransactions = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const transactionService = this.orchestrator.getTransactionService();
      const transactions = transactionService.getPendingTransactions();
      res.json(successResponse({ transactions }));
    } catch (error) {
      this.logger.error({ err: error }, 'Error getting pending transactions');
      next(error);
    }
  };

  /**
   * Get transaction status by ID
   */
  getTransactionStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { transactionId } = req.params;

      const transactionService = this.orchestrator.getTransactionService();
      const transaction = transactionService.getTransaction(transactionId);

      if (!transaction) {
        throw ApiError.notFound(`Transaction ${transactionId} not found`);
      }

      res.json(successResponse(transaction));
    } catch (error) {
      this.logger.error({ err: error }, 'Error getting transaction status');
      next(error);
    }
  };

  /**
   * Send native tokens (tDUST/DUST)
   */
  sendFunds = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { destinationAddress, amount } = req.body;

      const amountBigInt = BigInt(amount);
      const tokenService = this.orchestrator.getTokenService();
      const txId = await tokenService.sendNativeToken(destinationAddress, amountBigInt);

      const transactionService = this.orchestrator.getTransactionService();
      const transaction = transactionService.getTransaction(txId);

      res.json(successResponse({
        id: txId,
        state: transaction?.state ?? 'pending',
        toAddress: destinationAddress,
        amount: amount.toString(),
        createdAt: transaction?.timestamp ?? new Date().toISOString(),
      }));
    } catch (error) {
      this.logger.error({ err: error }, 'Error sending funds');
      next(error);
    }
  };

  /**
   * Verify a transaction exists
   */
  verifyTransaction = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { identifier } = req.body;

      const transactionService = this.orchestrator.getTransactionService();
      const walletService = this.orchestrator.getWalletService();
      const transaction = transactionService.getTransaction(identifier);

      res.json(successResponse({
        exists: !!transaction,
        transactionAmount: transaction?.amount?.toString() ?? '0',
        syncStatus: {
          synced: walletService.getSyncProgress().synced,
          percentage: walletService.getSyncProgress().syncPercentage,
        },
      }));
    } catch (error) {
      this.logger.error({ err: error }, 'Error verifying transaction');
      next(error);
    }
  };
}
