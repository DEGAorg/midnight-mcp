/* istanbul ignore file */

import { Request, Response, NextFunction } from 'express';
import { WalletServiceMCP } from '../mcp/index.js';
import { createLogger } from '../logger/index.js';

export class WalletController {
  private logger = createLogger('wallet-controller');

  constructor(private readonly walletService: WalletServiceMCP) {}

  async getStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const status = this.walletService.getWalletStatus();
      res.json(status);
    } catch (error) {
      this.logger.error('Error getting wallet status:', error);
      next(error);
    }
  }

  async getAddress(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const address = this.walletService.getAddress();
      res.json({ address });
    } catch (error) {
      this.logger.error('Error getting wallet address:', error);
      next(error);
    }
  }

  async getBalance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const balance = this.walletService.getBalance();
      res.json(balance);
    } catch (error) {
      this.logger.error('Error getting wallet balance:', error);
      next(error);
    }
  }

  async sendFunds(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { destinationAddress, amount } = req.body;
      if (!destinationAddress || !amount) {
        res.status(400).json({
          error: 'Missing required parameters: destinationAddress and amount'
        });
        return;
      }
      const result = await this.walletService.sendFunds(destinationAddress, amount);
      res.json(result);
    } catch (error) {
      this.logger.error('Error sending funds:', error);
      next(error);
    }
  }

  async verifyTransaction(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { identifier } = req.body;
      if (!identifier) {
        res.status(400).json({
          error: 'Missing required parameter: identifier'
        });
        return;
      }
      const result = this.walletService.confirmTransactionHasBeenReceived(identifier);
      res.json(result);
    } catch (error) {
      this.logger.error('Error verifying transaction:', error);
      next(error);
    }
  }

  async getTransactionStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { transactionId } = req.params;
      if (!transactionId) {
        res.status(400).json({
          error: 'Missing required parameter: transactionId'
        });
        return;
      }
      const status = this.walletService.getTransactionStatus(transactionId);
      res.json(status);
    } catch (error) {
      this.logger.error('Error getting transaction status:', error);
      next(error);
    }
  }

  async getTransactions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const transactions = this.walletService.getTransactions();
      res.json(transactions);
    } catch (error) {
      this.logger.error('Error getting transactions:', error);
      next(error);
    }
  }

  async getPendingTransactions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const transactions = this.walletService.getPendingTransactions();
      res.json(transactions);
    } catch (error) {
      this.logger.error('Error getting pending transactions:', error);
      next(error);
    }
  }

  async getWalletConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const config = this.walletService.getWalletConfig();
      res.json(config);
    } catch (error) {
      this.logger.error('Error getting wallet config:', error);
      next(error);
    }
  }

  async healthCheck(req: Request, res: Response): Promise<void> {
    res.json({ status: 'ok' });
  }

  async registerInMarketplace(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId, userData } = req.body;
      if (!userId || !userData) {
        res.status(400).json({
          error: 'Missing required parameters: userId and userData'
        });
        return;
      }
      const result = await this.walletService.registerInMarketplace(userId, userData);
      res.json(result);
    } catch (error) {
      this.logger.error('Error registering in marketplace:', error);
      next(error);
    }
  }

  async verifyUserInMarketplace(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId, verificationData } = req.body;
      if (!userId || !verificationData || !verificationData.pubkey) {
        res.status(400).json({
          error: 'Missing required parameters: userId, verificationData and pubkey'
        });
        return;
      }
      const result = await this.walletService.verifyUserInMarketplace(userId, verificationData);
      res.json(result);
    } catch (error) {
      this.logger.error('Error verifying user in marketplace:', error);
      next(error);
    }
  }
} 