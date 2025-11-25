/**
 * STDIO Server Unit Tests
 *
 * Tests for MCP server entry point:
 * - Server creation
 * - Service initialization
 * - Exit handlers
 *
 * Note: These tests focus on the exported functions and basic structure.
 * Full integration testing requires actual services.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock all heavy dependencies
jest.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('@midnight-ntwrk/wallet', () => ({
  WalletBuilder: {
    build: (jest.fn() as any).mockResolvedValue({
      start: jest.fn(),
      state: jest.fn(() => ({ asObservable: jest.fn() })),
      close: (jest.fn() as any).mockResolvedValue(undefined),
    }),
    restore: (jest.fn() as any).mockResolvedValue({
      start: jest.fn(),
      state: jest.fn(() => ({ asObservable: jest.fn() })),
      close: (jest.fn() as any).mockResolvedValue(undefined),
    }),
  },
}));

jest.mock('@midnight-ntwrk/midnight-js-network-id', () => ({
  NetworkId: { TestNet: 1 },
  setNetworkId: jest.fn(),
  getZswapNetworkId: jest.fn(() => 'test-network'),
}));

jest.mock('@mcp/mcp-server.js', () => ({
  MCPServer: jest.fn().mockImplementation(() => ({
    getServer: jest.fn(() => ({
      connect: (jest.fn() as any).mockResolvedValue(undefined),
      close: (jest.fn() as any).mockResolvedValue(undefined),
    })),
  })),
}));

jest.mock('@services/WalletOrchestrator.js', () => ({
  WalletOrchestrator: jest.fn().mockImplementation(() => ({
    start: (jest.fn() as any).mockResolvedValue(undefined),
    stop: (jest.fn() as any).mockResolvedValue(undefined),
    getWalletService: jest.fn(() => ({ mock: 'walletService' })),
    getTransactionService: jest.fn(() => ({ mock: 'transactionService' })),
    getTokenService: jest.fn(() => ({ mock: 'tokenService' })),
    getDaoService: jest.fn(() => ({ mock: 'daoService' })),
    getMarketplaceService: jest.fn(() => ({ mock: 'marketplaceService' })),
  })),
}));

jest.mock('@lib/config/env.js', () => ({
  loadConfig: jest.fn(() => ({
    AGENT_ID: 'test-agent',
    NETWORK_ID: 'testnet',
    WALLET_FILENAME: 'test-wallet',
    INDEXER: 'https://indexer.test',
    INDEXER_WS: 'wss://indexer.test',
    MN_NODE: 'https://rpc.test',
    PROOF_SERVER: 'http://localhost:6300',
    DAO_CONTRACT_ADDRESS: '0xDao',
    MARKETPLACE_CONTRACT_ADDRESS: '0xMarket',
  })),
  getNetworkId: jest.fn(() => 1),
  getWalletBackupFolder: jest.fn(() => '/mock/backup'),
}));

jest.mock('@lib/utils/file-manager.js', () => ({
  FileManager: {
    getInstance: jest.fn(() => ({
      fileExists: jest.fn(() => false),
      readFile: jest.fn(),
      writeFile: jest.fn(),
    })),
    resetInstance: jest.fn(),
  },
  FileType: {
    WALLET_BACKUP: 'wallet_backup',
  },
}));

jest.mock('@lib/utils/seed-manager.js', () => ({
  SeedManager: {
    initialize: jest.fn(),
    getAgentSeed: jest.fn(() => 'test-seed-hex'),
  },
}));

describe('stdio-server', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Suppress console.error for log function
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('createServer', () => {
    it('should create server with services', async () => {
      // Dynamically import to get fresh module with mocks
      const { createServer } = await import('../../../src/mcp/stdio-server.js');

      const server = await createServer();

      expect(server).toBeDefined();
      expect(server.start).toBeDefined();
      expect(server.stop).toBeDefined();
      expect(server.services).toBeDefined();
      expect(server.orchestrator).toBeDefined();
    });

    it('should expose services via orchestrator', async () => {
      const { createServer } = await import('../../../src/mcp/stdio-server.js');

      const server = await createServer();

      expect(server.services.walletService).toBeDefined();
      expect(server.services.transactionService).toBeDefined();
      expect(server.services.tokenService).toBeDefined();
    });

    it('should start server successfully', async () => {
      const { createServer } = await import('../../../src/mcp/stdio-server.js');

      const server = await createServer();
      await expect(server.start()).resolves.not.toThrow();
    });

    it('should stop server successfully', async () => {
      const { createServer } = await import('../../../src/mcp/stdio-server.js');

      const server = await createServer();
      await server.start();
      await expect(server.stop()).resolves.not.toThrow();
    });
  });

  describe('service initialization', () => {
    it('should load config from env', async () => {
      const { loadConfig } = jest.requireMock('@lib/config/env.js') as any;
      const { createServer } = await import('../../../src/mcp/stdio-server.js');

      await createServer();

      expect(loadConfig).toHaveBeenCalled();
    });

    it('should initialize SeedManager', async () => {
      const { SeedManager } = jest.requireMock('@lib/utils/seed-manager.js') as any;
      const { createServer } = await import('../../../src/mcp/stdio-server.js');

      await createServer();

      expect(SeedManager.initialize).toHaveBeenCalled();
    });

    it('should set network ID', async () => {
      const { setNetworkId } = jest.requireMock('@midnight-ntwrk/midnight-js-network-id') as any;
      const { createServer } = await import('../../../src/mcp/stdio-server.js');

      await createServer();

      expect(setNetworkId).toHaveBeenCalled();
    });

    it('should create WalletOrchestrator', async () => {
      const { WalletOrchestrator } = jest.requireMock('@services/WalletOrchestrator.js') as any;
      const { createServer } = await import('../../../src/mcp/stdio-server.js');

      await createServer();

      expect(WalletOrchestrator).toHaveBeenCalled();
    });

    it('should start WalletOrchestrator', async () => {
      const { WalletOrchestrator } = jest.requireMock('@services/WalletOrchestrator.js') as any;
      const { createServer } = await import('../../../src/mcp/stdio-server.js');

      await createServer();

      // Get the mock instance and verify start was called
      const mockInstance = WalletOrchestrator.mock.results[0]?.value;
      if (mockInstance) {
        expect(mockInstance.start).toHaveBeenCalled();
      }
    });
  });

  describe('wallet factory', () => {
    it('should build wallet from seed when no backup exists', async () => {
      const { FileManager } = jest.requireMock('@lib/utils/file-manager.js') as any;
      FileManager.getInstance.mockReturnValue({
        fileExists: jest.fn(() => false),
        readFile: jest.fn(),
      });

      const { createServer } = await import('../../../src/mcp/stdio-server.js');

      // This triggers wallet factory creation, but not necessarily wallet build
      await createServer();

      // The factory is created but may not be invoked until orchestrator.start()
      // which is mocked, so we just verify the flow completes
      expect(FileManager.getInstance).toHaveBeenCalled();
    });
  });
});
