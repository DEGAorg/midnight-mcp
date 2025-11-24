/**
 * MarketplaceService Unit Tests
 *
 * Tests for marketplace operations:
 * - Service initialization
 * - User registration
 * - User verification
 * - User queries
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock dependencies
jest.mock('../../../../../src/lib/logger/index.js', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

jest.mock('../../../../../src/lib/config/constants.js', () => ({
  MARKETPLACE_CONFIG: {},
}));

jest.mock('../../../../../src/services/providers/ProviderFactory.js', () => ({
  ProviderFactory: {
    createMarketplaceProviders: jest.fn().mockResolvedValue({
      midnightProvider: {},
      publicDataProvider: {},
    }),
  },
}));

import {
  MarketplaceService,
  MarketplaceServiceConfig,
  UserRegistrationData,
  UserVerificationData,
} from '../../../../../src/services/contract/marketplace/MarketplaceService.js';

describe('MarketplaceService', () => {
  let marketplaceService: MarketplaceService;
  let mockWalletService: any;
  let mockAuditService: any;
  let mockConfig: MarketplaceServiceConfig;

  beforeEach(() => {
    jest.clearAllMocks();

    mockWalletService = {
      getWallet: jest.fn(() => ({ mock: 'wallet' })),
    };

    mockAuditService = {
      generateCorrelationId: jest.fn(() => 'corr-marketplace-001'),
      startTransactionTrace: jest.fn(),
      completeTransactionTrace: jest.fn(),
      logTransactionFailure: jest.fn(),
    };

    mockConfig = {
      walletService: mockWalletService,
      auditService: mockAuditService,
      contractAddress: '0xMarketplaceContract123',
      agentId: 'test-agent-marketplace',
    };

    marketplaceService = new MarketplaceService(mockConfig);
  });

  describe('constructor', () => {
    it('should initialize with provided config', () => {
      expect(marketplaceService).toBeDefined();
    });
  });

  describe('start', () => {
    it('should start and create providers', async () => {
      await marketplaceService.start();

      const { ProviderFactory } = jest.requireMock('../../../../../src/services/providers/ProviderFactory.js');
      expect(ProviderFactory.createMarketplaceProviders).toHaveBeenCalled();
    });

    it('should throw if provider creation fails', async () => {
      const { ProviderFactory } = jest.requireMock('../../../../../src/services/providers/ProviderFactory.js');
      ProviderFactory.createMarketplaceProviders.mockRejectedValueOnce(new Error('Provider error'));

      await expect(marketplaceService.start()).rejects.toThrow('Provider error');
    });
  });

  describe('stop', () => {
    it('should stop without error', () => {
      marketplaceService.stop();
    });
  });

  describe('registerUser', () => {
    it('should throw if service not started', async () => {
      const registrationData: UserRegistrationData = {
        userId: 'user-123',
        displayName: 'Test User',
      };

      await expect(marketplaceService.registerUser(registrationData))
        .rejects.toThrow('Marketplace service not started');
    });

    it('should register user and return transaction ID', async () => {
      await marketplaceService.start();

      const registrationData: UserRegistrationData = {
        userId: 'user-123',
        displayName: 'Test User',
        metadata: { email: 'test@example.com' },
      };

      const txId = await marketplaceService.registerUser(registrationData);

      expect(txId).toContain('marketplace-register-user-123');
      expect(mockAuditService.startTransactionTrace).toHaveBeenCalled();
      expect(mockAuditService.completeTransactionTrace).toHaveBeenCalled();
    });

    it('should register user without optional fields', async () => {
      await marketplaceService.start();

      const registrationData: UserRegistrationData = {
        userId: 'user-456',
      };

      const txId = await marketplaceService.registerUser(registrationData);

      expect(txId).toContain('marketplace-register-user-456');
    });
  });

  describe('verifyUser', () => {
    it('should throw if service not started', async () => {
      const verificationData: UserVerificationData = {
        verificationType: 'kyc',
      };

      await expect(marketplaceService.verifyUser('user-123', verificationData))
        .rejects.toThrow('Marketplace service not started');
    });

    it('should verify user and return transaction ID', async () => {
      await marketplaceService.start();

      const verificationData: UserVerificationData = {
        verificationType: 'kyc',
        proof: { document: 'passport' },
        metadata: { verified: true },
      };

      const txId = await marketplaceService.verifyUser('user-123', verificationData);

      expect(txId).toContain('marketplace-verify-user-123');
      expect(mockAuditService.startTransactionTrace).toHaveBeenCalled();
      expect(mockAuditService.completeTransactionTrace).toHaveBeenCalled();
    });

    it('should support different verification types', async () => {
      await marketplaceService.start();

      const kycVerification: UserVerificationData = { verificationType: 'kyc' };
      const emailVerification: UserVerificationData = { verificationType: 'email' };
      const phoneVerification: UserVerificationData = { verificationType: 'phone' };

      await expect(marketplaceService.verifyUser('user-1', kycVerification)).resolves.toBeDefined();
      await expect(marketplaceService.verifyUser('user-2', emailVerification)).resolves.toBeDefined();
      await expect(marketplaceService.verifyUser('user-3', phoneVerification)).resolves.toBeDefined();
    });
  });

  describe('isUserRegistered', () => {
    it('should throw if service not started', async () => {
      await expect(marketplaceService.isUserRegistered('user-123'))
        .rejects.toThrow('Marketplace service not started');
    });

    it('should return false (placeholder implementation)', async () => {
      await marketplaceService.start();

      const isRegistered = await marketplaceService.isUserRegistered('user-123');

      expect(isRegistered).toBe(false);
    });
  });

  describe('isUserVerified', () => {
    it('should throw if service not started', async () => {
      await expect(marketplaceService.isUserVerified('user-123'))
        .rejects.toThrow('Marketplace service not started');
    });

    it('should return false (placeholder implementation)', async () => {
      await marketplaceService.start();

      const isVerified = await marketplaceService.isUserVerified('user-123');

      expect(isVerified).toBe(false);
    });
  });

  describe('getUserInfo', () => {
    it('should throw if service not started', async () => {
      await expect(marketplaceService.getUserInfo('user-123'))
        .rejects.toThrow('Marketplace service not started');
    });

    it('should return undefined (placeholder implementation)', async () => {
      await marketplaceService.start();

      const userInfo = await marketplaceService.getUserInfo('user-123');

      expect(userInfo).toBeUndefined();
    });
  });
});
