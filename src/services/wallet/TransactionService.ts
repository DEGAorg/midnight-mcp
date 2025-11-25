/**
 * Transaction Service
 *
 * Manages transaction lifecycle with state machine and polling:
 * - Transaction state machine: INITIATED → SENT → COMPLETED / FAILED
 * - Background polling for SENT → COMPLETED transitions
 * - Pending balance tracking (updates WalletService)
 * - Audit trail integration for transaction tracing
 * - Configurable polling interval via TRANSACTION_POLLING_CONFIG
 *
 * This replaces the scattered transaction logic from the god-class pattern.
 */

import type { Wallet } from '@midnight-ntwrk/wallet-api';
import type { Resource } from '@midnight-ntwrk/wallet';
import { createLogger } from '@lib/logger/index.js';
import { TRANSACTION_POLLING_CONFIG } from '@lib/config/constants.js';
import { AuditService } from '@services/audit/AuditService.js';
import type { WalletService } from '@services/wallet/WalletService.js';
import type { Logger } from 'pino';

/**
 * Transaction state enum
 */
export enum TransactionState {
  INITIATED = 'INITIATED',
  SENT = 'SENT',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

/**
 * Transaction record
 */
export interface TransactionRecord {
  /** Transaction ID */
  id: string;

  /** Current state */
  state: TransactionState;

  /** Sender address */
  from: string;

  /** Recipient address */
  to: string;

  /** Amount in base units (bigint as string for JSON) */
  amount: string;

  /** Transaction creation timestamp */
  timestamp: number;

  /** Blockchain transaction identifier (once sent) */
  txIdentifier?: string;

  /** Error message if failed */
  error?: string;

  /** Correlation ID for audit trail */
  correlationId: string;
}

/**
 * Transaction service configuration
 */
export interface TransactionServiceConfig {
  /** Wallet service for balance updates */
  walletService: WalletService;

  /** Audit service for transaction tracing */
  auditService: AuditService;

  /** Agent ID for logging */
  agentId: string;

  /** Polling interval in milliseconds (defaults to TRANSACTION_POLLING_CONFIG.DEFAULT_INTERVAL_MS) */
  pollingIntervalMs?: number;
}

/**
 * TransactionService manages transaction lifecycle and state
 */
export class TransactionService {
  private logger: Logger;
  private config: TransactionServiceConfig;
  private pollingIntervalMs: number;

  // Transaction storage
  private transactions = new Map<string, TransactionRecord>();

  // Polling state
  private pollingTimer?: NodeJS.Timeout;
  private isPolling = false;

  constructor(config: TransactionServiceConfig) {
    this.config = config;
    this.logger = createLogger(`transaction-service:${config.agentId}`);

    // Validate and set polling interval
    this.pollingIntervalMs = this.validatePollingInterval(
      config.pollingIntervalMs ?? TRANSACTION_POLLING_CONFIG.DEFAULT_INTERVAL_MS
    );

    this.logger.info('Transaction service initialized', {
      agentId: config.agentId,
      pollingIntervalMs: this.pollingIntervalMs,
    });
  }

  // ==================== LIFECYCLE ====================

  /**
   * Start the transaction service
   * Begins background polling for transaction status updates
   */
  start(): void {
    this.logger.info('Starting transaction service...');
    this.startPolling();
    this.logger.info('Transaction service started');
  }

  /**
   * Stop the transaction service
   * Stops background polling
   */
  stop(): void {
    this.logger.info('Stopping transaction service...');
    this.stopPolling();
    this.logger.info('Transaction service stopped');
  }

  // ==================== TRANSACTION OPERATIONS ====================

  /**
   * Create a new transaction (INITIATED state)
   * Returns transaction ID for tracking
   */
  createTransaction(
    to: string,
    amount: bigint,
    from?: string
  ): string {
    const id = this.generateTransactionId();
    const correlationId = this.config.auditService.generateCorrelationId();

    const transaction: TransactionRecord = {
      id,
      state: TransactionState.INITIATED,
      from: from ?? this.config.walletService.getAddress(),
      to,
      amount: amount.toString(),
      timestamp: Date.now(),
      correlationId,
    };

    this.transactions.set(id, transaction);

    // Start audit trail
    this.config.auditService.startTransactionTrace(id, correlationId, {
      to,
      amount: amount.toString(),
      from: transaction.from,
    });

    this.logger.info('Transaction created', {
      id,
      to,
      amount: amount.toString(),
      correlationId,
    });

    return id;
  }

