/**
 * Tests for Shielded Token Manager
 */

import { ShieldedTokenManager } from '../../../src/wallet/shielded-tokens.js';
import type { WalletManager } from '../../../src/wallet/index.js';
import type { TokenOperationResult, TokenBalance } from '../../../src/types/wallet.js';

// Mock WalletManager for testing
class MockWalletManager {
  public walletState: any = {
    balances: {
      'contract1': 1000000000n, // 10 tokens (assuming 8 decimals)
      'contract2': 500000000n,  // 5 tokens
      'native': 10000000000n    // 100 native tokens
    },
    syncProgress: {
      synced: true
    }
  };

  public applyGap: bigint = 0n;
  public sourceGap: bigint = 0n;
  public wallet: any = null;

  isReady(): boolean {
    return true;
  }
}

describe('ShieldedTokenManager', () => {
  let tokenManager: ShieldedTokenManager;
  let mockWalletManager: MockWalletManager;

  beforeEach(() => {
    mockWalletManager = new MockWalletManager();
    tokenManager = new ShieldedTokenManager(mockWalletManager as any);
  });

  describe('Token Registration', () => {
    it('should register a token successfully', () => {
      const result: TokenOperationResult = tokenManager.registerToken(
        'DAO_VOTING',
        'DVT',
        'contract1',
        'DAO Voting Token'
      );

      expect(result.success).toBe(true);
      expect(result.tokenName).toBe('DAO_VOTING');
      expect(result.error).toBeUndefined();
    });

    it('should fail to register duplicate token names', () => {
      // Register first token
      tokenManager.registerToken('DAO_VOTING', 'DVT', 'contract1');
      
      // Try to register duplicate
      const result: TokenOperationResult = tokenManager.registerToken(
        'DAO_VOTING',
        'DVT2',
        'contract2'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('already registered');
    });

    it('should fail to register with missing required fields', () => {
      const result: TokenOperationResult = tokenManager.registerToken(
        '',
        'DVT',
        'contract1'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('required');
    });
  });

  describe('Token Information', () => {
    beforeEach(() => {
      tokenManager.registerToken('DAO_VOTING', 'DVT', 'contract1', 'DAO Voting Token');
      tokenManager.registerToken('FUNDING', 'FUND', 'contract2', 'Funding Token');
    });

    it('should get token info by name', () => {
      const tokenInfo = tokenManager.getTokenInfo('DAO_VOTING');
      
      expect(tokenInfo).not.toBeNull();
      expect(tokenInfo?.name).toBe('dao_voting');
      expect(tokenInfo?.symbol).toBe('DVT');
      expect(tokenInfo?.contractAddress).toBe('contract1');
      expect(tokenInfo?.description).toBe('DAO Voting Token');
    });

    it('should return null for non-existent token', () => {
      const tokenInfo = tokenManager.getTokenInfo('NON_EXISTENT');
      expect(tokenInfo).toBeNull();
    });

    it('should be case insensitive for token names', () => {
      const tokenInfo1 = tokenManager.getTokenInfo('DAO_VOTING');
      const tokenInfo2 = tokenManager.getTokenInfo('dao_voting');
      const tokenInfo3 = tokenManager.getTokenInfo('Dao_Voting');

      expect(tokenInfo1).toEqual(tokenInfo2);
      expect(tokenInfo2).toEqual(tokenInfo3);
    });
  });

  describe('Token Balance', () => {
    beforeEach(() => {
      tokenManager.registerToken('DAO_VOTING', 'DVT', 'contract1');
      tokenManager.registerToken('FUNDING', 'FUND', 'contract2');
    });

    it('should get token balance correctly', () => {
      const balance = tokenManager.getTokenBalance('DAO_VOTING');
      expect(balance).toBe('10'); // 1000000000n / 100000000 = 10
    });

    it('should return "0" for non-existent token', () => {
      const balance = tokenManager.getTokenBalance('NON_EXISTENT');
      expect(balance).toBe('0');
    });

    it('should return "0" when wallet state is not available', () => {
      mockWalletManager.walletState = null;
      const balance = tokenManager.getTokenBalance('DAO_VOTING');
      expect(balance).toBe('0');
    });
  });

  describe('List Wallet Tokens', () => {
    beforeEach(() => {
      tokenManager.registerToken('DAO_VOTING', 'DVT', 'contract1', 'DAO Voting Token');
      tokenManager.registerToken('FUNDING', 'FUND', 'contract2', 'Funding Token');
    });

    it('should list all registered tokens with balances', () => {
      const tokens: TokenBalance[] = tokenManager.listWalletTokens();
      
      expect(tokens).toHaveLength(3); // 2 registered + 1 native
      
      const daoToken = tokens.find(t => t.tokenName === 'dao_voting');
      const fundingToken = tokens.find(t => t.tokenName === 'funding');
      const nativeToken = tokens.find(t => t.tokenName === 'NATIVE');

      expect(daoToken).toBeDefined();
      expect(daoToken?.balance).toBe('10');
      expect(daoToken?.symbol).toBe('DVT');
      expect(daoToken?.description).toBe('DAO Voting Token');

      expect(fundingToken).toBeDefined();
      expect(fundingToken?.balance).toBe('5');
      expect(fundingToken?.symbol).toBe('FUND');
      expect(fundingToken?.description).toBe('Funding Token');

      expect(nativeToken).toBeDefined();
      expect(nativeToken?.balance).toBe('100');
      expect(nativeToken?.symbol).toBe('MN');
      expect(nativeToken?.description).toBe('Native Midnight token');
    });

    it('should return empty array when wallet state is not available', () => {
      mockWalletManager.walletState = null;
      const tokens: TokenBalance[] = tokenManager.listWalletTokens();
      expect(tokens).toHaveLength(0);
    });
  });

  describe('Token Registry Management', () => {
    beforeEach(() => {
      tokenManager.registerToken('DAO_VOTING', 'DVT', 'contract1');
      tokenManager.registerToken('FUNDING', 'FUND', 'contract2');
    });

    it('should get registered token names', () => {
      const names = tokenManager.getRegisteredTokenNames();
      expect(names).toHaveLength(2);
      expect(names).toContain('dao_voting');
      expect(names).toContain('funding');
    });

    it('should check if token is registered', () => {
      expect(tokenManager.isTokenRegistered('DAO_VOTING')).toBe(true);
      expect(tokenManager.isTokenRegistered('dao_voting')).toBe(true);
      expect(tokenManager.isTokenRegistered('NON_EXISTENT')).toBe(false);
    });

    it('should unregister token', () => {
      expect(tokenManager.isTokenRegistered('DAO_VOTING')).toBe(true);
      
      const removed = tokenManager.unregisterToken('DAO_VOTING');
      expect(removed).toBe(true);
      expect(tokenManager.isTokenRegistered('DAO_VOTING')).toBe(false);
      expect(tokenManager.getRegisteredTokenNames()).toHaveLength(1);
    });

    it('should return false when trying to unregister non-existent token', () => {
      const removed = tokenManager.unregisterToken('NON_EXISTENT');
      expect(removed).toBe(false);
    });

    it('should get registry statistics', () => {
      const stats = tokenManager.getRegistryStats();
      expect(stats.totalTokens).toBe(2);
      expect(stats.tokenNames).toHaveLength(2);
      expect(stats.tokenNames).toContain('dao_voting');
      expect(stats.tokenNames).toContain('funding');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty registry', () => {
      const tokens = tokenManager.listWalletTokens();
      expect(tokens).toHaveLength(1); // Only native token
      expect(tokenManager.getRegisteredTokenNames()).toHaveLength(0);
      expect(tokenManager.getRegistryStats().totalTokens).toBe(0);
    });

    it('should handle special characters in token names', () => {
      const result = tokenManager.registerToken('TOKEN-123', 'T123', 'contract1');
      expect(result.success).toBe(true);
      expect(tokenManager.isTokenRegistered('TOKEN-123')).toBe(true);
    });
  });
});
