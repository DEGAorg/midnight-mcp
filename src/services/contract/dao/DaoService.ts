/**
 * DAO Service
 *
 * Handles DAO voting operations:
 * - Open/close elections
 * - Cast votes with vote coins
 * - Fund treasury with funding coins
 * - Read coin colors from contract state (NOT locally generated!)
 * - Uses ProviderFactory for DAO-specific providers
 *
 * CRITICAL: Coin colors must be read from deployed contract state,
 * not generated locally. The contract determines the coin types.
 */

import { createLogger } from '@lib/logger/index.js';
import { DAO_CONFIG, TOKEN_CONFIG } from '@lib/config/constants.js';
import { padBytes, convertDecimalToBigInt } from '@lib/utils/conversions.js';
import { ProviderFactory, type DaoVotingProviders } from '@services/providers/ProviderFactory.js';
import type { WalletService } from '@services/wallet/WalletService.js';
import type { AuditService } from '@services/audit/AuditService.js';
import type { Logger } from 'pino';
import { joinDaoVotingContract, pad, type DeployedDaoVotingContract, VoteType } from '@contracts/dao/index.js';

/**
 * DAO coin colors (read from contract state)
 */
export interface DaoCoinColors {
  /** Vote coin color */
  voteCoinColor: Uint8Array;

  /** Funding coin color */
  fundingCoinColor: Uint8Array;
}

/**
 * DAO election info
 */
export interface DaoElectionInfo {
  /** Election ID */
  electionId: string;

  /** Whether election is open */
  isOpen: boolean;

  /** Start time */
  startTime?: number;

  /** End time */
  endTime?: number;
}

/**
 * DAO service configuration
 */
export interface DaoServiceConfig {
  /** Wallet service */
  walletService: WalletService;

  /** Audit service */
  auditService: AuditService;

  /** DAO contract address */
  contractAddress: string;

  /** Agent ID for logging */
  agentId: string;
}

/**
 * DaoService handles DAO voting operations
 */
export class DaoService {
  private logger: Logger;
  private config: DaoServiceConfig;
  private providers?: DaoVotingProviders;

  // Deployed contract instance (needed for circuit calls)
  private deployedContract?: DeployedDaoVotingContract;

  // Coin colors (must be read from contract!)
  private coinColors?: DaoCoinColors;

  constructor(config: DaoServiceConfig) {
    this.config = config;
    this.logger = createLogger(`dao-service:${config.agentId}`);

    this.logger.info('DAO service initialized', {
      agentId: config.agentId,
      contractAddress: config.contractAddress,
    });
  }

  // ==================== LIFECYCLE ====================

  /**
   * Start the DAO service
   * Initializes providers, joins contract, and reads coin colors from contract
   */
  async start(): Promise<void> {
    this.logger.info('Starting DAO service...');

    try {
      // Create DAO providers
      const wallet = this.config.walletService.getWallet();
      this.providers = await ProviderFactory.createDaoProviders(wallet);

      // Join the deployed DAO contract
      this.deployedContract = await joinDaoVotingContract(
        this.providers,
        this.config.contractAddress
      );

      this.logger.info('Joined DAO contract', {
        contractAddress: this.deployedContract.deployTxData.public.contractAddress,
      });

      // Read coin colors from deployed contract
      await this.readCoinColorsFromContract();

      this.logger.info('DAO service started successfully');
    } catch (error) {
      this.logger.error('Failed to start DAO service', error);
      throw error;
    }
  }

  /**
   * Stop the DAO service
   */
  stop(): void {
    this.logger.info('DAO service stopped');
  }

  // ==================== COIN COLORS ====================

