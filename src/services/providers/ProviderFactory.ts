/**
 * Provider Factory
 *
 * Creates and configures providers for wallet and contract operations.
 * Handles the complex dual-provider pattern required by Midnight SDK.
 */

import type { Wallet } from '@midnight-ntwrk/wallet-api';
import type { Resource } from '@midnight-ntwrk/wallet';
import {
  type WalletProvider,
  type MidnightProvider,
  type UnbalancedTransaction,
  type BalancedTransaction,
  createBalancedTx,
} from '@midnight-ntwrk/midnight-js-types';
import type { TransactionId, CoinInfo } from '@midnight-ntwrk/zswap';
import { Transaction as ZswapTransaction } from '@midnight-ntwrk/zswap';
import { Transaction } from '@midnight-ntwrk/ledger';
import {
  getLedgerNetworkId,
  getZswapNetworkId,
} from '@midnight-ntwrk/midnight-js-network-id';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { firstValueFrom } from 'rxjs';
import { config } from '@lib/config/env.js';
import { DAO_CONFIG, MARKETPLACE_CONFIG } from '@lib/config/constants.js';
import { createLogger } from '@lib/logger/index.js';
import type { Logger } from 'pino';

/**
 * Combined WalletProvider and MidnightProvider
 * This dual-provider pattern is required by Midnight SDK
 */
export type DualProvider = WalletProvider & MidnightProvider;

/**
 * Providers required for DAO voting operations
 */
export interface DaoVotingProviders {
  privateStateProvider: any;
  publicDataProvider: any;
  zkConfigProvider: NodeZkConfigProvider<
    | 'open_election'
    | 'close_election'
    | 'cast_vote'
    | 'fund_treasury'
    | 'payout_approved_proposal'
    | 'cancel_payout'
  >;
  proofProvider: any;
  walletProvider: DualProvider;
  midnightProvider: DualProvider;
}

/**
 * Providers required for marketplace operations
 */
export interface MarketplaceProviders {
  privateStateProvider: any;
  publicDataProvider: any;
  zkConfigProvider: any;
  proofProvider: any;
  walletProvider: DualProvider;
  midnightProvider: DualProvider;
}

/**
 * ProviderFactory creates and configures providers for wallet and contract operations
 */
export class ProviderFactory {
  private static logger: Logger = createLogger('provider-factory');

  /**
   * Create a combined WalletProvider & MidnightProvider from a wallet instance
   *
   * This implements the dual-provider pattern required by Midnight SDK:
   * - Provides wallet state access (coin public key, encryption key)
   * - Handles transaction balancing and proving
   * - Converts between Ledger and Zswap transaction formats
   * - Submits transactions to the network
   *
   * @param wallet Wallet instance
   * @returns Combined provider
   */
  static async createDualProvider(
    wallet: Wallet & Resource
  ): Promise<DualProvider> {
    const logger = this.logger;
    logger.debug('Creating dual provider from wallet');

    // Get current wallet state
    const state = await firstValueFrom(wallet.state());

    return {
      // WalletProvider properties
      coinPublicKey: state.coinPublicKey,
      encryptionPublicKey: state.encryptionPublicKey,

      /**
       * Balance a transaction by adding fees and proving it
       * Converts: Ledger → Zswap → prove → Zswap → Ledger
       */
      balanceTx(
        tx: UnbalancedTransaction,
        newCoins: CoinInfo[]
      ): Promise<BalancedTransaction> {
        logger.debug('Balancing transaction');

        return wallet
          .balanceTransaction(
            ZswapTransaction.deserialize(
              tx.serialize(getLedgerNetworkId()),
              getZswapNetworkId()
            ),
            newCoins
          )
          .then((balancedTx) => wallet.proveTransaction(balancedTx))
          .then((provenZswapTx) => {
            // Convert back to Ledger format
            const ledgerTx = Transaction.deserialize(
              provenZswapTx.serialize(getZswapNetworkId()),
              getLedgerNetworkId()
            );
            return createBalancedTx(ledgerTx as any);
          });
      },

      /**
       * Submit a balanced transaction to the network
       */
      submitTx(tx: BalancedTransaction): Promise<TransactionId> {
        logger.debug('Submitting transaction');
        return wallet.submitTransaction(tx);
      },
    };
  }

