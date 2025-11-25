/**
 * Token Tools Unit Tests
 *
 * Tests for token-related MCP tools and their execute functions.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

import {
  TOKEN_TOOLS,
  getTokenBalanceTool,
  registerTokenTool,
  sendShieldedTokenTool,
  sendNativeTokenTool,
  listTokensTool,
  GetTokenBalanceSchema,
  RegisterTokenSchema,
  SendShieldedTokenSchema,
  SendNativeTokenSchema,
  ListTokensSchema,
} from '../../../../src/mcp/tools/token-tools.js';
import type { ServiceDependencies } from '../../../../src/mcp/types.js';

// Mock services
function createMockServices(): ServiceDependencies {
  return {
    walletService: {} as any,
    transactionService: {} as any,
    tokenService: {
      getTokenBalance: jest.fn((tokenId: string) => ({
        tokenId,
        balance: '5000000',
        decimals: 6,
      })),
      registerToken: jest.fn((name: string, symbol: string, contractAddress: string, decimals: number) => ({
        success: true,
        token: { name, symbol, contractAddress, decimals },
      })),
      sendShieldedToken: jest.fn((tokenId: string, destination: string, amount: bigint) => ({
        transactionId: 'tx-shielded-123',
        tokenId,
        amount: amount.toString(),
        destination,
        status: 'pending',
      })),
      sendNativeToken: jest.fn((destination: string, amount: bigint) => ({
        transactionId: 'tx-native-456',
        amount: amount.toString(),
        destination,
        status: 'pending',
      })),
      listTokens: jest.fn(() => [
        { name: 'TestToken', symbol: 'TST', contractAddress: '0xtoken1', decimals: 6 },
        { name: 'MockCoin', symbol: 'MCK', contractAddress: '0xtoken2', decimals: 8 },
      ]),
    } as any,
    daoService: {} as any,
    marketplaceService: {} as any,
  };
}

describe('Token Tools', () => {
  let mockServices: ServiceDependencies;

  beforeEach(() => {
    mockServices = createMockServices();
  });

  describe('TOKEN_TOOLS collection', () => {
    it('should export array of token tools', () => {
      expect(Array.isArray(TOKEN_TOOLS)).toBe(true);
      expect(TOKEN_TOOLS.length).toBe(5); // Updated: now 5 tools
    });

    it('should contain expected tools', () => {
      const toolNames = TOKEN_TOOLS.map((t) => t.name);
      expect(toolNames).toContain('getTokenBalance');
      expect(toolNames).toContain('registerToken');
      expect(toolNames).toContain('sendShieldedToken');
      expect(toolNames).toContain('sendNativeToken');
      expect(toolNames).toContain('listTokens');
    });
  });

  describe('getTokenBalanceTool', () => {
    it('should have correct metadata', () => {
      expect(getTokenBalanceTool.name).toBe('getTokenBalance');
      expect(getTokenBalanceTool.description).toContain('balance');
      expect(typeof getTokenBalanceTool.execute).toBe('function');
    });

    it('should execute and return token balance', async () => {
      const result = await getTokenBalanceTool.execute(
        { tokenName: 'TestToken' },
        mockServices
      );

      expect(result).toEqual({
        tokenId: 'TestToken',
        balance: '5000000',
        decimals: 6,
      });
    });

    it('should call getTokenBalance with correct token name', async () => {
      await getTokenBalanceTool.execute({ tokenName: 'MockCoin' }, mockServices);

      expect(mockServices.tokenService.getTokenBalance).toHaveBeenCalledWith('MockCoin');
    });
  });

  describe('registerTokenTool', () => {
    it('should have correct metadata', () => {
      expect(registerTokenTool.name).toBe('registerToken');
      expect(registerTokenTool.description).toContain('Register');
      expect(typeof registerTokenTool.execute).toBe('function');
    });

    it('should execute and register token', async () => {
      const result = await registerTokenTool.execute(
        {
          name: 'NewToken',
          symbol: 'NEW',
          contractAddress: '0xnewtoken',
          decimals: 8,
        },
        mockServices
      );

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('token');
    });

    it('should call registerToken with correct parameters', async () => {
      await registerTokenTool.execute(
        {
          name: 'NewToken',
          symbol: 'NEW',
          contractAddress: '0xnewtoken',
          decimals: 8,
        },
        mockServices
      );

      expect(mockServices.tokenService.registerToken).toHaveBeenCalledWith(
        'NewToken',
        'NEW',
        '0xnewtoken',
        8
      );
    });

    it('should use default decimals when not provided', async () => {
      const input = RegisterTokenSchema.parse({
        name: 'DefaultToken',
        symbol: 'DEF',
        contractAddress: '0xdefault',
      });

      expect(input.decimals).toBe(6); // Default value
    });
  });

  describe('sendShieldedTokenTool', () => {
    it('should have correct metadata', () => {
      expect(sendShieldedTokenTool.name).toBe('sendShieldedToken');
      expect(sendShieldedTokenTool.description).toContain('shielded');
      expect(typeof sendShieldedTokenTool.execute).toBe('function');
    });

    it('should execute and send shielded tokens', async () => {
      const result = await sendShieldedTokenTool.execute(
        {
          tokenId: 'custom_token:0xcontract',
          destinationAddress: 'addr_test1qzx8m3qasx97l6lcrzfht5hc0g0v8l9lgs3yqgekkj5ru6nptlsaw',
          amount: '1000000',
        },
        mockServices
      );

      expect(result).toHaveProperty('transactionId');
      expect(result).toHaveProperty('status', 'pending');
    });

    it('should call sendShieldedToken with correct parameters', async () => {
      await sendShieldedTokenTool.execute(
        {
          tokenId: 'custom_token:0xcontract',
          destinationAddress: 'addr_test1qzx8m3qasx97l6lcrzfht5hc0g0v8l9lgs3yqgekkj5ru6nptlsaw',
          amount: '1000000',
        },
        mockServices
      );

      expect(mockServices.tokenService.sendShieldedToken).toHaveBeenCalledWith(
        'custom_token:0xcontract',
        'addr_test1qzx8m3qasx97l6lcrzfht5hc0g0v8l9lgs3yqgekkj5ru6nptlsaw',
        1000000n
      );
    });
  });

  describe('sendNativeTokenTool', () => {
    it('should have correct metadata', () => {
      expect(sendNativeTokenTool.name).toBe('sendNativeToken');
      expect(sendNativeTokenTool.description).toContain('native');
      expect(typeof sendNativeTokenTool.execute).toBe('function');
    });

    it('should execute and send native tokens', async () => {
      const result = await sendNativeTokenTool.execute(
        {
          destinationAddress: 'addr_test1qzx8m3qasx97l6lcrzfht5hc0g0v8l9lgs3yqgekkj5ru6nptlsaw',
          amount: '5000000',
        },
        mockServices
      );

      expect(result).toHaveProperty('transactionId');
      expect(result).toHaveProperty('status', 'pending');
    });

    it('should call sendNativeToken with correct parameters', async () => {
      await sendNativeTokenTool.execute(
        {
          destinationAddress: 'addr_test1qzx8m3qasx97l6lcrzfht5hc0g0v8l9lgs3yqgekkj5ru6nptlsaw',
          amount: '5000000',
        },
        mockServices
      );

      expect(mockServices.tokenService.sendNativeToken).toHaveBeenCalledWith(
        'addr_test1qzx8m3qasx97l6lcrzfht5hc0g0v8l9lgs3yqgekkj5ru6nptlsaw',
        5000000n
      );
    });
  });

  describe('listTokensTool', () => {
    it('should have correct metadata', () => {
      expect(listTokensTool.name).toBe('listTokens');
      expect(listTokensTool.description).toContain('List');
      expect(typeof listTokensTool.execute).toBe('function');
    });

    it('should execute and return token list', async () => {
      const result = await listTokensTool.execute({}, mockServices);

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
      expect((result as any[])[0]).toHaveProperty('name', 'TestToken');
      expect((result as any[])[1]).toHaveProperty('symbol', 'MCK');
    });

    it('should call listTokens service method', async () => {
      await listTokensTool.execute({}, mockServices);

      expect(mockServices.tokenService.listTokens).toHaveBeenCalled();
    });
  });

  describe('Schema Validation', () => {
    describe('GetTokenBalanceSchema', () => {
      it('should accept valid token name', () => {
        expect(() => GetTokenBalanceSchema.parse({ tokenName: 'TestToken' })).not.toThrow();
      });

      it('should reject empty token name', () => {
        expect(() => GetTokenBalanceSchema.parse({ tokenName: '' })).toThrow();
      });

      it('should reject missing token name', () => {
        expect(() => GetTokenBalanceSchema.parse({})).toThrow();
      });
    });

    describe('RegisterTokenSchema', () => {
      it('should accept valid token registration', () => {
        const validInput = {
          name: 'TestToken',
          symbol: 'TST',
          contractAddress: '0xcontract',
          decimals: 6,
        };
        expect(() => RegisterTokenSchema.parse(validInput)).not.toThrow();
      });

      it('should accept registration without decimals (uses default)', () => {
        const inputWithoutDecimals = {
          name: 'TestToken',
          symbol: 'TST',
          contractAddress: '0xcontract',
        };
        const result = RegisterTokenSchema.parse(inputWithoutDecimals);
        expect(result.decimals).toBe(6);
      });

      it('should reject empty name', () => {
        expect(() =>
          RegisterTokenSchema.parse({
            name: '',
            symbol: 'TST',
            contractAddress: '0xcontract',
          })
        ).toThrow();
      });

      it('should reject symbol longer than 10 characters', () => {
        expect(() =>
          RegisterTokenSchema.parse({
            name: 'TestToken',
            symbol: 'VERYLONGSYMBOL',
            contractAddress: '0xcontract',
          })
        ).toThrow();
      });

      it('should reject decimals greater than 18', () => {
        expect(() =>
          RegisterTokenSchema.parse({
            name: 'TestToken',
            symbol: 'TST',
            contractAddress: '0xcontract',
            decimals: 20,
          })
        ).toThrow();
      });

      it('should reject negative decimals', () => {
        expect(() =>
          RegisterTokenSchema.parse({
            name: 'TestToken',
            symbol: 'TST',
            contractAddress: '0xcontract',
            decimals: -1,
          })
        ).toThrow();
      });
    });

    describe('SendShieldedTokenSchema', () => {
      it('should accept valid send request', () => {
        const validInput = {
          tokenId: 'custom_token:0xcontract',
          destinationAddress: 'addr_test1qzx8m3qasx97l6lcrzfht5hc0g0v8l9lgs3yqgekkj5ru6nptlsaw',
          amount: '1000000',
        };
        expect(() => SendShieldedTokenSchema.parse(validInput)).not.toThrow();
      });

      it('should reject invalid Midnight address', () => {
        expect(() =>
          SendShieldedTokenSchema.parse({
            tokenId: 'custom_token:0xcontract',
            destinationAddress: '0x1234',
            amount: '1000000',
          })
        ).toThrow();
      });

      it('should reject zero amount', () => {
        expect(() =>
          SendShieldedTokenSchema.parse({
            tokenId: 'custom_token:0xcontract',
            destinationAddress: 'addr_test1qzx8m3qasx97l6lcrzfht5hc0g0v8l9lgs3yqgekkj5ru6nptlsaw',
            amount: '0',
          })
        ).toThrow(/greater than zero/);
      });
    });

    describe('SendNativeTokenSchema', () => {
      it('should accept valid send request', () => {
        const validInput = {
          destinationAddress: 'addr_test1qzx8m3qasx97l6lcrzfht5hc0g0v8l9lgs3yqgekkj5ru6nptlsaw',
          amount: '5000000',
        };
        expect(() => SendNativeTokenSchema.parse(validInput)).not.toThrow();
      });

      it('should reject invalid Midnight address', () => {
        expect(() =>
          SendNativeTokenSchema.parse({
            destinationAddress: '0x1234',
            amount: '5000000',
          })
        ).toThrow();
      });

      it('should reject zero amount', () => {
        expect(() =>
          SendNativeTokenSchema.parse({
            destinationAddress: 'addr_test1qzx8m3qasx97l6lcrzfht5hc0g0v8l9lgs3yqgekkj5ru6nptlsaw',
            amount: '0',
          })
        ).toThrow(/greater than zero/);
      });
    });

    describe('ListTokensSchema', () => {
      it('should accept empty object', () => {
        expect(() => ListTokensSchema.parse({})).not.toThrow();
      });
    });
  });
});
