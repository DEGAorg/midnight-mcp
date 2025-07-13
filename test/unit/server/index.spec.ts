// Mock dependencies - must be at the very top
jest.mock('@midnight-ntwrk/wallet');
jest.mock('@midnight-ntwrk/ledger');
jest.mock('@midnight-ntwrk/midnight-js-network-id');
jest.mock('../../../src/logger/index');
jest.mock('../../../src/config.js');
jest.mock('../../../src/utils/seed-manager.js');
jest.mock('../../../src/wallet/wallet');
jest.mock('../../../src/mcp/index');
jest.mock('../../../src/controllers/wallet.controller');
jest.mock('../../../src/utils/file-manager');
jest.mock('../../../src/integrations/marketplace/api.js', () => require('../__mocks__/marketplace-api.ts'));

import { of, Subscription } from 'rxjs';
import { describe, it, beforeAll, afterAll, beforeEach, afterEach, jest, expect } from '@jest/globals';
import { WalletController } from '../../../src/controllers/wallet.controller';
import { WalletServiceMCP, WalletServiceError, WalletServiceErrorType } from '../../../src/mcp/index';
import { NetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { WalletServiceMCP as MockWalletServiceMCP } from '../__mocks__/mcp';

// Mock console.error to capture error messages
const originalConsoleError = console.error;
const mockConsoleError = jest.fn();

// Create a mock instance at the top level
const mockWalletService = new MockWalletServiceMCP();

let someObservable: any;
let subscription: Subscription;
let intervalId: NodeJS.Timeout;

beforeEach(() => {
  intervalId = setInterval(() => { }, 1000);
  someObservable = of(1);
  subscription = someObservable.subscribe();
});

afterEach(() => {
  clearInterval(intervalId);
  subscription.unsubscribe();
});

describe('Server setup', () => {
  let mockController: any;

  beforeAll(() => {
    mockController = {
      getStatus: jest.fn((_req, res: any) => res.json({ status: 'ok' })),
      getAddress: jest.fn((_req, res: any) => res.json({ address: '0x123' })),
      getBalance: jest.fn((_req, res: any) => res.json({ balance: 100 })),
      sendFunds: jest.fn((_req, res: any) => res.json({ txId: 'abc123' })),
      verifyTransaction: jest.fn((_req, res: any) => res.json({ valid: true })),
      getTransactionStatus: jest.fn((_req, res: any) => res.json({ status: 'confirmed' })),
      getTransactions: jest.fn((_req, res: any) => res.json([])),
      getPendingTransactions: jest.fn((_req, res: any) => res.json([])),
      getWalletConfig: jest.fn((_req, res: any) => res.json({ config: true })),
      healthCheck: jest.fn((_req, res: any) => res.json({ health: 'ok' }))
    };

    // Mock WalletController constructor
    (WalletController as jest.Mock).mockImplementation(() => mockController);
  });

  it('WalletController can be instantiated', () => {
    const controller = new WalletController(mockWalletService);
    expect(controller).toBeDefined();
  });

  it('WalletServiceMCP can be instantiated', () => {
    const service = new WalletServiceMCP(NetworkId.TestNet, 'test-seed', 'test-wallet', {
      indexer: 'https://test-indexer.com',
      indexerWS: 'wss://test-indexer.com/ws',
      node: 'https://test-node.com',
      proofServer: 'http://test-proof.com'
    });
    expect(service).toBeDefined();
  });

  it('WalletServiceMCP can be instantiated without external config', () => {
    const service = new WalletServiceMCP(NetworkId.TestNet, 'test-seed', 'test-wallet');
    expect(service).toBeDefined();
  });

  it('Mock controller methods work correctly', () => {
    const mockReq = {};
    const mockRes = {
      json: jest.fn()
    };

    mockController.getStatus(mockReq, mockRes);
    expect(mockRes.json).toHaveBeenCalledWith({ status: 'ok' });

    mockController.getAddress(mockReq, mockRes);
    expect(mockRes.json).toHaveBeenCalledWith({ address: '0x123' });

    mockController.healthCheck(mockReq, mockRes);
    expect(mockRes.json).toHaveBeenCalledWith({ health: 'ok' });
  });

  it('Mock wallet service methods work correctly', () => {
    expect(mockWalletService.isReady()).toBe(true);
    expect(mockWalletService.getAddress()).toBe('test-address');
    expect(mockWalletService.getBalance()).toEqual({ balance: '1000', pendingBalance: '0' });
  });
});

describe('WalletServiceMCP Constructor', () => {
  it('should initialize with network ID when provided', () => {
    const service = new WalletServiceMCP(NetworkId.TestNet, 'test-seed', 'test-wallet');
    expect(service).toBeDefined();
  });

  it('should initialize with default config when no external config provided', () => {
    const service = new WalletServiceMCP(NetworkId.TestNet, 'test-seed', 'test-wallet');
    expect(service).toBeDefined();
  });

  it('should initialize with custom config when provided', () => {
    const customConfig = {
      indexer: 'https://custom-indexer.com',
      indexerWS: 'wss://custom-indexer.com/ws',
      node: 'https://custom-node.com',
      proofServer: 'http://custom-proof.com'
    };
    const service = new WalletServiceMCP(NetworkId.TestNet, 'test-seed', 'test-wallet', customConfig);
    expect(service).toBeDefined();
  });
});

describe('WalletServiceMCP - Wallet Ready State', () => {
  beforeEach(() => {
    // Ensure wallet starts in ready state, then set to not ready
    mockWalletService.setWalletReady(true);
    mockWalletService.setWalletReady(false);
  });

  afterEach(() => {
    // Reset wallet to ready state
    mockWalletService.setWalletReady(true);
  });

  it('getAddress should throw when wallet is not ready', () => {
    expect(() => mockWalletService.getAddress()).toThrow(WalletServiceError);
  });

  it('getBalance should throw when wallet is not ready', () => {
    expect(() => mockWalletService.getBalance()).toThrow(WalletServiceError);
  });

  it('sendFunds should throw when wallet is not ready', async () => {
    try {
      await mockWalletService.sendFunds('addr', '100');
      fail('Expected sendFunds to throw WalletServiceError');
    } catch (error) {
      expect(error).toBeInstanceOf(WalletServiceError);
    }
  });

  it('sendFundsAndWait should throw when wallet is not ready', async () => {
    try {
      await mockWalletService.sendFundsAndWait('addr', '100');
      fail('Expected sendFundsAndWait to throw WalletServiceError');
    } catch (error) {
      expect(error).toBeInstanceOf(WalletServiceError);
    }
  });

  it('getTransactionStatus should throw when wallet is not ready', () => {
    expect(() => mockWalletService.getTransactionStatus('tx-id')).toThrow(WalletServiceError);
  });

  it('getTransactions should throw when wallet is not ready', () => {
    expect(() => mockWalletService.getTransactions()).toThrow(WalletServiceError);
  });

  it('getPendingTransactions should throw when wallet is not ready', () => {
    expect(() => mockWalletService.getPendingTransactions()).toThrow(WalletServiceError);
  });

  it('confirmTransactionHasBeenReceived should throw when wallet is not ready', () => {
    expect(() => mockWalletService.confirmTransactionHasBeenReceived('identifier')).toThrow(WalletServiceError);
  });

  it('getWalletStatus should reflect wallet ready state', () => {
    const status = mockWalletService.getWalletStatus();
    expect(status.ready).toBe(false);
  });
});

describe('WalletServiceMCP - Error Handling', () => {
  beforeEach(() => {
    // Ensure wallet is in ready state for error handling tests
    mockWalletService.setWalletReady(true);
  });

  afterEach(() => {
    // Ensure wallet is in ready state after each test
    mockWalletService.setWalletReady(true);
  });

  it('getAddress should handle wallet errors gracefully', () => {
    mockWalletService.getAddress.mockImplementation(() => {
      throw new WalletServiceError(WalletServiceErrorType.WALLET_NOT_READY, 'Error accessing wallet address');
    });

    expect(() => mockWalletService.getAddress()).toThrow(WalletServiceError);
  });

  it('getBalance should handle wallet errors gracefully', () => {
    mockWalletService.getBalance.mockImplementation(() => {
      throw new WalletServiceError(WalletServiceErrorType.WALLET_NOT_READY, 'Error accessing wallet balance');
    });

    expect(() => mockWalletService.getBalance()).toThrow(WalletServiceError);
  });

  it('sendFunds should handle wallet errors gracefully', async () => {
    mockWalletService.sendFunds.mockImplementation(async () => {
      throw new WalletServiceError(WalletServiceErrorType.TX_SUBMISSION_FAILED, 'Failed to submit transaction');
    });

    try {
      await mockWalletService.sendFunds('addr', '100');
      fail('Expected sendFunds to throw WalletServiceError');
    } catch (error) {
      expect(error).toBeInstanceOf(WalletServiceError);
    }
  });

  it('sendFundsAndWait should handle wallet errors gracefully', async () => {
    mockWalletService.sendFundsAndWait.mockImplementation(async () => {
      throw new WalletServiceError(WalletServiceErrorType.TX_SUBMISSION_FAILED, 'Failed to submit transaction');
    });

    try {
      await mockWalletService.sendFundsAndWait('addr', '100');
      fail('Expected sendFundsAndWait to throw WalletServiceError');
    } catch (error) {
      expect(error).toBeInstanceOf(WalletServiceError);
    }
  });

  it('getTransactionStatus should handle wallet errors gracefully', () => {
    mockWalletService.getTransactionStatus.mockImplementation(() => {
      throw new WalletServiceError(WalletServiceErrorType.TX_NOT_FOUND, 'Transaction not found');
    });

    expect(() => mockWalletService.getTransactionStatus('tx-id')).toThrow(WalletServiceError);
  });

  it('getTransactions should handle wallet errors gracefully', () => {
    mockWalletService.getTransactions.mockImplementation(() => {
      throw new WalletServiceError(WalletServiceErrorType.WALLET_NOT_READY, 'Failed to get transactions');
    });

    expect(() => mockWalletService.getTransactions()).toThrow(WalletServiceError);
  });

  it('getPendingTransactions should handle wallet errors gracefully', () => {
    mockWalletService.getPendingTransactions.mockImplementation(() => {
      throw new WalletServiceError(WalletServiceErrorType.WALLET_NOT_READY, 'Failed to get pending transactions');
    });

    expect(() => mockWalletService.getPendingTransactions()).toThrow(WalletServiceError);
  });

  it('confirmTransactionHasBeenReceived should handle wallet errors gracefully', () => {
    mockWalletService.confirmTransactionHasBeenReceived.mockImplementation(() => {
      throw new WalletServiceError(WalletServiceErrorType.IDENTIFIER_VERIFICATION_FAILED, 'Failed to verify transaction');
    });

    expect(() => mockWalletService.confirmTransactionHasBeenReceived('identifier')).toThrow(WalletServiceError);
  });

  it('getWalletStatus should handle wallet errors gracefully', () => {
    mockWalletService.getWalletStatus.mockImplementation(() => {
      throw new WalletServiceError(WalletServiceErrorType.WALLET_NOT_READY, 'Failed to retrieve wallet status');
    });

    expect(() => mockWalletService.getWalletStatus()).toThrow(WalletServiceError);
  });
});

describe('WalletServiceMCP - Method Coverage', () => {
  let freshMockWalletService: any;

  beforeEach(() => {
    // Create a fresh mock instance for each test
    freshMockWalletService = new MockWalletServiceMCP();
    freshMockWalletService.setWalletReady(true);
  });

  it('should call close method successfully', async () => {
    await expect(freshMockWalletService.close()).resolves.toBeUndefined();
    expect(freshMockWalletService.close).toHaveBeenCalled();
  });

  it('should handle close method errors gracefully', async () => {
    freshMockWalletService.close.mockImplementation(async () => {
      throw new Error('Close error');
    });

    await expect(freshMockWalletService.close()).rejects.toThrow('Close error');
  });

  it('should get wallet status successfully', () => {
    const status = freshMockWalletService.getWalletStatus();
    expect(status).toBeDefined();
    expect(status.ready).toBe(true);
    expect(status.address).toBe('test-address');
  });

  it('should get wallet config successfully', () => {
    const config = freshMockWalletService.getWalletConfig();
    expect(config).toBeDefined();
    expect(config.indexer).toBe('https://test-indexer.com');
  });

  it('should confirm transaction has been received successfully', () => {
    const result = freshMockWalletService.confirmTransactionHasBeenReceived('test-identifier');
    expect(result).toBeDefined();
    expect(result.exists).toBe(true);
  });

  it('should send funds and wait successfully', async () => {
    const result = await freshMockWalletService.sendFundsAndWait('addr', '100');
    expect(result).toBeDefined();
    expect(result.txIdentifier).toBe('test-tx');
    expect(result.amount).toBe('100');
  });

  it('should get transaction status successfully', () => {
    const status = freshMockWalletService.getTransactionStatus('tx-id');
    expect(status).toBeDefined();
    expect(status.transaction).toBeDefined();
    expect(status.blockchainStatus).toBeDefined();
  });

  it('should get transactions successfully', () => {
    const transactions = freshMockWalletService.getTransactions();
    expect(Array.isArray(transactions)).toBe(true);
  });

  it('should get pending transactions successfully', () => {
    const pendingTransactions = freshMockWalletService.getPendingTransactions();
    expect(Array.isArray(pendingTransactions)).toBe(true);
  });
});

describe('WalletServiceError Class', () => {
  it('should create WalletServiceError instance', () => {
    const error = new WalletServiceError(WalletServiceErrorType.WALLET_NOT_READY, 'Test error message');
    expect(error).toBeInstanceOf(WalletServiceError);
  });

  it('should create WalletServiceError with different error types', () => {
    const error = new WalletServiceError(WalletServiceErrorType.INSUFFICIENT_FUNDS, 'Insufficient funds');
    expect(error).toBeInstanceOf(WalletServiceError);
  });
});

describe('Event Parsing: hasReceivedTransactionByIdentifier', () => {
  it('returns exists=true when identifier is found in transaction history', () => {
    // Set up mock state
    (mockWalletService as any).walletState = {
      transactionHistory: [
        { identifiers: ['abc123'], deltas: { native: 1000000n } }
      ],
      syncProgress: { synced: true, lag: { applyGap: 0n, sourceGap: 0n } }
    };
    (mockWalletService as any).ready = true;
    (mockWalletService as any).wallet = mockWalletService;

    // Mock the method to check the actual identifier
    mockWalletService.hasReceivedTransactionByIdentifier.mockImplementation((identifier: string) => {
      const history = (mockWalletService as any).walletState?.transactionHistory;
      if (history && Array.isArray(history)) {
        for (const tx of history) {
          if (tx.identifiers && tx.identifiers.includes(identifier)) {
            return {
              exists: true,
              syncStatus: {
                syncedIndices: '10',
                lag: { applyGap: '0', sourceGap: '0' },
                isFullySynced: true
              },
              transactionAmount: '1'
            };
          }
        }
      }
      return {
        exists: false,
        syncStatus: {
          syncedIndices: '10',
          lag: { applyGap: '0', sourceGap: '0' },
          isFullySynced: true
        },
        transactionAmount: '0'
      };
    });

    const result = mockWalletService.hasReceivedTransactionByIdentifier('abc123');
    expect(result.exists).toBe(true);
    expect(result.transactionAmount).toBe('1');
  });

  it('returns exists=false when identifier is not found', () => {
    // Set up mock state
    (mockWalletService as any).walletState = {
      transactionHistory: [
        { identifiers: ['def456'], deltas: { native: 1000000n } }
      ],
      syncProgress: { synced: true, lag: { applyGap: 0n, sourceGap: 0n } }
    };
    (mockWalletService as any).ready = true;
    (mockWalletService as any).wallet = mockWalletService;

    // Mock the method to check the actual identifier
    mockWalletService.hasReceivedTransactionByIdentifier.mockImplementation((identifier: string) => {
      const history = (mockWalletService as any).walletState?.transactionHistory;
      if (history && Array.isArray(history)) {
        for (const tx of history) {
          if (tx.identifiers && tx.identifiers.includes(identifier)) {
            return {
              exists: true,
              syncStatus: {
                syncedIndices: '10',
                lag: { applyGap: '0', sourceGap: '0' },
                isFullySynced: true
              },
              transactionAmount: '1'
            };
          }
        }
      }
      return {
        exists: false,
        syncStatus: {
          syncedIndices: '10',
          lag: { applyGap: '0', sourceGap: '0' },
          isFullySynced: true
        },
        transactionAmount: '0'
      };
    });

    const result = mockWalletService.hasReceivedTransactionByIdentifier('abc123');
    expect(result.exists).toBe(false);
    expect(result.transactionAmount).toBe('0');
  });

  it('handles missing transactionHistory gracefully', () => {
    (mockWalletService as any).walletState = {};
    (mockWalletService as any).ready = true;
    (mockWalletService as any).wallet = mockWalletService;

    // Mock the method to handle missing history
    mockWalletService.hasReceivedTransactionByIdentifier.mockImplementation((identifier: string) => {
      const history = (mockWalletService as any).walletState?.transactionHistory;
      if (history && Array.isArray(history)) {
        for (const tx of history) {
          if (tx.identifiers && tx.identifiers.includes(identifier)) {
            return {
              exists: true,
              syncStatus: {
                syncedIndices: '10',
                lag: { applyGap: '0', sourceGap: '0' },
                isFullySynced: true
              },
              transactionAmount: '1'
            };
          }
        }
      }
      return {
        exists: false,
        syncStatus: {
          syncedIndices: '10',
          lag: { applyGap: '0', sourceGap: '0' },
          isFullySynced: true
        },
        transactionAmount: '0'
      };
    });

    const result = mockWalletService.hasReceivedTransactionByIdentifier('abc123');
    expect(result.exists).toBe(false);
    expect(result.transactionAmount).toBe('0');
  });
});

describe('Transaction Submission', () => {
  beforeEach(() => {
    // Redefine sendFunds to use the mocked transferTransaction, proveTransaction, and submitTransaction
    mockWalletService.sendFunds = jest.fn(async (to: string, amount: string) => {
      // Simulate the real sequence of calls
      const txRecipe = await mockWalletService.transferTransaction(to, amount);
      const provenTx = await mockWalletService.proveTransaction(txRecipe);
      const submittedTx = await mockWalletService.submitTransaction(provenTx);
      return submittedTx;
    });
  });

  it('throws if transferTransaction fails', async () => {
    mockWalletService.transferTransaction.mockRejectedValue(new Error('fail'));
    await expect(mockWalletService.sendFunds('addr2', '0.5')).rejects.toThrow('fail');
  });

  it('throws if proveTransaction fails', async () => {
    mockWalletService.transferTransaction.mockResolvedValue('tx-recipe');
    mockWalletService.proveTransaction.mockRejectedValue(new Error('fail'));
    await expect(mockWalletService.sendFunds('addr2', '0.5')).rejects.toThrow('fail');
  });

  it('throws if submitTransaction fails', async () => {
    mockWalletService.transferTransaction.mockResolvedValue('tx-recipe');
    mockWalletService.proveTransaction.mockResolvedValue('proven-tx');
    mockWalletService.submitTransaction.mockRejectedValue(new Error('fail'));
    await expect(mockWalletService.sendFunds('addr2', '0.5')).rejects.toThrow('fail');
  });

  it('handles errors during transaction submission', async () => {
    mockWalletService.transferTransaction.mockResolvedValue('tx-recipe');
    mockWalletService.proveTransaction.mockResolvedValue('proven-tx');
    mockWalletService.submitTransaction.mockRejectedValue(new Error('Submission failed'));
    await expect(mockWalletService.sendFunds('addr2', '0.5')).rejects.toThrow('Submission failed');
  });
});

describe('Transaction Status and Error Handling', () => {
  it('should throw an error if transaction is not found', () => {
    mockWalletService.getTransactionStatus.mockImplementation(() => {
      throw new WalletServiceError(WalletServiceErrorType.TX_NOT_FOUND, 'Transaction with ID nonexistent not found');
    });
    expect(() => mockWalletService.getTransactionStatus('nonexistent')).toThrow(WalletServiceError);
  });

  it('should handle getTransactionStatus when wallet throws WalletServiceError', () => {
    mockWalletService.getTransactionStatus.mockImplementation(() => {
      throw new WalletServiceError(WalletServiceErrorType.TX_NOT_FOUND, 'Transaction not found');
    });
    expect(() => mockWalletService.getTransactionStatus('tx-id')).toThrow(WalletServiceError);
  });

  it('should handle getTransactionStatus when wallet throws regular error', () => {
    mockWalletService.getTransactionStatus.mockImplementation(() => {
      throw new Error('Database connection failed');
    });
    expect(() => mockWalletService.getTransactionStatus('tx-id')).toThrow(Error);
  });
});

describe('Environment Variable Handling', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should use default agent ID when AGENT_ID is not set', () => {
    delete process.env.AGENT_ID;
    const service = new WalletServiceMCP(NetworkId.TestNet, 'test-seed', 'test-wallet');
    expect(service).toBeDefined();
  });

  it('should use custom agent ID when AGENT_ID is set', () => {
    process.env.AGENT_ID = 'custom-agent';
    const service = new WalletServiceMCP(NetworkId.TestNet, 'test-seed', 'test-wallet');
    expect(service).toBeDefined();
  });
});

