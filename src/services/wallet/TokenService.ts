/**
 * Token Service
 *
 * Manages token operations with automatic registration and state-based balances:
 * - Automatic token registration from wallet state
 * - State-based balance reads (cached, no blockchain query)
 * - Token type generation (domain separator + contract address)
 * - Token sending with transaction tracking
 * - Uses conversion utilities for proper decimal handling
 *
 * This replaces the manual token management from god-class pattern.
 */

import { tokenType } from '@midnight-ntwrk/compact-runtime';
import { nativeToken } from '@midnight-ntwrk/zswap';
import { createLogger } from '@lib/logger/index.js';
import { TOKEN_CONFIG } from '@lib/config/constants.js';
import { padBytes, convertDecimalToBigInt, convertBigIntToDecimal } from '@lib/utils/conversions.js';
import { TokenRegistryDatabase } from '@lib/database/token-registry-db.js';
import type { WalletService } from '@services/wallet/WalletService.js';
import type { TransactionService } from '@services/wallet/TransactionService.js';
import type { Logger } from 'pino';

/**
 * Token information
 */
export interface TokenInfo {
  /** Token ID (generated from domain separator + contract address) */
  id: string;

  /** Token name */
  name: string;

  /** Token symbol */
  symbol: string;

  /** Contract address */
  contractAddress: string;

  /** Number of decimal places */
  decimals: number;

  /** Domain separator for token type generation */
  domainSeparator: string;

  /** Token type (padded bytes) */
  tokenType: Uint8Array;

  /** Token type as hex string (for balance lookup) */
  tokenTypeHex: string;
}

/**
 * Token balance
 */
export interface TokenBalance {
  /** Token info */
  token: TokenInfo;

  /** Balance in base units */
  balance: bigint;

  /** Balance as decimal string */
  balanceDecimal: string;
}

/**
 * Token service configuration
 */
export interface TokenServiceConfig {
  /** Wallet service for state access */
  walletService: WalletService;

  /** Transaction service for token sends */
  transactionService: TransactionService;

  /** Token registry database */
  tokenDb: TokenRegistryDatabase;

  /** Agent ID for logging */
  agentId: string;
}

/**
 * TokenService manages token registration and operations
 */
export class TokenService {
  private logger: Logger;
  private config: TokenServiceConfig;

  // Token registry
  private tokens = new Map<string, TokenInfo>();

  constructor(config: TokenServiceConfig) {
    this.config = config;
    this.logger = createLogger(`token-service:${config.agentId}`);

    this.logger.info('Token service initialized', {
      agentId: config.agentId,
    });
  }

  // ==================== TOKEN REGISTRATION ====================

  /**
   * Register a new token
   * Generates token type from domain separator and contract address
   *
   * @param name Token name
   * @param symbol Token symbol
   * @param contractAddress Contract address
   * @param decimals Number of decimal places (default: TOKEN_CONFIG.DEFAULT_DECIMALS)
   * @param domainSeparator Domain separator (default: TOKEN_CONFIG.DEFAULT_DOMAIN_SEPARATOR)
   * @returns Token info
   */
  registerToken(
    name: string,
    symbol: string,
    contractAddress: string,
    decimals: number = TOKEN_CONFIG.DEFAULT_DECIMALS,
    domainSeparator: string = TOKEN_CONFIG.DEFAULT_DOMAIN_SEPARATOR
  ): TokenInfo {
    // Generate token type (bytes)
    const tokenTypeBytes = this.generateTokenType(domainSeparator, contractAddress);

    // Generate token type hex string (for balance lookup)
    const domainSep = padBytes(32, domainSeparator);
    const tokenTypeHex = tokenType(domainSep, contractAddress);

    // Generate token ID (unique identifier)
    const id = this.generateTokenId(domainSeparator, contractAddress);

    // Check if already registered in database
    const existingToken = this.config.tokenDb.getTokenByName(name);
    if (existingToken) {
      this.logger.debug('Token already registered in database', {
        name,
        symbol,
      });
      // Reconstruct full TokenInfo with computed fields
      const fullTokenInfo: TokenInfo = {
        id,
        name: existingToken.name,
        symbol: existingToken.symbol,
        contractAddress: existingToken.contractAddress,
        decimals: existingToken.decimals ?? TOKEN_CONFIG.DEFAULT_DECIMALS,
        domainSeparator: existingToken.domainSeparator,
        tokenType: tokenTypeBytes,
        tokenTypeHex: existingToken.tokenTypeHex ?? tokenTypeHex,
      };
      // Cache in memory
      this.tokens.set(id, fullTokenInfo);
      return fullTokenInfo;
    }

    // Create token info
    const tokenInfo: TokenInfo = {
      id,
      name,
      symbol,
      contractAddress,
      decimals,
      domainSeparator,
      tokenType: tokenTypeBytes,
      tokenTypeHex,
    };

    // Register token in database
    this.config.tokenDb.registerToken(tokenInfo);

    // Cache in memory
    this.tokens.set(id, tokenInfo);

    this.logger.info('Token registered in database', {
      id,
      name,
      symbol,
      contractAddress,
      decimals,
      domainSeparator,
      tokenTypeHex,
    });

    return tokenInfo;
  }