  /**
   * Read coin colors from deployed DAO contract state
   * CRITICAL: Must read from contract, NOT generate locally!
   *
   * The contract deployment creates the coin colors, and all participants
   * must use the exact same colors. Local generation would create mismatches.
   */
  private async readCoinColorsFromContract(): Promise<void> {
    this.logger.info('Reading coin colors from DAO contract...');

    try {
      // Query the deployed DAO contract state
      const contractState = await this.providers!.publicDataProvider.queryContractState(
        this.config.contractAddress
      );

      if (!contractState || !contractState.data) {
        throw new Error('Contract state not available');
      }

      // Parse the contract state using the DAO contract ledger function
      // This requires importing the DaoVoting contract, but for now we'll access the data directly
      const stateData = contractState.data;

      // Extract dao_vote_coin_color from contract state
      // This is the CRITICAL one that must come from contract
      const voteCoinColor = stateData.dao_vote_coin_color;

      if (!voteCoinColor || !(voteCoinColor instanceof Uint8Array)) {
        throw new Error('dao_vote_coin_color not found in contract state');
      }

      // For funding coin color, it's generated deterministically
      // (Not stored in contract state, but generated from domain separator)
      const fundingCoinColor = this.generateFundingCoinType();

      this.coinColors = {
        voteCoinColor,
        fundingCoinColor,
      };

      this.logger.info('Coin colors read from contract', {
        voteCoinColorLength: voteCoinColor.length,
        voteCoinColorHex: Buffer.from(voteCoinColor).toString('hex').substring(0, 16) + '...',
        fundingCoinColorLength: fundingCoinColor.length,
      });
    } catch (error) {
      this.logger.error('Failed to read coin colors from contract', error);
      throw error;
    }
  }

  /**
   * Generate vote coin type
   * Format: padBytes(32, "dega_dao_vote") + padBytes(32, contractAddress)
   *
   * NOTE: In production, this should be READ from contract, not generated!
   */
  private generateVoteCoinType(): Uint8Array {
    const domainBytes = padBytes(32, TOKEN_CONFIG.DAO_VOTE_DOMAIN_SEPARATOR);
    const addressBytes = padBytes(32, this.config.contractAddress);

    const coinType = new Uint8Array(64);
    coinType.set(domainBytes, 0);
    coinType.set(addressBytes, 32);

    return coinType;
  }

  /**
   * Generate funding coin type
   * Format: padBytes(32, "dega_funding_token") + padBytes(32, contractAddress)
   *
   * NOTE: In production, this should be READ from contract, not generated!
   */
  private generateFundingCoinType(): Uint8Array {
    const domainBytes = padBytes(32, TOKEN_CONFIG.DAO_FUNDING_DOMAIN_SEPARATOR);
    const addressBytes = padBytes(32, this.config.contractAddress);

    const coinType = new Uint8Array(64);
    coinType.set(domainBytes, 0);
    coinType.set(addressBytes, 32);

    return coinType;
  }

  /**
   * Get coin colors (throws if not initialized)
   */
  private getCoinColors(): DaoCoinColors {
    if (!this.coinColors) {
      throw new Error('DAO service not started - coin colors not available');
    }
    return this.coinColors;
  }

  // ==================== ELECTION OPERATIONS ====================

  /**
   * Open a DAO election
   *
   * @param electionId Election identifier
   * @returns Transaction result
   */
  async openElection(electionId: string): Promise<string> {
    if (!this.deployedContract) {
      throw new Error('DAO service not started - contract not available');
    }

    const correlationId = this.config.auditService.generateCorrelationId();

    this.logger.info('Opening DAO election', {
      electionId,
      correlationId,
    });

    try {
      // Start audit trail
      this.config.auditService.startTransactionTrace(`dao-open-${electionId}`, correlationId, {
        operation: 'open_election',
        electionId,
        contractAddress: this.config.contractAddress,
      });

      // Pad election ID to 32 bytes
      const electionIdBytes = pad(electionId, 32);

      // Call open_election circuit
      const finalizedTxData = await this.deployedContract.callTx.open_election(electionIdBytes);

      const txId = finalizedTxData.public.txId;
      const blockHeight = finalizedTxData.public.blockHeight;

      // Complete audit trail
      this.config.auditService.completeTransactionTrace(
        `dao-open-${electionId}`,
        'completed',
        'Election opened successfully',
        { txId, blockHeight }
      );

      this.logger.info('DAO election opened', {
        electionId,
        txId,
        blockHeight,
        correlationId,
      });

      return txId;
    } catch (error) {
      this.logger.error('Failed to open DAO election', {
        error,
        electionId,
      });

      // Log failure to audit trail
      this.config.auditService.logTransactionFailure(
        `dao-open-${electionId}`,
        error as Error,
        { electionId },
        correlationId
      );

      throw error;
    }
  }

