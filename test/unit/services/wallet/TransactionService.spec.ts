/**
 * TransactionService Unit Tests
 *
 * Tests for transaction lifecycle management:
 * - Transaction creation and state transitions
 * - Pending balance tracking
 * - Background polling
 * - Audit trail integration
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock dependencies before importing
jest.mock('../../../../src/lib/logger/index.js', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

jest.mock('../../../../src/lib/config/constants.js', () => ({
  TRANSACTION_POLLING_CONFIG: {
    DEFAULT_INTERVAL_MS: 10000,
    MIN_INTERVAL_MS: 1000,
    MAX_INTERVAL_MS: 60000,
  },
}));

import {
  TransactionService,
  TransactionServiceConfig,
  TransactionState,
} from '../../../../src/services/wallet/TransactionService.js';

describe('TransactionService', () => {
  let transactionService: TransactionService;
  let mockWalletService: any;
  let mockAuditService: any;
  let mockConfig: TransactionServiceConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockWalletService = {
      getAddress: jest.fn(() => '0xSenderAddress'),
      updatePendingBalance: jest.fn(),
      getWalletState: jest.fn(() => ({
        transactionHistory: [],
      })),
    };

    mockAuditService = {
      generateCorrelationId: jest.fn(() => 'corr-001'),
      startTransactionTrace: jest.fn(),
      logTransactionSent: jest.fn(),
      completeTransactionTrace: jest.fn(),
      logTransactionFailure: jest.fn(),
    };

    mockConfig = {
      walletService: mockWalletService,
      auditService: mockAuditService,
      agentId: 'test-agent-123',
    };

    transactionService = new TransactionService(mockConfig);
  });

  afterEach(() => {
    transactionService.stop();
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('should initialize with default polling interval', () => {
      expect(transactionService.getPollingInterval()).toBe(10000);
    });

    it('should respect custom polling interval', () => {
      const customConfig = { ...mockConfig, pollingIntervalMs: 5000 };
      const service = new TransactionService(customConfig);
      expect(service.getPollingInterval()).toBe(5000);
      service.stop();
    });

    it('should enforce minimum polling interval', () => {
      const customConfig = { ...mockConfig, pollingIntervalMs: 100 };
      const service = new TransactionService(customConfig);
      expect(service.getPollingInterval()).toBe(1000);
      service.stop();
    });

    it('should enforce maximum polling interval', () => {
      const customConfig = { ...mockConfig, pollingIntervalMs: 100000 };
      const service = new TransactionService(customConfig);
      expect(service.getPollingInterval()).toBe(60000);
      service.stop();
    });
  });

  describe('start/stop', () => {
    it('should start polling when started', () => {
      expect(transactionService.isPollingActive()).toBe(false);
      transactionService.start();
      expect(transactionService.isPollingActive()).toBe(true);
    });

    it('should stop polling when stopped', () => {
      transactionService.start();
      expect(transactionService.isPollingActive()).toBe(true);
      transactionService.stop();
      expect(transactionService.isPollingActive()).toBe(false);
    });

    it('should handle multiple start calls gracefully', () => {
      transactionService.start();
      transactionService.start();
      expect(transactionService.isPollingActive()).toBe(true);
    });

    it('should handle stop when not started', () => {
      transactionService.stop();
      expect(transactionService.isPollingActive()).toBe(false);
    });
  });

  describe('createTransaction', () => {
    it('should create transaction with INITIATED state', () => {
      const txId = transactionService.createTransaction('0xRecipient', 1000n);

      expect(txId).toBeDefined();
      expect(txId.startsWith('tx_')).toBe(true);

      const tx = transactionService.getTransaction(txId);
      expect(tx?.state).toBe(TransactionState.INITIATED);
      expect(tx?.to).toBe('0xRecipient');
      expect(tx?.amount).toBe('1000');
    });

    it('should use wallet address as sender by default', () => {
      const txId = transactionService.createTransaction('0xRecipient', 1000n);

      const tx = transactionService.getTransaction(txId);
      expect(tx?.from).toBe('0xSenderAddress');
      expect(mockWalletService.getAddress).toHaveBeenCalled();
    });

    it('should use provided sender address', () => {
      const txId = transactionService.createTransaction('0xRecipient', 1000n, '0xCustomSender');

      const tx = transactionService.getTransaction(txId);
      expect(tx?.from).toBe('0xCustomSender');
    });

    it('should start audit trail', () => {
      const txId = transactionService.createTransaction('0xRecipient', 1000n);

      expect(mockAuditService.startTransactionTrace).toHaveBeenCalledWith(
        txId,
        'corr-001',
        expect.objectContaining({
          to: '0xRecipient',
          amount: '1000',
        })
      );
    });

    it('should generate unique transaction IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const txId = transactionService.createTransaction('0xRecipient', BigInt(i));
        ids.add(txId);
      }
      expect(ids.size).toBe(100);
    });
  });

  describe('markTransactionSent', () => {
    it('should transition from INITIATED to SENT', () => {
      const txId = transactionService.createTransaction('0xRecipient', 1000n);

      transactionService.markTransactionSent(txId, 'blockchain-tx-123');

      const tx = transactionService.getTransaction(txId);
      expect(tx?.state).toBe(TransactionState.SENT);
      expect(tx?.txIdentifier).toBe('blockchain-tx-123');
    });

    it('should throw for non-existent transaction', () => {
      expect(() => transactionService.markTransactionSent('nonexistent', 'tx-id'))
        .toThrow('Transaction not found: nonexistent');
    });

    it('should not transition if not in INITIATED state', () => {
      const txId = transactionService.createTransaction('0xRecipient', 1000n);
      transactionService.markTransactionSent(txId, 'tx-1');
      transactionService.markTransactionCompleted(txId);

      // Try to mark as sent again (from COMPLETED state)
      transactionService.markTransactionSent(txId, 'tx-2');

      const tx = transactionService.getTransaction(txId);
      expect(tx?.state).toBe(TransactionState.COMPLETED);
    });

    it('should update pending balance', () => {
      const txId = transactionService.createTransaction('0xRecipient', 1000n);
      transactionService.markTransactionSent(txId, 'tx-123');

      expect(mockWalletService.updatePendingBalance).toHaveBeenCalled();
    });

    it('should log to audit trail', () => {
      const txId = transactionService.createTransaction('0xRecipient', 1000n);
      transactionService.markTransactionSent(txId, 'tx-123');

      expect(mockAuditService.logTransactionSent).toHaveBeenCalledWith(
        txId,
        'tx-123',
        'corr-001'
      );
    });
  });

  describe('markTransactionCompleted', () => {
    it('should transition from SENT to COMPLETED', () => {
      const txId = transactionService.createTransaction('0xRecipient', 1000n);
      transactionService.markTransactionSent(txId, 'tx-123');

      transactionService.markTransactionCompleted(txId);

      const tx = transactionService.getTransaction(txId);
      expect(tx?.state).toBe(TransactionState.COMPLETED);
    });

    it('should throw for non-existent transaction', () => {
      expect(() => transactionService.markTransactionCompleted('nonexistent'))
        .toThrow('Transaction not found: nonexistent');
    });

    it('should not transition if not in SENT state', () => {
      const txId = transactionService.createTransaction('0xRecipient', 1000n);

      // Try to complete from INITIATED state
      transactionService.markTransactionCompleted(txId);

      const tx = transactionService.getTransaction(txId);
      expect(tx?.state).toBe(TransactionState.INITIATED);
    });

    it('should update pending balance', () => {
      const txId = transactionService.createTransaction('0xRecipient', 1000n);
      transactionService.markTransactionSent(txId, 'tx-123');
      mockWalletService.updatePendingBalance.mockClear();

      transactionService.markTransactionCompleted(txId);

      expect(mockWalletService.updatePendingBalance).toHaveBeenCalled();
    });

    it('should complete audit trail', () => {
      const txId = transactionService.createTransaction('0xRecipient', 1000n);
      transactionService.markTransactionSent(txId, 'tx-123');

      transactionService.markTransactionCompleted(txId);

      expect(mockAuditService.completeTransactionTrace).toHaveBeenCalledWith(
        txId,
        'completed',
        'Transaction completed successfully',
        expect.any(Object)
      );
    });
  });

  describe('markTransactionFailed', () => {
    it('should transition to FAILED from any state', () => {
      const txId = transactionService.createTransaction('0xRecipient', 1000n);

      transactionService.markTransactionFailed(txId, new Error('Network error'));

      const tx = transactionService.getTransaction(txId);
      expect(tx?.state).toBe(TransactionState.FAILED);
      expect(tx?.error).toBe('Network error');
    });

    it('should throw for non-existent transaction', () => {
      expect(() => transactionService.markTransactionFailed('nonexistent', new Error('fail')))
        .toThrow('Transaction not found: nonexistent');
    });

    it('should update pending balance', () => {
      const txId = transactionService.createTransaction('0xRecipient', 1000n);
      transactionService.markTransactionSent(txId, 'tx-123');
      mockWalletService.updatePendingBalance.mockClear();

      transactionService.markTransactionFailed(txId, new Error('fail'));

      expect(mockWalletService.updatePendingBalance).toHaveBeenCalled();
    });

    it('should log to audit trail', () => {
      const txId = transactionService.createTransaction('0xRecipient', 1000n);

      transactionService.markTransactionFailed(txId, new Error('fail'));

      expect(mockAuditService.logTransactionFailure).toHaveBeenCalledWith(
        txId,
        expect.any(Error),
        expect.any(Object),
        'corr-001'
      );
    });
  });

  describe('getTransaction', () => {
    it('should return undefined for non-existent transaction', () => {
      expect(transactionService.getTransaction('nonexistent')).toBeUndefined();
    });

    it('should return transaction by ID', () => {
      const txId = transactionService.createTransaction('0xRecipient', 1000n);

      const tx = transactionService.getTransaction(txId);
      expect(tx?.to).toBe('0xRecipient');
    });
  });

  describe('getAllTransactions', () => {
    it('should return empty array when no transactions', () => {
      expect(transactionService.getAllTransactions()).toEqual([]);
    });

    it('should return all transactions', () => {
      transactionService.createTransaction('0xA', 100n);
      transactionService.createTransaction('0xB', 200n);
      transactionService.createTransaction('0xC', 300n);

      const all = transactionService.getAllTransactions();
      expect(all.length).toBe(3);
    });
  });

  describe('getTransactionsByState', () => {
    it('should filter by state', () => {
      const tx1 = transactionService.createTransaction('0xA', 100n);
      const tx2 = transactionService.createTransaction('0xB', 200n);
      transactionService.createTransaction('0xC', 300n);

      transactionService.markTransactionSent(tx1, 'tx-1');
      transactionService.markTransactionSent(tx2, 'tx-2');

      const sent = transactionService.getTransactionsByState(TransactionState.SENT);
      expect(sent.length).toBe(2);

      const initiated = transactionService.getTransactionsByState(TransactionState.INITIATED);
      expect(initiated.length).toBe(1);
    });
  });

  describe('getPendingTransactions', () => {
    it('should return INITIATED and SENT transactions', () => {
      const tx1 = transactionService.createTransaction('0xA', 100n);
      const tx2 = transactionService.createTransaction('0xB', 200n);
      const tx3 = transactionService.createTransaction('0xC', 300n);

      transactionService.markTransactionSent(tx1, 'tx-1');
      transactionService.markTransactionSent(tx2, 'tx-2');
      transactionService.markTransactionCompleted(tx1);

      const pending = transactionService.getPendingTransactions();
      expect(pending.length).toBe(2); // tx2 (SENT) and tx3 (INITIATED)
    });
  });

  describe('getTransactionCount', () => {
    it('should return 0 for empty', () => {
      expect(transactionService.getTransactionCount()).toBe(0);
    });

    it('should return correct count', () => {
      transactionService.createTransaction('0xA', 100n);
      transactionService.createTransaction('0xB', 200n);

      expect(transactionService.getTransactionCount()).toBe(2);
    });
  });

  describe('getPendingTransactionCount', () => {
    it('should return count of pending transactions', () => {
      const tx1 = transactionService.createTransaction('0xA', 100n);
      transactionService.createTransaction('0xB', 200n);

      transactionService.markTransactionSent(tx1, 'tx-1');
      transactionService.markTransactionCompleted(tx1);

      expect(transactionService.getPendingTransactionCount()).toBe(1);
    });
  });

  describe('pending balance calculation', () => {
    it('should sum amounts of SENT transactions', () => {
      const tx1 = transactionService.createTransaction('0xA', 1000n);
      const tx2 = transactionService.createTransaction('0xB', 2000n);

      transactionService.markTransactionSent(tx1, 'tx-1');
      transactionService.markTransactionSent(tx2, 'tx-2');

      // Find the last call with the sum of pending balances
      const lastCall = mockWalletService.updatePendingBalance.mock.calls.slice(-1)[0];
      expect(lastCall[0]).toBe(3000n);
    });

    it('should update pending balance when transaction completes', () => {
      const tx1 = transactionService.createTransaction('0xA', 1000n);
      transactionService.markTransactionSent(tx1, 'tx-1');
      mockWalletService.updatePendingBalance.mockClear();

      transactionService.markTransactionCompleted(tx1);

      // After completion, pending should be 0
      expect(mockWalletService.updatePendingBalance).toHaveBeenCalledWith(0n);
    });
  });

  describe('polling', () => {
    it('should poll for transaction statuses', () => {
      const txId = transactionService.createTransaction('0xRecipient', 1000n);
      transactionService.markTransactionSent(txId, 'tx-123');

      // Set up wallet state with matching transaction in history
      mockWalletService.getWalletState.mockReturnValue({
        transactionHistory: [
          { identifiers: ['tx-123'] },
        ],
      });

      transactionService.start();

      // Advance time to trigger polling
      jest.advanceTimersByTime(10000);

      // Transaction should now be completed
      const tx = transactionService.getTransaction(txId);
      expect(tx?.state).toBe(TransactionState.COMPLETED);
    });

    it('should not complete transaction if not in history', () => {
      const txId = transactionService.createTransaction('0xRecipient', 1000n);
      transactionService.markTransactionSent(txId, 'tx-123');

      mockWalletService.getWalletState.mockReturnValue({
        transactionHistory: [],
      });

      transactionService.start();
      jest.advanceTimersByTime(10000);

      const tx = transactionService.getTransaction(txId);
      expect(tx?.state).toBe(TransactionState.SENT);
    });

    it('should handle missing transaction history gracefully', () => {
      const txId = transactionService.createTransaction('0xRecipient', 1000n);
      transactionService.markTransactionSent(txId, 'tx-123');

      mockWalletService.getWalletState.mockReturnValue({});

      transactionService.start();
      jest.advanceTimersByTime(10000);

      const tx = transactionService.getTransaction(txId);
      expect(tx?.state).toBe(TransactionState.SENT);
    });
  });

  describe('getPollingInterval', () => {
    it('should return configured polling interval', () => {
      expect(transactionService.getPollingInterval()).toBe(10000);
    });
  });

  describe('isPollingActive', () => {
    it('should return false initially', () => {
      expect(transactionService.isPollingActive()).toBe(false);
    });

    it('should return true after start', () => {
      transactionService.start();
      expect(transactionService.isPollingActive()).toBe(true);
    });
  });
});
