/**
 * Wallet Tools Unit Tests
 *
 * Tests for wallet-related MCP tools and their execute functions.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

import {
  WALLET_TOOLS,
  walletStatusTool,
  walletAddressTool,
  walletBalanceTool,
  getTransactionTool,
  WalletStatusSchema,
  WalletAddressSchema,
  WalletBalanceSchema,
  SendSchema,
  GetTransactionSchema,
} from '../../../../src/mcp/tools/wallet-tools.js';
import type { ServiceDependencies } from '../../../../src/mcp/types.js';

// Mock services
function createMockServices(): ServiceDependencies {
  return {
    walletService: {
      isReady: jest.fn(() => true),
      getAddress: jest.fn(() => 'addr_test1qmockaddress123456789'),
      getBalance: jest.fn(() => 1000000n),
      getPendingBalance: jest.fn(() => 50000n),
      getSyncProgress: jest.fn(() => ({ synced: true, syncPercentage: 100, applyGap: 0n, sourceGap: 0n })),
      isSyncInProgress: jest.fn(() => false),
    } as any,
    transactionService: {
      getTransaction: jest.fn((txId: string) => ({
        id: txId,
        status: 'confirmed',
        amount: '100000',
        timestamp: Date.now(),
      })),
    } as any,
    tokenService: {} as any,
    daoService: {} as any,
    marketplaceService: {} as any,
  };
}

describe('Wallet Tools', () => {
  let mockServices: ServiceDependencies;

  beforeEach(() => {
    mockServices = createMockServices();
  });

  describe('WALLET_TOOLS collection', () => {
    it('should export array of wallet tools', () => {
      expect(Array.isArray(WALLET_TOOLS)).toBe(true);
      expect(WALLET_TOOLS.length).toBeGreaterThan(0);
    });

    it('should contain expected tools', () => {
      const toolNames = WALLET_TOOLS.map((t) => t.name);
      expect(toolNames).toContain('walletStatus');
      expect(toolNames).toContain('walletAddress');
      expect(toolNames).toContain('walletBalance');
      expect(toolNames).toContain('getTransaction');
    });
  });

  describe('walletStatusTool', () => {
    it('should have correct metadata', () => {
      expect(walletStatusTool.name).toBe('walletStatus');
      expect(walletStatusTool.description).toContain('synchronization');
      expect(typeof walletStatusTool.execute).toBe('function');
    });

    it('should execute and return wallet status', async () => {
      const result = await walletStatusTool.execute({}, mockServices);

      expect(result).toEqual({
        isReady: true,
        address: 'addr_test1qmockaddress123456789',
        balance: '1000000',
        syncProgress: { synced: true, syncPercentage: 100, applyGap: 0n, sourceGap: 0n },
        isSyncing: false,
      });
    });

    it('should call correct service methods', async () => {
      await walletStatusTool.execute({}, mockServices);

      expect(mockServices.walletService.isReady).toHaveBeenCalled();
      expect(mockServices.walletService.getAddress).toHaveBeenCalled();
      expect(mockServices.walletService.getBalance).toHaveBeenCalled();
      expect(mockServices.walletService.getSyncProgress).toHaveBeenCalled();
      expect(mockServices.walletService.isSyncInProgress).toHaveBeenCalled();
    });
  });

  describe('walletAddressTool', () => {
    it('should have correct metadata', () => {
      expect(walletAddressTool.name).toBe('walletAddress');
      expect(walletAddressTool.description).toContain('address');
      expect(typeof walletAddressTool.execute).toBe('function');
    });

    it('should execute and return wallet address', async () => {
      const result = await walletAddressTool.execute({}, mockServices);

      expect(result).toEqual({
        address: 'addr_test1qmockaddress123456789',
      });
    });

    it('should call getAddress service method', async () => {
      await walletAddressTool.execute({}, mockServices);

      expect(mockServices.walletService.getAddress).toHaveBeenCalled();
    });
  });

  describe('walletBalanceTool', () => {
    it('should have correct metadata', () => {
      expect(walletBalanceTool.name).toBe('walletBalance');
      expect(walletBalanceTool.description).toContain('balance');
      expect(typeof walletBalanceTool.execute).toBe('function');
    });

    it('should execute and return balance info', async () => {
      const result = await walletBalanceTool.execute({}, mockServices);

      expect(result).toEqual({
        balance: '1000000',
        pendingBalance: '50000',
      });
    });

    it('should call balance service methods', async () => {
      await walletBalanceTool.execute({}, mockServices);

      expect(mockServices.walletService.getBalance).toHaveBeenCalled();
      expect(mockServices.walletService.getPendingBalance).toHaveBeenCalled();
    });
  });

  describe('getTransactionTool', () => {
    it('should have correct metadata', () => {
      expect(getTransactionTool.name).toBe('getTransaction');
      expect(getTransactionTool.description).toContain('transaction');
      expect(typeof getTransactionTool.execute).toBe('function');
    });

    it('should execute and return transaction details', async () => {
      const result = await getTransactionTool.execute(
        { transactionId: 'tx-123' },
        mockServices
      );

      expect(result).toHaveProperty('id', 'tx-123');
      expect(result).toHaveProperty('status', 'confirmed');
    });

    it('should call getTransaction with correct ID', async () => {
      await getTransactionTool.execute({ transactionId: 'tx-456' }, mockServices);

      expect(mockServices.transactionService.getTransaction).toHaveBeenCalledWith('tx-456');
    });

    it('should validate transactionId is required', () => {
      expect(() => GetTransactionSchema.parse({})).toThrow();
    });

    it('should validate transactionId is not empty', () => {
      expect(() => GetTransactionSchema.parse({ transactionId: '' })).toThrow();
    });
  });

  describe('Schema Validation', () => {
    describe('WalletStatusSchema', () => {
      it('should accept empty object', () => {
        expect(() => WalletStatusSchema.parse({})).not.toThrow();
      });
    });

    describe('WalletAddressSchema', () => {
      it('should accept empty object', () => {
        expect(() => WalletAddressSchema.parse({})).not.toThrow();
      });
    });

    describe('WalletBalanceSchema', () => {
      it('should accept empty object', () => {
        expect(() => WalletBalanceSchema.parse({})).not.toThrow();
      });
    });

    describe('SendSchema', () => {
      it('should accept valid Bech32m address and amount', () => {
        const validInput = {
          destinationAddress: 'addr_test1qzx8m3qasx97l6lcrzfht5hc0g0v8l9lgs3yqgekkj5ru6nptlsaw',
          amount: '1000000',
        };
        expect(() => SendSchema.parse(validInput)).not.toThrow();
      });

      it('should reject invalid address format', () => {
        const invalidInput = {
          destinationAddress: '0x1234567890abcdef', // Ethereum format
          amount: '1000000',
        };
        expect(() => SendSchema.parse(invalidInput)).toThrow(/Bech32m/);
      });

      it('should reject non-numeric amount', () => {
        const invalidInput = {
          destinationAddress: 'addr_test1qzx8m3qasx97l6lcrzfht5hc0g0v8l9lgs3yqgekkj5ru6nptlsaw',
          amount: 'abc',
        };
        expect(() => SendSchema.parse(invalidInput)).toThrow();
      });

      it('should reject zero amount', () => {
        const invalidInput = {
          destinationAddress: 'addr_test1qzx8m3qasx97l6lcrzfht5hc0g0v8l9lgs3yqgekkj5ru6nptlsaw',
          amount: '0',
        };
        expect(() => SendSchema.parse(invalidInput)).toThrow(/greater than zero/);
      });

      it('should reject negative amount (as string)', () => {
        const invalidInput = {
          destinationAddress: 'addr_test1qzx8m3qasx97l6lcrzfht5hc0g0v8l9lgs3yqgekkj5ru6nptlsaw',
          amount: '-100',
        };
        expect(() => SendSchema.parse(invalidInput)).toThrow();
      });
    });

    describe('GetTransactionSchema', () => {
      it('should accept valid transaction ID', () => {
        expect(() => GetTransactionSchema.parse({ transactionId: 'tx-123' })).not.toThrow();
      });

      it('should reject empty transaction ID', () => {
        expect(() => GetTransactionSchema.parse({ transactionId: '' })).toThrow();
      });

      it('should reject missing transaction ID', () => {
        expect(() => GetTransactionSchema.parse({})).toThrow();
      });
    });
  });
});
