import { Wallet } from '@midnight-ntwrk/wallet-api';
import { Resource } from '@midnight-ntwrk/wallet';
import { createLogger } from '../logger/index.js';
import {
  configureProviders,
  joinDaoVotingContract,
  openElection,
  closeElection,
  castVote,
  fundTreasury,
  payoutApprovedProposal,
  getElectionStatus,
  displayDaoVotingState,
  VoteType,
  type DaoVotingProviders,
  type DeployedDaoVotingContract,
  type ElectionStatus
} from '../integrations/dao/index.js';
import { getDaoConfigFromEnv, type DaoConfig } from './dao-config.js';
import { tokenType } from '@midnight-ntwrk/compact-runtime';
import { randomBytes } from 'crypto';
import { CoinInfo } from '../types/wallet.js';

const logger = createLogger('dao-service');

/**
 * Helper function to serialize BigInt values to strings for JSON serialization
 */
function serializeBigInts(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'bigint') {
    return obj.toString();
  }
  
  if (Array.isArray(obj)) {
    return obj.map(serializeBigInts);
  }
  
  if (typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = serializeBigInts(value);
    }
    return result;
  }
  
  return obj;
}

export interface DaoOperationResult {
  success: boolean;
  message?: string;
  data?: any;
  error?: string;
}

// Use the standard CoinInfo interface from types/wallet.ts
// export interface VoteCoinInfo {
//   nonce: string;
//   color: string;
//   value: string;
// }

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
 * Generate vote coin color using the same logic as the working DAO code
 * @param voteTokenContractAddress Vote token contract address
 * @returns Vote coin color as hex string
 */
function generateVoteCoinColor(voteTokenContractAddress: string): string {
  const domainSep = padBytes(32, 'dega_dao_vote');
  return tokenType(domainSep, voteTokenContractAddress);
}

/**
 * Generate fund coin color using the same logic as the working DAO code
 * @param fundTokenContractAddress Fund token contract address
 * @returns Fund coin color as hex string
 */
function generateFundCoinColor(fundTokenContractAddress: string): string {
  const domainSep = padBytes(32, 'dega_funding_token');
  return tokenType(domainSep, fundTokenContractAddress);
}

export class DaoService {
  private wallet: Wallet & Resource;
  private providers: DaoVotingProviders | null = null;
  private daoConfig: DaoConfig | null = null;

  constructor(wallet: Wallet & Resource) {
    this.wallet = wallet;
    this.loadDaoConfig();
  }

  /**
   * Load DAO configuration from environment variables
   */
  private loadDaoConfig(): void {
    const configResult = getDaoConfigFromEnv();
    if (configResult.success && configResult.config) {
      this.daoConfig = configResult.config;
      logger.info('DAO configuration loaded successfully', this.daoConfig);
    } else {
      logger.warn('No DAO configuration found in environment variables', configResult.error);
    }
  }

  /**
   * Get DAO configuration
   */
  private getDaoConfig(): DaoConfig {
    if (!this.daoConfig) {
      throw new Error('DAO configuration not found. Please set DAO environment variable.');
    }
    return this.daoConfig;
  }

  /**
   * Initialize DAO providers
   */
  private async initializeProviders(): Promise<DaoVotingProviders> {
    if (!this.providers) {
      this.providers = await configureProviders(this.wallet);
    }
    return this.providers;
  }

  /**
   * Get DAO providers (initialize if needed)
   */
  private async getDaoProviders(): Promise<DaoVotingProviders> {
    return await this.initializeProviders();
  }

  /**
   * Get DAO voting contract instance
   */
  private async getDaoVotingContract(): Promise<DeployedDaoVotingContract> {
    const config = this.getDaoConfig();
    const providers = await this.initializeProviders();
    return await joinDaoVotingContract(providers, config.contractAddress);
  }

