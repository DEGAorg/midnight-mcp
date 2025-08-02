import { TransactionState } from '../../../src/types/wallet';

class WalletManager {
  public isReady = jest.fn(() => true);
  public getAddress = jest.fn(() => 'mock_address');
  public getBalance = jest.fn(() => ({ balance: '1000', pendingBalance: '0' }));
  public sendFunds = jest.fn(() => Promise.resolve({
    txIdentifier: 'mock_tx_hash',
    syncStatus: {
      syncedIndices: '10',
      lag: { applyGap: '0', sourceGap: '0' },
      isFullySynced: true
    },
    amount: '100'
  }));
  public initiateSendFunds = jest.fn(() => Promise.resolve({
    id: 'mock_tx_id',
    state: 'initiated',
    toAddress: 'mock_to_address',
    amount: '100',
    createdAt: Date.now()
  }));
  public close = jest.fn(() => Promise.resolve(undefined));
  public hasReceivedTransactionByIdentifier = jest.fn(() => ({
    exists: true,
    syncStatus: {
      syncedIndices: '10',
      lag: { applyGap: '0', sourceGap: '0' },
      isFullySynced: true
    },
    transactionAmount: '1'
  }));
  public getTransactionStatus = jest.fn(() => ({
    transaction: {
      id: 'mock_tx_id',
      state: 'sent',
      fromAddress: 'mock_address',
      toAddress: 'mock_to_address',
      amount: '100',
      txIdentifier: 'mock_tx_hash',
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    blockchainStatus: {
      exists: true,
      syncStatus: {
        syncedIndices: '10',
        lag: { applyGap: '0', sourceGap: '0' },
        isFullySynced: true
      }
    }
  }));
  public getTransactions = jest.fn(() => []);
  public getPendingTransactions = jest.fn(() => []);
  public getWalletStatus = jest.fn(function(this: any) {
    const walletState = this.walletState;
    const isSynced = walletState?.syncProgress?.synced ?? false;
    
    return {
      ready: this.ready ?? true,
      syncing: false,
      syncProgress: {
        synced: isSynced,
        lag: { applyGap: '0', sourceGap: '0' },
        percentage: isSynced ? 100 : 0
      },
      address: this.walletAddress || 'mock_address',
      balances: { balance: '1000', pendingBalance: '0' },
      recovering: false,
      recoveryAttempts: 0,
      maxRecoveryAttempts: 5,
      isFullySynced: isSynced
    };
  });
  public recoverWallet = jest.fn(() => Promise.resolve(undefined));
  public saveWalletToFile = jest.fn(() => Promise.resolve('/tmp/mock-wallet.json'));
  public processSendFundsAsync = jest.fn(() => Promise.resolve(undefined));
  
  // Add private properties that tests might need to access
  public ready = true;
  public wallet = null;
  public walletBalances = { balance: 1000000000n, pendingBalance: 0n };
  public walletAddress = 'mock_address';
  public transactionDb = null;
  public walletInitPromise = Promise.resolve();
  public walletState = null;
  public applyGap = 0n;
  public sourceGap = 0n;
}

export const __mockWallet = new WalletManager();

// Export WalletManager as a Jest mock constructor
const MockWalletManager = jest.fn().mockImplementation(() => __mockWallet);
export { MockWalletManager as WalletManager };

// Also export TestnetRemoteConfig
export class TestnetRemoteConfig {
  public indexer = 'https://test-indexer.com';
  public indexerWS = 'wss://test-indexer.com/ws';
  public node = 'https://test-node.com';
  public proofServer = 'http://test-proof.com';
  public logDir = '/tmp/test-logs';
}

export default MockWalletManager; 