/**
 * TokenService Unit Tests
 *
 * Tests for token management:
 * - Token registration
 * - Token balance queries
 * - Token operations (send)
 * - Token type generation
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock dependencies before importing TokenService
jest.mock('../../../../src/lib/logger/index.js', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

jest.mock('../../../../src/lib/config/constants.js', () => ({
  TOKEN_CONFIG: {
    DEFAULT_DECIMALS: 6,
    DEFAULT_DOMAIN_SEPARATOR: 'token',
  },
}));

jest.mock('@midnight-ntwrk/compact-runtime', () => ({
  tokenType: jest.fn((domainSep: Uint8Array, contractAddress: string) => {
    return `tokentype_${contractAddress}`;
  }),
}));

import { TokenService, TokenServiceConfig, TokenInfo } from '../../../../src/services/wallet/TokenService.js';

describe('TokenService', () => {
  let tokenService: TokenService;
  let mockWalletService: any;
  let mockTransactionService: any;
  let mockTokenDb: any;
  let mockConfig: TokenServiceConfig;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock wallet service
    mockWalletService = {
      getWalletState: jest.fn(() => ({
        balances: {
          'tokentype_0xContract123': 1000000n,
          'tokentype_0xContract456': 500000n,
        },
      })),
      getWallet: jest.fn(() => ({
        transferTransaction: (jest.fn() as any).mockResolvedValue({ recipe: 'mock' }),
        proveTransaction: (jest.fn() as any).mockResolvedValue('proven-tx'),
        submitTransaction: (jest.fn() as any).mockResolvedValue('tx-identifier-123'),
      })),
    };

    // Create mock transaction service
    mockTransactionService = {
      createTransaction: jest.fn(() => 'tx-001'),
      markTransactionSent: jest.fn(),
      markTransactionFailed: jest.fn(),
    };

    // Create mock token database
    mockTokenDb = {
      getTokenByName: jest.fn(() => null),
      getTokenByTokenTypeHex: jest.fn(() => null),
      registerToken: jest.fn(),
    };

    mockConfig = {
      walletService: mockWalletService,
      transactionService: mockTransactionService,
      tokenDb: mockTokenDb,
      agentId: 'test-agent-123',
    };

    tokenService = new TokenService(mockConfig);
  });

  describe('constructor', () => {
    it('should initialize with provided config', () => {
      expect(tokenService).toBeDefined();
      expect(tokenService.getTokenCount()).toBe(0);
    });
  });

  describe('registerToken', () => {
    it('should register a new token', () => {
      const token = tokenService.registerToken(
        'TestToken',
        'TT',
        '0xContract123',
        6,
        'token'
      );

      expect(token.name).toBe('TestToken');
      expect(token.symbol).toBe('TT');
      expect(token.contractAddress).toBe('0xContract123');
      expect(token.decimals).toBe(6);
      expect(token.domainSeparator).toBe('token');
      expect(token.id).toBe('token:0xContract123');
      expect(tokenService.getTokenCount()).toBe(1);
      expect(mockTokenDb.registerToken).toHaveBeenCalled();
    });

    it('should use default decimals and domain separator', () => {
      const token = tokenService.registerToken(
        'DefaultToken',
        'DT',
        '0xContract789'
      );

      expect(token.decimals).toBe(6);
      expect(token.domainSeparator).toBe('token');
    });

    it('should return existing token from database without re-registering', () => {
      const existingToken = {
        name: 'ExistingToken',
        symbol: 'ET',
        contractAddress: '0xExisting',
        decimals: 8,
        domainSeparator: 'existing',
        tokenTypeHex: 'tokentype_0xExisting',
      };
      mockTokenDb.getTokenByName.mockReturnValue(existingToken);

      const token = tokenService.registerToken(
        'ExistingToken',
        'ET',
        '0xExisting',
        8,
        'existing'
      );

      expect(token.name).toBe('ExistingToken');
      expect(mockTokenDb.registerToken).not.toHaveBeenCalled();
    });

    it('should generate token type bytes', () => {
      const token = tokenService.registerToken(
        'TestToken',
        'TT',
        '0xContract123'
      );

      expect(token.tokenType).toBeInstanceOf(Uint8Array);
      expect(token.tokenType.length).toBe(64);
    });
  });

  describe('registerTokensBatch', () => {
    it('should register multiple tokens', () => {
      const configs = [
        { name: 'Token1', symbol: 'T1', contractAddress: '0x111' },
        { name: 'Token2', symbol: 'T2', contractAddress: '0x222' },
        { name: 'Token3', symbol: 'T3', contractAddress: '0x333' },
      ];

      const tokens = tokenService.registerTokensBatch(configs);

      expect(tokens.length).toBe(3);
      expect(tokenService.getTokenCount()).toBe(3);
    });

    it('should continue if one token fails', () => {
      mockTokenDb.getTokenByName
        .mockReturnValueOnce(null) // First token ok
        .mockImplementationOnce(() => { throw new Error('DB error'); }) // Second fails
        .mockReturnValueOnce(null); // Third ok

      const configs = [
        { name: 'Token1', symbol: 'T1', contractAddress: '0x111' },
        { name: 'Token2', symbol: 'T2', contractAddress: '0x222' },
        { name: 'Token3', symbol: 'T3', contractAddress: '0x333' },
      ];

      const tokens = tokenService.registerTokensBatch(configs);

      // Should have 2 successful registrations (first and third)
      expect(tokens.length).toBe(2);
    });
  });

  describe('getToken', () => {
    it('should return undefined for non-existent token', () => {
      expect(tokenService.getToken('nonexistent')).toBeUndefined();
    });

    it('should return token by ID', () => {
      tokenService.registerToken('TestToken', 'TT', '0xContract123');

      const token = tokenService.getToken('token:0xContract123');
      expect(token?.name).toBe('TestToken');
    });
  });

  describe('getTokenBySymbol', () => {
    it('should return undefined for non-existent symbol', () => {
      expect(tokenService.getTokenBySymbol('NONE')).toBeUndefined();
    });

    it('should return token by symbol', () => {
      tokenService.registerToken('TestToken', 'TT', '0xContract123');

      const token = tokenService.getTokenBySymbol('TT');
      expect(token?.name).toBe('TestToken');
    });
  });

  describe('listTokens', () => {
    it('should return empty array when no tokens registered', () => {
      expect(tokenService.listTokens()).toEqual([]);
    });

    it('should return all registered tokens', () => {
      tokenService.registerToken('Token1', 'T1', '0x111');
      tokenService.registerToken('Token2', 'T2', '0x222');

      const tokens = tokenService.listTokens();
      expect(tokens.length).toBe(2);
    });
  });

  describe('getTokenCount', () => {
    it('should return 0 for empty registry', () => {
      expect(tokenService.getTokenCount()).toBe(0);
    });

    it('should return correct count', () => {
      tokenService.registerToken('Token1', 'T1', '0x111');
      tokenService.registerToken('Token2', 'T2', '0x222');
      tokenService.registerToken('Token3', 'T3', '0x333');

      expect(tokenService.getTokenCount()).toBe(3);
    });
  });

  describe('getTokenBalance', () => {
    it('should throw for non-existent token', () => {
      expect(() => tokenService.getTokenBalance('nonexistent'))
        .toThrow('Token not found: nonexistent');
    });

    it('should return balance from wallet state', () => {
      tokenService.registerToken('TestToken', 'TT', '0xContract123');

      const balance = tokenService.getTokenBalance('token:0xContract123');
      expect(balance).toBe(1000000n);
    });

    it('should return 0n for token with no balance in wallet', () => {
      tokenService.registerToken('NewToken', 'NT', '0xNoBalance');

      const balance = tokenService.getTokenBalance('token:0xNoBalance');
      expect(balance).toBe(0n);
    });
  });

  describe('getTokenBalanceDecimal', () => {
    it('should throw for non-existent token', () => {
      expect(() => tokenService.getTokenBalanceDecimal('nonexistent'))
        .toThrow('Token not found: nonexistent');
    });

    it('should return balance as decimal string', () => {
      tokenService.registerToken('TestToken', 'TT', '0xContract123');

      const balance = tokenService.getTokenBalanceDecimal('token:0xContract123');
      expect(balance).toBe('1');
    });
  });

  describe('getAllTokenBalances', () => {
    it('should return empty array when no tokens', () => {
      expect(tokenService.getAllTokenBalances()).toEqual([]);
    });

    it('should return balances for all tokens', () => {
      tokenService.registerToken('Token1', 'T1', '0xContract123');
      tokenService.registerToken('Token2', 'T2', '0xContract456');

      const balances = tokenService.getAllTokenBalances();
      expect(balances.length).toBe(2);
      expect(balances[0].balance).toBe(1000000n);
      expect(balances[1].balance).toBe(500000n);
    });
  });

  describe('getNonZeroTokenBalances', () => {
    it('should filter out zero balances', () => {
      tokenService.registerToken('TokenWithBalance', 'TWB', '0xContract123');
      tokenService.registerToken('TokenZero', 'TZ', '0xNoBalance');

      const balances = tokenService.getNonZeroTokenBalances();
      expect(balances.length).toBe(1);
      expect(balances[0].token.symbol).toBe('TWB');
    });
  });

  describe('sendShieldedToken', () => {
    it('should throw for non-existent token', async () => {
      await expect(tokenService.sendShieldedToken('nonexistent', '0xRecipient', 100n))
        .rejects.toThrow('Token not found: nonexistent');
    });

    it('should throw for insufficient balance', async () => {
      tokenService.registerToken('TestToken', 'TT', '0xContract123');

      await expect(tokenService.sendShieldedToken('token:0xContract123', '0xRecipient', 9999999999n))
        .rejects.toThrow('Insufficient token balance');
    });

    it('should send shielded token successfully', async () => {
      tokenService.registerToken('TestToken', 'TT', '0xContract123');

      const txId = await tokenService.sendShieldedToken('token:0xContract123', '0xRecipient', 500000n);

      expect(txId).toBe('tx-001');
      expect(mockTransactionService.createTransaction).toHaveBeenCalledWith('0xRecipient', 500000n);
      expect(mockTransactionService.markTransactionSent).toHaveBeenCalledWith('tx-001', 'tx-identifier-123');
    });

    it('should mark transaction failed on error', async () => {
      tokenService.registerToken('TestToken', 'TT', '0xContract123');

      // Override getWallet to return a failing wallet
      mockWalletService.getWallet.mockReturnValue({
        transferTransaction: (jest.fn() as any).mockRejectedValue(new Error('Transfer failed')),
        proveTransaction: jest.fn() as any,
        submitTransaction: jest.fn() as any,
      });

      await expect(tokenService.sendShieldedToken('token:0xContract123', '0xRecipient', 500000n))
        .rejects.toThrow('Transfer failed');

      expect(mockTransactionService.markTransactionFailed).toHaveBeenCalled();
    });
  });

  describe('sendShieldedTokenDecimal', () => {
    it('should throw for non-existent token', async () => {
      await expect(tokenService.sendShieldedTokenDecimal('nonexistent', '0xRecipient', '1.0'))
        .rejects.toThrow('Token not found: nonexistent');
    });

    it('should convert decimal and send', async () => {
      tokenService.registerToken('TestToken', 'TT', '0xContract123');

      const txId = await tokenService.sendShieldedTokenDecimal('token:0xContract123', '0xRecipient', '0.5');

      expect(txId).toBe('tx-001');
      expect(mockTransactionService.createTransaction).toHaveBeenCalledWith('0xRecipient', 500000n);
    });
  });

  describe('generateTokenType', () => {
    it('should generate 64-byte token type', () => {
      const tokenType = tokenService.generateTokenType('domain', '0xAddress');

      expect(tokenType).toBeInstanceOf(Uint8Array);
      expect(tokenType.length).toBe(64);
    });

    it('should combine domain and address bytes', () => {
      const tokenType = tokenService.generateTokenType('test', '0xABC');

      // First 32 bytes should contain "test"
      const decoder = new TextDecoder();
      const domainPart = decoder.decode(tokenType.slice(0, 4));
      expect(domainPart).toBe('test');

      // Check padding (bytes 4-31 should be 0)
      for (let i = 4; i < 32; i++) {
        expect(tokenType[i]).toBe(0);
      }
    });
  });

  describe('autoRegisterTokens', () => {
    it('should skip already registered tokens', async () => {
      mockTokenDb.getTokenByTokenTypeHex.mockReturnValue({
        name: 'ExistingToken',
      });

      const newTokens = await tokenService.autoRegisterTokens();
      expect(newTokens.length).toBe(0);
    });

    it('should skip tokens with zero balance', async () => {
      mockWalletService.getWalletState.mockReturnValue({
        balances: {
          'tokentype_0xZero': 0n,
        },
      });

      const newTokens = await tokenService.autoRegisterTokens();
      expect(newTokens.length).toBe(0);
    });

    it('should handle errors gracefully', async () => {
      mockWalletService.getWalletState.mockImplementation(() => {
        throw new Error('Wallet error');
      });

      const newTokens = await tokenService.autoRegisterTokens();
      expect(newTokens).toEqual([]);
    });
  });

  describe('getRegistryStats', () => {
    it('should return stats for empty registry', () => {
      const stats = tokenService.getRegistryStats();

      expect(stats.totalTokens).toBe(0);
      expect(stats.tokensWithBalance).toBe(0);
      expect(stats.tokens).toEqual([]);
      expect(stats.balances).toEqual([]);
    });

    it('should return correct stats', () => {
      tokenService.registerToken('Token1', 'T1', '0xContract123');
      tokenService.registerToken('Token2', 'T2', '0xNoBalance');

      const stats = tokenService.getRegistryStats();

      expect(stats.totalTokens).toBe(2);
      expect(stats.tokensWithBalance).toBe(1);
    });
  });
});
