/**
 * WalletService Unit Tests
 *
 * Tests for wallet lifecycle management:
 * - Construction and initialization
 * - Start/Close lifecycle
 * - State subscription and caching
 * - Balance tracking
 * - Sync progress tracking
 * - Recovery handling
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { BehaviorSubject } from 'rxjs';

// Mock dependencies before importing WalletService
jest.mock('../../../../src/lib/logger/index.js', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

jest.mock('../../../../src/lib/config/constants.js', () => ({
  WALLET_SYNC_CONFIG: {
    SAVE_INTERVAL_MS: 30000,
    POLL_INTERVAL_MS: 1000,
  },
}));

jest.mock('../../../../src/services/recovery/RecoveryService.js', () => ({
  RecoveryService: jest.fn().mockImplementation(() => ({
    attemptRecovery: (jest.fn() as any).mockResolvedValue({
      success: true,
      attempts: 1,
      totalTimeMs: 100,
    }),
  })),
}));

import { WalletService, WalletConfig, WalletState } from '../../../../src/services/wallet/WalletService.js';

// Default mock state
const createMockState = (overrides: Partial<WalletState> = {}): WalletState => ({
  address: '0x123',
  coinPublicKey: 'pubkey123',
  balances: { unshielded: 1000n },
  synced: true,
  applyGap: 0n,
  sourceGap: 0n,
  ...overrides,
} as WalletState);

describe('WalletService', () => {
  let walletService: WalletService;
  let mockWallet: any;
  let mockStateSubject: BehaviorSubject<WalletState>;
  let mockConfig: WalletConfig;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create a BehaviorSubject with initial state (required for firstValueFrom)
    mockStateSubject = new BehaviorSubject<WalletState>(createMockState());

    // Create mock wallet
    mockWallet = {
      state: jest.fn(() => mockStateSubject.asObservable()),
      close: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    };

    // Create mock config
    mockConfig = {
      walletFactory: jest.fn<() => Promise<any>>().mockResolvedValue(mockWallet),
      walletPath: '/mock/wallet/path',
      agentId: 'test-agent-123',
    };

    walletService = new WalletService(mockConfig);
  });

  describe('constructor', () => {
    it('should initialize with provided config', () => {
      expect(walletService.getAgentId()).toBe('test-agent-123');
      expect(walletService.isReady()).toBe(false);
    });

    it('should use default RecoveryService if not provided', () => {
      const service = new WalletService(mockConfig);
      expect(service).toBeDefined();
    });

    it('should use custom RecoveryService if provided', () => {
      const customRecovery = {
        attemptRecovery: jest.fn(),
      };
      const configWithRecovery = {
        ...mockConfig,
        recoveryService: customRecovery as any,
      };
      const service = new WalletService(configWithRecovery);
      expect(service).toBeDefined();
    });
  });

  describe('start', () => {
    it('should start wallet service and set ready state', async () => {
      await walletService.start();

      expect(walletService.isReady()).toBe(true);
      expect(mockConfig.walletFactory).toHaveBeenCalled();
    });

    it('should throw error if wallet factory fails', async () => {
      const error = new Error('Factory failed');
      ((mockConfig.walletFactory as jest.Mock) as any).mockRejectedValue(error);

      await expect(walletService.start()).rejects.toThrow('Factory failed');
      expect(walletService.isReady()).toBe(false);
    });
  });

  describe('close', () => {
    it('should close wallet service and clean up resources', async () => {
      await walletService.start();
      expect(walletService.isReady()).toBe(true);

      await walletService.close();

      expect(walletService.isReady()).toBe(false);
      expect(mockWallet.close).toHaveBeenCalled();
    });

    it('should handle close when wallet is not started', async () => {
      await walletService.close();
      expect(walletService.isReady()).toBe(false);
    });
  });

  describe('getAddress', () => {
    it('should throw error if wallet state not available', () => {
      expect(() => walletService.getAddress()).toThrow('Wallet state not available');
    });

    it('should return address after start', async () => {
      mockStateSubject.next(createMockState({ address: '0xABC123' }));
      await walletService.start();

      expect(walletService.getAddress()).toBe('0xABC123');
    });
  });

  describe('getBalance', () => {
    it('should return 0n initially', () => {
      expect(walletService.getBalance()).toBe(0n);
    });

    it('should return updated balance after state update', async () => {
      mockStateSubject.next(createMockState({ balances: { unshielded: 5000n } }));
      await walletService.start();

      expect(walletService.getBalance()).toBe(5000n);
    });

    it('should handle state without unshielded balance', async () => {
      mockStateSubject.next(createMockState({ balances: {} }));
      await walletService.start();

      expect(walletService.getBalance()).toBe(0n);
    });
  });

  describe('getPendingBalance', () => {
    it('should return 0n initially', () => {
      expect(walletService.getPendingBalance()).toBe(0n);
    });
  });

  describe('updatePendingBalance', () => {
    it('should update pending balance', () => {
      walletService.updatePendingBalance(1000n);
      expect(walletService.getPendingBalance()).toBe(1000n);
    });

    it('should allow updating to zero', () => {
      walletService.updatePendingBalance(1000n);
      walletService.updatePendingBalance(0n);
      expect(walletService.getPendingBalance()).toBe(0n);
    });
  });

  describe('getWalletState', () => {
    it('should throw error if state not available', () => {
      expect(() => walletService.getWalletState()).toThrow('Wallet state not available');
    });

    it('should return cached state after start', async () => {
      await walletService.start();

      const state = walletService.getWalletState();
      expect(state.address).toBe('0x123');
      expect(state.coinPublicKey).toBe('pubkey123');
    });
  });

  describe('getSyncProgress', () => {
    it('should return default sync progress initially', () => {
      const progress = walletService.getSyncProgress();
      expect(progress.synced).toBe(false);
      expect(progress.applyGap).toBe(0n);
      expect(progress.sourceGap).toBe(0n);
      expect(progress.syncPercentage).toBe(0);
    });

    it('should return copy of sync progress (not reference)', () => {
      const progress1 = walletService.getSyncProgress();
      const progress2 = walletService.getSyncProgress();
      expect(progress1).not.toBe(progress2);
      expect(progress1).toEqual(progress2);
    });
  });

  describe('isSyncInProgress', () => {
    it('should return false initially', () => {
      expect(walletService.isSyncInProgress()).toBe(false);
    });
  });

  describe('getWallet', () => {
    it('should throw error if wallet not initialized', () => {
      expect(() => walletService.getWallet()).toThrow('Wallet not initialized');
    });

    it('should return wallet after start', async () => {
      await walletService.start();

      const wallet = walletService.getWallet();
      expect(wallet).toBe(mockWallet);
    });
  });

  describe('getAgentId', () => {
    it('should return configured agent ID', () => {
      expect(walletService.getAgentId()).toBe('test-agent-123');
    });
  });

  describe('waitForSync', () => {
    it('should resolve immediately if already synced', async () => {
      // Default state is synced: true
      await walletService.start();

      // Should resolve immediately
      await walletService.waitForSync(1000);
    });

    it('should timeout if sync does not complete', async () => {
      mockStateSubject.next(createMockState({
        synced: false,
        applyGap: 100n,
        sourceGap: 50n,
      }));
      await walletService.start();

      // Short timeout to make test fast
      await expect(walletService.waitForSync(100)).rejects.toThrow('Wallet sync timeout');
    });
  });

  describe('isReady', () => {
    it('should return false before start', () => {
      expect(walletService.isReady()).toBe(false);
    });

    it('should return true after successful start', async () => {
      await walletService.start();
      expect(walletService.isReady()).toBe(true);
    });

    it('should return false after close', async () => {
      await walletService.start();
      await walletService.close();
      expect(walletService.isReady()).toBe(false);
    });
  });

  describe('state subscription handling', () => {
    it('should update balance when state changes', async () => {
      await walletService.start();
      expect(walletService.getBalance()).toBe(1000n);

      // Emit new state with different balance
      mockStateSubject.next(createMockState({ balances: { unshielded: 2000n } }));

      // Give time for async update
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(walletService.getBalance()).toBe(2000n);
    });

    it('should track sync progress from state updates', async () => {
      mockStateSubject.next(createMockState({
        synced: false,
        applyGap: 50n,
        sourceGap: 100n,
      }));
      await walletService.start();

      const progress = walletService.getSyncProgress();
      expect(progress.synced).toBe(false);
      expect(progress.applyGap).toBe(50n);
      expect(progress.sourceGap).toBe(100n);
    });

    it('should detect sync completion', async () => {
      mockStateSubject.next(createMockState({
        synced: false,
        applyGap: 10n,
        sourceGap: 5n,
      }));
      await walletService.start();

      expect(walletService.getSyncProgress().synced).toBe(false);

      // Emit synced state
      mockStateSubject.next(createMockState({
        synced: true,
        applyGap: 0n,
        sourceGap: 0n,
      }));
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(walletService.getSyncProgress().synced).toBe(true);
    });
  });
});
