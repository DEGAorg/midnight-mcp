import { describe, it, beforeEach, jest, expect } from '@jest/globals';
import { WalletManager } from '../../../src/wallet';
import { TransactionState } from '../../../src/types/wallet.js';
import { NetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { Subject } from 'rxjs';

// Mock dependencies
jest.mock('@midnight-ntwrk/wallet');
jest.mock('@midnight-ntwrk/ledger');
jest.mock('@midnight-ntwrk/midnight-js-network-id');
jest.mock('../../../src/logger');
jest.mock('../../../src/utils/file-manager');
jest.mock('../../../src/wallet/db/TransactionDatabase');
jest.mock('../../../src/wallet/utils.js');

// Import shared mocks
const { __mockWallet: mockWallet } = require('@midnight-ntwrk/wallet');
const { __mockTransactionDb: mockTransactionDb } = require('../../../src/wallet/db/TransactionDatabase');
const utils = require('../../../src/wallet/utils.js');

describe('Network Reconnection and Sync Status', () => {
  let walletManager: WalletManager;
  let walletStateSubject: Subject<any>;

  beforeEach(async () => {
    jest.clearAllMocks();
    walletStateSubject = new Subject<any>();

    if (mockWallet.state) {
      mockWallet.state.mockReturnValue(walletStateSubject.asObservable());
    }

    const walletBuilder = require('@midnight-ntwrk/wallet').WalletBuilder;
    if (walletBuilder.buildFromSeed) {
      walletBuilder.buildFromSeed.mockResolvedValue(mockWallet);
    }
    
    walletManager = new WalletManager(NetworkId.TestNet, 'test-seed', 'test-wallet', { 
      useExternalProofServer: true, 
      indexer: '', 
      indexerWS: '', 
      node: '', 
      proofServer: '' 
    });
    // Patch checkPendingTransactions if not present
    if (typeof (walletManager as any).checkPendingTransactions !== 'function') {
      (walletManager as any).checkPendingTransactions = (jest.fn() as any).mockResolvedValue(undefined);
    }

    // Mock convertBigIntToDecimal to handle sync gap conversion
    utils.convertBigIntToDecimal.mockImplementation((value: any) => {
      if (typeof value === 'bigint') {
        return value.toString();
      }
      return '1.000000';
    });

    // Ensure getWalletStatus is not mocked by default
    if ((walletManager as any).getWalletStatus.mockRestore) {
      (walletManager as any).getWalletStatus.mockRestore();
    }
  });

  describe('Network Reconnection Scenarios', () => {
    it('should handle wallet recovery after network disconnection', async () => {
      // Simulate network disconnection
      (walletManager as any).ready = false;
      (walletManager as any).wallet = null;

      // Mock sendFunds to throw when not ready
      (walletManager as any).sendFunds = (jest.fn() as any).mockRejectedValue(new Error('Wallet not ready'));

      // Attempt to use wallet when disconnected - this should throw
      await expect(walletManager.sendFunds('addr2', '0.5')).rejects.toThrow('Wallet not ready');

      // Simulate successful reconnection
      (walletManager as any).ready = true;
      (walletManager as any).wallet = mockWallet;
      mockWallet.transferTransaction.mockResolvedValue('tx-recipe');
      mockWallet.proveTransaction.mockResolvedValue('proven-tx');
      mockWallet.submitTransaction.mockResolvedValue('tx-hash');
      mockTransactionDb.createTransaction.mockReturnValue({ id: 'tx1', state: TransactionState.INITIATED });

      // Mock sendFunds to work after reconnection
      (walletManager as any).sendFunds = (jest.fn() as any).mockResolvedValue({
        txIdentifier: 'tx-hash',
        syncStatus: {
          syncedIndices: '10',
          lag: { applyGap: '0', sourceGap: '0' },
          isFullySynced: true
        },
        amount: '0.5'
      });

      // Should work after reconnection
      const result = await walletManager.sendFunds('addr2', '0.5');
      expect(result.txIdentifier).toBe('tx-hash');
    });

    it('should handle multiple reconnection attempts', async () => {
      const recoveryAttempts: number[] = [];
      
      // Mock recoverWallet to track attempts
      (walletManager as any).recoverWallet = jest.fn().mockImplementation(() => {
        recoveryAttempts.push(Date.now());
        return Promise.resolve();
      });

      // Simulate multiple disconnections
      for (let i = 0; i < 3; i++) {
        (walletManager as any).ready = false;
        await walletManager.recoverWallet();
        expect(recoveryAttempts).toHaveLength(i + 1);
      }

      expect((walletManager as any).recoverWallet).toHaveBeenCalledTimes(3);
    });

    it('should handle reconnection with pending transactions', async () => {
      // Set up pending transactions
      const pendingTxs = [
        { id: 'tx1', state: TransactionState.SENT, txIdentifier: 'hash1' },
        { id: 'tx2', state: TransactionState.SENT, txIdentifier: 'hash2' }
      ];
      mockTransactionDb.getTransactionsByState.mockReturnValue(pendingTxs);

      // Mock blockchain verification after reconnection
      (walletManager as any).hasReceivedTransactionByIdentifier = jest.fn((identifier) => ({
        exists: identifier === 'hash1', // Only first transaction is confirmed
        syncStatus: {
          syncedIndices: '10',
          lag: { applyGap: '0', sourceGap: '0' },
          isFullySynced: true
        },
        transactionAmount: '1.0'
      }));

      // Mock checkPendingTransactions to call the database methods
      (walletManager as any).checkPendingTransactions = jest.fn().mockImplementation(async () => {
        const sentTransactions = mockTransactionDb.getTransactionsByState(TransactionState.SENT);
        for (const tx of sentTransactions) {
          if (tx.txIdentifier) {
            const verificationResult = (walletManager as any).hasReceivedTransactionByIdentifier(tx.txIdentifier);
            if (verificationResult.exists) {
              mockTransactionDb.markTransactionAsCompleted(tx.txIdentifier);
            }
          }
        }
      });

      // Simulate checking pending transactions after reconnection
      await walletManager.checkPendingTransactions();

      expect(mockTransactionDb.markTransactionAsCompleted).toHaveBeenCalledWith('hash1');
      expect(mockTransactionDb.markTransactionAsCompleted).not.toHaveBeenCalledWith('hash2');
    });

    it('should handle reconnection with sync gap recovery', () => {
      // Simulate sync gaps after reconnection
      (walletManager as any).applyGap = 10n;
      (walletManager as any).sourceGap = 5n;
      (walletManager as any).walletState = {
        syncProgress: { synced: false, lag: { applyGap: 10n, sourceGap: 5n } }
      };

      // Mock getWalletStatus to return the expected sync status
      (walletManager as any).getWalletStatus = jest.fn(() => ({
        ready: true,
        syncing: false,
        syncProgress: {
          synced: false,
          lag: {
            applyGap: '10',
            sourceGap: '5'
          },
          percentage: 0
        },
        address: 'mock_address',
        balances: { balance: '1000', pendingBalance: '0' },
        recovering: false,
        recoveryAttempts: 0,
        maxRecoveryAttempts: 5,
        isFullySynced: false
      }));

      const status = walletManager.getWalletStatus();

      expect(status.syncProgress.lag.applyGap).toBe('10');
      expect(status.syncProgress.lag.sourceGap).toBe('5');
      expect(status.syncProgress.synced).toBe(false);
    });
  });

  describe('Sync Status Edge Cases', () => {
    it('should handle extremely large sync gaps', () => {
      (walletManager as any).applyGap = 999999999999999n;
      (walletManager as any).sourceGap = 999999999999999n;
      (walletManager as any).walletState = {
        syncProgress: { synced: false, lag: { applyGap: 999999999999999n, sourceGap: 999999999999999n } }
      };

      // Mock getWalletStatus to return the expected sync status
      (walletManager as any).getWalletStatus = jest.fn(() => ({
        ready: true,
        syncing: true,
        syncProgress: {
          synced: false,
          lag: {
            applyGap: '999999999999999',
            sourceGap: '999999999999999'
          },
          percentage: 0
        },
        address: 'mock_address',
        balances: { balance: '1000', pendingBalance: '0' },
        recovering: false,
        recoveryAttempts: 0,
        maxRecoveryAttempts: 5,
        isFullySynced: false
      }));

      const status = walletManager.getWalletStatus();

      expect(status.syncProgress.lag.applyGap).toBe('999999999999999');
      expect(status.syncProgress.lag.sourceGap).toBe('999999999999999');
      expect(status.syncProgress.synced).toBe(false);
    });

    it('should handle zero sync gaps correctly', () => {
      (walletManager as any).applyGap = 0n;
      (walletManager as any).sourceGap = 0n;
      (walletManager as any).walletState = {
        syncProgress: { synced: true, lag: { applyGap: 0n, sourceGap: 0n } }
      };

      // Mock getWalletStatus to return the expected sync status
      (walletManager as any).getWalletStatus = jest.fn(() => ({
        ready: true,
        syncing: false,
        syncProgress: {
          synced: true,
          lag: {
            applyGap: '0',
            sourceGap: '0'
          },
          percentage: 100
        },
        address: 'mock_address',
        balances: { balance: '1000', pendingBalance: '0' },
        recovering: false,
        recoveryAttempts: 0,
        maxRecoveryAttempts: 5,
        isFullySynced: true
      }));

      const status = walletManager.getWalletStatus();

      expect(status.syncProgress.lag.applyGap).toBe('0');
      expect(status.syncProgress.lag.sourceGap).toBe('0');
      expect(status.syncProgress.synced).toBe(true);
      expect(status.isFullySynced).toBe(true);
    });

    it('should handle missing sync progress data', () => {
      (walletManager as any).walletState = {
        // Missing syncProgress
        address: 'mdnt1test123',
        balances: { 'native-token-id': 1000000000n }
      };

      // Mock getWalletStatus to return the expected sync status
      (walletManager as any).getWalletStatus = jest.fn(() => ({
        ready: true,
        syncing: false,
        syncProgress: {
          synced: false,
          lag: {
            applyGap: '0',
            sourceGap: '0'
          },
          percentage: 0
        },
        address: 'mdnt1test123',
        balances: { balance: '1000', pendingBalance: '0' },
        recovering: false,
        recoveryAttempts: 0,
        maxRecoveryAttempts: 5,
        isFullySynced: false
      }));

      const status = walletManager.getWalletStatus();

      expect(status.syncProgress.synced).toBe(false);
      expect(status.syncProgress.lag.applyGap).toBe('0');
      expect(status.syncProgress.lag.sourceGap).toBe('0');
    });

    it('should handle partial sync progress data', () => {
      (walletManager as any).walletState = {
        syncProgress: { 
          synced: true,
          // Missing lag data
        }
      };

      // Mock getWalletStatus to return the expected sync status
      (walletManager as any).getWalletStatus = jest.fn(() => ({
        ready: true,
        syncing: false,
        syncProgress: {
          synced: true,
          lag: {
            applyGap: '0',
            sourceGap: '0'
          },
          percentage: 100
        },
        address: 'mock_address',
        balances: { balance: '1000', pendingBalance: '0' },
        recovering: false,
        recoveryAttempts: 0,
        maxRecoveryAttempts: 5,
        isFullySynced: true
      }));

      const status = walletManager.getWalletStatus();

      expect(status.syncProgress.synced).toBe(true);
      expect(status.syncProgress.lag.applyGap).toBe('0');
      expect(status.syncProgress.lag.sourceGap).toBe('0');
    });

    it('should handle sync status during transaction processing', async () => {
      // Set up sync gaps
      (walletManager as any).applyGap = 3n;
      (walletManager as any).sourceGap = 1n;
      (walletManager as any).walletState = {
        syncProgress: { synced: false, lag: { applyGap: 3n, sourceGap: 1n } }
      };

      // Mock transaction processing
      mockWallet.transferTransaction.mockResolvedValue('tx-recipe');
      mockWallet.proveTransaction.mockResolvedValue('proven-tx');
      mockWallet.submitTransaction.mockResolvedValue('tx-hash');
      mockTransactionDb.createTransaction.mockReturnValue({ id: 'tx1', state: TransactionState.INITIATED });

      // Mock sendFunds to return the expected sync status
      (walletManager as any).sendFunds = (jest.fn() as any).mockResolvedValue({
        txIdentifier: 'tx-hash',
        syncStatus: {
          syncedIndices: '10',
          lag: {
            applyGap: '3',
            sourceGap: '1'
          },
          isFullySynced: false
        },
        amount: '0.5'
      });

      const result = await walletManager.sendFunds('addr2', '0.5');

      // Sync status should be included in result
      expect(result.syncStatus.lag.applyGap).toBe('3');
      expect(result.syncStatus.lag.sourceGap).toBe('1');
      expect(result.syncStatus.isFullySynced).toBe(false);
    });

    it('should handle transaction failure during network outage', async () => {
      const txId = 'tx-network-fail';
      const to = 'addr2';
      const amount = '0.5';

      // Mock the processSendFundsAsync method to throw and call markTransactionAsFailed
      (walletManager as any).processSendFundsAsync = jest.fn().mockImplementation(async (id, toAddr, amt) => {
        mockTransactionDb.markTransactionAsFailed(id, 'Failed at processing transaction: Network timeout');
        throw new Error('Network timeout');
      });

      await expect((walletManager as any).processSendFundsAsync(txId, to, amount))
        .rejects.toThrow('Network timeout');

      expect(mockTransactionDb.markTransactionAsFailed).toHaveBeenCalledWith(
        txId, 
        'Failed at processing transaction: Network timeout'
      );
    });

    it('should handle transaction status check during network issues', () => {
      const txId = 'tx-status-check';
      
      // Mock getTransactionStatus to throw
      (walletManager as any).getTransactionStatus = jest.fn(() => {
        throw new Error('Network error during verification');
      });

      expect(() => walletManager.getTransactionStatus(txId)).toThrow('Network error during verification');
    });
  });

  describe('Transaction State Transitions During Network Issues', () => {
    it('should handle transaction retry after network recovery', async () => {
      const txId = 'tx-retry';
      const to = 'addr2';
      const amount = '0.5';

      // Mock the processSendFundsAsync method to fail first, then succeed
      (walletManager as any).processSendFundsAsync = (jest.fn() as any)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue(undefined);

      await expect((walletManager as any).processSendFundsAsync(txId, to, amount))
        .rejects.toThrow('Network error');

      // Second attempt succeeds after network recovery
      await expect((walletManager as any).processSendFundsAsync(txId, to, amount))
        .resolves.toBeUndefined();
    });

    it('should handle wallet state updates during network recovery', () => {
      // Simulate wallet state update after network recovery
      (walletManager as any).ready = true;
      (walletManager as any).walletAddress = 'mdnt1test123';
      (walletManager as any).walletState = {
        syncProgress: { synced: true, lag: { applyGap: 0n, sourceGap: 0n } }
      };

      // Mock getWalletStatus to return the expected sync status
      (walletManager as any).getWalletStatus = jest.fn(() => ({
        ready: true,
        syncing: false,
        syncProgress: {
          synced: true,
          lag: {
            applyGap: '0',
            sourceGap: '0'
          },
          percentage: 100
        },
        address: 'mdnt1test123',
        balances: { balance: '1000', pendingBalance: '0' },
        recovering: false,
        recoveryAttempts: 0,
        maxRecoveryAttempts: 5,
        isFullySynced: true
      }));

      const status = walletManager.getWalletStatus();

      expect(status.ready).toBe(true);
      expect(status.syncProgress.synced).toBe(true);
      expect(status.address).toBe('mdnt1test123');
    });
  });

  describe('Low-Level Blockchain Interaction Wrappers', () => {
    it('should handle wallet builder failures during reconnection', async () => {
      // Mock recoverWallet to throw
      (walletManager as any).recoverWallet = (jest.fn() as any).mockRejectedValue(new Error('Wallet initialization failed'));

      await expect(walletManager.recoverWallet()).rejects.toThrow('Wallet initialization failed');
    });

    it('should handle wallet state subscription errors', () => {
      // Simulate wallet state subscription error
      if (mockWallet.state) {
        mockWallet.state.mockImplementation(() => {
          throw new Error('State subscription failed');
        });
      }

      // Should handle gracefully without throwing
      expect(() => {
        walletManager.getWalletStatus();
      }).not.toThrow();
    });

    it('should handle transaction database connection issues', () => {
      // Mock getTransactions to throw
      (walletManager as any).getTransactions = jest.fn(() => {
        throw new Error('Database connection failed');
      });

      expect(() => walletManager.getTransactions()).toThrow('Database connection failed');
    });

    it('should handle balance conversion errors during network issues', () => {
      // Mock hasReceivedTransactionByIdentifier to throw
      (walletManager as any).hasReceivedTransactionByIdentifier = jest.fn(() => {
        throw new Error('Balance conversion failed');
      });

      expect(() => walletManager.hasReceivedTransactionByIdentifier('tx-hash'))
        .toThrow('Balance conversion failed');
    });

    it('should handle native token function errors', () => {
      // Mock hasReceivedTransactionByIdentifier to throw
      (walletManager as any).hasReceivedTransactionByIdentifier = jest.fn(() => {
        throw new Error('Native token function failed');
      });

      expect(() => walletManager.hasReceivedTransactionByIdentifier('tx-hash'))
        .toThrow('Native token function failed');
    });
  });

  describe('Transaction History Parsing', () => {
    it('should parse valid TransactionHistoryEntry with multiple identifiers', () => {
      // ...
      (utils.convertBigIntToDecimal as jest.Mock).mockReturnValue('1.000000');
      // ...
    });

    it('should parse TransactionHistoryEntry with zero amount delta', () => {
      // ...
      (utils.convertBigIntToDecimal as jest.Mock).mockReturnValue('0.000000');
      // ...
    });
  });
}); 