  /**
   * Automatically register tokens from wallet state
   * Detects unregistered token balances and creates TokenInfo for them
   *
   * This inspects wallet state for colored coin balances and attempts to
   * auto-register tokens that aren't yet in the registry database.
   *
   * Note: Since we can't reverse-engineer contract metadata from coin colors,
   * this only works for tokens defined in environment variables.
   *
   * @returns Array of newly registered tokens
   */
  async autoRegisterTokens(): Promise<TokenInfo[]> {
    this.logger.info('Auto-registering tokens from wallet state...');

    const newTokens: TokenInfo[] = [];

    try {
      // Get wallet state to see colored coin balances
      const walletState = this.config.walletService.getWalletState();

      // Get all token types (colored coins) from wallet balances
      const tokenTypes = Object.keys(walletState.balances || {});

      this.logger.debug('Found token types in wallet', {
        count: tokenTypes.length,
        types: tokenTypes.map((t) => t.substring(0, 16) + '...'),
      });

      // For each token type, check if already registered in database
      for (const tokenTypeHex of tokenTypes) {
        // Skip if already registered (check database)
        const existingToken = this.config.tokenDb.getTokenByTokenTypeHex(tokenTypeHex);
        if (existingToken) {
          this.logger.debug('Token already registered in database', {
            tokenTypeHex: tokenTypeHex.substring(0, 16) + '...',
            name: existingToken.name,
          });
          continue;
        }

        // Skip if balance is zero (no need to register)
        const balance = walletState.balances[tokenTypeHex];
        if (!balance || balance === 0n) {
          continue;
        }

        this.logger.debug('Found unregistered token with balance', {
          tokenTypeHex: tokenTypeHex.substring(0, 16) + '...',
          balance: balance.toString(),
        });

        // Try to get metadata from environment variables
        const metadata = this.getTokenMetadataFromEnv(tokenTypeHex);

        if (metadata) {
          try {
            const token = this.registerToken(
              metadata.name,
              metadata.symbol,
              metadata.contractAddress,
              metadata.decimals,
              metadata.domainSeparator
            );

            newTokens.push(token);

            this.logger.info('Auto-registered token from environment', {
              name: token.name,
              symbol: token.symbol,
              balance: balance.toString(),
            });
          } catch (error) {
            this.logger.error('Failed to auto-register token', {
              error,
              tokenTypeHex: tokenTypeHex.substring(0, 16) + '...',
            });
          }
        } else {
          this.logger.debug('No metadata available in environment variables for unregistered token', {
            tokenTypeHex: tokenTypeHex.substring(0, 16) + '...',
          });
        }
      }

      this.logger.info('Auto-registration complete', {
        newTokenCount: newTokens.length,
        totalTokenTypes: tokenTypes.length,
      });
    } catch (error) {
      this.logger.error('Error during auto-registration', { error });
    }

    return newTokens;
  }