  /**
   * Mark transaction as sent to blockchain
   * Transitions: INITIATED → SENT
   */
  markTransactionSent(id: string, txIdentifier: string): void {
    const tx = this.transactions.get(id);
    if (!tx) {
      throw new Error(`Transaction not found: ${id}`);
    }

    if (tx.state !== TransactionState.INITIATED) {
      this.logger.warn('Invalid state transition', {
        id,
        currentState: tx.state,
        expectedState: TransactionState.INITIATED,
      });
      return;
    }

    // Update transaction state
    tx.state = TransactionState.SENT;
    tx.txIdentifier = txIdentifier;

    // Update pending balance
    this.updatePendingBalance();

    // Log to audit trail
    this.config.auditService.logTransactionSent(id, txIdentifier, tx.correlationId);

    this.logger.info('Transaction sent to blockchain', {
      id,
      txIdentifier,
      correlationId: tx.correlationId,
    });
  }

  /**
   * Mark transaction as completed
   * Transitions: SENT → COMPLETED
   */
  markTransactionCompleted(id: string): void {
    const tx = this.transactions.get(id);
    if (!tx) {
      throw new Error(`Transaction not found: ${id}`);
    }

    if (tx.state !== TransactionState.SENT) {
      this.logger.warn('Invalid state transition', {
        id,
        currentState: tx.state,
        expectedState: TransactionState.SENT,
      });
      return;
    }

    // Update transaction state
    tx.state = TransactionState.COMPLETED;

    // Update pending balance
    this.updatePendingBalance();

    // Complete audit trail
    this.config.auditService.completeTransactionTrace(
      id,
      'completed',
      'Transaction completed successfully',
      {
        txIdentifier: tx.txIdentifier,
      }
    );

    this.logger.info('Transaction completed', {
      id,
      txIdentifier: tx.txIdentifier,
      correlationId: tx.correlationId,
    });
  }

  /**
   * Mark transaction as failed
   * Transitions: ANY → FAILED
   */
  markTransactionFailed(id: string, error: Error): void {
    const tx = this.transactions.get(id);
    if (!tx) {
      throw new Error(`Transaction not found: ${id}`);
    }

    const previousState = tx.state;

    // Update transaction state
    tx.state = TransactionState.FAILED;
    tx.error = error.message;

    // Update pending balance
    this.updatePendingBalance();

    // Log to audit trail
    this.config.auditService.logTransactionFailure(
      id,
      error,
      {
        previousState,
        txIdentifier: tx.txIdentifier,
      },
      tx.correlationId
    );

    this.logger.error('Transaction failed', {
      id,
      error: error.message,
      previousState,
      correlationId: tx.correlationId,
    });
  }

  // ==================== TRANSACTION QUERIES ====================

  /**
   * Get transaction by ID
   */
  getTransaction(id: string): TransactionRecord | undefined {
    return this.transactions.get(id);
  }

  /**
   * Get all transactions
   */
  getAllTransactions(): TransactionRecord[] {
    return Array.from(this.transactions.values());
  }

  /**
   * Get transactions by state
   */
  getTransactionsByState(state: TransactionState): TransactionRecord[] {
    return Array.from(this.transactions.values()).filter((tx) => tx.state === state);
  }

  /**
   * Get pending transactions (INITIATED or SENT)
   */
  getPendingTransactions(): TransactionRecord[] {
    return Array.from(this.transactions.values()).filter(
      (tx) => tx.state === TransactionState.INITIATED || tx.state === TransactionState.SENT
    );
  }

  /**
   * Get transaction count
   */
  getTransactionCount(): number {
    return this.transactions.size;
  }

  /**
   * Get pending transaction count
   */
  getPendingTransactionCount(): number {
    return this.getPendingTransactions().length;
  }

  // ==================== BACKGROUND POLLING ====================

  /**
   * Start background polling for transaction status updates
   * Checks for SENT → COMPLETED transitions
   */
  private startPolling(): void {
    if (this.isPolling) {
      this.logger.warn('Polling already started');
      return;
    }

    this.isPolling = true;
    this.scheduleNextPoll();

    this.logger.info('Transaction polling started', {
      intervalMs: this.pollingIntervalMs,
    });
  }

  /**
   * Stop background polling
   */
  private stopPolling(): void {
    if (!this.isPolling) {
      return;
    }

    this.isPolling = false;

    if (this.pollingTimer) {
      clearTimeout(this.pollingTimer);
      this.pollingTimer = undefined;
    }

    this.logger.info('Transaction polling stopped');
  }

