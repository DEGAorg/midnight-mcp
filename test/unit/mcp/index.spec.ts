import { jest } from '@jest/globals';
import { MCPServer, MCPErrorType, MCPError } from '../../../src/mcp/index.js';
import { NetworkId } from '@midnight-ntwrk/midnight-js-network-id';

// Mock the wallet module and create test data
const mockWalletData = {
  isReady: jest.fn(() => true),
  getAddress: jest.fn(() => 'mdnt1test_address123456789'),
  getBalance: jest.fn(() => BigInt(1000)),
  initiateSendFunds: jest.fn(() => Promise.resolve({
    id: 'mock_tx_id',
    state: 'initiated',
    toAddress: 'mdnt1recipient_address',
    amount: '100',
    createdAt: Date.now()
  })),
  sendFunds: jest.fn(() => Promise.resolve({
    txIdentifier: 'mock_tx_hash',
    syncedIndices: '10',
    lag: {
      applyGap: '0',
      sourceGap: '0'
    },
    isFullySynced: true,
    amount: '100'
  })),
  hasReceivedTransactionByIdentifier: jest.fn(() => ({
    exists: true,
    syncedIndices: '10',
    lag: {
      applyGap: '0',
      sourceGap: '0'
    },
    isFullySynced: true
  })),
  getTransactionStatus: jest.fn(() => ({
    transaction: {
      id: 'mock_tx_id',
      state: 'sent',
      fromAddress: 'mdnt1test_address123456789',
      toAddress: 'mdnt1recipient_address',
      amount: '100',
      txIdentifier: 'mock_tx_hash',
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    blockchainStatus: {
      exists: true,
      syncStatus: {
        syncedIndices: '10',
        lag: {
          applyGap: '0',
          sourceGap: '0'
        },
        isFullySynced: true
      }
    }
  })),
  close: jest.fn(() => Promise.resolve())
};

// Mock the wallet module
jest.mock('../../../src/wallet/index.js', () => ({
  WalletManager: jest.fn().mockImplementation(() => mockWalletData)
}));

// Mock the logger module
jest.mock('../../../src/logger/index.js', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn()
  }))
}));

// Mock setTimeout
jest.useFakeTimers();