  /**
   * Create providers for DAO voting operations
   *
   * @param wallet Wallet instance
   * @returns DAO voting providers
   */
  static async createDaoProviders(
    wallet: Wallet & Resource
  ): Promise<DaoVotingProviders> {
    this.logger.debug('Creating DAO voting providers');

    const dualProvider = await this.createDualProvider(wallet);

    return {
      privateStateProvider: levelPrivateStateProvider({
        privateStateStoreName: DAO_CONFIG.PRIVATE_STATE_STORE_NAME,
      }),
      publicDataProvider: indexerPublicDataProvider(
        config.INDEXER!,
        config.INDEXER_WS!
      ),
      zkConfigProvider: new NodeZkConfigProvider<
        | 'open_election'
        | 'close_election'
        | 'cast_vote'
        | 'fund_treasury'
        | 'payout_approved_proposal'
        | 'cancel_payout'
      >(DAO_CONFIG.ZK_CONFIG_PATH),
      proofProvider: httpClientProofProvider(config.PROOF_SERVER!),
      walletProvider: dualProvider,
      midnightProvider: dualProvider,
    };
  }

  /**
   * Create providers for marketplace operations
   *
   * @param wallet Wallet instance
   * @returns Marketplace providers
   */
  static async createMarketplaceProviders(
    wallet: Wallet & Resource
  ): Promise<MarketplaceProviders> {
    this.logger.debug('Creating marketplace providers');

    const dualProvider = await this.createDualProvider(wallet);

    return {
      privateStateProvider: levelPrivateStateProvider({
        privateStateStoreName: MARKETPLACE_CONFIG.PRIVATE_STATE_STORE_NAME,
      }),
      publicDataProvider: indexerPublicDataProvider(
        config.INDEXER!,
        config.INDEXER_WS!
      ),
      zkConfigProvider: new NodeZkConfigProvider(
        MARKETPLACE_CONFIG.ZK_CONFIG_PATH
      ),
      proofProvider: httpClientProofProvider(config.PROOF_SERVER!),
      walletProvider: dualProvider,
      midnightProvider: dualProvider,
    };
  }

  /**
   * Create a private state provider
   * Used for contract-specific private state storage
   *
   * @param storeName Name of the private state store
   * @returns Private state provider
   */
  static createPrivateStateProvider(storeName: string): any {
    this.logger.debug(`Creating private state provider: ${storeName}`);
    return levelPrivateStateProvider({
      privateStateStoreName: storeName,
    });
  }

  /**
   * Create a public data provider
   * Used for querying blockchain data
   *
   * @returns Public data provider
   */
  static createPublicDataProvider(): any {
    this.logger.debug('Creating public data provider');
    return indexerPublicDataProvider(config.INDEXER!, config.INDEXER_WS!);
  }

  /**
   * Create a ZK config provider
   * Used for loading zero-knowledge circuit configurations
   *
   * @param zkConfigPath Path to ZK config directory
   * @returns ZK config provider
   */
  static createZkConfigProvider<T extends string = string>(
    zkConfigPath: string
  ): NodeZkConfigProvider<T> {
    this.logger.debug(`Creating ZK config provider: ${zkConfigPath}`);
    return new NodeZkConfigProvider<T>(zkConfigPath);
  }

  /**
   * Create a proof provider
   * Used for generating zero-knowledge proofs
   *
   * @returns Proof provider
   */
  static createProofProvider(): any {
    this.logger.debug(`Creating proof provider: ${config.PROOF_SERVER}`);
    return httpClientProofProvider(config.PROOF_SERVER!);
  }
}