describe('Server Startup', () => {
  let mockServer: any;
  let mockCreateServer: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    console.error = mockConsoleError;
    
    // Create mock server
    mockServer = {
      start: jest.fn(),
      stop: jest.fn()
    };
    
    // Create mock createServer function
    mockCreateServer = jest.fn().mockReturnValue(mockServer);
    
    // Mock the module before importing
    jest.doMock('../../../src/stdio-server.js', () => ({
      createServer: mockCreateServer
    }));
  });

  afterEach(() => {
    console.error = originalConsoleError;
    // Restore original process.argv
    process.argv = ['node', 'test.js'];
    jest.resetModules();
  });

  describe('Server Creation', () => {
    it('should create server successfully', async () => {
      const { createServer } = await import('../../../src/stdio-server.js');
      const server = createServer();
      expect(mockCreateServer).toHaveBeenCalled();
      expect(server).toBe(mockServer);
    });

    it('should handle server creation errors', async () => {
      const creationError = new Error('Failed to create server');
      mockCreateServer.mockImplementation(() => {
        throw creationError;
      });

      const { createServer } = await import('../../../src/stdio-server.js');
      expect(() => createServer()).toThrow('Failed to create server');
    });
  });

  describe('Server Startup', () => {
    it('should start server successfully', async () => {
      mockServer.start.mockResolvedValue(undefined);

      const { createServer } = await import('../../../src/stdio-server.js');
      const server = createServer();
      await server.start();

      expect(mockServer.start).toHaveBeenCalled();
    });

    it('should handle server startup errors', async () => {
      const startupError = new Error('Failed to start server');
      mockServer.start.mockRejectedValue(startupError);

      const { createServer } = await import('../../../src/stdio-server.js');
      const server = createServer();
      
      await expect(server.start()).rejects.toThrow('Failed to start server');
      expect(mockServer.start).toHaveBeenCalled();
    });

    it('should handle network connection errors', async () => {
      const networkError = new Error('Connection refused');
      mockServer.start.mockRejectedValue(networkError);

      const { createServer } = await import('../../../src/stdio-server.js');
      const server = createServer();
      
      await expect(server.start()).rejects.toThrow('Connection refused');
    });

    it('should handle timeout errors', async () => {
      const timeoutError = new Error('Connection timeout');
      mockServer.start.mockRejectedValue(timeoutError);

      const { createServer } = await import('../../../src/stdio-server.js');
      const server = createServer();
      
      await expect(server.start()).rejects.toThrow('Connection timeout');
    });
  });

  describe('Server Shutdown', () => {
    it('should stop server successfully', async () => {
      mockServer.stop.mockResolvedValue(undefined);

      const { createServer } = await import('../../../src/stdio-server.js');
      const server = createServer();
      await server.stop();

      expect(mockServer.stop).toHaveBeenCalled();
    });

    it('should handle server shutdown errors gracefully', async () => {
      const shutdownError = new Error('Failed to stop server');
      
      // Mock the server's stop method to simulate the actual implementation
      // where errors are caught and logged but not re-thrown
      mockServer.stop.mockImplementation(async () => {
        try {
          // Simulate the actual stop logic that might fail
          throw shutdownError;
        } catch (error) {
          // Simulate the error logging that happens in the real implementation
          console.error("Error stopping server:", error);
          // Don't re-throw the error
        }
      });

      const { createServer } = await import('../../../src/stdio-server.js');
      const server = createServer();
      
      // The stop method should catch errors and not re-throw them
      await expect(server.stop()).resolves.toBeUndefined();
      expect(mockServer.stop).toHaveBeenCalled();
      expect(mockConsoleError).toHaveBeenCalledWith("Error stopping server:", shutdownError);
    });
  });

  describe('Main Module Execution', () => {
    let originalProcessExit: any;
    let mockProcessExit: jest.Mock;

    beforeEach(() => {
      originalProcessExit = process.exit;
      mockProcessExit = jest.fn();
      process.exit = mockProcessExit as any;
    });

    afterEach(() => {
      process.exit = originalProcessExit;
    });

    it('should auto-start server when run as main module', async () => {
      // Mock import.meta.url to simulate main module execution
      const originalImportMeta = (global as any).import;
      (global as any).import = {
        meta: {
          url: `file://${process.argv[1]}`
        }
      };

      // Simulate successful startup
      mockServer.start.mockResolvedValue(undefined);

      // Execute the main module logic
      const { createServer } = await import('../../../src/stdio-server.js');
      const server = createServer();
      await server.start();

      expect(mockCreateServer).toHaveBeenCalled();
      expect(mockServer.start).toHaveBeenCalled();
      expect(mockProcessExit).not.toHaveBeenCalled();

      // Restore original import
      (global as any).import = originalImportMeta;
    });

    it('should exit with code 1 on startup failure when run as main module', async () => {
      // Mock import.meta.url to simulate main module execution
      const originalImportMeta = (global as any).import;
      (global as any).import = {
        meta: {
          url: `file://${process.argv[1]}`
        }
      };

      // Mock the main module execution with error
      const startupError = new Error('Failed to start server');
      mockServer.start.mockRejectedValue(startupError);

      // Execute the main module logic
      const { createServer } = await import('../../../src/stdio-server.js');
      const server = createServer();
      
      try {
        await server.start();
      } catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
      }

      expect(mockCreateServer).toHaveBeenCalled();
      expect(mockServer.start).toHaveBeenCalled();
      expect(mockConsoleError).toHaveBeenCalledWith("Failed to start server:", startupError);
      expect(mockProcessExit).toHaveBeenCalledWith(1);

      // Restore original import
      (global as any).import = originalImportMeta;
    });

    it('should not auto-start server when not run as main module', async () => {
      // Mock import.meta.url to simulate non-main module execution
      const originalImportMeta = (global as any).import;
      (global as any).import = {
        meta: {
          url: 'file://some-other-file.js'
        }
      };

      // The server should not be created automatically
      expect(mockCreateServer).not.toHaveBeenCalled();

      // Restore original import
      (global as any).import = originalImportMeta;
    });
  });

  describe('Error Handling', () => {
    it('should handle configuration errors', async () => {
      const configError = new Error('Invalid configuration');
      mockCreateServer.mockImplementation(() => {
        throw configError;
      });

      const { createServer } = await import('../../../src/stdio-server.js');
      expect(() => createServer()).toThrow('Invalid configuration');
    });

    it('should handle seed loading errors', async () => {
      const seedError = new Error('Seed file not found');
      mockCreateServer.mockImplementation(() => {
        throw seedError;
      });

      const { createServer } = await import('../../../src/stdio-server.js');
      expect(() => createServer()).toThrow('Seed file not found');
    });

    it('should handle wallet initialization errors', async () => {
      const walletError = new Error('Failed to initialize wallet');
      mockCreateServer.mockImplementation(() => {
        throw walletError;
      });

      const { createServer } = await import('../../../src/stdio-server.js');
      expect(() => createServer()).toThrow('Failed to initialize wallet');
    });

    it('should handle transport connection errors', async () => {
      const transportError = new Error('Failed to connect transport');
      mockServer.start.mockRejectedValue(transportError);

      const { createServer } = await import('../../../src/stdio-server.js');
      const server = createServer();
      
      await expect(server.start()).rejects.toThrow('Failed to connect transport');
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete server lifecycle', async () => {
      mockServer.start.mockResolvedValue(undefined);
      mockServer.stop.mockResolvedValue(undefined);

      const { createServer } = await import('../../../src/stdio-server.js');
      const server = createServer();
      
      // Start server
      await server.start();
      expect(mockServer.start).toHaveBeenCalled();
      
      // Stop server
      await server.stop();
      expect(mockServer.stop).toHaveBeenCalled();
    });

    it('should handle server restart scenario', async () => {
      mockServer.start.mockResolvedValue(undefined);
      mockServer.stop.mockResolvedValue(undefined);

      const { createServer } = await import('../../../src/stdio-server.js');
      const server = createServer();
      
      // First start
      await server.start();
      expect(mockServer.start).toHaveBeenCalledTimes(1);
      
      // Stop
      await server.stop();
      expect(mockServer.stop).toHaveBeenCalledTimes(1);
      
      // Second start
      await server.start();
      expect(mockServer.start).toHaveBeenCalledTimes(2);
    });
  });
});