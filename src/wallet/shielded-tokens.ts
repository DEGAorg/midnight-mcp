/**
 * Shielded Token Manager
 * 
 * Handles token name mapping and operations using the wallet's native token capabilities.
 * Provides human-readable names for tokens instead of using hex addresses directly.
 */

import { createLogger } from '../logger/index.js';
import type { Logger } from 'pino';
import { nativeToken } from '@midnight-ntwrk/ledger';
import { tokenType } from '@midnight-ntwrk/compact-runtime';
import { convertBigIntToDecimal, convertDecimalToBigInt } from './utils.js';
import type { WalletManager } from './index.js';
import type { SendFundsResult, TokenInfo, TokenBalance, TokenOperationResult, CoinInfo } from '../types/wallet.js';
import { TokenRegistryDatabase } from './db/TokenRegistryDatabase.js';
import { randomBytes } from 'crypto';
import { 
  parseTokensFromMultipleEnvVars, 
  validateTokenConfig, 
  configToTokenInfo,
  type TokenConfig,
  type BatchTokenRegistrationResult 
} from './token-config.js';

/**
 * Helper function to pad string to specified length (required for token type generation)
 * pad(n, s): UTF-8 bytes of s followed by 0x00 up to length n
 */
function padBytes(n: number, s: string): Uint8Array {
  const bytes = new TextEncoder().encode(s);
  if (bytes.length > n) throw new Error('String too long for pad length');
  const out = new Uint8Array(n);
  out.set(bytes);
  return out;
}

/**
 * Shielded Token Manager
 * 
 * Manages token name mapping and provides operations for custom tokens.
 * Uses the wallet's native token capabilities for all operations.
 * Provides persistence for token registry between reboots.
 */
export class ShieldedTokenManager {
  private readonly logger: Logger;
  private readonly walletManager: WalletManager;
  private readonly tokenRegistryDb: TokenRegistryDatabase;
  
  constructor(walletManager: WalletManager) {
    this.logger = createLogger('shielded-token-manager');
    this.walletManager = walletManager;
    this.tokenRegistryDb = new TokenRegistryDatabase();
    
    // Auto-register tokens from environment variables
    this.registerTokensFromEnv();
    
    this.logger.info('ShieldedTokenManager initialized with database persistence');
  }
  

  /**
   * Generate token type using proper tokenType function
   * @param domainSeparator Domain separator (e.g., "dega_dao_vote")
   * @param contractAddress Contract address
   * @returns Token type hex string
   */
  private generateTokenType(domainSeparator: string, contractAddress: string): string {
    const domainSep = padBytes(32, domainSeparator);
    return tokenType(domainSep, contractAddress);
  }

