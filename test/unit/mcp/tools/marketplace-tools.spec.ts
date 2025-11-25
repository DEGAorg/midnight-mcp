/**
 * Marketplace Tools Unit Tests
 *
 * Tests for marketplace-related MCP tools and their execute functions.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

import {
  MARKETPLACE_TOOLS,
  getUserInfoTool,
  isUserRegisteredTool,
  isUserVerifiedTool,
  GetUserInfoSchema,
  IsUserRegisteredSchema,
  IsUserVerifiedSchema,
} from '../../../../src/mcp/tools/marketplace-tools.js';
import type { ServiceDependencies } from '../../../../src/mcp/types.js';

// Mock services
function createMockServices(): ServiceDependencies {
  return {
    walletService: {} as any,
    transactionService: {} as any,
    tokenService: {} as any,
    daoService: {} as any,
    marketplaceService: {
      getUserInfo: jest.fn((userId: string) => ({
        userId,
        name: 'Test User',
        email: 'test@example.com',
        registeredAt: '2024-01-01T00:00:00Z',
        verified: true,
      })),
      isUserRegistered: jest.fn((userId: string) => {
        // Mock: users starting with 'registered' are registered
        return userId.startsWith('registered');
      }),
      isUserVerified: jest.fn((userId: string) => {
        // Mock: users starting with 'verified' are verified
        return userId.startsWith('verified');
      }),
    } as any,
  };
}

describe('Marketplace Tools', () => {
  let mockServices: ServiceDependencies;

  beforeEach(() => {
    mockServices = createMockServices();
  });

  describe('MARKETPLACE_TOOLS collection', () => {
    it('should export array of marketplace tools', () => {
      expect(Array.isArray(MARKETPLACE_TOOLS)).toBe(true);
      expect(MARKETPLACE_TOOLS.length).toBe(3);
    });

    it('should contain expected tools', () => {
      const toolNames = MARKETPLACE_TOOLS.map((t) => t.name);
      expect(toolNames).toContain('getUserInfo');
      expect(toolNames).toContain('isUserRegistered');
      expect(toolNames).toContain('isUserVerified');
    });
  });

  describe('getUserInfoTool', () => {
    it('should have correct metadata', () => {
      expect(getUserInfoTool.name).toBe('getUserInfo');
      expect(getUserInfoTool.description).toContain('information');
      expect(typeof getUserInfoTool.execute).toBe('function');
    });

    it('should execute and return user info', async () => {
      const result = await getUserInfoTool.execute(
        { userId: 'user-123' },
        mockServices
      );

      expect(result).toHaveProperty('userId', 'user-123');
      expect(result).toHaveProperty('name', 'Test User');
      expect(result).toHaveProperty('email', 'test@example.com');
      expect(result).toHaveProperty('verified', true);
    });

    it('should call getUserInfo with correct user ID', async () => {
      await getUserInfoTool.execute({ userId: 'another-user' }, mockServices);

      expect(mockServices.marketplaceService.getUserInfo).toHaveBeenCalledWith('another-user');
    });
  });

  describe('isUserRegisteredTool', () => {
    it('should have correct metadata', () => {
      expect(isUserRegisteredTool.name).toBe('isUserRegistered');
      expect(isUserRegisteredTool.description).toContain('registered');
      expect(typeof isUserRegisteredTool.execute).toBe('function');
    });

    it('should execute and return registration status for registered user', async () => {
      const result = await isUserRegisteredTool.execute(
        { userId: 'registered-user-1' },
        mockServices
      );

      expect(result).toEqual({
        userId: 'registered-user-1',
        isRegistered: true,
      });
    });

    it('should execute and return false for unregistered user', async () => {
      const result = await isUserRegisteredTool.execute(
        { userId: 'unknown-user' },
        mockServices
      );

      expect(result).toEqual({
        userId: 'unknown-user',
        isRegistered: false,
      });
    });

    it('should call isUserRegistered with correct user ID', async () => {
      await isUserRegisteredTool.execute({ userId: 'check-user' }, mockServices);

      expect(mockServices.marketplaceService.isUserRegistered).toHaveBeenCalledWith('check-user');
    });
  });

  describe('isUserVerifiedTool', () => {
    it('should have correct metadata', () => {
      expect(isUserVerifiedTool.name).toBe('isUserVerified');
      expect(isUserVerifiedTool.description).toContain('verified');
      expect(typeof isUserVerifiedTool.execute).toBe('function');
    });

    it('should execute and return verification status for verified user', async () => {
      const result = await isUserVerifiedTool.execute(
        { userId: 'verified-user-1' },
        mockServices
      );

      expect(result).toEqual({
        userId: 'verified-user-1',
        isVerified: true,
      });
    });

    it('should execute and return false for unverified user', async () => {
      const result = await isUserVerifiedTool.execute(
        { userId: 'unverified-user' },
        mockServices
      );

      expect(result).toEqual({
        userId: 'unverified-user',
        isVerified: false,
      });
    });

    it('should call isUserVerified with correct user ID', async () => {
      await isUserVerifiedTool.execute({ userId: 'verify-check' }, mockServices);

      expect(mockServices.marketplaceService.isUserVerified).toHaveBeenCalledWith('verify-check');
    });
  });

  describe('Schema Validation', () => {
    describe('GetUserInfoSchema', () => {
      it('should accept valid user ID', () => {
        expect(() => GetUserInfoSchema.parse({ userId: 'user-123' })).not.toThrow();
      });

      it('should accept user ID with various characters', () => {
        expect(() => GetUserInfoSchema.parse({ userId: 'user_123-abc' })).not.toThrow();
      });

      it('should reject empty user ID', () => {
        expect(() => GetUserInfoSchema.parse({ userId: '' })).toThrow();
      });

      it('should reject missing user ID', () => {
        expect(() => GetUserInfoSchema.parse({})).toThrow();
      });
    });

    describe('IsUserRegisteredSchema', () => {
      it('should accept valid user ID', () => {
        expect(() => IsUserRegisteredSchema.parse({ userId: 'check-user' })).not.toThrow();
      });

      it('should reject empty user ID', () => {
        expect(() => IsUserRegisteredSchema.parse({ userId: '' })).toThrow();
      });

      it('should reject missing user ID', () => {
        expect(() => IsUserRegisteredSchema.parse({})).toThrow();
      });
    });

    describe('IsUserVerifiedSchema', () => {
      it('should accept valid user ID', () => {
        expect(() => IsUserVerifiedSchema.parse({ userId: 'verify-user' })).not.toThrow();
      });

      it('should reject empty user ID', () => {
        expect(() => IsUserVerifiedSchema.parse({ userId: '' })).toThrow();
      });

      it('should reject missing user ID', () => {
        expect(() => IsUserVerifiedSchema.parse({})).toThrow();
      });
    });
  });

  describe('Tool Structure', () => {
    it('all tools should have required properties', () => {
      MARKETPLACE_TOOLS.forEach((tool) => {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('inputSchema');
        expect(tool).toHaveProperty('execute');
        expect(typeof tool.name).toBe('string');
        expect(typeof tool.description).toBe('string');
        expect(typeof tool.execute).toBe('function');
      });
    });

    it('all tool names should be unique', () => {
      const names = MARKETPLACE_TOOLS.map((t) => t.name);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });
  });
});
