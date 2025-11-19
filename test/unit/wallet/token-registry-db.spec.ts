/**
 * Tests for Token Registry Database
 */

import { TokenRegistryDatabase } from '../../../src/wallet/db/TokenRegistryDatabase.js';
import type { TokenInfo } from '../../../src/types/wallet.js';

describe('TokenRegistryDatabase', () => {
  let tokenDb: TokenRegistryDatabase;
  let testDbPath: string;

  beforeEach(() => {
    // Use a temporary database for testing
    testDbPath = '/tmp/test-token-registry.db';
    tokenDb = new TokenRegistryDatabase(testDbPath);
  });

  afterEach(() => {
    // Clean up the test database
    tokenDb.close();
    try {
      require('fs').unlinkSync(testDbPath);
    } catch (error) {
      // File might not exist, that's okay
    }
  });

  describe('Token Registration', () => {
    it('should register a new token successfully', () => {
      const tokenInfo: TokenInfo = {
        name: 'dao_voting',
        symbol: 'DVT',
        contractAddress: '0x1234567890abcdef',
        domainSeparator: 'dega_dao_vote',
        tokenTypeHex: '0xabcdef1234567890',
        description: 'DAO voting token'
      };

      const result = tokenDb.registerToken(tokenInfo);
      expect(result).toEqual(tokenInfo);
    });

    it('should prevent duplicate token registration', () => {
      const tokenInfo: TokenInfo = {
        name: 'dao_voting',
        symbol: 'DVT',
        contractAddress: '0x1234567890abcdef',
        domainSeparator: 'dega_dao_vote',
        tokenTypeHex: '0xabcdef1234567890',
        description: 'DAO voting token'
      };

      // Register first time
      tokenDb.registerToken(tokenInfo);

      // Try to register again - should throw error
      expect(() => {
        tokenDb.registerToken(tokenInfo);
      }).toThrow("Token with name 'dao_voting' is already registered");
    });
  });

  describe('Token Retrieval', () => {
    beforeEach(() => {
      // Register test tokens
      const tokens: TokenInfo[] = [
        {
          name: 'dao_voting',
          symbol: 'DVT',
          contractAddress: '0x1234567890abcdef',
          domainSeparator: 'dega_dao_vote',
          tokenTypeHex: '0xabcdef1234567890',
          description: 'DAO voting token'
        },
        {
          name: 'funding',
          symbol: 'FUND',
          contractAddress: '0xfedcba0987654321',
          domainSeparator: 'dega_funding_token',
          tokenTypeHex: '0x0987654321fedcba',
          description: 'Funding token'
        }
      ];

      tokens.forEach(token => tokenDb.registerToken(token));
    });

    it('should get token by name', () => {
      const token = tokenDb.getTokenByName('dao_voting');
      expect(token).not.toBeNull();
      expect(token?.name).toBe('dao_voting');
      expect(token?.symbol).toBe('DVT');
      expect(token?.contractAddress).toBe('0x1234567890abcdef');
    });

    it('should get token by contract address', () => {
      const token = tokenDb.getTokenByContractAddress('0x1234567890abcdef');
      expect(token).not.toBeNull();
      expect(token?.name).toBe('dao_voting');
      expect(token?.symbol).toBe('DVT');
    });

    it('should get token by token type hex', () => {
      const token = tokenDb.getTokenByTokenTypeHex('0xabcdef1234567890');
      expect(token).not.toBeNull();
      expect(token?.name).toBe('dao_voting');
      expect(token?.symbol).toBe('DVT');
    });

    it('should return null for non-existent token', () => {
      const token = tokenDb.getTokenByName('non_existent');
      expect(token).toBeNull();
    });

    it('should get all tokens', () => {
      const allTokens = tokenDb.getAllTokens();
      expect(allTokens).toHaveLength(2);
      expect(allTokens.map(t => t.name)).toContain('dao_voting');
      expect(allTokens.map(t => t.name)).toContain('funding');
    });

    it('should check if token is registered', () => {
      expect(tokenDb.isTokenRegistered('dao_voting')).toBe(true);
      expect(tokenDb.isTokenRegistered('non_existent')).toBe(false);
    });
  });

  describe('Token Management', () => {
    beforeEach(() => {
      const tokenInfo: TokenInfo = {
        name: 'dao_voting',
        symbol: 'DVT',
        contractAddress: '0x1234567890abcdef',
        domainSeparator: 'dega_dao_vote',
        tokenTypeHex: '0xabcdef1234567890',
        description: 'DAO voting token'
      };
      tokenDb.registerToken(tokenInfo);
    });

    it('should update token information', () => {
      const updatedToken = tokenDb.updateToken('dao_voting', {
        symbol: 'DVT2',
        description: 'Updated DAO voting token'
      });

      expect(updatedToken).not.toBeNull();
      expect(updatedToken?.symbol).toBe('DVT2');
      expect(updatedToken?.description).toBe('Updated DAO voting token');
      expect(updatedToken?.name).toBe('dao_voting'); // Should remain unchanged
    });

    it('should unregister token', () => {
      expect(tokenDb.isTokenRegistered('dao_voting')).toBe(true);
      
      const removed = tokenDb.unregisterToken('dao_voting');
      expect(removed).toBe(true);
      
      expect(tokenDb.isTokenRegistered('dao_voting')).toBe(false);
      expect(tokenDb.getTokenByName('dao_voting')).toBeNull();
    });

    it('should return false when trying to unregister non-existent token', () => {
      const removed = tokenDb.unregisterToken('non_existent');
      expect(removed).toBe(false);
    });
  });

  describe('Registry Statistics', () => {
    it('should return correct statistics', () => {
      const tokens: TokenInfo[] = [
        {
          name: 'dao_voting',
          symbol: 'DVT',
          contractAddress: '0x1234567890abcdef',
          domainSeparator: 'dega_dao_vote',
          tokenTypeHex: '0xabcdef1234567890',
          description: 'DAO voting token'
        },
        {
          name: 'funding',
          symbol: 'FUND',
          contractAddress: '0xfedcba0987654321',
          domainSeparator: 'dega_funding_token',
          tokenTypeHex: '0x0987654321fedcba',
          description: 'Funding token'
        },
        {
          name: 'another_funding',
          symbol: 'FUND',
          contractAddress: '0x1111111111111111',
          domainSeparator: 'dega_funding_token',
          tokenTypeHex: '0x1111111111111111',
          description: 'Another funding token'
        }
      ];

      tokens.forEach(token => tokenDb.registerToken(token));

      const stats = tokenDb.getRegistryStats();
      expect(stats.totalTokens).toBe(3);
      expect(stats.tokensBySymbol['DVT']).toBe(1);
      expect(stats.tokensBySymbol['FUND']).toBe(2);
    });
  });
});
