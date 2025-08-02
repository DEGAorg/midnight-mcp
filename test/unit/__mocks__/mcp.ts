import { WalletServiceError, WalletServiceErrorType } from '../../../src/mcp/index';

export const WalletServiceMCP = jest.fn().mockImplementation(() => {
  let isWalletReady = true;

  const checkWalletReady = () => {
    if (!isWalletReady) {
      throw new WalletServiceError(WalletServiceErrorType.WALLET_NOT_READY, 'Wallet is not ready');
    }
  };

  const checkWalletReadyAsync = async () => {
    if (!isWalletReady) {
      throw new WalletServiceError(WalletServiceErrorType.WALLET_NOT_READY, 'Wallet is not ready');
    }
  };

  return {
    isReady: jest.fn(() => isWalletReady),
    setWalletReady: jest.fn((ready: boolean) => {
      isWalletReady = ready;
    }),
    getAddress: jest.fn(() => {
      checkWalletReady();
      return 'test-address';
    }),
    getBalance: jest.fn(() => {
      checkWalletReady();
      return { balance: '1000', pendingBalance: '0' };
    }),
    close: jest.fn(() => Promise.resolve()),
    sendFunds: jest.fn(async () => {
      await checkWalletReadyAsync();
      return { 
        id: 'mock_tx_id',
        state: 'initiated',
        toAddress: 'test-address',
        amount: '100',
        createdAt: Date.now()
      };
    }),
    sendFundsAndWait: jest.fn(async () => {
      await checkWalletReadyAsync();
      return { 
        txIdentifier: 'test-tx',
        syncStatus: {
          syncedIndices: '10',
          lag: { applyGap: '0', sourceGap: '0' },
          isFullySynced: true
        },
        amount: '100'
      };
    }),
    getTransactionStatus: jest.fn(() => {
      checkWalletReady();
      return { transaction: { id: 'test' }, blockchainStatus: { exists: true } };
    }),
    getTransactions: jest.fn(() => {
      checkWalletReady();
      return [];
    }),
    getPendingTransactions: jest.fn(() => {
      checkWalletReady();
      return [];
    }),
    getWalletStatus: jest.fn(() => {
      return { 
        ready: isWalletReady, 
        address: 'test-address', 
        balances: { balance: '1000' },
        syncing: false,
        syncProgress: {
          synced: true,
          lag: { applyGap: '0', sourceGap: '0' },
          percentage: 100
        },
        recovering: false,
        recoveryAttempts: 0,
        maxRecoveryAttempts: 5,
        isFullySynced: true
      };
    }),
    verifyTransaction: jest.fn(() => ({ valid: true })),
    getWalletConfig: jest.fn(() => ({ 
      indexer: 'https://test-indexer.com',
      indexerWS: 'wss://test-indexer.com/ws',
      node: 'https://test-node.com',
      proofServer: 'http://test-proof.com'
    })),
    hasReceivedTransactionByIdentifier: jest.fn((identifier: string) => ({
      exists: true,
      syncStatus: {
        syncedIndices: '10',
        lag: { applyGap: '0', sourceGap: '0' },
        isFullySynced: true
      },
      transactionAmount: '100'
    })),
    confirmTransactionHasBeenReceived: jest.fn((identifier: string) => {
      checkWalletReady();
      return {
        exists: true,
        syncStatus: {
          syncedIndices: '10',
          lag: { applyGap: '0', sourceGap: '0' },
          isFullySynced: true
        }
      };
    }),
    transferTransaction: jest.fn(() => Promise.resolve('tx-recipe')),
    proveTransaction: jest.fn(() => Promise.resolve('proven-tx')),
    submitTransaction: jest.fn(() => Promise.resolve('submitted-tx'))
  };
}); 