  /**
   * Register multiple tokens in batch
   *
   * @param configs Array of token configurations
   * @returns Array of registered tokens
   */
  registerTokensBatch(
    configs: Array<{
      name: string;
      symbol: string;
      contractAddress: string;
      decimals?: number;
      domainSeparator?: string;
    }>
  ): TokenInfo[] {
    this.logger.info('Registering tokens in batch', {
      count: configs.length,
    });

    const tokens: TokenInfo[] = [];

    for (const config of configs) {
      try {
        const token = this.registerToken(
          config.name,
          config.symbol,
          config.contractAddress,
          config.decimals,
          config.domainSeparator
        );
        tokens.push(token);
      } catch (error) {
        this.logger.error('Failed to register token in batch', {
          error,
          name: config.name,
        });
        // Continue with other tokens
      }
    }

    this.logger.info('Batch registration complete', {
      successCount: tokens.length,
      totalCount: configs.length,
    });

    return tokens;
  }

  // ==================== TOKEN QUERIES ====================

  /**
   * Get token by ID
   *
   * @param id Token ID
   * @returns Token info or undefined
   */
  getToken(id: string): TokenInfo | undefined {
    return this.tokens.get(id);
  }

  /**
   * Get token by symbol
   *
   * @param symbol Token symbol
   * @returns Token info or undefined
   */
  getTokenBySymbol(symbol: string): TokenInfo | undefined {
    return Array.from(this.tokens.values()).find((t) => t.symbol === symbol);
  }

  /**
   * List all registered tokens
   *
   * @returns Array of token info
   */
  listTokens(): TokenInfo[] {
    return Array.from(this.tokens.values());
  }

  /**
   * Get token count
   *
   * @returns Number of registered tokens
   */
  getTokenCount(): number {
    return this.tokens.size;
  }

  // ==================== BALANCE OPERATIONS ====================

  /**
   * Get token balance from cached wallet state
   * This is FAST - reads from WalletService cache, no blockchain query
   *
   * @param tokenId Token ID
   * @returns Balance in base units
   */
  getTokenBalance(tokenId: string): bigint {
    const token = this.tokens.get(tokenId);
    if (!token) {
      throw new Error(`Token not found: ${tokenId}`);
    }

    // Get wallet state from WalletService (cached, fast!)
    const walletState = this.config.walletService.getWalletState();

    // Look up balance using tokenTypeHex
    // walletState.balances is a map: { [tokenTypeHex: string]: bigint }
    const balance = walletState.balances[token.tokenTypeHex] ?? 0n;

    this.logger.debug('Token balance retrieved', {
      tokenId,
      symbol: token.symbol,
      balance: balance.toString(),
      tokenTypeHex: token.tokenTypeHex,
    });

    return balance;
  }

  /**
   * Get token balance as decimal string
   *
   * @param tokenId Token ID
   * @returns Balance as decimal string
   */
  getTokenBalanceDecimal(tokenId: string): string {
    const token = this.tokens.get(tokenId);
    if (!token) {
      throw new Error(`Token not found: ${tokenId}`);
    }

    const balance = this.getTokenBalance(tokenId);
    return convertBigIntToDecimal(balance, token.decimals);
  }

  /**
   * Get all token balances
   * Reads from cached wallet state
   *
   * @returns Array of token balances
   */
  getAllTokenBalances(): TokenBalance[] {
    const balances: TokenBalance[] = [];

    for (const token of this.tokens.values()) {
      try {
        const balance = this.getTokenBalance(token.id);
        balances.push({
          token,
          balance,
          balanceDecimal: convertBigIntToDecimal(balance, token.decimals),
        });
      } catch (error) {
        this.logger.error('Failed to get token balance', {
          error,
          tokenId: token.id,
        });
      }
    }

    return balances;
  }

  /**
   * Get token balances with non-zero amounts only
   *
   * @returns Array of non-zero token balances
   */
  getNonZeroTokenBalances(): TokenBalance[] {
    return this.getAllTokenBalances().filter((tb) => tb.balance > 0n);
  }

  // ==================== TOKEN OPERATIONS ====================

