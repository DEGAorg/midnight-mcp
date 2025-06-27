// Mock dependencies - must be at the very top
jest.mock('@midnight-ntwrk/wallet');
jest.mock('@midnight-ntwrk/ledger');
jest.mock('@midnight-ntwrk/midnight-js-network-id');
jest.mock('../../../src/utils/file-manager');
jest.mock('../../../src/logger');

import { describe, it, beforeAll, afterAll, beforeEach, afterEach, jest, expect } from '@jest/globals';
import { WalletServiceMCP, WalletServiceErrorType, WalletServiceError } from '../../../src/mcp/index.js';
import { NetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { fail } from 'assert';
import { __mockWallet as mockWalletData } from '../__mocks__/wallet';
import { TransactionState } from '../../../src/types/wallet.js';

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
  });
}); 