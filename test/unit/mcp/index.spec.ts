// Mock dependencies - must be at the very top
jest.mock('@midnight-ntwrk/wallet');
jest.mock('@midnight-ntwrk/ledger');
jest.mock('@midnight-ntwrk/midnight-js-network-id');
jest.mock('../../../src/utils/file-manager');
jest.mock('../../../src/logger');
jest.mock('../../../src/integrations/marketplace/api.js', () => require('../__mocks__/marketplace-api.ts'));

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { NetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { fail } from 'assert';
import { createSimpleToolHandler, handleWalletServiceError, formatError } from '../../../src/mcp/index';
import { WalletServiceError, WalletServiceErrorType, WalletServiceMCP } from '../../../src/mcp/index.js';
import { createParameterizedToolHandler } from '../../../src/mcp/index';

jest.useFakeTimers();

describe('WalletServiceMCP', () => {
  let mcpServer: WalletServiceMCP;
  let mockWallet: any;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Get the mock wallet instance
    const { __mockWallet } = require('../__mocks__/wallet');
    mockWallet = __mockWallet;
    
    // Create a new MCPServer instance
    mcpServer = new WalletServiceMCP(
      NetworkId.Undeployed,
      'seed phrase for testing',
      'test-wallet.json'
    );

    // Replace the wallet instance with our mock
    (mcpServer as any).wallet = mockWallet;
  });
  
  afterEach(async () => {
    // Clean up MCP server to stop any running intervals
    if (mcpServer) {
      try {
        await mcpServer.close();
      } catch (error) {
        // Ignore cleanup errors in tests
      }
    }
    
    // Clear any remaining intervals that might have been created
    const activeIntervals = (global as any).__JEST_ACTIVE_INTERVALS__ || [];
    activeIntervals.forEach((intervalId: NodeJS.Timeout) => {
      clearInterval(intervalId);
    });
    (global as any).__JEST_ACTIVE_INTERVALS__ = [];
    
    jest.clearAllMocks();
  });
  
  describe('isReady', () => {
    it('should return the ready status from the wallet manager', () => {
      // Ensure the mock isReady method returns true
      mockWallet.isReady.mockReturnValue(true);
      
      const result = mcpServer.isReady();
      expect(result).toBe(true);
    });
  });
  
  describe('getAddress', () => {
    it('should return the wallet address when wallet is ready', () => {
      mockWallet.isReady.mockReturnValue(true);
      mockWallet.getAddress.mockReturnValue('mdnt1test_address123456789');
      const address = mcpServer.getAddress();
      expect(address).toBe('mdnt1test_address123456789');
    });
    
    it('should throw an error when wallet is not ready', () => {
      jest.spyOn(mcpServer, 'isReady').mockReturnValue(false);
      try {
        mcpServer.getAddress();
        fail('Expected an error to be thrown');
      } catch (error:any) {
        expect(error).toBeInstanceOf(WalletServiceError);
        expect(error.type).toBe(WalletServiceErrorType.WALLET_NOT_READY);
      }
    });

    it('should throw an error when the wallet getAddress function fails', () => {
      mockWallet.isReady.mockReturnValue(true);
      mockWallet.getAddress.mockImplementation(() => {
        throw new Error('Access error');
      });
      try {
        mcpServer.getAddress();
        fail('Expected an error to be thrown');
      } catch (error:any) {
        expect(error).toBeInstanceOf(WalletServiceError);
        expect(error.type).toBe(WalletServiceErrorType.WALLET_NOT_READY);
        expect(error.message).toBe('Error accessing wallet address');
      }
    });
  });
  
  describe('getBalance', () => {
    it('should return the wallet balance when wallet is ready', () => {
      mockWallet.isReady.mockReturnValue(true);
      mockWallet.getBalance.mockReturnValue({ balance: '1000', pendingBalance: '0' });
      const balance = mcpServer.getBalance();
      expect(balance).toEqual({
        balance: '1000',
        pendingBalance: '0'
      });
    });
    
    it('should throw an error when wallet is not ready', () => {
      jest.spyOn(mcpServer, 'isReady').mockReturnValue(false);
      try {
        mcpServer.getBalance();
        fail('Expected an error to be thrown');
      } catch (error:any) {
        expect(error).toBeInstanceOf(WalletServiceError);
        expect(error.type).toBe(WalletServiceErrorType.WALLET_NOT_READY);
      }
    });

    it('should throw an error when the wallet getBalance function fails', () => {
      mockWallet.isReady.mockReturnValue(true);
      mockWallet.getBalance.mockImplementation(() => {
        throw new Error('Access error');
      });
      try {
        mcpServer.getBalance();
        fail('Expected an error to be thrown');
      } catch (error:any) {
        expect(error).toBeInstanceOf(WalletServiceError);
        expect(error.type).toBe(WalletServiceErrorType.WALLET_NOT_READY);
        expect(error.message).toBe('Error accessing wallet balance');
      }
    });
  });
  
  describe('sendFunds', () => {
    it('should initiate a transaction and return the transaction details', async () => {
      mockWallet.isReady.mockReturnValue(true);
      mockWallet.initiateSendFunds.mockResolvedValue({
        id: 'mock_tx_id',
        state: 'initiated',
        toAddress: 'mdnt1recipient_address',
        amount: '100',
        createdAt: Date.now()
      });
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
      mockWallet.isReady.mockReturnValue(false);
      await expect(mcpServer.sendFunds('mdnt1recipient_address', '100')).rejects.toThrow('Wallet is not ready');
    });

    it('should throw an error if the underlying wallet call fails', async () => {
      mockWallet.isReady.mockReturnValue(true);
      mockWallet.initiateSendFunds.mockRejectedValue(new Error('Internal wallet error'));
      await expect(mcpServer.sendFunds('addr', '10')).rejects.toThrow('Failed to submit transaction');
    });
  });

  describe('sendFundsAndWait', () => {
    it('should send funds and wait for the transaction to be submitted', async () => {
      mockWallet.isReady.mockReturnValue(true);
      mockWallet.sendFunds.mockResolvedValue({
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
      mockWallet.isReady.mockReturnValue(false);
      await expect(mcpServer.sendFundsAndWait('mdnt1recipient_address', '100')).rejects.toThrow('Wallet is not ready');
    });

    it('should log and throw when wallet.sendFunds fails', async () => {
      // Arrange: create instance
      const mcp = new WalletServiceMCP(NetworkId.TestNet, 'seed', 'walletFile');
      // Mock isReady to return true
      jest.spyOn(mcp, 'isReady').mockReturnValue(true);
      // Mock logger
      mcp['logger'] = { error: jest.fn() } as any;
      // Mock wallet.sendFunds to throw
      mcp['wallet'] = {
        sendFunds: () => Promise.reject(new Error('fail'))
      } as any;

      // Act & Assert
      await expect(mcp.sendFundsAndWait('addr', '1')).rejects.toThrow('Failed to submit transaction');
      expect(mcp['logger'].error).toHaveBeenCalledWith('Failed to send funds', expect.any(Error));
    });
  });

  describe('getTransactionStatus', () => {
    it('should return the transaction status', () => {
      mockWallet.isReady.mockReturnValue(true);
      mockWallet.getTransactionStatus.mockReturnValue({
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
      const result = mcpServer.getTransactionStatus('mock_tx_id');
      expect(result).toEqual({
        transaction: expect.objectContaining({
          id: 'mock_tx_id',
          state: 'sent',
          fromAddress: 'mdnt1test_address123456789',
          toAddress: 'mdnt1recipient_address',
          amount: '100',
          txIdentifier: 'mock_tx_hash',
          createdAt: expect.any(Number),
          updatedAt: expect.any(Number)
        }),
        blockchainStatus: expect.objectContaining({
          exists: true,
          syncStatus: expect.objectContaining({
            syncedIndices: '10',
            lag: expect.objectContaining({
              applyGap: '0',
              sourceGap: '0'
            }),
            isFullySynced: true
          })
        })
      });
    });

    it('should throw an error if the wallet is not ready', () => {
      mockWallet.isReady.mockReturnValue(false);
      expect(() => mcpServer.getTransactionStatus('mock_tx_id')).toThrow('Wallet is not ready');
    });

    it('should throw TX_NOT_FOUND error if transaction does not exist', () => {
      mockWallet.isReady.mockReturnValue(true);
      mockWallet.getTransactionStatus.mockReturnValue(null as any);
      try {
        mcpServer.getTransactionStatus('nonexistent_id');
        fail('Expected an error to be thrown');
      } catch (error:any) {
        expect(error).toBeInstanceOf(WalletServiceError);
        expect(error.type).toBe(WalletServiceErrorType.TX_NOT_FOUND);
      }
    });

    it('should log and throw when wallet.getTransactionStatus fails', () => {
      const mcp = new WalletServiceMCP(NetworkId.TestNet, 'seed', 'walletFile');
      jest.spyOn(mcp, 'isReady').mockReturnValue(true);
      mcp['logger'] = { error: jest.fn() } as any;
      mcp['wallet'] = {
        getTransactionStatus: jest.fn(() => { throw new Error('fail'); })
      } as any;

      expect(() => mcp.getTransactionStatus('txid')).toThrow('Failed to get transaction status: Error: fail');
      expect(mcp['logger'].error).toHaveBeenCalledWith('Failed to get transaction status for txid', expect.any(Error));
    });

    it('should log and throw when wallet.getTransactionStatus fails with non-Error', () => {
      const mcp = new WalletServiceMCP(NetworkId.TestNet, 'seed', 'walletFile');
      jest.spyOn(mcp, 'isReady').mockReturnValue(true);
      mcp['logger'] = { error: jest.fn() } as any;
      mcp['wallet'] = {
        getTransactionStatus: jest.fn(() => { throw 'string-error'; }) // Not an Error instance
      } as any;

      expect(() => mcp.getTransactionStatus('txid')).toThrow('Failed to get transaction status: string-error');
      expect(mcp['logger'].error).toHaveBeenCalledWith('Failed to get transaction status for txid', 'string-error');
    });
  });

  describe('confirmTransactionHasBeenReceived', () => {
    it('should verify if a transaction has been received', () => {
      mockWallet.isReady.mockReturnValue(true);
      mockWallet.hasReceivedTransactionByIdentifier.mockReturnValue({
        exists: true,
        syncStatus: {
          syncedIndices: '10',
          lag: {
            applyGap: '0',
            sourceGap: '0'
          },
          isFullySynced: true
        },
        transactionAmount: '100'
      });
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
        },
        transactionAmount: '100'
      });
    });

    it('should throw an error if the wallet is not ready', () => {
      mockWallet.isReady.mockReturnValue(false);
      expect(() => mcpServer.confirmTransactionHasBeenReceived('mock_tx_hash')).toThrow('Wallet is not ready');
    });

    it('should return exists: false if transaction is not found', () => {
      mockWallet.isReady.mockReturnValue(true);
      mockWallet.hasReceivedTransactionByIdentifier.mockReturnValue({
        exists: false,
        syncStatus: {
          syncedIndices: '10',
          lag: {
            applyGap: '0',
            sourceGap: '0'
          },
          isFullySynced: true
        }
      });
      const result = mcpServer.confirmTransactionHasBeenReceived('nonexistent_tx');
      expect(result).toEqual({
        exists: false,
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

    it('should re-throw a WalletServiceError if one occurs', () => {
      mockWallet.isReady.mockReturnValue(true);
      mockWallet.hasReceivedTransactionByIdentifier.mockImplementation(() => {
        throw new WalletServiceError(WalletServiceErrorType.WALLET_NOT_READY, "Wallet disconnected");
      });
      expect(() => mcpServer.confirmTransactionHasBeenReceived('mock_tx_hash')).toThrow(WalletServiceError);
    });

    it('should log and throw when wallet.hasReceivedTransactionByIdentifier fails with non-Error', () => {
      const mcp = new WalletServiceMCP(NetworkId.TestNet, 'seed', 'walletFile');
      jest.spyOn(mcp, 'isReady').mockReturnValue(true);
      mcp['logger'] = { error: jest.fn() } as any;
      mcp['wallet'] = {
        hasReceivedTransactionByIdentifier: jest.fn(() => { throw 'not-an-error'; })
      } as any;
      expect(() => mcp.confirmTransactionHasBeenReceived('id')).toThrow('Failed to verify transaction with identifier: not-an-error');
      expect(mcp['logger'].error).toHaveBeenCalledWith('Error verifying transaction by identifier', 'not-an-error');
    });
  });

  describe('close', () => {
    it('should close the wallet successfully', async () => {
      mockWallet.close.mockResolvedValue(undefined);
      await mcpServer.close();
      expect(mockWallet.close).toHaveBeenCalled();
    });

    it('should handle errors during wallet closing', async () => {
      mockWallet.close.mockRejectedValue(new Error('Close error'));
      await expect(mcpServer.close()).resolves.toBeUndefined();
    });

    it('should log error if wallet.close fails', async () => {
      const mcp = new WalletServiceMCP(NetworkId.TestNet, 'seed', 'walletFile');
      mcp['logger'] = { error: jest.fn() } as any;
      mcp['wallet'] = {
        close: jest.fn(() => { throw new Error('fail'); })
      } as any;
      await mcp.close();
      expect(mcp['logger'].error).toHaveBeenCalledWith('Error closing Wallet Service:', expect.any(Error));
    });
  });

  describe('constructor', () => {
    it('should set network ID if provided', () => {
      const testServer = new WalletServiceMCP(
        NetworkId.TestNet,
        'test seed',
        'test-wallet.json'
      );
      expect(testServer).toBeDefined();
    });

    it('should initialize with external config if provided', () => {
      const externalConfig = {
        indexer: 'https://custom-indexer.com',
        indexerWS: 'wss://custom-indexer.com/ws',
        node: 'https://custom-node.com',
        proofServer: 'http://custom-proof.com'
      };
      
      const testServer = new WalletServiceMCP(
        NetworkId.TestNet,
        'test seed',
        'test-wallet.json',
        externalConfig
      );
      expect(testServer).toBeDefined();
    });

    it('should use default agent ID when AGENT_ID environment variable is not set', () => {
      // Store original AGENT_ID
      const originalAgentId = process.env.AGENT_ID;
      
      // Remove AGENT_ID to test fallback
      delete process.env.AGENT_ID;
      
      try {
        const testServer = new WalletServiceMCP(
          NetworkId.TestNet,
          'test seed',
          'test-wallet.json'
        );
        expect(testServer).toBeDefined();
        // Verify that the default value was used by checking internal property
        expect((testServer as any).agentId).toBe('default');
      } finally {
        // Restore original AGENT_ID
        if (originalAgentId !== undefined) {
          process.env.AGENT_ID = originalAgentId;
        }
      }
    });

    it('should use AGENT_ID environment variable when set', () => {
      // Store original AGENT_ID
      const originalAgentId = process.env.AGENT_ID;
      
      // Set a test AGENT_ID
      process.env.AGENT_ID = 'test-agent-123';
      
      try {
        const testServer = new WalletServiceMCP(
          NetworkId.TestNet,
          'test seed',
          'test-wallet.json'
        );
        expect(testServer).toBeDefined();
        // Verify that the environment variable value was used
        expect((testServer as any).agentId).toBe('test-agent-123');
      } finally {
        // Restore original AGENT_ID
        if (originalAgentId !== undefined) {
          process.env.AGENT_ID = originalAgentId;
        } else {
          delete process.env.AGENT_ID;
        }
      }
    });
  });

  describe('getWalletConfig', () => {
    it('should return the external config when provided', () => {
      const externalConfig = {
        indexer: 'https://test-indexer.com',
        indexerWS: 'wss://test-indexer.com/ws',
        node: 'https://test-node.com',
        proofServer: 'http://test-proof.com',
        useExternalProofServer: true,
        networkId: NetworkId.TestNet
      };
      
      const testServer = new WalletServiceMCP(
        NetworkId.TestNet,
        'test seed',
        'test-wallet.json',
        externalConfig
      );
      
      const config = testServer.getWalletConfig();
      expect(config).toEqual(externalConfig);
    });

    it('should return the default config when no external config is provided', () => {
      const testServer = new WalletServiceMCP(
        NetworkId.TestNet,
        'test seed',
        'test-wallet.json'
      );
      
      const config = testServer.getWalletConfig();
      expect(config).toBeDefined();
      // Should return the default TestnetRemoteConfig or similar
      expect(typeof config).toBe('object');
      expect(config).toHaveProperty('indexer');
      expect(config).toHaveProperty('indexerWS');
      expect(config).toHaveProperty('node');
      expect(config).toHaveProperty('proofServer');
    });

    it('should return exactly the partial external config when provided', () => {
      const partialConfig = {
        indexer: 'https://custom-indexer-only.com'
      };
      
      const testServer = new WalletServiceMCP(
        NetworkId.TestNet,
        'test seed',
        'test-wallet.json',
        partialConfig as any
      );
      
      const config = testServer.getWalletConfig();
      expect(config).toEqual(partialConfig);
      expect(config.indexer).toBe('https://custom-indexer-only.com');
      // Should only have the properties that were provided in partialConfig
      expect(Object.keys(config)).toHaveLength(1);
      expect(config).not.toHaveProperty('indexerWS');
      expect(config).not.toHaveProperty('node');
      expect(config).not.toHaveProperty('proofServer');
    });
  });

  describe('getTransactions', () => {
    it('should log and throw when wallet.getTransactions fails', () => {
      const mcp = new WalletServiceMCP(NetworkId.TestNet, 'seed', 'walletFile');
      jest.spyOn(mcp, 'isReady').mockReturnValue(true);
      mcp['logger'] = { error: jest.fn() } as any;
      mcp['wallet'] = {
        getTransactions: jest.fn(() => { throw new Error('fail'); })
      } as any;

      expect(() => mcp.getTransactions()).toThrow('Failed to get transactions: Error: fail');
      expect(mcp['logger'].error).toHaveBeenCalledWith('Failed to get transactions', expect.any(Error));
    });

    it('should throw if not ready in getTransactions', () => {
      const mcp = new WalletServiceMCP(NetworkId.TestNet, 'seed', 'walletFile');
      jest.spyOn(mcp, 'isReady').mockReturnValue(false);
      expect(() => mcp.getTransactions()).toThrow('Wallet is not ready');
    });

    it('should log and throw when wallet.getTransactions fails with non-Error', () => {
      const mcp = new WalletServiceMCP(NetworkId.TestNet, 'seed', 'walletFile');
      jest.spyOn(mcp, 'isReady').mockReturnValue(true);
      mcp['logger'] = { error: jest.fn() } as any;
      mcp['wallet'] = {
        getTransactions: jest.fn(() => { throw 123; }) // Not an Error instance
      } as any;
      expect(() => mcp.getTransactions()).toThrow('Failed to get transactions: 123');
      expect(mcp['logger'].error).toHaveBeenCalledWith('Failed to get transactions', 123);
    });
  });

  describe('getPendingTransactions', () => {
    it('should throw if not ready in getPendingTransactions', () => {
      const mcp = new WalletServiceMCP(NetworkId.TestNet, 'seed', 'walletFile');
      jest.spyOn(mcp, 'isReady').mockReturnValue(false);
      expect(() => mcp.getPendingTransactions()).toThrow('Wallet is not ready');
    });

    it('should log and throw when wallet.getPendingTransactions fails', () => {
      const mcp = new WalletServiceMCP(NetworkId.TestNet, 'seed', 'walletFile');
      jest.spyOn(mcp, 'isReady').mockReturnValue(true);
      mcp['logger'] = { error: jest.fn() } as any;
      mcp['wallet'] = {
        getPendingTransactions: jest.fn(() => { throw new Error('fail'); })
      } as any;
      expect(() => mcp.getPendingTransactions()).toThrow('Failed to get pending transactions: Error: fail');
      expect(mcp['logger'].error).toHaveBeenCalledWith('Failed to get pending transactions', expect.any(Error));
    });

    it('should log and throw when wallet.getPendingTransactions fails with non-Error', () => {
      const mcp = new WalletServiceMCP(NetworkId.TestNet, 'seed', 'walletFile');
      jest.spyOn(mcp, 'isReady').mockReturnValue(true);
      mcp['logger'] = { error: jest.fn() } as any;
      mcp['wallet'] = {
        getPendingTransactions: jest.fn(() => { throw 456; }) // Not an Error instance
      } as any;
      expect(() => mcp.getPendingTransactions()).toThrow('Failed to get pending transactions: 456');
      expect(mcp['logger'].error).toHaveBeenCalledWith('Failed to get pending transactions', 456);
    });
  });

  describe('getWalletStatus', () => {
    
    it('should log and throw when wallet.getWalletStatus fails', () => {
      const mcp = new WalletServiceMCP(NetworkId.TestNet, 'seed', 'walletFile');
      mcp['logger'] = { error: jest.fn() } as any;
      mcp['wallet'] = {
        getWalletStatus: jest.fn(() => { throw new Error('fail'); })
      } as any;
      expect(() => mcp.getWalletStatus()).toThrow('Failed to retrieve wallet status: Error: fail');
      expect(mcp['logger'].error).toHaveBeenCalledWith('Error getting wallet status', expect.any(Error));
    });

    it('should log and throw when wallet.getWalletStatus fails with non-Error', () => {
      const mcp = new WalletServiceMCP(NetworkId.TestNet, 'seed', 'walletFile');
      mcp['logger'] = { error: jest.fn() } as any;
      mcp['wallet'] = {
        getWalletStatus: jest.fn(() => { throw 'fail-string'; })
      } as any;
      expect(() => mcp.getWalletStatus()).toThrow('Failed to retrieve wallet status: fail-string');
      expect(mcp['logger'].error).toHaveBeenCalledWith('Error getting wallet status', 'fail-string');
    });
  });
});

describe('createSimpleToolHandler', () => {
  it('returns string result', async () => {
    const handler = createSimpleToolHandler(() => 'hello');
    const result = await handler();
    expect(result.content[0].text).toBe('hello');
  });

  it('returns object result as JSON', async () => {
    const handler = createSimpleToolHandler(() => ({ foo: 'bar' }));
    const result = await handler();
    expect(result.content[0].text).toBe(JSON.stringify({ foo: 'bar' }, null, 2));
  });

  it('handles WalletServiceError', async () => {
    const handler = createSimpleToolHandler(() => {
      throw new WalletServiceError(WalletServiceErrorType.WALLET_NOT_READY, 'Wallet is not ready');
    });
    const result = await handler();
    expect(result.content[0].text).toBe('Wallet is not ready yet. Please try again later.');
  });

  it('throws non-WalletServiceError', async () => {
    const handler = createSimpleToolHandler(() => {
      throw new Error('Other error');
    });
    await expect(handler()).rejects.toThrow('Other error');
  });
});

describe('handleWalletServiceError', () => {
  it('returns error.message if type is not in ERROR_MESSAGES', () => {
    // @ts-ignore: purposely using a type not in ERROR_MESSAGES
    const error = new WalletServiceError('UNKNOWN_TYPE', 'Custom message');
    const result = handleWalletServiceError(error);
    expect(result.content[0].text).toBe('Custom message');
  });

  it('returns default message if type and message are missing', () => {
    // @ts-ignore: purposely omitting message
    const error = new WalletServiceError('UNKNOWN_TYPE');
    // Remove message property to simulate missing message
    delete (error as any).message;
    const result = handleWalletServiceError(error);
    expect(result.content[0].text).toBe('An unexpected error occurred.');
  });
});

describe('createParameterizedToolHandler', () => {
  it('returns string result', async () => {
    const handler = createParameterizedToolHandler<{ foo: string }>((args) => `Hello, ${args.foo}`);
    const result = await handler({ foo: 'World' });
    expect(result.content[0].text).toBe('Hello, World');
  });

  it('returns object result as JSON', async () => {
    const handler = createParameterizedToolHandler<{ bar: number }>((args) => ({ bar: args.bar }));
    const result = await handler({ bar: 42 });
    expect(result.content[0].text).toBe(JSON.stringify({ bar: 42 }, null, 2));
  });

  it('handles WalletServiceError', async () => {
    const handler = createParameterizedToolHandler(() => {
      throw new WalletServiceError(WalletServiceErrorType.WALLET_NOT_READY, 'Wallet is not ready');
    });
    const result = await handler({});
    expect(result.content[0].text).toBe('Wallet is not ready yet. Please try again later.');
  });

  it('throws non-WalletServiceError', async () => {
    const handler = createParameterizedToolHandler(() => {
      throw new Error('Other error');
    });
    await expect(handler({})).rejects.toThrow('Other error');
  });
});

describe('formatError', () => {
  it('should format Error instances with name and message', () => {
    const error = new Error('Test error message');
    error.name = 'TestError';
    const result = formatError(error);
    expect(result).toBe('TestError: Test error message');
  });

  it('should handle Error instances with default name', () => {
    const error = new Error('Test message');
    const result = formatError(error);
    expect(result).toBe('Error: Test message');
  });

  it('should handle custom Error subclasses', () => {
    class CustomError extends Error {
      constructor(message: string) {
        super(message);
        this.name = 'CustomError';
      }
    }
    const error = new CustomError('Custom error message');
    const result = formatError(error);
    expect(result).toBe('CustomError: Custom error message');
  });

  it('should convert non-Error values to string', () => {
    const result = formatError('string error');
    expect(result).toBe('string error');
  });

  it('should handle null values', () => {
    const result = formatError(null);
    expect(result).toBe('null');
  });

  it('should handle undefined values', () => {
    const result = formatError(undefined);
    expect(result).toBe('undefined');
  });

  it('should handle number values', () => {
    const result = formatError(42);
    expect(result).toBe('42');
  });

  it('should handle boolean values', () => {
    const result = formatError(false);
    expect(result).toBe('false');
  });

  it('should handle object values', () => {
    const obj = { key: 'value' };
    const result = formatError(obj);
    expect(result).toBe('[object Object]');
  });

  it('should handle array values', () => {
    const arr = [1, 2, 3];
    const result = formatError(arr);
    expect(result).toBe('1,2,3');
  });
}); 