  /**
   * Send native tokens (tDUST/DUST) to an address
   * Native tokens don't require a token type - they're the base currency
   *
   * @param to Recipient address
   * @param amount Amount in base units (dust)
   * @returns Transaction ID
   */
  async sendNativeToken(to: string, amount: bigint): Promise<string> {
    this.logger.info('Sending native token', {
      to,
      amount: amount.toString(),
    });

    // Check native balance from wallet
    const balance = this.config.walletService.getBalance();
    if (balance < amount) {
      throw new Error(
        `Insufficient native balance. Have: ${balance.toString()}, need: ${amount.toString()}`
      );
    }

    // Create transaction record via TransactionService
    const txId = this.config.transactionService.createTransaction(to, amount);

    try {
      // Get wallet instance
      const wallet = this.config.walletService.getWallet();

      // Build native transfer transaction (no type = native token)
      const transferRecipe = await wallet.transferTransaction([
        {
          amount,
          receiverAddress: to,
          type: nativeToken(),
        },
      ]);

      // Prove transaction
      const provenTransaction = await wallet.proveTransaction(transferRecipe);

      // Submit transaction to blockchain
      const txIdentifier = await wallet.submitTransaction(provenTransaction);

      // Mark as sent in TransactionService
      this.config.transactionService.markTransactionSent(txId, txIdentifier);

      this.logger.info('Native token sent successfully', {
        txId,
        txIdentifier,
        amount: amount.toString(),
      });

      return txId;
    } catch (error) {
      // Mark as failed in TransactionService
      this.config.transactionService.markTransactionFailed(txId, error as Error);

      this.logger.error('Failed to send native token', {
        error,
        txId,
      });

      throw error;
    }
  }

  /**
   * Send shielded tokens (colored coins) to an address
   * Requires a registered token with tokenTypeHex
   *
   * @param tokenId Token ID (from registered token)
   * @param to Recipient address
   * @param amount Amount in base units
   * @returns Transaction ID
   */
  async sendShieldedToken(tokenId: string, to: string, amount: bigint): Promise<string> {
    const token = this.tokens.get(tokenId);
    if (!token) {
      throw new Error(`Token not found: ${tokenId}`);
    }

    this.logger.info('Sending shielded token', {
      tokenId,
      symbol: token.symbol,
      to,
      amount: amount.toString(),
      amountDecimal: convertBigIntToDecimal(amount, token.decimals),
      tokenTypeHex: token.tokenTypeHex,
    });

    // Check balance
    const balance = this.getTokenBalance(tokenId);
    if (balance < amount) {
      throw new Error(
        `Insufficient token balance. Have: ${balance.toString()}, need: ${amount.toString()}`
      );
    }

    // Create transaction record via TransactionService
    const txId = this.config.transactionService.createTransaction(to, amount);

    try {
      // Get wallet instance
      const wallet = this.config.walletService.getWallet();

      // Build colored coin transfer transaction
      const transferRecipe = await wallet.transferTransaction([
        {
          amount,
          type: token.tokenTypeHex, // Use tokenTypeHex for colored coin
          receiverAddress: to,
        },
      ]);

      // Prove transaction
      const provenTransaction = await wallet.proveTransaction(transferRecipe);

      // Submit transaction to blockchain
      const txIdentifier = await wallet.submitTransaction(provenTransaction);

      // Mark as sent in TransactionService
      this.config.transactionService.markTransactionSent(txId, txIdentifier);

      this.logger.info('Shielded token sent successfully', {
        tokenId,
        symbol: token.symbol,
        txId,
        txIdentifier,
      });

      return txId;
    } catch (error) {
      // Mark as failed in TransactionService
      this.config.transactionService.markTransactionFailed(txId, error as Error);

      this.logger.error('Failed to send shielded token', {
        error,
        tokenId,
        symbol: token.symbol,
        txId,
      });

      throw error;
    }
  }

  /**
   * Send shielded tokens using decimal amount string
   *
   * @param tokenId Token ID
   * @param to Recipient address
   * @param amountDecimal Amount as decimal string (e.g., "12.345")
   * @returns Transaction ID
   */
  async sendShieldedTokenDecimal(tokenId: string, to: string, amountDecimal: string): Promise<string> {
    const token = this.tokens.get(tokenId);
    if (!token) {
      throw new Error(`Token not found: ${tokenId}`);
    }

    // Convert decimal to bigint
    const amount = convertDecimalToBigInt(amountDecimal, token.decimals);

    return this.sendShieldedToken(tokenId, to, amount);
  }