  /**
   * Register a token with a human-readable name
   * @param name Human-readable token name
   * @param symbol Token symbol
   * @param contractAddress Contract address for the token
   * @param domainSeparator Domain separator for token type generation
   * @param description Optional description
   * @param decimals Number of decimal places (default: 6)
   */
  public registerToken(
    name: string, 
    symbol: string, 
    contractAddress: string,
    domainSeparator: string = 'custom_token',
    description?: string,
    decimals?: number
  ): TokenOperationResult {
    try {
      // Validate inputs
      if (!name || !symbol || !contractAddress || !domainSeparator) {
        throw new Error('Name, symbol, contract address, and domain separator are required');
      }
      
      // Generate token type
      const tokenTypeHex = this.generateTokenType(domainSeparator, contractAddress);
      
      // Create token info
      const tokenInfo: TokenInfo = {
        name: name.toLowerCase(), // Store as lowercase for consistency
        symbol: symbol.toUpperCase(),
        contractAddress,
        domainSeparator,
        tokenTypeHex,
        description,
        decimals: decimals || 6
      };
      
      // Register the token in database
      this.tokenRegistryDb.registerToken(tokenInfo);
      
      this.logger.info(`Token '${name}' (${symbol}) registered with contract address ${contractAddress}`);
      this.logger.info(`Token type: ${tokenTypeHex}`);
      
      return {
        success: true,
        tokenName: name,
        amount: '0'
      };
    } catch (error) {
      this.logger.error(`Failed to register token '${name}':`, error);
      return {
        success: false,
        tokenName: name,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Get token information by name or symbol
   * @param tokenIdentifier Token name or symbol
   * @returns Token information or null if not found
   */
  public getTokenInfo(tokenIdentifier: string): TokenInfo | null {
    // First try to find by name (case insensitive)
    let tokenInfo = this.tokenRegistryDb.getTokenByName(tokenIdentifier.toLowerCase());
    
    // If not found by name, try to find by symbol (case insensitive)
    if (!tokenInfo) {
      tokenInfo = this.tokenRegistryDb.getTokenBySymbol(tokenIdentifier.toUpperCase());
    }
    
    return tokenInfo;
  }
  
  /**
   * Get token balance by name
   * @param tokenName Token name
   * @returns Token balance as string or "0" if not found
   */
  public getTokenBalance(tokenName: string): string {
    try {
      const tokenInfo = this.getTokenInfo(tokenName);
      if (!tokenInfo) {
        this.logger.warn(`Token '${tokenName}' not found in registry`);
        return '0';
      }
      
      // Get wallet state
      const walletState = this.walletManager['walletState'];
      if (!walletState || !walletState.balances) {
        this.logger.warn('Wallet state not available');
        return '0';
      }
      
      // Use the proper token type for balance checking
      const tokenTypeHex = tokenInfo.tokenTypeHex || this.generateTokenType(tokenInfo.domainSeparator, tokenInfo.contractAddress);
      const tokenBalance = walletState.balances[tokenTypeHex] ?? 0n;
      
      // Use token-specific decimals or default to 6
      const decimals = tokenInfo.decimals || 6;
      const balanceString = convertBigIntToDecimal(tokenBalance, decimals);
      
      this.logger.debug(`Token '${tokenName}' balance: ${balanceString} (${decimals} decimals)`);
      this.logger.debug(`Token type used: ${tokenTypeHex}`);
      
      return balanceString;
    } catch (error) {
      this.logger.error(`Failed to get balance for token '${tokenName}':`, error);
      return '0';
    }
  }
  
  /**
   * Send tokens to another address
   * @param tokenName Token name
   * @param toAddress Recipient address
   * @param amount Amount to send
   * @returns Transaction result
   */
  public async sendToken(
    tokenName: string, 
    toAddress: string, 
    amount: string
  ): Promise<SendFundsResult> {
    try {
      const tokenInfo = this.getTokenInfo(tokenName);
      if (!tokenInfo) {
        throw new Error(`Token '${tokenName}' not found in registry`);
      }
      
      // Validate amount using token-specific decimals
      const decimals = tokenInfo.decimals || 6;
      const amountBigInt = convertDecimalToBigInt(amount, decimals);
      if (amountBigInt <= 0n) {
        throw new Error('Amount must be greater than 0');
      }
      
      // Check if wallet is ready
      if (!this.walletManager.isReady()) {
        throw new Error('Wallet not ready');
      }
      
      // Get wallet instance
      const wallet = this.walletManager['wallet'];
      if (!wallet) {
        throw new Error('Wallet instance not available');
      }
      
      // Use the proper token type for the transfer
      const tokenTypeHex = tokenInfo.tokenTypeHex || this.generateTokenType(tokenInfo.domainSeparator, tokenInfo.contractAddress);
      
      this.logger.info(`Sending ${amount} ${tokenName} tokens to ${toAddress}`);
      this.logger.info(`Token type: ${tokenTypeHex}`);
      
      // Create transfer transaction using the proper token type
      const transferRecipe = await wallet.transferTransaction([
        {
          amount: amountBigInt,
          type: tokenTypeHex, // Use proper token type, not contract address
          receiverAddress: toAddress
        }
      ]);
      
      // Prove and submit the transaction
      const provenTransaction = await wallet.proveTransaction(transferRecipe);
      const submittedTransaction = await wallet.submitTransaction(provenTransaction);
      
      this.logger.info(`Token transfer submitted: ${submittedTransaction}`);
      
      // Get current sync status
      const isFullySynced = this.walletManager['walletState']?.syncProgress?.synced ?? false;
      const applyGap = this.walletManager['applyGap'] ?? 0n;
      const sourceGap = this.walletManager['sourceGap'] ?? 0n;
      
      return {
        txIdentifier: submittedTransaction,
        syncStatus: {
          syncedIndices: '0', // Not used in current wallet implementation
          lag: {
            applyGap: applyGap.toString(),
            sourceGap: sourceGap.toString()
          },
          isFullySynced
        },
        amount
      };
    } catch (error) {
      this.logger.error(`Failed to send ${tokenName} tokens:`, error);
      throw error;
    }
  }
  
  /**
   * List all registered tokens with their balances
   * @returns Array of token balances
   */
  public listWalletTokens(): TokenBalance[] {
    try {
      const tokenBalances: TokenBalance[] = [];
      
      // Get wallet state
      const walletState = this.walletManager['walletState'];
      if (!walletState || !walletState.balances) {
        this.logger.warn('Wallet state not available');
        return tokenBalances;
      }
      
      // Get all registered tokens from database
      const registeredTokens = this.tokenRegistryDb.getAllTokens();
      
      // Iterate through registered tokens
      for (const tokenInfo of registeredTokens) {
        const tokenTypeHex = tokenInfo.tokenTypeHex || this.generateTokenType(tokenInfo.domainSeparator, tokenInfo.contractAddress);
        const balance = walletState.balances[tokenTypeHex] ?? 0n;
        
        // Use token-specific decimals or default to 6
        const decimals = tokenInfo.decimals || 6;
        const balanceString = convertBigIntToDecimal(balance, decimals);
        
        tokenBalances.push({
          tokenName: tokenInfo.name,
          symbol: tokenInfo.symbol,
          balance: balanceString,
          contractAddress: tokenInfo.contractAddress,
          description: tokenInfo.description,
          decimals: tokenInfo.decimals || 6
        });
      }
      
      // Also include native token
      const nativeBalance = walletState.balances[nativeToken()] ?? 0n;
      tokenBalances.push({
        tokenName: 'NATIVE',
        symbol: 'MN',
        balance: convertBigIntToDecimal(nativeBalance, 6),
        contractAddress: nativeToken(),
        description: 'Native Midnight token',
        decimals: 6
      });
      
      this.logger.debug(`Listed ${tokenBalances.length} tokens`);
      
      return tokenBalances;
    } catch (error) {
      this.logger.error('Failed to list wallet tokens:', error);
      return [];
    }
  }

  /**
   * Create a coin for DAO voting (requires 500 tokens)
   * @param tokenName Token name to create coin for
   * @param amount Amount for the coin (default 500 for DAO voting)
   * @returns Coin info for transactions
   */
  public createCoinForVoting(tokenName: string, amount: bigint = 500n): CoinInfo {
    const tokenInfo = this.getTokenInfo(tokenName);
    if (!tokenInfo) {
      throw new Error(`Token '${tokenName}' not found in registry`);
    }

    const tokenTypeHex = tokenInfo.tokenTypeHex || this.generateTokenType(tokenInfo.domainSeparator, tokenInfo.contractAddress);
    
    // Create random nonce for uniqueness
    const nonce = randomBytes(32);
    
    return {
      nonce,
      color: new TextEncoder().encode(tokenTypeHex),
      value: amount
    };
  }

  /**
   * Create a coin for treasury funding (default 100 tokens)
   * @param tokenName Token name to create coin for
   * @param amount Amount for the coin (default 100 for treasury funding)
   * @returns Coin info for transactions
   */
  public createCoinForFunding(tokenName: string, amount: bigint = 100n): CoinInfo {
    const tokenInfo = this.getTokenInfo(tokenName);
    if (!tokenInfo) {
      throw new Error(`Token '${tokenName}' not found in registry`);
    }

    const tokenTypeHex = tokenInfo.tokenTypeHex || this.generateTokenType(tokenInfo.domainSeparator, tokenInfo.contractAddress);
    
    // Create random nonce for uniqueness
    const nonce = randomBytes(32);
    
    return {
      nonce,
      color: new TextEncoder().encode(tokenTypeHex),
      value: amount
    };
  }
  
  /**
   * Get all registered token names
   * @returns Array of registered token names
   */
  public getRegisteredTokenNames(): string[] {
    const allTokens = this.tokenRegistryDb.getAllTokens();
    return allTokens.map(token => token.name);
  }
  
  /**
   * Check if a token is registered
   * @param tokenName Token name
   * @returns True if token is registered
   */
  public isTokenRegistered(tokenName: string): boolean {
    return this.tokenRegistryDb.isTokenRegistered(tokenName.toLowerCase());
  }
  
  /**
   * Remove a token from registry
   * @param tokenName Token name
   * @returns True if token was removed
   */
  public unregisterToken(tokenName: string): boolean {
    return this.tokenRegistryDb.unregisterToken(tokenName.toLowerCase());
  }
  
  /**
   * Get registry statistics
   * @returns Registry statistics
   */
  public getRegistryStats(): { totalTokens: number; tokensBySymbol: Record<string, number> } {
    return this.tokenRegistryDb.getRegistryStats();
  }

  /**
   * Register tokens from environment variables
   * Automatically called during initialization
   */
  private registerTokensFromEnv(): void {
    try {
      const tokenConfigs = parseTokensFromMultipleEnvVars();
      if (tokenConfigs.length > 0) {
        this.logger.info(`Found ${tokenConfigs.length} token configurations in environment variables`);
        const result = this.registerTokensBatch(tokenConfigs);
        this.logger.info(`Auto-registered ${result.registeredCount} tokens from environment variables`);
        if (result.errors.length > 0) {
          this.logger.warn(`Failed to register ${result.errors.length} tokens from environment variables`);
          result.errors.forEach(error => {
            this.logger.warn(`  - ${error.token}: ${error.error}`);
          });
        }
      }
    } catch (error) {
      this.logger.error('Failed to register tokens from environment variables:', error);
    }
  }

  /**
   * Register multiple tokens in batch
   * @param tokenConfigs Array of token configurations
   * @returns Batch registration result
   */
  public registerTokensBatch(tokenConfigs: TokenConfig[]): BatchTokenRegistrationResult {
    const result: BatchTokenRegistrationResult = {
      success: true,
      registeredCount: 0,
      errors: [],
      registeredTokens: []
    };

    for (const config of tokenConfigs) {
      try {
        // Validate configuration
        const validation = validateTokenConfig(config);
        if (!validation.valid) {
          result.errors.push({
            token: config.name,
            error: validation.errors.join(', ')
          });
          continue;
        }

        // Check if token already exists
        if (this.isTokenRegistered(config.name)) {
          this.logger.debug(`Token '${config.name}' already registered, skipping`);
          continue;
        }

        // Convert to TokenInfo and register
        const tokenInfo = configToTokenInfo(config);
        
        // Generate token type if not provided
        if (!tokenInfo.tokenTypeHex) {
          tokenInfo.tokenTypeHex = this.generateTokenType(tokenInfo.domainSeparator, tokenInfo.contractAddress);
        }

        this.tokenRegistryDb.registerToken(tokenInfo);
        result.registeredCount++;
        result.registeredTokens.push(config.name);
        
        this.logger.info(`Batch registered token: ${config.name} (${config.symbol})`);
      } catch (error) {
        result.errors.push({
          token: config.name,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        this.logger.error(`Failed to batch register token '${config.name}':`, error);
      }
    }

    result.success = result.errors.length === 0;
    return result;
  }

  /**
   * Register tokens from environment variable string
   * @param envValue Environment variable value with token configurations
   * @returns Batch registration result
   */
  public registerTokensFromEnvString(envValue: string): BatchTokenRegistrationResult {
    const tokenConfigs = parseTokensFromMultipleEnvVars();
    return this.registerTokensBatch(tokenConfigs);
  }

  /**
   * Get token configuration template for environment variables
   * @returns Example configuration string
   */
  public getEnvConfigTemplate(): string {
    return `# Token Configuration Template
# Format: TOKEN_NAME:SYMBOL:CONTRACT_ADDRESS:DOMAIN_SEPARATOR:DESCRIPTION
# Multiple tokens separated by |

# Example configuration:
TOKENS="DAO_VOTING:DVT:0x1234567890abcdef:dega_dao_vote:DAO voting token|FUNDING:FUND:0xfedcba0987654321:dega_funding_token:Funding token"

# Or use numbered variables:
TOKENS_1="DAO_VOTING:DVT:0x1234567890abcdef:dega_dao_vote:DAO voting token"
TOKENS_2="FUNDING:FUND:0xfedcba0987654321:dega_funding_token:Funding token"

# Domain separator is optional (defaults to 'custom_token')
# Description is optional
# Minimal format: TOKEN_NAME:SYMBOL:CONTRACT_ADDRESS`;
  }
}
