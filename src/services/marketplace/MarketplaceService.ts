/**
 * MarketplaceService
 *
 * Marketplace operations: registration, verification
 * Extracted from WalletServiceMCP god class
 */

import type { Logger } from 'pino';
import type { WalletManager } from '../../wallet/index.js';

export class MarketplaceService {
  constructor(
    private readonly wallet: WalletManager,
    private readonly logger: Logger
  ) {}

  /**
   * Register user in marketplace
   */
  async registerInMarketplace(userId: string, userData: any): Promise<any> {
    this.logger.info({ userId }, 'Registering in marketplace');

    try {
      const result = await this.wallet.registerInMarketplace(userId, userData);
      this.logger.info({ userId }, 'Registered in marketplace successfully');
      return result;
    } catch (error) {
      this.logger.error({ error, userId }, 'Failed to register in marketplace');
      throw error;
    }
  }

  /**
   * Verify user in marketplace
   */
  async verifyUserInMarketplace(userId: string, verificationData: any): Promise<any> {
    this.logger.info({ userId }, 'Verifying user in marketplace');

    try {
      const result = await this.wallet.verifyUserInMarketplace(userId, verificationData);
      this.logger.info({ userId, verified: result }, 'User verification completed');
      return result;
    } catch (error) {
      this.logger.error({ error, userId }, 'Failed to verify user in marketplace');
      throw error;
    }
  }
}