  // ==================== TOKEN TYPE GENERATION ====================

  /**
   * Generate token type from domain separator and contract address
   * Used for identifying colored coins
   *
   * Token type format: padBytes(32, domainSeparator) + padBytes(32, contractAddress)
   *
   * @param domainSeparator Domain separator (e.g., "custom_token")
   * @param contractAddress Contract address
   * @returns Token type as Uint8Array
   */
  generateTokenType(domainSeparator: string, contractAddress: string): Uint8Array {
    // Pad domain separator to 32 bytes
    const domainBytes = padBytes(32, domainSeparator);

    // Pad contract address to 32 bytes
    const addressBytes = padBytes(32, contractAddress);

    // Combine: domain + address = 64 bytes total
    const tokenType = new Uint8Array(64);
    tokenType.set(domainBytes, 0);
    tokenType.set(addressBytes, 32);

    this.logger.debug('Generated token type', {
      domainSeparator,
      contractAddress,
      tokenTypeLength: tokenType.length,
    });

    return tokenType;
  }

  /**
   * Generate token ID from domain separator and contract address
   * Simple string identifier for token registry
   *
   * @param domainSeparator Domain separator
   * @param contractAddress Contract address
   * @returns Token ID string
   */
  private generateTokenId(domainSeparator: string, contractAddress: string): string {
    return `${domainSeparator}:${contractAddress}`;
  }

  /**
   * Get token metadata from environment variables
   * Parses TOKENS, TOKENS_1, TOKENS_2, etc. environment variables
   *
   * Format: name:contract:symbol:decimals:domainSeparator
   * Example: TOKENS=MyToken:0x123...:MTK:6:custom_token
   *
   * @param tokenTypeHex Token type hex to search for
   * @returns Token metadata or null
   */
  private getTokenMetadataFromEnv(tokenTypeHex: string): {
    name: string;
    symbol: string;
    contractAddress: string;
    decimals: number;
    domainSeparator: string;
  } | null {
    // Check TOKENS, TOKENS_1, TOKENS_2, etc.
    const envVars = ['TOKENS'];
    for (let i = 1; i <= 10; i++) {
      envVars.push(`TOKENS_${i}`);
    }

    for (const envVar of envVars) {
      const value = process.env[envVar];
      if (!value) continue;

      // Parse comma-separated token configs
      const tokenConfigs = value.split(',').map((t) => t.trim());

      for (const configStr of tokenConfigs) {
        try {
          // Format: name:contract:symbol:decimals:domainSeparator
          const parts = configStr.split(':');
          if (parts.length < 4) continue;

          const [name, contractAddress, symbol, decimalsStr, domainSeparator = TOKEN_CONFIG.DEFAULT_DOMAIN_SEPARATOR] = parts;

          const decimals = parseInt(decimalsStr, 10);
          if (isNaN(decimals)) continue;

          // Generate token type hex for this config
          const domainSep = padBytes(32, domainSeparator);
          const configTokenTypeHex = tokenType(domainSep, contractAddress);

          // Check if it matches
          if (configTokenTypeHex === tokenTypeHex) {
            return {
              name: name.trim(),
              symbol: symbol.trim(),
              contractAddress: contractAddress.trim(),
              decimals,
              domainSeparator: domainSeparator.trim(),
            };
          }
        } catch (error) {
          this.logger.debug('Failed to parse token config', {
            error,
            configStr,
          });
        }
      }
    }

    return null;
  }

  // ==================== STATISTICS ====================

  /**
   * Get token registry statistics
   *
   * @returns Registry statistics
   */
  getRegistryStats(): {
    totalTokens: number;
    tokensWithBalance: number;
    tokens: TokenInfo[];
    balances: TokenBalance[];
  } {
    const tokens = this.listTokens();
    const balances = this.getNonZeroTokenBalances();

    return {
      totalTokens: tokens.length,
      tokensWithBalance: balances.length,
      tokens,
      balances,
    };
  }
}
