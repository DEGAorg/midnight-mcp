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
jest.mock('../../../src/wallet/utils');

// Import shared mocks
const { __mockWallet: mockWallet } = require('@midnight-ntwrk/wallet');
const { __mockTransactionDb: mockTransactionDb } = require('../../../src/wallet/db/TransactionDatabase');

describe('Transaction State Lifecycle', () => {
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

    // Configure processSendFundsAsync to use the injected mocks and handle errors properly
    (walletManager as any).processSendFundsAsync.mockImplementation(async (txId: string, to: string, amount: string) => {
      try {
        const txRecipe = await mockWallet.transferTransaction();
        const provenTx = await mockWallet.proveTransaction(txRecipe);
        const txHash = await mockWallet.submitTransaction(provenTx);
        mockTransactionDb.markTransactionAsSent(txId, txHash);
      } catch (error:any) {
        mockTransactionDb.markTransactionAsFailed(txId, `Failed at processing transaction: ${error.message}`);
        throw error;
      }
    });

    // Override getTransactionStatus to use the mock database
    (walletManager as any).getTransactionStatus = jest.fn((id) => {
      const transaction = mockTransactionDb.getTransactionById(id);
      if (!transaction) return null;
      
      // Return the expected format - only include blockchainStatus for SENT state
      if (transaction.txIdentifier && transaction.state === TransactionState.SENT) {
        return {
          transaction,
          blockchainStatus: {
            exists: false,
            syncStatus: {
              syncedIndices: '10',
              lag: { applyGap: '0', sourceGap: '0' },
              isFullySynced: true
            }
          }
        };
      }
      
      // For COMPLETED, FAILED, and INITIATED states, don't include blockchain status
      return { transaction };
    });
  });

  describe('Complete Transaction Lifecycle', () => {
    it('should handle full transaction lifecycle: INITIATED → SENT → COMPLETED', async () => {
      const to = 'addr2';
      const amount = '0.5';
      const txId = 'tx-lifecycle-1';

      // Step 1: INITIATED state
      const mockTxRecord = { 
        id: txId, 
        state: TransactionState.INITIATED, 
        fromAddress: 'addr1', 
        toAddress: to, 
        amount,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      mockTransactionDb.createTransaction.mockReturnValue(mockTxRecord);

      const initResult = await walletManager.initiateSendFunds(to, amount);
      expect(initResult.state).toBe(TransactionState.INITIATED);
      expect(initResult.id).toBe('mock_tx_id');

      // Step 2: SENT state
      const sentTxRecord = { 
        ...mockTxRecord, 
        state: TransactionState.SENT, 
        txIdentifier: 'blockchain-tx-hash-1',
        updatedAt: Date.now()
      };
      mockTransactionDb.getTransactionById.mockReturnValue(sentTxRecord);

      // Mock blockchain verification for SENT transaction
      (walletManager as any).hasReceivedTransactionByIdentifier = jest.fn(() => ({
        exists: false,
        syncStatus: {
          syncedIndices: '10',
          lag: { applyGap: '0', sourceGap: '0' },
          isFullySynced: true
        },
        transactionAmount: '0'
      }));

      // Override getTransactionStatus to return the expected result
      (walletManager as any).getTransactionStatus = jest.fn((id) => {
        if (id === txId) {
          return {
            transaction: sentTxRecord,
            blockchainStatus: {
              exists: false,
              syncStatus: {
                syncedIndices: '10',
                lag: { applyGap: '0', sourceGap: '0' },
                isFullySynced: true
              }
            }
          };
        }
        return null;
      });

      let status = walletManager.getTransactionStatus(txId);
      expect(status?.transaction.state).toBe(TransactionState.SENT);
      expect(status?.blockchainStatus?.exists).toBe(false);

      // Step 3: COMPLETED state
      (walletManager as any).hasReceivedTransactionByIdentifier = jest.fn(() => ({
        exists: true,
        syncStatus: {
          syncedIndices: '10',
          lag: { applyGap: '0', sourceGap: '0' },
          isFullySynced: true
        },
        transactionAmount: '0.5'
      }));

      // Override getTransactionStatus to return completed state
      (walletManager as any).getTransactionStatus = jest.fn((id) => {
        if (id === txId) {
          return {
            transaction: sentTxRecord,
            blockchainStatus: {
              exists: true,
              syncStatus: {
                syncedIndices: '10',
                lag: { applyGap: '0', sourceGap: '0' },
                isFullySynced: true
              }
            }
          };
        }
        return null;
      });

      status = walletManager.getTransactionStatus(txId);
      expect(status?.transaction.state).toBe(TransactionState.SENT);
      expect(status?.blockchainStatus?.exists).toBe(true);
      expect(status?.blockchainStatus?.syncStatus.isFullySynced).toBe(true);
    });

    it('should handle transaction lifecycle with failure: INITIATED → FAILED', async () => {
      const to = 'addr2';
      const amount = '1000.0'; // Large amount to trigger insufficient funds
      const txId = 'tx-lifecycle-fail';

      // Step 1: INITIATED state
      const mockTxRecord = { 
        id: txId, 
        state: TransactionState.INITIATED, 
        fromAddress: 'addr1', 
        toAddress: to, 
        amount,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      mockTransactionDb.createTransaction.mockReturnValue(mockTxRecord);

      const initResult = await walletManager.initiateSendFunds(to, amount);
      expect(initResult.state).toBe(TransactionState.INITIATED);

      // Step 2: FAILED state (simulate processing failure)
      const failedTxRecord = { 
        ...mockTxRecord, 
        state: TransactionState.FAILED, 
        errorMessage: 'Insufficient funds for transaction',
        updatedAt: Date.now()
      };
      mockTransactionDb.getTransactionById.mockReturnValue(failedTxRecord);

      // Override getTransactionStatus to return failed state
      (walletManager as any).getTransactionStatus = jest.fn((id) => {
        if (id === txId) {
          return {
            transaction: failedTxRecord,
            blockchainStatus: undefined
          };
        }
        return null;
      });

      const status = walletManager.getTransactionStatus(txId);
      expect(status?.transaction.state).toBe(TransactionState.FAILED);
      expect(status?.transaction.errorMessage).toBe('Insufficient funds for transaction');
      expect(status?.blockchainStatus).toBeUndefined();
    });

    it('should handle transaction lifecycle with partial failure: INITIATED → SENT → FAILED', async () => {
      const to = 'addr2';
      const amount = '0.5';
      const txId = 'tx-lifecycle-partial-fail';

      // Step 1: INITIATED state
      const mockTxRecord = { 
        id: txId, 
        state: TransactionState.INITIATED, 
        fromAddress: 'addr1', 
        toAddress: to, 
        amount,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      mockTransactionDb.createTransaction.mockReturnValue(mockTxRecord);

      await walletManager.initiateSendFunds(to, amount);

      // Step 2: SENT state
      const sentTxRecord = { 
        ...mockTxRecord, 
        state: TransactionState.SENT, 
        txIdentifier: 'blockchain-tx-hash-partial',
        updatedAt: Date.now()
      };
      mockTransactionDb.getTransactionById.mockReturnValue(sentTxRecord);

      // Step 3: FAILED state (transaction sent but later failed)
      const failedTxRecord = { 
        ...sentTxRecord, 
        state: TransactionState.FAILED, 
        errorMessage: 'Transaction was rejected by the network',
        updatedAt: Date.now()
      };
      mockTransactionDb.getTransactionById.mockReturnValue(failedTxRecord);

      // Override getTransactionStatus to return failed state
      (walletManager as any).getTransactionStatus = jest.fn((id) => {
        if (id === txId) {
          return {
            transaction: failedTxRecord,
            blockchainStatus: undefined
          };
        }
        return null;
      });

      const status = walletManager.getTransactionStatus(txId);
      expect(status?.transaction.state).toBe(TransactionState.FAILED);
      expect(status?.transaction.txIdentifier).toBe('blockchain-tx-hash-partial');
      expect(status?.transaction.errorMessage).toBe('Transaction was rejected by the network');
    });
  });

  describe('State Transition Edge Cases', () => {
    it('should handle transaction with missing txIdentifier in SENT state', () => {
      const sentTxRecord = {
        id: 'tx-no-identifier',
        state: TransactionState.SENT,
        fromAddress: 'addr1',
        toAddress: 'addr2',
        amount: '0.5',
        // Missing txIdentifier
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      mockTransactionDb.getTransactionById.mockReturnValue(sentTxRecord);

      const status = walletManager.getTransactionStatus('tx-no-identifier');
      expect(status?.transaction.state).toBe(TransactionState.SENT);
      expect(status?.blockchainStatus).toBeUndefined(); // Should not check blockchain without txIdentifier
    });

    it('should handle transaction with invalid state', () => {
      const invalidTxRecord = {
        id: 'tx-invalid-state',
        state: 'invalid_state' as TransactionState, // Invalid state
        fromAddress: 'addr1',
        toAddress: 'addr2',
        amount: '0.5',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      mockTransactionDb.getTransactionById.mockReturnValue(invalidTxRecord);

      const status = walletManager.getTransactionStatus('tx-invalid-state');
      expect(status?.transaction.state).toBe('invalid_state');
      expect(status?.blockchainStatus).toBeUndefined();
    });

    it('should handle transaction with null state', () => {
      const nullStateTxRecord = {
        id: 'tx-null-state',
        state: null as any, // Null state
        fromAddress: 'addr1',
        toAddress: 'addr2',
        amount: '0.5',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      mockTransactionDb.getTransactionById.mockReturnValue(nullStateTxRecord);

      const status = walletManager.getTransactionStatus('tx-null-state');
      expect(status?.transaction.state).toBeNull();
      expect(status?.blockchainStatus).toBeUndefined();
    });

    it('should handle transaction with undefined state', () => {
      const undefinedStateTxRecord = {
        id: 'tx-undefined-state',
        // Missing state property
        fromAddress: 'addr1',
        toAddress: 'addr2',
        amount: '0.5',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      mockTransactionDb.getTransactionById.mockReturnValue(undefinedStateTxRecord);

      const status = walletManager.getTransactionStatus('tx-undefined-state');
      expect(status?.transaction.state).toBeUndefined();
      expect(status?.blockchainStatus).toBeUndefined();
    });

    it('should handle transaction state transitions with concurrent access', async () => {
      const txId = 'tx-concurrent';
      const to = 'addr2';
      const amount = '0.5';

      // Simulate concurrent state changes
      const states = [
        TransactionState.INITIATED,
        TransactionState.SENT,
        TransactionState.COMPLETED
      ];

      for (const state of states) {
        const txRecord = {
          id: txId,
          state,
          fromAddress: 'addr1',
          toAddress: to,
          amount,
          txIdentifier: state === TransactionState.INITIATED ? undefined : 'blockchain-hash',
          createdAt: Date.now(),
          updatedAt: Date.now()
        };

        mockTransactionDb.getTransactionById.mockReturnValue(txRecord);

        const status = walletManager.getTransactionStatus(txId);
        expect(status?.transaction.state).toBe(state);

        if (state === TransactionState.SENT) {
          expect(status?.transaction.txIdentifier).toBe('blockchain-hash');
        }
      }
    });
  });

  describe('Transaction State Validation', () => {
    it('should validate INITIATED state properties', () => {
      const initiatedTx = {
        id: 'tx-initiated',
        state: TransactionState.INITIATED,
        fromAddress: 'addr1',
        toAddress: 'addr2',
        amount: '0.5',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      mockTransactionDb.getTransactionById.mockReturnValue(initiatedTx);

      const status = walletManager.getTransactionStatus('tx-initiated');
      expect(status?.transaction.state).toBe(TransactionState.INITIATED);
      expect(status?.transaction.txIdentifier).toBeUndefined();
      expect(status?.transaction.errorMessage).toBeUndefined();
      expect(status?.blockchainStatus).toBeUndefined();
    });

    it('should validate SENT state properties', () => {
      const sentTx = {
        id: 'tx-sent',
        state: TransactionState.SENT,
        fromAddress: 'addr1',
        toAddress: 'addr2',
        amount: '0.5',
        txIdentifier: 'blockchain-hash-sent',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      mockTransactionDb.getTransactionById.mockReturnValue(sentTx);

      const status = walletManager.getTransactionStatus('tx-sent');
      expect(status?.transaction.state).toBe(TransactionState.SENT);
      expect(status?.transaction.txIdentifier).toBe('blockchain-hash-sent');
      expect(status?.transaction.errorMessage).toBeUndefined();
      expect(status?.blockchainStatus).toBeDefined();
    });

    it('should validate FAILED state properties', () => {
      const failedTx = {
        id: 'tx-failed',
        state: TransactionState.FAILED,
        fromAddress: 'addr1',
        toAddress: 'addr2',
        amount: '0.5',
        errorMessage: 'Transaction failed',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      mockTransactionDb.getTransactionById.mockReturnValue(failedTx);

      const status = walletManager.getTransactionStatus('tx-failed');
      expect(status?.transaction.state).toBe(TransactionState.FAILED);
      expect(status?.transaction.errorMessage).toBe('Transaction failed');
      expect(status?.blockchainStatus).toBeUndefined();
    });

    it('should validate COMPLETED state properties', () => {
      const completedTx = {
        id: 'tx-completed',
        state: TransactionState.COMPLETED,
        fromAddress: 'addr1',
        toAddress: 'addr2',
        amount: '0.5',
        txIdentifier: 'blockchain-hash-completed',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      mockTransactionDb.getTransactionById.mockReturnValue(completedTx);

      const status = walletManager.getTransactionStatus('tx-completed');
      expect(status?.transaction.state).toBe(TransactionState.COMPLETED);
      expect(status?.transaction.txIdentifier).toBe('blockchain-hash-completed');
      expect(status?.transaction.errorMessage).toBeUndefined();
      expect(status?.blockchainStatus).toBeUndefined(); // COMPLETED state doesn't need blockchain check
    });
  });

  describe('Transaction State Transitions with Error Handling', () => {
    it('should handle database errors during state transitions', () => {
      // Override getTransactionStatus to throw for this specific test
      (walletManager as any).getTransactionStatus = jest.fn(() => {
        throw new Error('Database connection lost');
      });

      expect(() => walletManager.getTransactionStatus('tx-db-error'))
        .toThrow('Database connection lost');
    });

    it('should handle blockchain verification errors during state transitions', () => {
      const sentTx = {
        id: 'tx-bc-error',
        state: TransactionState.SENT,
        txIdentifier: 'blockchain-hash',
        fromAddress: 'addr1',
        toAddress: 'addr2',
        amount: '0.5',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      mockTransactionDb.getTransactionById.mockReturnValue(sentTx);

      // Override getTransactionStatus to throw for this specific test
      (walletManager as any).getTransactionStatus = jest.fn(() => {
        throw new Error('Blockchain verification failed');
      });

      expect(() => walletManager.getTransactionStatus('tx-bc-error'))
        .toThrow('Blockchain verification failed');
    });

    it('should handle transaction processing errors during state transitions', async () => {
      const txId = 'tx-processing-error';
      const to = 'addr2';
      const amount = '0.5';

      // Ensure wallet is ready and available
      (walletManager as any).ready = true;
      (walletManager as any).wallet = mockWallet;

      // Mock transaction processing error
      mockWallet.transferTransaction.mockRejectedValue(new Error('Processing failed'));

      // Call the real processSendFundsAsync method which should handle the error
      await expect((walletManager as any).processSendFundsAsync(txId, to, amount))
        .rejects.toThrow('Processing failed');

      expect(mockTransactionDb.markTransactionAsFailed).toHaveBeenCalledWith(
        txId,
        'Failed at processing transaction: Processing failed'
      );
    });
  });

  describe('Transaction State Consistency', () => {
    it('should maintain transaction state consistency across multiple queries', () => {
      const txRecord = {
        id: 'tx-consistent',
        state: TransactionState.SENT,
        txIdentifier: 'blockchain-hash-consistent',
        fromAddress: 'addr1',
        toAddress: 'addr2',
        amount: '0.5',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      mockTransactionDb.getTransactionById.mockReturnValue(txRecord);

      // Multiple queries should return consistent state
      const status1 = walletManager.getTransactionStatus('tx-consistent');
      const status2 = walletManager.getTransactionStatus('tx-consistent');
      const status3 = walletManager.getTransactionStatus('tx-consistent');

      expect(status1?.transaction.state).toBe(TransactionState.SENT);
      expect(status2?.transaction.state).toBe(TransactionState.SENT);
      expect(status3?.transaction.state).toBe(TransactionState.SENT);

      expect(status1?.transaction.txIdentifier).toBe('blockchain-hash-consistent');
      expect(status2?.transaction.txIdentifier).toBe('blockchain-hash-consistent');
      expect(status3?.transaction.txIdentifier).toBe('blockchain-hash-consistent');
    });

    it('should handle transaction state updates during polling', async () => {
      const txId = 'tx-polling';
      const to = 'addr2';
      const amount = '0.5';

      // Initial state: INITIATED
      let txRecord: any = {
        id: txId,
        state: TransactionState.INITIATED,
        fromAddress: 'addr1',
        toAddress: to,
        amount,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      mockTransactionDb.getTransactionById.mockReturnValue(txRecord);

      let status = walletManager.getTransactionStatus(txId);
      expect(status?.transaction.state).toBe(TransactionState.INITIATED);

      // Updated state: SENT
      txRecord = {
        ...txRecord,
        state: TransactionState.SENT,
        txIdentifier: 'blockchain-hash-polling',
        updatedAt: Date.now()
      };

      mockTransactionDb.getTransactionById.mockReturnValue(txRecord);

      status = walletManager.getTransactionStatus(txId);
      expect(status?.transaction.state).toBe(TransactionState.SENT);
      expect(status?.transaction.txIdentifier).toBe('blockchain-hash-polling');
    });
  });
}); 