  /**
   * Close a DAO election
   *
   * @param electionId Election identifier
   * @returns Transaction result
   */
  async closeElection(electionId: string): Promise<string> {
    if (!this.deployedContract) {
      throw new Error('DAO service not started - contract not available');
    }

    const correlationId = this.config.auditService.generateCorrelationId();

    this.logger.info('Closing DAO election', {
      electionId,
      correlationId,
    });

    try {
      // Start audit trail
      this.config.auditService.startTransactionTrace(`dao-close-${electionId}`, correlationId, {
        operation: 'close_election',
        electionId,
        contractAddress: this.config.contractAddress,
      });

      // Call close_election circuit
      const finalizedTxData = await this.deployedContract.callTx.close_election();

      const txId = finalizedTxData.public.txId;
      const blockHeight = finalizedTxData.public.blockHeight;

      // Complete audit trail
      this.config.auditService.completeTransactionTrace(
        `dao-close-${electionId}`,
        'completed',
        'Election closed successfully',
        { txId, blockHeight }
      );

      this.logger.info('DAO election closed', {
        electionId,
        txId,
        blockHeight,
        correlationId,
      });

      return txId;
    } catch (error) {
      this.logger.error('Failed to close DAO election', {
        error,
        electionId,
      });

      // Log failure to audit trail
      this.config.auditService.logTransactionFailure(
        `dao-close-${electionId}`,
        error as Error,
        { electionId },
        correlationId
      );

      throw error;
    }
  }

  // ==================== VOTING OPERATIONS ====================

  /**
   * Cast a vote in the DAO election
   * Uses vote coins from wallet
   *
   * @param voteChoice Vote choice (e.g., "yes", "no", "absent")
   * @returns Transaction result
   */
  async castVote(voteChoice: string): Promise<string> {
    if (!this.deployedContract) {
      throw new Error('DAO service not started - contract not available');
    }

    const coinColors = this.getCoinColors();
    const correlationId = this.config.auditService.generateCorrelationId();

    this.logger.info('Casting DAO vote', {
      voteChoice,
      correlationId,
    });

    try {
      // Convert vote choice string to VoteType
      const voteType = this.parseVoteChoice(voteChoice);

      // Start audit trail
      const txTraceId = `dao-vote-${Date.now()}`;
      this.config.auditService.startTransactionTrace(txTraceId, correlationId, {
        operation: 'cast_vote',
        voteChoice,
        voteType,
        contractAddress: this.config.contractAddress,
      });

      // Find vote coin in wallet
      const voteCoin = await this.findVoteCoinInWallet(coinColors.voteCoinColor);

      if (!voteCoin) {
        throw new Error('No vote coin found in wallet');
      }

      // Call cast_vote circuit
      const finalizedTxData = await this.deployedContract.callTx.cast_vote(
        BigInt(voteType),
        voteCoin
      );

      const txId = finalizedTxData.public.txId;
      const blockHeight = finalizedTxData.public.blockHeight;

      // Complete audit trail
      this.config.auditService.completeTransactionTrace(
        txTraceId,
        'completed',
        'Vote cast successfully',
        { txId, blockHeight, voteChoice }
      );

      this.logger.info('DAO vote cast', {
        voteChoice,
        voteType,
        txId,
        blockHeight,
        correlationId,
      });

      return txId;
    } catch (error) {
      this.logger.error('Failed to cast DAO vote', {
        error,
        voteChoice,
      });

      // Log failure to audit trail
      this.config.auditService.logTransactionFailure(
        `dao-vote-${Date.now()}`,
        error as Error,
        { voteChoice },
        correlationId
      );

      throw error;
    }
  }

  // ==================== TREASURY OPERATIONS ====================

  /**
   * Fund the DAO treasury
   * Uses funding coins from wallet
   *
   * @param amountDecimal Amount to fund (decimal string)
   * @returns Transaction result
   */
  async fundTreasury(amountDecimal: string): Promise<string> {
    if (!this.deployedContract) {
      throw new Error('DAO service not started - contract not available');
    }

    const coinColors = this.getCoinColors();
    const amount = convertDecimalToBigInt(amountDecimal, TOKEN_CONFIG.DEFAULT_DECIMALS);
    const correlationId = this.config.auditService.generateCorrelationId();

    this.logger.info('Funding DAO treasury', {
      amountDecimal,
      amount: amount.toString(),
      correlationId,
    });

    try {
      // Start audit trail
      const txTraceId = `dao-fund-${Date.now()}`;
      this.config.auditService.startTransactionTrace(txTraceId, correlationId, {
        operation: 'fund_treasury',
        amount: amount.toString(),
        amountDecimal,
        contractAddress: this.config.contractAddress,
      });

      // Find funding coin in wallet matching the required amount
      const fundingCoin = await this.findFundingCoinInWallet(
        coinColors.fundingCoinColor,
        amount
      );

      if (!fundingCoin) {
        throw new Error(
          `No funding coin found in wallet with sufficient balance (need ${amount.toString()})`
        );
      }

      // Call fund_treasury circuit
      const finalizedTxData = await this.deployedContract.callTx.fund_treasury(fundingCoin);

      const txId = finalizedTxData.public.txId;
      const blockHeight = finalizedTxData.public.blockHeight;

      // Complete audit trail
      this.config.auditService.completeTransactionTrace(
        txTraceId,
        'completed',
        'Treasury funded successfully',
        { txId, blockHeight, amount: amount.toString() }
      );

      this.logger.info('DAO treasury funded', {
        amountDecimal,
        amount: amount.toString(),
        txId,
        blockHeight,
        correlationId,
      });

      return txId;
    } catch (error) {
      this.logger.error('Failed to fund DAO treasury', {
        error,
        amountDecimal,
      });

      // Log failure to audit trail
      this.config.auditService.logTransactionFailure(
        `dao-fund-${Date.now()}`,
        error as Error,
        { amount: amount.toString(), amountDecimal },
        correlationId
      );

      throw error;
    }
  }

