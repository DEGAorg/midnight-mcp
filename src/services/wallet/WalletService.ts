/**
 * WalletService
 *
 * Core wallet operations: address, balance, sending funds
 * Extracted from WalletServiceMCP god class
 */

import type { Logger } from 'pino';
import type { WalletManager, WalletConfig } from '../../wallet/index.js';
import type {
  WalletBalances,
  WalletStatus,
  InitiateTransactionResult,
  SendFundsResult,
} from './types.js';
import {
  WalletServiceError,
  WalletServiceErrorType,
  SendFundsError,
  WalletNotReadyError,
} from './errors.js';

export class WalletService {
  constructor(
    private readonly wallet: WalletManager,
    private readonly logger: Logger
  ) {}

  /**
   * Check if wallet is ready for operations
   */
  isReady(): boolean {
    try {
      const state = this.wallet.getCurrentState();
      return state !== null && state !== undefined;
    } catch (error) {
      this.logger.warn({ error }, 'Error checking wallet readiness');
      return false;
    }
  }

  /**
   * Get wallet address
   */
  getAddress(): string {
    if (!this.isReady()) {
      throw new WalletNotReadyError();
    }

    try {
      const state = this.wallet.getCurrentState();
      return state.publicKey.address;
    } catch (error) {
      this.logger.error({ error }, 'Failed to get wallet address');
      throw new WalletServiceError(
        WalletServiceErrorType.WALLET_NOT_READY,
        'Failed to get wallet address',
        error
      );
    }
  }

  /**
   * Get wallet balance
   */
  getBalance(): WalletBalances {
    if (!this.isReady()) {
      throw new WalletNotReadyError();
    }

    try {
      const state = this.wallet.getCurrentState();
      const tokenBalances = this.wallet.getTokenBalances();

      return {
        address: state.publicKey.address,
        balance: state.balance.toString(),
        tokens: tokenBalances,
      };
    } catch (error) {
      this.logger.error({ error }, 'Failed to get wallet balance');
      throw new WalletServiceError(
        WalletServiceErrorType.WALLET_NOT_READY,
        'Failed to get wallet balance',
        error
      );
    }
  }

  /**
   * Get wallet status
   */
  getWalletStatus(): WalletStatus {
    try {
      const state = this.wallet.getCurrentState();
      const isReady = state !== null && state !== undefined;

      return {
        ready: isReady,
        address: isReady ? state.publicKey.address : '',
        balance: isReady ? state.balance.toString() : '0',
        syncing: false, // TODO: Implement proper syncing status
      };
    } catch (error) {
      this.logger.error({ error }, 'Failed to get wallet status');
      return {
        ready: false,
        address: '',
        balance: '0',
        syncing: false,
      };
    }
  }

  /**
   * Send funds to an address (initiate transaction)
   */
  async sendFunds(destinationAddress: string, amount: string): Promise<InitiateTransactionResult> {
    if (!this.isReady()) {
      throw new WalletNotReadyError();
    }

    this.logger.info({ destinationAddress, amount }, 'Initiating send funds');

    try {
      const result = await this.wallet.sendFunds(destinationAddress, amount);

      this.logger.info(
        { transactionId: result.id, status: result.state },
        'Transaction initiated successfully'
      );

      return {
        transactionId: result.id,
        status: result.state,
        message: result.message || 'Transaction initiated',
      };
    } catch (error) {
      this.logger.error({ error, destinationAddress, amount }, 'Failed to send funds');
      throw new SendFundsError('Failed to send funds', error);
    }
  }

  /**
   * Send funds and wait for completion
   */
  async sendFundsAndWait(
    destinationAddress: string,
    amount: string
  ): Promise<SendFundsResult> {
    if (!this.isReady()) {
      throw new WalletNotReadyError();
    }

    this.logger.info({ destinationAddress, amount }, 'Sending funds and waiting');

    try {
      const result = await this.wallet.sendFundsAndWait(destinationAddress, amount);

      this.logger.info(
        { transactionId: result.id, status: result.state },
        'Transaction completed'
      );

      return {
        id: result.id,
        state: result.state,
        message: result.message || 'Transaction completed',
      };
    } catch (error) {
      this.logger.error({ error, destinationAddress, amount }, 'Failed to send funds and wait');
      throw new SendFundsError('Failed to send funds', error);
    }
  }

  /**
   * Get wallet configuration
   */
  getWalletConfig(): WalletConfig {
    return this.wallet.getConfig();
  }

  /**
   * Close wallet and cleanup
   */
  async close(): Promise<void> {
    this.logger.info('Closing wallet');
    try {
      await this.wallet.close();
      this.logger.info('Wallet closed successfully');
    } catch (error) {
      this.logger.error({ error }, 'Error closing wallet');
      throw error;
    }
  }
}
