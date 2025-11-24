/**
 * WalletOrchestrator Unit Tests
 *
 * Tests for service coordination:
 * - Service initialization
 * - Lifecycle management (start/stop)
 * - Service access
 * - Health monitoring
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock all dependencies
jest.mock('@lib/logger/index.js', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

jest.mock('@services/wallet/WalletService.js', () => ({
  WalletService: jest.fn().mockImplementation(() => ({
    start: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    isReady: jest.fn(() => true),
    getAddress: jest.fn(() => '0xMockAddress'),
    getBalance: jest.fn(() => 1000n),
    getSyncProgress: jest.fn(() => ({ synced: true, applyGap: 0n, sourceGap: 0n })),
    waitForSync: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('@services/wallet/TransactionService.js', () => ({
  TransactionService: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    stop: jest.fn(),
    isPollingActive: jest.fn(() => true),
    getTransactionCount: jest.fn(() => 5),
    getPendingTransactionCount: jest.fn(() => 2),
    getPollingInterval: jest.fn(() => 10000),
  })),
}));

jest.mock('@services/wallet/TokenService.js', () => ({
  TokenService: jest.fn().mockImplementation(() => ({
    autoRegisterTokens: jest.fn().mockResolvedValue([]),
    getTokenCount: jest.fn(() => 3),
    getNonZeroTokenBalances: jest.fn(() => [{ balance: 100n }]),
  })),
}));

jest.mock('@services/audit/AuditService.js', () => ({
  AuditService: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('@services/recovery/RecoveryService.js', () => ({
  RecoveryService: jest.fn().mockImplementation(() => ({
    isRecovering: jest.fn(() => false),
    getAttempts: jest.fn(() => 0),
  })),
}));

jest.mock('@services/contract/dao/DaoService.js', () => ({
  DaoService: jest.fn().mockImplementation(() => ({
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn(),
  })),
}));

jest.mock('@services/contract/marketplace/MarketplaceService.js', () => ({
  MarketplaceService: jest.fn().mockImplementation(() => ({
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn(),
  })),
}));

jest.mock('@lib/database/token-registry-db.js', () => ({
  TokenRegistryDatabase: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('@lib/utils/file-manager.js', () => ({
  FileManager: {
    getInstance: jest.fn(() => ({
      getPath: jest.fn(() => '/mock/path/token-registry.db'),
    })),
  },
  FileType: {
    TRANSACTION_DB: 'transaction_db',
  },
}));

import {
  WalletOrchestrator,
  WalletOrchestratorConfig,
} from '@services/WalletOrchestrator.js';

describe('WalletOrchestrator', () => {
  let orchestrator: WalletOrchestrator;
  let mockConfig: WalletOrchestratorConfig;

  beforeEach(() => {
    jest.clearAllMocks();

    mockConfig = {
      walletConfig: {
        walletFactory: jest.fn<() => Promise<any>>().mockResolvedValue({}),
        walletPath: '/mock/wallet/path',
        agentId: 'test-agent-123',
      },
      agentId: 'test-agent-123',
    };

    orchestrator = new WalletOrchestrator(mockConfig);
  });

  afterEach(async () => {
    await orchestrator.stop();
  });

  describe('constructor', () => {
    it('should initialize with minimal config', () => {
      expect(orchestrator).toBeDefined();
      expect(orchestrator.getAgentId()).toBe('test-agent-123');
    });

    it('should initialize services', () => {
      expect(orchestrator.getWalletService()).toBeDefined();
      expect(orchestrator.getTransactionService()).toBeDefined();
      expect(orchestrator.getTokenService()).toBeDefined();
      expect(orchestrator.getAuditService()).toBeDefined();
      expect(orchestrator.getRecoveryService()).toBeDefined();
    });

    it('should not initialize optional services without contract addresses', () => {
      expect(orchestrator.getDaoService()).toBeUndefined();
      expect(orchestrator.getMarketplaceService()).toBeUndefined();
    });

    it('should initialize DaoService with contract address', () => {
      const configWithDao = {
        ...mockConfig,
        daoContractAddress: '0xDaoContract',
      };
      const orch = new WalletOrchestrator(configWithDao);
      expect(orch.getDaoService()).toBeDefined();
      orch.stop();
    });

    it('should initialize MarketplaceService with contract address', () => {
      const configWithMarketplace = {
        ...mockConfig,
        marketplaceContractAddress: '0xMarketplace',
      };
      const orch = new WalletOrchestrator(configWithMarketplace);
      expect(orch.getMarketplaceService()).toBeDefined();
      orch.stop();
    });
  });

  describe('start', () => {
    it('should start all services in order', async () => {
      await orchestrator.start();

      const walletService = orchestrator.getWalletService();
      const transactionService = orchestrator.getTransactionService();
      const tokenService = orchestrator.getTokenService();

      expect(walletService.start).toHaveBeenCalled();
      expect(transactionService.start).toHaveBeenCalled();
      expect(tokenService.autoRegisterTokens).toHaveBeenCalled();
    });

    it('should set isStarted to true', async () => {
      expect(orchestrator.isReady()).toBe(false);
      await orchestrator.start();
      expect(orchestrator.isReady()).toBe(true);
    });

    it('should not start twice', async () => {
      await orchestrator.start();
      await orchestrator.start();

      const walletService = orchestrator.getWalletService();
      expect(walletService.start).toHaveBeenCalledTimes(1);
    });

    it('should start optional services when configured', async () => {
      const configWithAll = {
        ...mockConfig,
        daoContractAddress: '0xDao',
        marketplaceContractAddress: '0xMarket',
      };
      const orch = new WalletOrchestrator(configWithAll);

      await orch.start();

      expect(orch.getDaoService()?.start).toHaveBeenCalled();
      expect(orch.getMarketplaceService()?.start).toHaveBeenCalled();

      await orch.stop();
    });
  });

  describe('stop', () => {
    it('should stop all services', async () => {
      await orchestrator.start();
      await orchestrator.stop();

      const walletService = orchestrator.getWalletService();
      const transactionService = orchestrator.getTransactionService();

      expect(walletService.close).toHaveBeenCalled();
      expect(transactionService.stop).toHaveBeenCalled();
    });

    it('should set isStarted to false', async () => {
      await orchestrator.start();
      expect(orchestrator.isReady()).toBe(true);

      await orchestrator.stop();
      expect(orchestrator.isReady()).toBe(false);
    });

    it('should not throw when stopping before start', async () => {
      await expect(orchestrator.stop()).resolves.not.toThrow();
    });
  });

  describe('service access', () => {
    it('should return WalletService', () => {
      expect(orchestrator.getWalletService()).toBeDefined();
    });

    it('should return TransactionService', () => {
      expect(orchestrator.getTransactionService()).toBeDefined();
    });

    it('should return TokenService', () => {
      expect(orchestrator.getTokenService()).toBeDefined();
    });

    it('should return AuditService', () => {
      expect(orchestrator.getAuditService()).toBeDefined();
    });

    it('should return RecoveryService', () => {
      expect(orchestrator.getRecoveryService()).toBeDefined();
    });
  });

  describe('unified API', () => {
    it('should delegate getAddress to WalletService', async () => {
      await orchestrator.start();
      expect(orchestrator.getAddress()).toBe('0xMockAddress');
    });

    it('should delegate getBalance to WalletService', async () => {
      await orchestrator.start();
      expect(orchestrator.getBalance()).toBe(1000n);
    });

    it('should delegate getSyncProgress to WalletService', async () => {
      await orchestrator.start();
      const progress = orchestrator.getSyncProgress();
      expect(progress.synced).toBe(true);
    });

    it('should delegate waitForSync to WalletService', async () => {
      await orchestrator.start();
      await orchestrator.waitForSync(5000);

      const walletService = orchestrator.getWalletService();
      expect(walletService.waitForSync).toHaveBeenCalledWith(5000);
    });

    it('should return agent ID', () => {
      expect(orchestrator.getAgentId()).toBe('test-agent-123');
    });
  });

  describe('isReady', () => {
    it('should return false before start', () => {
      expect(orchestrator.isReady()).toBe(false);
    });

    it('should return true when started and wallet ready', async () => {
      await orchestrator.start();
      expect(orchestrator.isReady()).toBe(true);
    });

    it('should return false when wallet not ready', async () => {
      const walletService = orchestrator.getWalletService();
      (walletService.isReady as jest.Mock).mockReturnValue(false);

      await orchestrator.start();
      expect(orchestrator.isReady()).toBe(false);
    });
  });

  describe('getHealthStatus', () => {
    it('should return health status before start', () => {
      const status = orchestrator.getHealthStatus();

      expect(status.isStarted).toBe(false);
      expect(status.servicesInitialized.wallet).toBe(true);
      expect(status.servicesInitialized.transaction).toBe(true);
      expect(status.servicesInitialized.token).toBe(true);
    });

    it('should return health status after start', async () => {
      await orchestrator.start();
      const status = orchestrator.getHealthStatus();

      expect(status.isStarted).toBe(true);
      expect(status.isReady).toBe(true);
      expect(status.walletReady).toBe(true);
      expect(status.walletSynced).toBe(true);
      expect(status.transactionPollingActive).toBe(true);
    });

    it('should show optional services as uninitialized when not configured', () => {
      const status = orchestrator.getHealthStatus();
      expect(status.servicesInitialized.dao).toBe(false);
      expect(status.servicesInitialized.marketplace).toBe(false);
    });

    it('should show optional services as initialized when configured', async () => {
      const configWithAll = {
        ...mockConfig,
        daoContractAddress: '0xDao',
        marketplaceContractAddress: '0xMarket',
      };
      const orch = new WalletOrchestrator(configWithAll);

      const status = orch.getHealthStatus();
      expect(status.servicesInitialized.dao).toBe(true);
      expect(status.servicesInitialized.marketplace).toBe(true);

      await orch.stop();
    });
  });

  describe('getStatistics', () => {
    it('should return statistics', async () => {
      await orchestrator.start();
      const stats = orchestrator.getStatistics();

      expect(stats.transactions.total).toBe(5);
      expect(stats.transactions.pending).toBe(2);
      expect(stats.transactions.pollingInterval).toBe(10000);
      expect(stats.tokens.registered).toBe(3);
      expect(stats.tokens.withBalance).toBe(1);
      expect(stats.recovery.isRecovering).toBe(false);
      expect(stats.recovery.attempts).toBe(0);
    });
  });
});
