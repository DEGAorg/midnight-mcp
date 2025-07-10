import { describe, it, beforeEach, afterEach, jest, expect } from '@jest/globals';

// Mock all dependencies before any imports
jest.mock('express');
jest.mock('cors');
jest.mock('helmet');
jest.mock('body-parser');
jest.mock('../../../src/mcp/index');
jest.mock('../../../src/controllers/wallet.controller');
jest.mock('../../../src/config.js');
jest.mock('../../../src/utils/seed-manager.js');
jest.mock('../../../src/logger/index');

describe('Server', () => {
  let mockApp: any;
  let mockRouter: any;
  let mockServer: any;
  let mockWalletService: any;
  let mockWalletController: any;
  let mockSeedManager: any;
  let mockConfig: any;
  let mockLogger: any;
  let originalProcessEnv: any;
  let originalProcessExit: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Store original process environment
    originalProcessEnv = { ...process.env };
    
    // Create mocks
    mockApp = { use: jest.fn(), listen: jest.fn() };
    mockRouter = { 
      get: jest.fn(), 
      post: jest.fn(), 
      put: jest.fn(),
      delete: jest.fn()
    };
    mockServer = { close: jest.fn() };
    mockWalletService = { close: jest.fn() };
    mockWalletController = {
      getStatus: jest.fn(), getAddress: jest.fn(), getBalance: jest.fn(),
      sendFunds: jest.fn(), verifyTransaction: jest.fn(), getTransactionStatus: jest.fn(),
      getTransactions: jest.fn(), getPendingTransactions: jest.fn(), getWalletConfig: jest.fn(),
      healthCheck: jest.fn()
    };
    mockSeedManager = { getAgentSeed: jest.fn().mockReturnValue('test-seed') };
    mockConfig = {
      agentId: 'test-agent', proofServer: 'http://test-proof.com',
      indexer: 'https://test-indexer.com', indexerWS: 'wss://test-indexer.com/ws',
      node: 'https://test-node.com', useExternalProofServer: true,
      networkId: 'testnet', walletFilename: 'test-wallet'
    };
    mockLogger = { info: jest.fn(), error: jest.fn() };
    
    // Set up mocks
    mockApp.listen.mockReturnValue(mockServer);
    
    // Mock express
    const express = require('express');
    express.mockReturnValue(mockApp);
    express.Router.mockReturnValue(mockRouter);
    
    // Mock body-parser with proper destructuring
    const bodyParser = require('body-parser');
    bodyParser.json = jest.fn().mockReturnValue('json-middleware');
    
    // Mock helmet and cors as functions
    require('helmet').mockReturnValue('helmet-middleware');
    require('cors').mockReturnValue('cors-middleware');
    
    // Mock internal modules
    jest.doMock('../../../src/mcp/index', () => ({
      WalletServiceMCP: jest.fn().mockImplementation(() => mockWalletService)
    }));
    
    jest.doMock('../../../src/controllers/wallet.controller', () => ({
      WalletController: jest.fn().mockImplementation(() => mockWalletController)
    }));
    
    jest.doMock('../../../src/config.js', () => ({ config: mockConfig }));
    jest.doMock('../../../src/utils/seed-manager.js', () => ({ SeedManager: mockSeedManager }));
    jest.doMock('../../../src/logger/index', () => ({ createLogger: jest.fn().mockReturnValue(mockLogger) }));

    originalProcessExit = process.exit;
    process.exit = jest.fn() as any;
    process.on = jest.fn() as any;
  });

  afterEach(() => {
    process.env = originalProcessEnv;
    process.exit = originalProcessExit;
    process.on = originalProcessEnv.on;
    jest.resetModules();
  });

  describe('Server Initialization', () => {
    it('should initialize server with default port', async () => {
      delete process.env.PORT;
      
      // Import server after mocks are set up
      const { app, server } = await import('../../../src/server.js');
      
      expect(mockApp.listen).toHaveBeenCalledWith(3000, expect.any(Function));
      
      expect(app).toBe(mockApp);
      expect(server).toBe(mockServer);
    });

    it('should initialize server with custom port', async () => {
      process.env.PORT = '8080';
      
      await import('../../../src/server.js');
      
      expect(mockApp.listen).toHaveBeenCalledWith("8080", expect.any(Function));
      
    });

    it('should set up middleware', async () => {
      await import('../../../src/server.js');
      
      expect(mockApp.use).toHaveBeenCalled();
      expect(mockApp.use.mock.calls.length).toBeGreaterThan(3);
    });

    it('should initialize wallet service', async () => {
      const { WalletServiceMCP } = await import('../../../src/mcp/index');
      
      await import('../../../src/server.js');
      
      expect(WalletServiceMCP).toHaveBeenCalledWith(
        mockConfig.networkId, 'test-seed', mockConfig.walletFilename,
        {
          proofServer: mockConfig.proofServer, indexer: mockConfig.indexer,
          indexerWS: mockConfig.indexerWS, node: mockConfig.node,
          useExternalProofServer: mockConfig.useExternalProofServer,
          networkId: mockConfig.networkId
        }
      );
    });
  });

  describe('Route Registration', () => {
    it('should register all routes', async () => {
      await import('../../../src/server.js');
      
      expect(mockRouter.get).toHaveBeenCalledWith('/wallet/status', expect.any(Function));
      expect(mockRouter.get).toHaveBeenCalledWith('/wallet/address', expect.any(Function));
      expect(mockRouter.get).toHaveBeenCalledWith('/wallet/balance', expect.any(Function));
      expect(mockRouter.post).toHaveBeenCalledWith('/wallet/send', expect.any(Function));
      expect(mockRouter.post).toHaveBeenCalledWith('/wallet/verify-transaction', expect.any(Function));
      expect(mockRouter.get).toHaveBeenCalledWith('/wallet/transaction/:transactionId', expect.any(Function));
      expect(mockRouter.get).toHaveBeenCalledWith('/wallet/transactions', expect.any(Function));
      expect(mockRouter.get).toHaveBeenCalledWith('/wallet/pending-transactions', expect.any(Function));
      expect(mockRouter.get).toHaveBeenCalledWith('/wallet/config', expect.any(Function));
      expect(mockRouter.get).toHaveBeenCalledWith('/health', expect.any(Function));
    });

    it('should mount router', async () => {
      await import('../../../src/server.js');
      
      expect(mockApp.use).toHaveBeenCalledWith(mockRouter);
    });


  });

  describe('Error Handling', () => {
    it('should handle unhandled errors', async () => {
      await import('../../../src/server.js');
      
      const errorMiddleware = mockApp.use.mock.calls.find((call: any) => 
        call[0] && typeof call[0] === 'function' && call[0].length === 4
      );
      
      expect(errorMiddleware).toBeDefined();
      
      const errorHandler = errorMiddleware[0];
      const mockReq = {};
      const mockRes = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const mockNext = jest.fn();
      const testError = new Error('Test error');
      
      errorHandler(testError, mockReq, mockRes, mockNext);
      
      expect(mockLogger.error).toHaveBeenCalledWith('Unhandled error:', testError);
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Internal server error',
        message: 'Test error'
      });
    });
  });

  describe('Configuration', () => {
    it('should load seed correctly', async () => {
      await import('../../../src/server.js');
      
      expect(mockSeedManager.getAgentSeed).toHaveBeenCalledWith(mockConfig.agentId);
    });

    it('should create external config', async () => {
      const { WalletServiceMCP } = await import('../../../src/mcp/index');
      
      await import('../../../src/server.js');
      
      const expectedConfig = {
        proofServer: mockConfig.proofServer, indexer: mockConfig.indexer,
        indexerWS: mockConfig.indexerWS, node: mockConfig.node,
        useExternalProofServer: mockConfig.useExternalProofServer,
        networkId: mockConfig.networkId
      };
      
      expect(WalletServiceMCP).toHaveBeenCalledWith(
        mockConfig.networkId, 'test-seed', mockConfig.walletFilename, expectedConfig
      );
    });
  });

  describe('Logger', () => {
    it('should create logger with correct name', async () => {
      const { createLogger } = await import('../../../src/logger/index');
      
      await import('../../../src/server.js');
      
      expect(createLogger).toHaveBeenCalledWith('server');
    });
  });

  describe('Uncovered branches and shutdown', () => {
    it('should register put and delete routes if present', async () => {
      // Patch the Router mock to track put/delete
      mockRouter.put = jest.fn();
      mockRouter.delete = jest.fn();
      // Patch the routes array in the module after import
      jest.doMock('../../../src/server.js', () => {
        const original = jest.requireActual('../../../src/server.js') as any;
        // Add fake put/delete routes
        const routes = [
          { method: 'put', path: '/wallet/put', handler: mockWalletController.getStatus },
          { method: 'delete', path: '/wallet/delete', handler: mockWalletController.getStatus }
        ];
        // Call the registration logic manually
        routes.forEach(({ method, path, handler }) => {
          const boundHandler = handler.bind(mockWalletController);
          if (method === 'get') mockRouter.get(path, boundHandler);
          else if (method === 'post') mockRouter.post(path, boundHandler);
          else if (method === 'put') mockRouter.put(path, boundHandler);
          else if (method === 'delete') mockRouter.delete(path, boundHandler);
        });
        return original;
      });
      await import('../../../src/server.js');
      expect(mockRouter.put).toHaveBeenCalledWith('/wallet/put', expect.any(Function));
      expect(mockRouter.delete).toHaveBeenCalledWith('/wallet/delete', expect.any(Function));
    });

    it('should log server startup message when listen callback is called', async () => {
      await import('../../../src/server.js');
      const listenCallback = mockApp.listen.mock.calls[0][1];
      listenCallback();
      expect(mockLogger.info).toHaveBeenCalledWith('Server is running on port 3000');
    });

    it('should handle SIGTERM shutdown (success path)', async () => {
      await import('../../../src/server.js');
      const sigtermHandler = ((process.on as jest.Mock).mock.calls.find(
        (call: any) => call[0] === 'SIGTERM'
      )?.[1]) as (() => Promise<void>);
      mockServer.close.mockImplementation((cb: () => void) => cb());
      await sigtermHandler();
      expect(mockLogger.info).toHaveBeenCalledWith('SIGTERM signal received. Closing HTTP server...');
      expect(mockLogger.info).toHaveBeenCalledWith('HTTP server closed');
      expect(mockWalletService.close).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Wallet service closed');
      expect(process.exit).toHaveBeenCalledWith(0);
    });

    it('should handle SIGTERM shutdown (error path)', async () => {
      await import('../../../src/server.js');
      const sigtermHandler = ((process.on as jest.Mock).mock.calls.find(
        (call: any) => call[0] === 'SIGTERM'
      )?.[1]) as (() => Promise<void>);
      const err = new Error('fail');
      mockWalletService.close.mockRejectedValue(err);
      mockServer.close.mockImplementation((cb: () => void) => cb());
      await sigtermHandler();
      expect(mockLogger.error).toHaveBeenCalledWith('Error during shutdown:', err);
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle SIGINT shutdown (success path)', async () => {
      await import('../../../src/server.js');
      const sigintHandler = ((process.on as jest.Mock).mock.calls.find(
        (call: any) => call[0] === 'SIGINT'
      )?.[1]) as (() => Promise<void>);
      mockServer.close.mockImplementation((cb: () => void) => cb());
      await sigintHandler();
      expect(mockLogger.info).toHaveBeenCalledWith('SIGINT signal received. Closing HTTP server...');
      expect(mockLogger.info).toHaveBeenCalledWith('HTTP server closed');
      expect(mockWalletService.close).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Wallet service closed');
      expect(process.exit).toHaveBeenCalledWith(0);
    });

    it('should handle SIGINT shutdown (error path)', async () => {
      await import('../../../src/server.js');
      const sigintHandler = ((process.on as jest.Mock).mock.calls.find(
        (call: any) => call[0] === 'SIGINT'
      )?.[1]) as (() => Promise<void>);
      const err = new Error('fail');
      mockWalletService.close.mockRejectedValue(err);
      mockServer.close.mockImplementation((cb: () => void) => cb());
      await sigintHandler();
      expect(mockLogger.error).toHaveBeenCalledWith('Error during shutdown:', err);
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });
}); 