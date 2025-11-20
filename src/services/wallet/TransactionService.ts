/**
 * TransactionService
 *
 * Transaction management: status, history, verification
 * Extracted from WalletServiceMCP god class
 */

import type { Logger } from 'pino';
import type { WalletManager } from '../../wallet/index.js';
import type {
  TransactionStatusResult,
  TransactionRecord,
  TransactionVerificationResult,
  TransactionQuery,
} from './types.js';
import { TransactionNotFoundError, WalletNotReadyError } from './errors.js';

export class TransactionService {
  constructor(
    private readonly wallet: WalletManager,
    private readonly logger: Logger
  ) {}

  /**
   * Get transaction status by ID
   */
  getTransactionStatus(transactionId: string): TransactionStatusResult | null {
    this.logger.debug({ transactionId }, 'Getting transaction status');

    try {
      const tx = this.wallet.getTransactionById(transactionId);

      if (!tx) {
        this.logger.warn({ transactionId }, 'Transaction not found');
        return null;
      }

      return {
        transactionId: tx.id,
        status: tx.state,
        from: tx.from || '',
        to: tx.to || '',
        amount: tx.amount?.toString() || '0',
        timestamp: tx.timestamp || Date.now(),
        confirmations: tx.confirmations || 0,
      };
    } catch (error) {
      this.logger.error({ error, transactionId }, 'Error getting transaction status');
      return null;
    }
  }

  /**
   * Get all transactions
   */
  getTransactions(query?: TransactionQuery): TransactionRecord[] {
    this.logger.debug({ query }, 'Getting all transactions');

    try {
      let transactions = this.wallet.getAllTransactions();

      // Filter by status if provided
      if (query?.status) {
        transactions = transactions.filter((tx) => tx.state === query.status);
      }

      // Apply pagination
      const offset = query?.offset || 0;
      const limit = query?.limit || transactions.length;

      return transactions.slice(offset, offset + limit);
    } catch (error) {
      this.logger.error({ error }, 'Error getting transactions');
      return [];
    }
  }

  /**
   * Get pending transactions
   */
  getPendingTransactions(): TransactionRecord[] {
    this.logger.debug('Getting pending transactions');

    try {
      const transactions = this.wallet.getAllTransactions();
      return transactions.filter(
        (tx) => tx.state === 'pending' || tx.state === 'submitted' || tx.state === 'sent'
      );
    } catch (error) {
      this.logger.error({ error }, 'Error getting pending transactions');
      return [];
    }
  }

  /**
   * Verify transaction has been received
   */
  confirmTransactionHasBeenReceived(identifier: string): TransactionVerificationResult {
    this.logger.info({ identifier }, 'Verifying transaction received');

    try {
      const verified = this.wallet.verifyTransactionReceived(identifier);

      return {
        verified,
        identifier,
        message: verified ? 'Transaction verified' : 'Transaction not found or not received',
      };
    } catch (error) {
      this.logger.error({ error, identifier }, 'Error verifying transaction');
      return {
        verified: false,
        identifier,
        message: 'Verification failed',
      };
    }
  }

  /**
   * Get transaction by ID (throws if not found)
   */
  getTransactionById(transactionId: string): TransactionRecord {
    const tx = this.wallet.getTransactionById(transactionId);

    if (!tx) {
      throw new TransactionNotFoundError(transactionId);
    }

    return tx;
  }

  /**
   * Get transaction count
   */
  getTransactionCount(): number {
    try {
      return this.wallet.getAllTransactions().length;
    } catch (error) {
      this.logger.error({ error }, 'Error getting transaction count');
      return 0;
    }
  }

  /**
   * Get pending transaction count
   */
  getPendingTransactionCount(): number {
    try {
      return this.getPendingTransactions().length;
    } catch (error) {
      this.logger.error({ error }, 'Error getting pending transaction count');
      return 0;
    }
  }
}
