/**
 * TokenService
 *
 * Token operations: register, send, balance, batch operations
 * Extracted from WalletServiceMCP god class
 */

import type { Logger } from 'pino';
import type { WalletManager } from '../../wallet/index.js';
import { WalletServiceError, WalletServiceErrorType } from './errors.js';

export interface TokenConfig {
  name: string;
  symbol: string;
  decimals: number;
  contractAddress?: string;
}

export interface TokenBalance {
  name: string;
  symbol: string;
  balance: string;
  decimals: number;
}

export class TokenService {
  constructor(
    private readonly wallet: WalletManager,
    private readonly logger: Logger
  ) {}

  /**
   * Register a new token
   */
  registerToken(name: string, symbol: string, decimals: number, contractAddress?: string): void {
    this.logger.info({ name, symbol, decimals }, 'Registering token');

    try {
      this.wallet.registerToken({ name, symbol, decimals, contractAddress });
      this.logger.info({ name }, 'Token registered successfully');
    } catch (error) {
      this.logger.error({ error, name }, 'Failed to register token');
      throw new WalletServiceError(
        WalletServiceErrorType.TX_SUBMISSION_FAILED,
        `Failed to register token ${name}`,
        error
      );
    }
  }

  /**
   * Get token balance
   */
  getTokenBalance(tokenName: string): string {
    try {
      return this.wallet.getTokenBalance(tokenName);
    } catch (error) {
      this.logger.error({ error, tokenName }, 'Failed to get token balance');
      return '0';
    }
  }

  /**
   * Send tokens to an address
   */
  async sendToken(tokenName: string, toAddress: string, amount: string): Promise<any> {
    this.logger.info({ tokenName, toAddress, amount }, 'Sending token');

    try {
      const result = await this.wallet.sendToken(tokenName, toAddress, amount);
      this.logger.info({ tokenName, transactionId: result.id }, 'Token sent successfully');
      return result;
    } catch (error) {
      this.logger.error({ error, tokenName, toAddress, amount }, 'Failed to send token');
      throw new WalletServiceError(
        WalletServiceErrorType.TX_SUBMISSION_FAILED,
        `Failed to send token ${tokenName}`,
        error
      );
    }
  }

  /**
   * List all wallet tokens
   */
  listWalletTokens(): TokenBalance[] {
    try {
      return this.wallet.getTokenBalances();
    } catch (error) {
      this.logger.error({ error }, 'Failed to list wallet tokens');
      return [];
    }
  }

  /**
   * Register multiple tokens in batch
   */
  registerTokensBatch(tokenConfigs: TokenConfig[]): void {
    this.logger.info({ count: tokenConfigs.length }, 'Registering tokens in batch');

    for (const config of tokenConfigs) {
      try {
        this.registerToken(config.name, config.symbol, config.decimals, config.contractAddress);
      } catch (error) {
        this.logger.error({ error, tokenName: config.name }, 'Failed to register token in batch');
        // Continue with other tokens
      }
    }
  }

  /**
   * Register tokens from environment string
   */
  registerTokensFromEnvString(envValue: string): void {
    this.logger.info('Registering tokens from environment string');

    try {
      const tokens = JSON.parse(envValue);
      this.registerTokensBatch(tokens);
    } catch (error) {
      this.logger.error({ error }, 'Failed to parse token configuration from environment');
      throw new WalletServiceError(
        WalletServiceErrorType.TX_SUBMISSION_FAILED,
        'Invalid token configuration format',
        error
      );
    }
  }

  /**
   * Get token environment config template
   */
  getTokenEnvConfigTemplate(): string {
    return JSON.stringify(
      [
        {
          name: 'TOKEN_NAME',
          symbol: 'TKN',
          decimals: 18,
          contractAddress: '0x...',
        },
      ],
      null,
      2
    );
  }

  /**
   * Get token registry statistics
   */
  getTokenRegistryStats(): { totalTokens: number; tokens: TokenBalance[] } {
    const tokens = this.listWalletTokens();
    return {
      totalTokens: tokens.length,
      tokens,
    };
  }
}