describe('MCPServer', () => {
  let mcpServer: MCPServer;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Reset default behaviors
    mockWalletData.isReady.mockReturnValue(true);
    mockWalletData.getAddress.mockReturnValue('mdnt1test_address123456789');
    mockWalletData.getBalance.mockReturnValue(BigInt(1000));
    mockWalletData.initiateSendFunds.mockResolvedValue({
      id: 'mock_tx_id',
      state: 'initiated',
      toAddress: 'mdnt1recipient_address',
      amount: '100',
      createdAt: Date.now()
    });
    mockWalletData.sendFunds.mockResolvedValue({
      txIdentifier: 'mock_tx_hash',
      syncedIndices: '10',
      lag: {
        applyGap: '0',
        sourceGap: '0'
      },
      isFullySynced: true,
      amount: '100'
    });
    mockWalletData.hasReceivedTransactionByIdentifier.mockReturnValue({
      exists: true,
      syncedIndices: '10',
      lag: {
        applyGap: '0',
        sourceGap: '0'
      },
      isFullySynced: true
    });
    mockWalletData.getTransactionStatus.mockReturnValue({
      transaction: {
        id: 'mock_tx_id',
        state: 'sent',
        fromAddress: 'mdnt1test_address123456789',
        toAddress: 'mdnt1recipient_address',
        amount: '100',
        txIdentifier: 'mock_tx_hash',
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      blockchainStatus: {
        exists: true,
        syncStatus: {
          syncedIndices: '10',
          lag: {
            applyGap: '0',
            sourceGap: '0'
          },
          isFullySynced: true
        }
      }
    });
    
    // Create a new MCPServer instance
    mcpServer = new MCPServer(
      NetworkId.Undeployed,
      'seed phrase for testing',
      'test-wallet.json'
    );
  });
  
  afterEach(async () => {
    await mcpServer.close();
  });
  
  describe('isReady', () => {
    it('should return the ready status from the wallet manager', () => {
      const result = mcpServer.isReady();
      expect(result).toBe(true);
    });
  });
  
  describe('getAddress', () => {
    it('should return the wallet address when wallet is ready', () => {
      const address = mcpServer.getAddress();
      expect(address).toBe('mdnt1test_address123456789');
    });
    
    it('should throw an error when wallet is not ready', () => {
      // Override isReady for this test
      jest.spyOn(mcpServer, 'isReady').mockReturnValue(false);
      
      try {
        mcpServer.getAddress();
        fail('Expected an error to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(MCPError);
        expect(error.type).toBe(MCPErrorType.WALLET_NOT_READY);
      }
    });

    it('should throw an error when the wallet getAddress function fails', () => {
      // Mock an error in the wallet's getAddress method
      mockWalletData.getAddress.mockImplementation(() => {
        throw new Error('Access error');
      });
      
      try {
        mcpServer.getAddress();
        fail('Expected an error to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(MCPError);
        expect(error.type).toBe(MCPErrorType.WALLET_NOT_READY);
        expect(error.message).toBe('Error accessing wallet address');
      }
    });
  });
  
  describe('getBalance', () => {
    it('should return the wallet balance when wallet is ready', () => {
      const balance = mcpServer.getBalance();
      expect(balance).toBe(BigInt(1000));
    });
    
    it('should throw an error when wallet is not ready', () => {
      // Override isReady for this test
      jest.spyOn(mcpServer, 'isReady').mockReturnValue(false);
      
      try {
        mcpServer.getBalance();
        fail('Expected an error to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(MCPError);
        expect(error.type).toBe(MCPErrorType.WALLET_NOT_READY);
      }
    });

    it('should throw an error when the wallet getBalance function fails', () => {
      // Mock an error in the wallet's getBalance method
      mockWalletData.getBalance.mockImplementation(() => {
        throw new Error('Access error');
      });
      
      try {
        mcpServer.getBalance();
        fail('Expected an error to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(MCPError);
        expect(error.type).toBe(MCPErrorType.WALLET_NOT_READY);
        expect(error.message).toBe('Error accessing wallet balance');
      }
    });
  });
  
  describe('sendFunds', () => {
    it('should initiate a transaction and return the transaction details', async () => {
      const result = await mcpServer.sendFunds('mdnt1recipient_address', '100');
      expect(result).toEqual({
        id: 'mock_tx_id',
        state: 'initiated',
        toAddress: 'mdnt1recipient_address',
        amount: '100',
        createdAt: expect.any(Number)
      });
    });

    it('should throw an error if the wallet is not ready', async () => {
      mockWalletData.isReady.mockReturnValue(false);
      await expect(mcpServer.sendFunds('mdnt1recipient_address', '100')).rejects.toThrow('Wallet is not ready');
    });
  });

  describe('sendFundsAndWait', () => {
    it('should send funds and wait for the transaction to be submitted', async () => {
      const result = await mcpServer.sendFundsAndWait('mdnt1recipient_address', '100');
      expect(result).toEqual({
        txIdentifier: 'mock_tx_hash',
        syncStatus: {
          syncedIndices: '10',
          lag: {
            applyGap: '0',
            sourceGap: '0'
          },
          isFullySynced: true
        },
        amount: '100'
      });
    });

    it('should throw an error if the wallet is not ready', async () => {
      mockWalletData.isReady.mockReturnValue(false);
      await expect(mcpServer.sendFundsAndWait('mdnt1recipient_address', '100')).rejects.toThrow('Wallet is not ready');
    });
  });

  describe('getTransactionStatus', () => {
    it('should return the transaction status', () => {
      const result = mcpServer.getTransactionStatus('mock_tx_id');
      expect(result).toEqual({
        transaction: {
          id: 'mock_tx_id',
          state: 'sent',
          fromAddress: 'mdnt1test_address123456789',
          toAddress: 'mdnt1recipient_address',
          amount: '100',
          txIdentifier: 'mock_tx_hash',
          createdAt: expect.any(Number),
          updatedAt: expect.any(Number)
        },
        blockchainStatus: {
          exists: true,
          syncStatus: {
            syncedIndices: '10',
            lag: {
              applyGap: '0',
              sourceGap: '0'
            },
            isFullySynced: true
          }
        }
      });
    });

    it('should throw an error if the wallet is not ready', () => {
      mockWalletData.isReady.mockReturnValue(false);
      expect(() => mcpServer.getTransactionStatus('mock_tx_id')).toThrow('Wallet is not ready');
    });
  });

  describe('confirmTransactionHasBeenReceived', () => {
    it('should verify if a transaction has been received', () => {
      const result = mcpServer.confirmTransactionHasBeenReceived('mock_tx_hash');
      expect(result).toEqual({
        exists: true,
        syncStatus: {
          syncedIndices: '10',
          lag: {
            applyGap: '0',
            sourceGap: '0'
          },
          isFullySynced: true
        }
      });
    });

    it('should throw an error if the wallet is not ready', () => {
      mockWalletData.isReady.mockReturnValue(false);
      expect(() => mcpServer.confirmTransactionHasBeenReceived('mock_tx_hash')).toThrow('Wallet is not ready');
    });
  });

  describe('close', () => {
    it('should close the wallet successfully', async () => {
      await mcpServer.close();
      expect(mockWalletData.close).toHaveBeenCalled();
    });

    it('should handle errors during wallet closing', async () => {
      // Mock an error during close
      mockWalletData.close.mockRejectedValue(new Error('Close error'));
      
      // The close method catches errors, so it should not throw
      await expect(mcpServer.close()).resolves.toBeUndefined();
    });
  });

  describe('constructor', () => {
    it('should set network ID if provided', () => {
      // Create a new instance with a specific network ID
      const testServer = new MCPServer(
        NetworkId.MainNet,
        'seed phrase for testing',
        'test-wallet.json'
      );
      
      // We can't directly test the internal network ID set, but we can verify the constructor completed
      expect(testServer).toBeInstanceOf(MCPServer);
      
      // Clean up
      testServer.close();
    });

    it('should initialize with external config if provided', () => {
      const externalConfig = {
        indexer: 'https://test-indexer.com',
        indexerWS: 'wss://test-indexer-ws.com',
        node: 'https://test-node.com',
        proofServer: 'https://test-proof-server.com'
      };

      const testServer = new MCPServer(
        NetworkId.Undeployed,
        'seed phrase for testing',
        'test-wallet.json',
        externalConfig
      );
      
      expect(testServer).toBeInstanceOf(MCPServer);
      
      // Clean up
      testServer.close();
    });
  });
}); 