  /**
   * Schedule next poll
   */
  private scheduleNextPoll(): void {
    if (!this.isPolling) {
      return;
    }

    this.pollingTimer = setTimeout(async () => {
      await this.pollTransactionStatuses();
      this.scheduleNextPoll();
    }, this.pollingIntervalMs);
  }

  /**
   * Poll transaction statuses
   * Checks blockchain for SENT → COMPLETED transitions
   */
  private async pollTransactionStatuses(): Promise<void> {
    const sentTransactions = this.getTransactionsByState(TransactionState.SENT);

    if (sentTransactions.length === 0) {
      return;
    }

    this.logger.debug('Polling transaction statuses', {
      count: sentTransactions.length,
    });

    // Check each SENT transaction for completion
    for (const tx of sentTransactions) {
      if (!tx.txIdentifier) {
        this.logger.warn('Transaction missing txIdentifier, cannot poll', {
          id: tx.id,
        });
        continue;
      }

      try {
        // Check if transaction appears in wallet history
        const isConfirmed = this.checkTransactionInHistory(tx.txIdentifier);

        if (isConfirmed) {
          this.logger.info('Transaction found in blockchain history', {
            id: tx.id,
            txIdentifier: tx.txIdentifier,
          });
          this.markTransactionCompleted(tx.id);
        } else {
          this.logger.debug('Transaction not yet confirmed', {
            id: tx.id,
            txIdentifier: tx.txIdentifier,
          });
        }
      } catch (error) {
        this.logger.error('Error checking transaction status', {
          error,
          id: tx.id,
          txIdentifier: tx.txIdentifier,
        });
        // Don't mark as failed - might be temporary network issue
      }
    }
  }

  /**
   * Check if transaction appears in wallet transaction history
   *
   * @param txIdentifier Transaction identifier from blockchain
   * @returns true if transaction is confirmed in wallet history
   */
  private checkTransactionInHistory(txIdentifier: string): boolean {
    try {
      // Get wallet state from WalletService
      const walletState = this.config.walletService.getWalletState();

      // Check if transaction history is available
      if (!walletState.transactionHistory || !Array.isArray(walletState.transactionHistory)) {
        this.logger.debug('Transaction history not available in wallet state');
        return false;
      }

      // Search for transaction in history
      // Each history entry has an 'identifiers' array containing transaction IDs
      const matchingTransaction = walletState.transactionHistory.find((tx: any) =>
        tx && Array.isArray(tx.identifiers) && tx.identifiers.includes(txIdentifier)
      );

      return !!matchingTransaction;
    } catch (error) {
      this.logger.error('Error checking transaction history', { error, txIdentifier });
      return false;
    }
  }

  // ==================== PENDING BALANCE ====================

  /**
   * Update pending balance in WalletService
   * Sum of all SENT transaction amounts
   */
  private updatePendingBalance(): void {
    const sentTransactions = this.getTransactionsByState(TransactionState.SENT);

    const pendingBalance = sentTransactions.reduce((total, tx) => {
      return total + BigInt(tx.amount);
    }, 0n);

    this.config.walletService.updatePendingBalance(pendingBalance);

    this.logger.debug('Pending balance updated', {
      pendingBalance: pendingBalance.toString(),
      sentTransactionCount: sentTransactions.length,
    });
  }

  // ==================== HELPERS ====================

  /**
   * Generate unique transaction ID
   */
  private generateTransactionId(): string {
    return `tx_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Validate polling interval
   * Ensures interval is within allowed range
   */
  private validatePollingInterval(intervalMs: number): number {
    const { MIN_INTERVAL_MS, MAX_INTERVAL_MS, DEFAULT_INTERVAL_MS } = TRANSACTION_POLLING_CONFIG;

    if (intervalMs < MIN_INTERVAL_MS) {
      this.logger.warn(
        `Polling interval ${intervalMs}ms is below minimum ${MIN_INTERVAL_MS}ms, using minimum`
      );
      return MIN_INTERVAL_MS;
    }

    if (intervalMs > MAX_INTERVAL_MS) {
      this.logger.warn(
        `Polling interval ${intervalMs}ms exceeds maximum ${MAX_INTERVAL_MS}ms, using maximum`
      );
      return MAX_INTERVAL_MS;
    }

    return intervalMs;
  }

  /**
   * Get polling interval (for debugging/monitoring)
   */
  getPollingInterval(): number {
    return this.pollingIntervalMs;
  }

  /**
   * Check if polling is active (for debugging/monitoring)
   */
  isPollingActive(): boolean {
    return this.isPolling;
  }
}
