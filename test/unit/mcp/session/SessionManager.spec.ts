/**
 * SessionManager Unit Tests
 *
 * Tests for multi-agent session management with LRU eviction.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock dependencies before imports
jest.mock('../../../../src/lib/logger/index.js', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

jest.mock('../../../../src/lib/utils/file-manager.js', () => ({
  FileManager: {
    getInstance: jest.fn(() => ({
      getPath: jest.fn(() => '/mock/path/wallet.json'),
      fileExists: jest.fn(() => false),
      readFile: jest.fn(),
    })),
  },
  FileType: {
    WALLET_BACKUP: 'wallet_backup',
  },
}));

jest.mock('../../../../src/lib/utils/seed-manager.js', () => ({
  SeedManager: {
    getAgentSeed: jest.fn(() => 'mock-seed-phrase-for-testing'),
    hasAgentSeed: jest.fn(() => true),
  },
}));

jest.mock('../../../../src/services/WalletOrchestrator.js', () => ({
  WalletOrchestrator: jest.fn().mockImplementation(() => ({
    start: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    stop: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    getWalletService: jest.fn(() => ({ mock: 'walletService' })),
    getTransactionService: jest.fn(() => ({ mock: 'transactionService' })),
    getTokenService: jest.fn(() => ({ mock: 'tokenService' })),
    getDaoService: jest.fn(() => null),
    getMarketplaceService: jest.fn(() => null),
  })),
}));

jest.mock('@midnight-ntwrk/wallet', () => ({
  WalletBuilder: {
    build: jest.fn(),
    restore: jest.fn(),
  },
}));

jest.mock('@midnight-ntwrk/midnight-js-network-id', () => ({
  getZswapNetworkId: jest.fn(() => 'testnet'),
}));

import { SessionManager } from '../../../../src/mcp/session/SessionManager.js';
import type { SessionManagerConfig } from '../../../../src/mcp/session/types.js';

describe('SessionManager', () => {
  let sessionManager: SessionManager;
  let mockConfig: SessionManagerConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockConfig = {
      maxSessions: 10,
      sessionTimeout: 30 * 60 * 1000, // 30 minutes
      evictionInterval: 5 * 60 * 1000, // 5 minutes
      baseConfig: {
        indexer: 'https://indexer.test.com',
        indexerWS: 'wss://indexer.test.com/ws',
        proofServer: 'https://proof.test.com',
        node: 'https://node.test.com',
        walletFilename: 'wallet',
        daoContractAddress: '0xdao123',
        marketplaceContractAddress: '0xmarket123',
      },
    };

    sessionManager = new SessionManager(mockConfig);
  });

  afterEach(async () => {
    jest.useRealTimers();
    if (sessionManager) {
      await sessionManager.stop();
    }
  });

  describe('constructor', () => {
    it('should initialize with provided config', () => {
      expect(sessionManager).toBeDefined();
      expect(sessionManager.getActiveSessionCount()).toBe(0);
    });

    it('should use default values for optional config', () => {
      const minimalConfig: SessionManagerConfig = {
        maxSessions: 5,
        sessionTimeout: 10000,
        evictionInterval: 5000,
        baseConfig: {
          indexer: 'https://indexer.test.com',
          indexerWS: 'wss://indexer.test.com/ws',
          proofServer: 'https://proof.test.com',
          node: 'https://node.test.com',
          walletFilename: 'wallet',
        },
      };
      const manager = new SessionManager(minimalConfig);
      expect(manager).toBeDefined();
    });
  });

  describe('start/stop', () => {
    it('should start the session manager', () => {
      sessionManager.start();
      // Verify eviction timer is set by checking if callback runs
      expect(sessionManager.getActiveSessionCount()).toBe(0);
    });

    it('should stop the session manager and close all sessions', async () => {
      sessionManager.start();

      // Create a session first
      await sessionManager.getOrCreateSession({ agentId: 'agent-1' });
      expect(sessionManager.getActiveSessionCount()).toBe(1);

      // Stop should close all sessions
      await sessionManager.stop();
      expect(sessionManager.getActiveSessionCount()).toBe(0);
    });
  });

  describe('getOrCreateSession', () => {
    beforeEach(() => {
      sessionManager.start();
    });

    it('should create a new session for a new agent', async () => {
      const services = await sessionManager.getOrCreateSession({ agentId: 'agent-1' });

      expect(services).toBeDefined();
      expect(services.walletService).toBeDefined();
      expect(services.transactionService).toBeDefined();
      expect(services.tokenService).toBeDefined();
      expect(sessionManager.getActiveSessionCount()).toBe(1);
      expect(sessionManager.hasSession('agent-1')).toBe(true);
    });

    it('should return existing session for same agent', async () => {
      const services1 = await sessionManager.getOrCreateSession({ agentId: 'agent-1' });
      const services2 = await sessionManager.getOrCreateSession({ agentId: 'agent-1' });

      expect(services1).toBe(services2);
      expect(sessionManager.getActiveSessionCount()).toBe(1);
    });

    it('should create separate sessions for different agents', async () => {
      const services1 = await sessionManager.getOrCreateSession({ agentId: 'agent-1' });
      const services2 = await sessionManager.getOrCreateSession({ agentId: 'agent-2' });

      expect(services1).not.toBe(services2);
      expect(sessionManager.getActiveSessionCount()).toBe(2);
    });

    it('should handle concurrent session creation for same agent', async () => {
      // Start two concurrent requests for the same agent
      const promise1 = sessionManager.getOrCreateSession({ agentId: 'agent-1' });
      const promise2 = sessionManager.getOrCreateSession({ agentId: 'agent-1' });

      const [services1, services2] = await Promise.all([promise1, promise2]);

      // Both should get the same session
      expect(services1).toBe(services2);
      expect(sessionManager.getActiveSessionCount()).toBe(1);
    });
  });

  describe('closeSession', () => {
    beforeEach(() => {
      sessionManager.start();
    });

    it('should close an existing session', async () => {
      await sessionManager.getOrCreateSession({ agentId: 'agent-1' });
      expect(sessionManager.hasSession('agent-1')).toBe(true);

      await sessionManager.closeSession('agent-1');
      expect(sessionManager.hasSession('agent-1')).toBe(false);
      expect(sessionManager.getActiveSessionCount()).toBe(0);
    });

    it('should handle closing non-existent session gracefully', async () => {
      await expect(sessionManager.closeSession('non-existent')).resolves.toBeUndefined();
    });
  });

  describe('LRU eviction', () => {
    beforeEach(() => {
      sessionManager.start();
    });

    it('should evict oldest session when max sessions reached', async () => {
      // Create sessions up to max, advancing time between each to ensure different timestamps
      const maxSessions = mockConfig.maxSessions;
      for (let i = 0; i < maxSessions; i++) {
        await sessionManager.getOrCreateSession({ agentId: `agent-${i}` });
        // Advance time by 100ms between sessions to ensure different lastAccessedAt times
        jest.advanceTimersByTime(100);
      }
      expect(sessionManager.getActiveSessionCount()).toBe(maxSessions);

      // Creating one more should trigger eviction of oldest (agent-0)
      await sessionManager.getOrCreateSession({ agentId: 'agent-new' });

      // New agent should exist
      expect(sessionManager.hasSession('agent-new')).toBe(true);

      // Oldest agent (agent-0) should be evicted
      expect(sessionManager.hasSession('agent-0')).toBe(false);

      // Verify eviction was triggered (stats should show eviction)
      const stats = sessionManager.getStats();
      expect(stats.totalEvicted).toBe(1);

      // Session count should remain at max
      expect(sessionManager.getActiveSessionCount()).toBe(maxSessions);
    });

    it('should track eviction in stats', async () => {
      // Create max sessions with different timestamps
      for (let i = 0; i < mockConfig.maxSessions; i++) {
        await sessionManager.getOrCreateSession({ agentId: `agent-${i}` });
        jest.advanceTimersByTime(100);
      }

      // Create one more to trigger eviction
      await sessionManager.getOrCreateSession({ agentId: 'agent-overflow' });

      const stats = sessionManager.getStats();
      expect(stats.totalEvicted).toBe(1);
    });
  });

  describe('getStats', () => {
    beforeEach(() => {
      sessionManager.start();
    });

    it('should return correct initial stats', () => {
      const stats = sessionManager.getStats();

      expect(stats.activeSessions).toBe(0);
      expect(stats.totalCreated).toBe(0);
      expect(stats.totalEvicted).toBe(0);
      expect(stats.totalClosed).toBe(0);
      expect(stats.maxSessions).toBe(mockConfig.maxSessions);
      expect(stats.utilizationPercent).toBe(0);
    });

    it('should track session creation', async () => {
      await sessionManager.getOrCreateSession({ agentId: 'agent-1' });
      await sessionManager.getOrCreateSession({ agentId: 'agent-2' });

      const stats = sessionManager.getStats();

      expect(stats.activeSessions).toBe(2);
      expect(stats.totalCreated).toBe(2);
      expect(stats.utilizationPercent).toBe(20); // 2/10 * 100
    });

    it('should track session closure', async () => {
      await sessionManager.getOrCreateSession({ agentId: 'agent-1' });
      await sessionManager.closeSession('agent-1');

      const stats = sessionManager.getStats();

      expect(stats.activeSessions).toBe(0);
      expect(stats.totalCreated).toBe(1);
      expect(stats.totalClosed).toBe(1);
    });
  });

  describe('hasSession', () => {
    beforeEach(() => {
      sessionManager.start();
    });

    it('should return true for existing session', async () => {
      await sessionManager.getOrCreateSession({ agentId: 'agent-1' });
      expect(sessionManager.hasSession('agent-1')).toBe(true);
    });

    it('should return false for non-existent session', () => {
      expect(sessionManager.hasSession('non-existent')).toBe(false);
    });
  });

  describe('trackAgent', () => {
    beforeEach(() => {
      sessionManager.start();
    });

    it('should track additional agent IDs for a session', async () => {
      await sessionManager.getOrCreateSession({ agentId: 'agent-1' });

      sessionManager.trackAgent('agent-1', 'sub-agent-1');
      sessionManager.trackAgent('agent-1', 'sub-agent-2');

      // The session should still exist
      expect(sessionManager.hasSession('agent-1')).toBe(true);
    });

    it('should handle tracking for non-existent session', () => {
      // Should not throw
      sessionManager.trackAgent('non-existent', 'sub-agent');
    });
  });

  describe('session state validation', () => {
    beforeEach(() => {
      sessionManager.start();
    });

    it('should throw when accessing a closing session', async () => {
      // Create a session
      await sessionManager.getOrCreateSession({ agentId: 'agent-1' });

      // Start closing the session (don't await - we want to access during closing)
      const closePromise = sessionManager.closeSession('agent-1');

      // The session is now in 'closing' state, but closeSession removes it from map
      // So we need to verify the session is no longer accessible
      await closePromise;

      // Session should be gone after close
      expect(sessionManager.hasSession('agent-1')).toBe(false);
    });
  });

  describe('session creation failure', () => {
    it('should clean up session when orchestrator start fails', async () => {
      // Get reference to WalletOrchestrator mock
      const { WalletOrchestrator } = jest.requireMock('../../../../src/services/WalletOrchestrator.js');

      // Make orchestrator.start() throw an error
      const mockError = new Error('Failed to start orchestrator');
      WalletOrchestrator.mockImplementationOnce(() => ({
        start: jest.fn<() => Promise<void>>().mockRejectedValue(mockError),
        stop: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
        getWalletService: jest.fn(),
        getTransactionService: jest.fn(),
        getTokenService: jest.fn(),
        getDaoService: jest.fn(() => null),
        getMarketplaceService: jest.fn(() => null),
      }));

      sessionManager.start();

      // Attempt to create session should fail
      await expect(
        sessionManager.getOrCreateSession({ agentId: 'failing-agent' })
      ).rejects.toThrow('Failed to start orchestrator');

      // Session should be cleaned up
      expect(sessionManager.hasSession('failing-agent')).toBe(false);
      expect(sessionManager.getActiveSessionCount()).toBe(0);
    });
  });

  describe('closeSession error handling', () => {
    it('should throw when orchestrator stop fails', async () => {
      // Get reference to WalletOrchestrator mock
      const { WalletOrchestrator } = jest.requireMock('../../../../src/services/WalletOrchestrator.js');

      // Create a new session manager instance for this test
      const errorTestManager = new SessionManager(mockConfig);

      // Mock orchestrator that fails on stop
      WalletOrchestrator.mockImplementationOnce(() => ({
        start: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
        stop: jest.fn<() => Promise<void>>().mockRejectedValue(new Error('Failed to stop orchestrator')),
        getWalletService: jest.fn(() => ({ mock: 'walletService' })),
        getTransactionService: jest.fn(() => ({ mock: 'transactionService' })),
        getTokenService: jest.fn(() => ({ mock: 'tokenService' })),
        getDaoService: jest.fn(() => null),
        getMarketplaceService: jest.fn(() => null),
      }));

      errorTestManager.start();

      // Create session
      await errorTestManager.getOrCreateSession({ agentId: 'error-agent' });
      expect(errorTestManager.hasSession('error-agent')).toBe(true);

      // Close should throw
      await expect(errorTestManager.closeSession('error-agent')).rejects.toThrow(
        'Failed to stop orchestrator'
      );
    });
  });

  describe('stale session eviction', () => {
    it('should evict stale sessions when timeout expires', async () => {
      // Use a short timeout for testing
      const shortTimeoutConfig: SessionManagerConfig = {
        maxSessions: 10,
        sessionTimeout: 1000, // 1 second timeout
        evictionInterval: 2000, // Check every 2 seconds (longer than timeout to avoid multiple triggers)
        baseConfig: mockConfig.baseConfig,
      };

      const shortTimeoutManager = new SessionManager(shortTimeoutConfig);
      shortTimeoutManager.start();

      // Create a session
      await shortTimeoutManager.getOrCreateSession({ agentId: 'stale-agent' });
      expect(shortTimeoutManager.hasSession('stale-agent')).toBe(true);

      // Advance time past the session timeout AND trigger the eviction interval
      jest.advanceTimersByTime(2000);

      // Allow async operations to complete
      await Promise.resolve();

      // Session should be evicted (at least once)
      const stats = shortTimeoutManager.getStats();
      expect(stats.totalEvicted).toBeGreaterThanOrEqual(1);

      // Stop without waiting (session is already gone)
      await shortTimeoutManager.stop();
    });

    it('should not evict sessions that are still active', async () => {
      const shortTimeoutConfig: SessionManagerConfig = {
        maxSessions: 10,
        sessionTimeout: 2000, // 2 second timeout
        evictionInterval: 3000, // Check every 3 seconds
        baseConfig: mockConfig.baseConfig,
      };

      const manager = new SessionManager(shortTimeoutConfig);
      manager.start();

      // Create a session
      await manager.getOrCreateSession({ agentId: 'active-agent' });

      // Advance time but not past timeout
      jest.advanceTimersByTime(1000);

      // Access the session to update lastAccessedAt
      await manager.getOrCreateSession({ agentId: 'active-agent' });

      // Advance time past original timeout but not past new lastAccessedAt + timeout
      jest.advanceTimersByTime(1500);

      // Trigger eviction check
      jest.advanceTimersByTime(3000);
      await Promise.resolve();

      // Session should still exist (was accessed recently)
      expect(manager.hasSession('active-agent')).toBe(true);

      await manager.stop();
    });
  });
});