  /**
   * Open a new election in the DAO voting contract
   */
  public async openDaoElection(electionId: string): Promise<DaoOperationResult> {
    try {
      const config = this.getDaoConfig();
      logger.info(`Opening DAO election: ${electionId} for contract: ${config.contractAddress}`);
      
      const daoVotingContract = await this.getDaoVotingContract();
      const result = await openElection(daoVotingContract, electionId);
      
      // Serialize BigInt values for JSON response
      const serializedResult = serializeBigInts(result);
      
      logger.info(`DAO election opened successfully: ${electionId}`);
      return {
        success: true,
        message: `Election ${electionId} opened successfully`,
        data: serializedResult
      };
    } catch (error) {
      logger.error('Error opening DAO election:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Close the current election in the DAO voting contract
   */
  public async closeDaoElection(): Promise<DaoOperationResult> {
    try {
      const config = this.getDaoConfig();
      logger.info(`Closing DAO election for contract: ${config.contractAddress}`);
      
      const daoVotingContract = await this.getDaoVotingContract();
      const result = await closeElection(daoVotingContract);
      
      // Serialize BigInt values for JSON response
      const serializedResult = serializeBigInts(result);
      
      logger.info(`DAO election closed successfully for contract: ${config.contractAddress}`);
      return {
        success: true,
        message: 'Election closed successfully',
        data: serializedResult
      };
    } catch (error) {
      logger.error('Error closing DAO election:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Convert natural language vote string to VoteType enum
   */
  private convertVoteStringToType(voteString: string): VoteType {
    const normalizedVote = voteString.toLowerCase().trim();
    
    switch (normalizedVote) {
      case 'yes':
        return VoteType.YES; // 0
      case 'no':
        return VoteType.NO; // 1
      case 'absence':
      case 'absent':
        return VoteType.ABSENT; // 2
      default:
        throw new Error(`Invalid vote type: ${voteString}. Must be 'yes', 'no', or 'absence'`);
    }
  }

  /**
   * Cast a vote in the DAO election
   */
  public async castDaoVote(voteType: string): Promise<DaoOperationResult> {
    try {
      const config = this.getDaoConfig();
      logger.info(`Casting DAO vote: ${voteType} for contract: ${config.contractAddress}`);
      
      // Convert natural language vote string to VoteType enum
      const convertedVoteType = this.convertVoteStringToType(voteType);
      
      // Get the DAO contract state to retrieve the correct vote coin color
      const daoVotingContract = await this.getDaoVotingContract();
      const providers = await this.getDaoProviders();
      const { state } = await displayDaoVotingState(providers, daoVotingContract);
      
      if (!state) {
        throw new Error('Failed to retrieve DAO contract state');
      }
      
      // Use the actual vote coin color from the contract state
      const voteCoinColor = state.dao_vote_coin_color;
      logger.info(`Using DAO vote coin color from contract: ${Buffer.from(voteCoinColor).toString('hex')}`);
      
      const voteCoin: CoinInfo = {
        nonce: randomBytes(32), // Generate random nonce for uniqueness (Uint8Array)
        color: voteCoinColor, // Use the exact color from contract state (already Uint8Array)
        value: BigInt(config.voteCoinValue) // Convert string to bigint
      };
      
      const result = await castVote(daoVotingContract, convertedVoteType, voteCoin);
      
      // Serialize BigInt values for JSON response
      const serializedResult = serializeBigInts(result);
      
      logger.info(`DAO vote cast successfully: ${voteType}`);
      return {
        success: true,
        message: `Vote ${voteType} cast successfully`,
        data: serializedResult
      };
    } catch (error) {
      logger.error('Error casting DAO vote:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Fund the DAO treasury with tokens
   */
  public async fundDaoTreasury(amount: string): Promise<DaoOperationResult> {
    try {
      const config = this.getDaoConfig();
      logger.info(`Funding DAO treasury for contract: ${config.contractAddress} with amount: ${amount}`);
      
      // Get the DAO contract state to retrieve the correct treasury coin color
      const daoVotingContract = await this.getDaoVotingContract();
      const providers = await this.getDaoProviders();
      const { state } = await displayDaoVotingState(providers, daoVotingContract);
      
      if (!state) {
        throw new Error('Failed to retrieve DAO contract state');
      }
      
      // Use the actual treasury coin color from the contract state
      const treasuryCoinColor = state.treasury.color;
      logger.info(`Using DAO treasury coin color from contract: ${Buffer.from(treasuryCoinColor).toString('hex')}`);
      
      const fundCoin: CoinInfo = {
        nonce: randomBytes(32), // Generate random nonce for uniqueness (Uint8Array)
        color: treasuryCoinColor, // Use the exact color from contract state (already Uint8Array)
        value: BigInt(amount) // Convert string to bigint
      };
      
      const result = await fundTreasury(daoVotingContract, fundCoin);
      
      // Serialize BigInt values for JSON response
      const serializedResult = serializeBigInts(result);
      
      logger.info(`DAO treasury funded successfully for contract: ${config.contractAddress}`);
      return {
        success: true,
        message: 'Treasury funded successfully',
        data: serializedResult
      };
    } catch (error) {
      logger.error('Error funding DAO treasury:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Payout an approved proposal from the DAO treasury
   */
  public async payoutDaoProposal(): Promise<DaoOperationResult> {
    try {
      const config = this.getDaoConfig();
      logger.info(`Paying out DAO proposal for contract: ${config.contractAddress}`);
      
      // Get the DAO contract state to check conditions before payout
      const daoVotingContract = await this.getDaoVotingContract();
      const providers = await this.getDaoProviders();
      const { state } = await displayDaoVotingState(providers, daoVotingContract);
      
      if (!state) {
        throw new Error('Failed to retrieve DAO contract state');
      }
      
      // Check if election is closed (payout typically requires closed election)
      if (state.election_open) {
        logger.warn('Election is still open. Payout may require election to be closed first.');
      }
      
      // Check if treasury has funds
      if (state.treasury.value === 0n) {
        logger.warn('Treasury has no funds to payout.');
      }
      
      const result = await payoutApprovedProposal(daoVotingContract);
      
      // Serialize BigInt values for JSON response
      const serializedResult = serializeBigInts(result);
      
      logger.info(`DAO proposal paid out successfully for contract: ${config.contractAddress}`);
      return {
        success: true,
        message: 'Proposal paid out successfully',
        data: serializedResult
      };
    } catch (error) {
      logger.error('Error paying out DAO proposal:', error);
      logger.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Get the current status of the DAO election
   */
  public async getDaoElectionStatus(): Promise<DaoOperationResult> {
    try {
      const config = this.getDaoConfig();
      logger.info(`Getting DAO election status for contract: ${config.contractAddress}`);
      
      const providers = await this.initializeProviders();
      const result = await getElectionStatus(providers, config.contractAddress);
      
      // Serialize BigInt values for JSON response
      const serializedResult = serializeBigInts(result);
      
      logger.info(`DAO election status retrieved for contract: ${config.contractAddress}`);
      return {
        success: true,
        message: 'Election status retrieved successfully',
        data: serializedResult
      };
    } catch (error) {
      logger.error('Error getting DAO election status:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Get the full state of the DAO voting contract
   */
  public async getDaoState(): Promise<DaoOperationResult> {
    try {
      const config = this.getDaoConfig();
      logger.info(`Getting DAO state for contract: ${config.contractAddress}`);
      
      const providers = await this.initializeProviders();
      const daoVotingContract = await this.getDaoVotingContract();
      const result = await displayDaoVotingState(providers, daoVotingContract);
      
      // Serialize BigInt values for JSON response
      const serializedResult = serializeBigInts(result);
      
      logger.info(`DAO state retrieved for contract: ${config.contractAddress}`);
      return {
        success: true,
        message: 'DAO state retrieved successfully',
        data: serializedResult
      };
    } catch (error) {
      logger.error('Error getting DAO state:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }
}
