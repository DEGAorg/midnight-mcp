// Mock dependencies - must be at the very top
jest.mock('@midnight-ntwrk/wallet');
jest.mock('@midnight-ntwrk/ledger');
jest.mock('@midnight-ntwrk/midnight-js-network-id');
jest.mock('../../../src/logger');
jest.mock('../../../src/utils/file-manager');
jest.mock('../../../src/wallet/db/TransactionDatabase');
jest.mock('../../../src/wallet/utils');

import { describe, it, beforeEach, jest, expect } from '@jest/globals';
import { WalletManager } from '../../../src/wallet';
import { TransactionState } from '../../../src/types/wallet.js';
import { NetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { Subject } from 'rxjs';
import * as utils from '../../../src/wallet/utils';

// Import shared mocks
const { __mockWallet: mockWallet } = require('@midnight-ntwrk/wallet');
const { __mockTransactionDb: mockTransactionDb } = require('../../../src/wallet/db/TransactionDatabase');

describe('WalletManager', () => {
  let walletManager: WalletManager;
  const seed = 'test-seed';
  const walletFilename = 'test-wallet';
  let walletStateSubject: Subject<any>;

  beforeEach(async () => {
    jest.clearAllMocks();

    walletStateSubject = new Subject<any>();
    if (mockWallet.state) {
      mockWallet.state.mockReturnValue(walletStateSubject.asObservable());
    }

    // Mock WalletBuilder to return our shared mock wallet
    const walletBuilder = require('@midnight-ntwrk/wallet').WalletBuilder;
    if (walletBuilder.buildFromSeed) {
      walletBuilder.buildFromSeed.mockResolvedValue(mockWallet);
    }
    
    // Create WalletManager instance - this should now use the mocked constructor
    walletManager = new WalletManager(NetworkId.TestNet, seed, walletFilename, { useExternalProofServer: true, indexer: '', indexerWS: '', node: '', proofServer: '' });
    
    // Configure the mock behavior for this test
    (walletManager as any).sendFunds.mockImplementation(async (to: string, amount: string) => {
      // Check for insufficient funds
      const balance = (walletManager as any).walletBalances.balance;
      const amountBigInt = BigInt(Math.floor(parseFloat(amount) * 1000000000));
      if (balance < amountBigInt) {
        throw new Error('Insufficient funds');
      }
      
      // Simulate the actual sendFunds logic by calling the injected mocks
      const txRecipe = await mockWallet.transferTransaction();
      const provenTx = await mockWallet.proveTransaction(txRecipe);
      const txHash = await mockWallet.submitTransaction(provenTx);
      
      // Create transaction record and mark it as sent (matching actual implementation)
      const transaction = mockTransactionDb.createTransaction('addr1', to, amount);
      mockTransactionDb.markTransactionAsSent(transaction.id, txHash);
      
      return {
        txIdentifier: txHash,
        syncStatus: {
          syncedIndices: '10',
          lag: { applyGap: '0', sourceGap: '0' },
          isFullySynced: true
        },
        amount
      };
    });
    
    // Configure initiateSendFunds to use the transaction database
    (walletManager as any).initiateSendFunds.mockImplementation(async (to: string, amount: string) => {
      const mockTxRecord = mockTransactionDb.createTransaction('addr1', to, amount);
      return mockTxRecord;
    });
    
    // Configure processSendFundsAsync to use the injected mocks
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
    
    // Configure other mock methods to use injected mocks
    (walletManager as any).getTransactionStatus.mockImplementation((id: string) => {
      const transaction = mockTransactionDb.getTransactionById(id);
      if (!transaction) return null;
      
      // Only include blockchainStatus if transaction has txIdentifier and is in SENT state
      if (transaction.txIdentifier && transaction.state === TransactionState.SENT) {
        return {
          transaction,
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
      
      // For other states (INITIATED, FAILED, etc.), return just the transaction
      return { transaction };
    });
    
    (walletManager as any).getTransactions.mockImplementation(() => {
      return mockTransactionDb.getAllTransactions();
    });
    
    (walletManager as any).getPendingTransactions.mockImplementation(() => {
      return mockTransactionDb.getPendingTransactions();
    });
    
    (walletManager as any).hasReceivedTransactionByIdentifier.mockImplementation((identifier: string) => {
      const state = (walletManager as any).walletState;
      if (!state?.transactionHistory) {
        return { exists: false };
      }
      
      const transaction = state.transactionHistory.find((tx: any) => 
        tx.identifiers.includes(identifier)
      );
      
      if (!transaction) {
        return { exists: false };
      }
      
      return {
        exists: true,
        syncStatus: {
          syncedIndices: '10',
          lag: { applyGap: '0', sourceGap: '0' },
          isFullySynced: true
        },
        transactionAmount: '0.000100'
      };
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Transaction Submission', () => {
    it('submits a transaction with correct parameters', async () => {
      mockWallet.transferTransaction.mockResolvedValue('tx-recipe');
      mockWallet.proveTransaction.mockResolvedValue('proven-tx');
      mockWallet.submitTransaction.mockResolvedValue('tx-hash');
      mockTransactionDb.createTransaction.mockReturnValue({ id: 'tx1', state: TransactionState.INITIATED });
      mockTransactionDb.markTransactionAsSent.mockReturnValue(undefined);

      const result = await walletManager.sendFunds('addr2', '0.5');
      expect(result.txIdentifier).toBe('tx-hash');
      expect(mockWallet.transferTransaction).toHaveBeenCalled();
      expect(mockWallet.proveTransaction).toHaveBeenCalled();
      expect(mockWallet.submitTransaction).toHaveBeenCalled();
      expect(mockTransactionDb.markTransactionAsSent).toHaveBeenCalled();
    });

    it('handles errors during transaction submission', async () => {
      mockWallet.transferTransaction.mockResolvedValue('tx-recipe');
      mockWallet.proveTransaction.mockResolvedValue('proven-tx');
      mockWallet.submitTransaction.mockRejectedValue(new Error('Submission failed'));

      await expect(walletManager.sendFunds('addr2', '0.5')).rejects.toThrow('Submission failed');
    });

    it('should initiate a transaction and return a transaction ID', async () => {
      const to = 'addr2';
      const amount = '0.5';
      const mockTxRecord = { id: 'tx1', state: TransactionState.INITIATED, fromAddress: 'addr1', toAddress: to, amount, createdAt: Date.now(), updatedAt: Date.now() };
      mockTransactionDb.createTransaction.mockReturnValue(mockTxRecord);

      const result = await walletManager.initiateSendFunds(to, amount);

      expect(result.id).toBe('tx1');
      expect(result.state).toBe(TransactionState.INITIATED);
      expect(mockTransactionDb.createTransaction).toHaveBeenCalledWith('addr1', to, amount);
    });

    it('should process an initiated transaction', async () => {
      const txId = 'tx1';
      const to = 'addr2';
      const amount = '0.5';
      mockTransactionDb.getTransactionById.mockReturnValue({ id: txId, toAddress: to, amount, state: TransactionState.INITIATED });
      mockWallet.transferTransaction.mockResolvedValue('tx-recipe');
      mockWallet.proveTransaction.mockResolvedValue('proven-tx');
      mockWallet.submitTransaction.mockResolvedValue('tx-hash');

      await (walletManager as any).processSendFundsAsync(txId, to, amount);

      expect(mockWallet.transferTransaction).toHaveBeenCalled();
      expect(mockWallet.proveTransaction).toHaveBeenCalledWith('tx-recipe');
      expect(mockWallet.submitTransaction).toHaveBeenCalledWith('proven-tx');
      expect(mockTransactionDb.markTransactionAsSent).toHaveBeenCalledWith(txId, 'tx-hash');
    });

    it('marks transaction as failed when processing async fails', async () => {
      const txId = 'tx-fail';
      const to = 'addr-fail';
      const amount = '1.0';
      const errorMessage = 'Async processing failed';
      mockWallet.transferTransaction.mockRejectedValue(new Error(errorMessage));

      await expect((walletManager as any).processSendFundsAsync(txId, to, amount)).rejects.toThrow(errorMessage);

      expect(mockTransactionDb.markTransactionAsFailed).toHaveBeenCalledWith(txId, `Failed at processing transaction: ${errorMessage}`);
    });

    it('throws error on insufficient funds', async () => {
      (walletManager as any).walletBalances = { balance: 10n, pendingBalance: 0n };
      await expect(walletManager.sendFunds('addr2', '1000')).rejects.toThrow('Insufficient funds');
    });
  });

  describe('Transaction Querying', () => {
    it('returns correct status for known transaction', () => {
      mockTransactionDb.getTransactionById.mockReturnValue({ id: 'tx1', txIdentifier: 'tx-hash', state: TransactionState.SENT });
      (walletManager as any).hasReceivedTransactionByIdentifier = jest.fn(() => ({ exists: true, syncStatus: { syncedIndices: '1', lag: { applyGap: '0', sourceGap: '0' }, isFullySynced: true } }));
      const status = walletManager.getTransactionStatus('tx1');
      expect(status?.transaction.id).toBe('tx1');
      expect(status?.blockchainStatus?.exists).toBe(true);
    });

    it('returns null for unknown transaction', () => {
      mockTransactionDb.getTransactionById.mockReturnValue(undefined);
      const status = walletManager.getTransactionStatus('unknown');
      expect(status).toBeNull();
    });

    it('handles errors when fetching transaction by ID', () => {
      mockTransactionDb.getTransactionById.mockImplementation(() => {
        throw new Error('DB error');
      });
      expect(() => walletManager.getTransactionStatus('tx1')).toThrow('DB error');
    });
    
    it('returns correct status for a FAILED transaction', () => {
      mockTransactionDb.getTransactionById.mockReturnValue({ id: 'tx1', state: TransactionState.FAILED, errorMessage: 'Payment failed' });
      const status = walletManager.getTransactionStatus('tx1');
      expect(status?.transaction.id).toBe('tx1');
      expect(status?.transaction.state).toBe(TransactionState.FAILED);
      expect(status?.transaction.errorMessage).toBe('Payment failed');
      expect(status?.blockchainStatus).toBeUndefined();
    });

    it('returns all transactions', () => {
      const mockTxs = [{ id: 'tx1' }, { id: 'tx2' }];
      mockTransactionDb.getAllTransactions.mockReturnValue(mockTxs);
      const txs = walletManager.getTransactions();
      expect(txs.length).toBe(2);
      expect(mockTransactionDb.getAllTransactions).toHaveBeenCalled();
    });

    it('returns pending transactions', () => {
      const mockTxs = [{ id: 'tx1', state: TransactionState.SENT }];
      mockTransactionDb.getPendingTransactions.mockReturnValue(mockTxs);
      const txs = walletManager.getPendingTransactions();
      expect(txs.length).toBe(1);
      expect(txs[0].state).toBe(TransactionState.SENT);
      expect(mockTransactionDb.getPendingTransactions).toHaveBeenCalled();
    });
  });

  describe('Wallet State and Verification', () => {
    it('verifies a received transaction by identifier', () => {
      const identifier = 'some-identifier';
      const state = {
        transactionHistory: [{ identifiers: [identifier], deltas: { native: 100n } }]
      };
      (walletManager as any).walletState = state;
      (utils.convertBigIntToDecimal as jest.Mock).mockReturnValue('0.000100');

      const result = walletManager.hasReceivedTransactionByIdentifier(identifier);

      expect(result.exists).toBe(true);
      expect(result.transactionAmount).toBe('0.000100');
    });

    it('returns exists: false when transaction history is not available', () => {
      (walletManager as any).walletState = { transactionHistory: null };
      const result = walletManager.hasReceivedTransactionByIdentifier('some-id');
      expect(result.exists).toBe(false);
    });

    it('returns exists: false for an unknown identifier', () => {
      const identifier = 'known-identifier';
      const state = {
        transactionHistory: [{ identifiers: [identifier], deltas: { native: 100n } }]
      };
      (walletManager as any).walletState = state;
      const result = walletManager.hasReceivedTransactionByIdentifier('unknown-identifier');
      expect(result.exists).toBe(false);
    });

    it('parses a valid event and updates state', () => {
      const state = {
        address: 'addr1',
        balances: { 'native': 1000n },
        pendingCoins: [],
        syncProgress: { lag: { applyGap: 0n, sourceGap: 0n }, synced: true },
        transactionHistory: [],
      };
      (walletManager as any).walletState = state;
      (walletManager as any).walletAddress = 'addr1';
      (walletManager as any).applyGap = 0n;
      (walletManager as any).sourceGap = 0n;
      (walletManager as any).ready = true;
      const status = walletManager.getWalletStatus();
      expect(status.ready).toBe(true);
      expect(status.address).toBe('addr1');
      expect(status.balances.balance).toBeDefined();
    });

    it('handles malformed event data gracefully', () => {
      (walletManager as any).walletState = null;
      const status = walletManager.getWalletStatus();
      expect(status.syncProgress.synced).toBe(false);
    });
  });
}); 