  // ==================== HELPERS ====================

  /**
   * Parse vote choice string to VoteType enum
   *
   * @param voteChoice Vote choice string
   * @returns VoteType enum value
   */
  private parseVoteChoice(voteChoice: string): VoteType {
    const normalized = voteChoice.toLowerCase().trim();

    switch (normalized) {
      case 'yes':
      case 'y':
      case '0':
        return VoteType.YES;

      case 'no':
      case 'n':
      case '1':
        return VoteType.NO;

      case 'absent':
      case 'abstain':
      case 'a':
      case '2':
        return VoteType.ABSENT;

      default:
        throw new Error(
          `Invalid vote choice: ${voteChoice}. Valid options: yes/no/absent`
        );
    }
  }

  /**
   * Find vote coin in wallet matching the vote coin color
   *
   * @param voteCoinColor Vote coin color to match
   * @returns Vote coin or null if not found
   */
  private async findVoteCoinInWallet(voteCoinColor: Uint8Array): Promise<any> {
    try {
      const walletState = this.config.walletService.getWalletState();

      // Get wallet instance to access coin info
      const wallet = this.config.walletService.getWallet();

      // Convert vote coin color to hex for comparison
      const voteCoinColorHex = Buffer.from(voteCoinColor).toString('hex');

      // Search through wallet coins to find one matching the vote coin color
      // Note: In full implementation, this would query wallet.coins() or similar
      // to get CoinInfo objects and find one with matching color

      this.logger.debug('Searching for vote coin', {
        voteCoinColorHex: voteCoinColorHex.substring(0, 16) + '...',
      });

      // TODO: In full implementation, this would:
      // 1. Get all coins from wallet
      // 2. Find one with color matching voteCoinColor
      // 3. Return the CoinInfo object
      //
      // For now, returning placeholder that will be replaced with actual coin lookup
      // when wallet API provides coin enumeration

      throw new Error('Vote coin lookup not yet implemented - requires wallet coin enumeration API');
    } catch (error) {
      this.logger.error('Error finding vote coin in wallet', { error });
      return null;
    }
  }

  /**
   * Find funding coin in wallet matching the funding coin color and amount
   *
   * @param fundingCoinColor Funding coin color to match
   * @param amount Amount needed
   * @returns Funding coin or null if not found
   */
  private async findFundingCoinInWallet(
    fundingCoinColor: Uint8Array,
    amount: bigint
  ): Promise<any> {
    try {
      const walletState = this.config.walletService.getWalletState();

      // Get wallet instance to access coin info
      const wallet = this.config.walletService.getWallet();

      // Convert funding coin color to hex for comparison
      const fundingCoinColorHex = Buffer.from(fundingCoinColor).toString('hex');

      this.logger.debug('Searching for funding coin', {
        fundingCoinColorHex: fundingCoinColorHex.substring(0, 16) + '...',
        amountNeeded: amount.toString(),
      });

      // TODO: In full implementation, this would:
      // 1. Get all coins from wallet
      // 2. Filter by color matching fundingCoinColor
      // 3. Find one with value >= amount
      // 4. Return the CoinInfo object
      //
      // For now, returning placeholder that will be replaced with actual coin lookup
      // when wallet API provides coin enumeration API

      throw new Error('Funding coin lookup not yet implemented - requires wallet coin enumeration API');
    } catch (error) {
      this.logger.error('Error finding funding coin in wallet', { error });
      return null;
    }
  }
}
