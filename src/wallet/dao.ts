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

export interface VoteCoinInfo {
  nonce: string;
  color: string;
  value: string;
}

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
   * Cast a vote in the DAO election
   */
  public async castDaoVote(voteType: string): Promise<DaoOperationResult> {
    try {
      const config = this.getDaoConfig();
      logger.info(`Casting DAO vote: ${voteType} for contract: ${config.contractAddress}`);
      
      // Generate vote coin color dynamically using the same logic as working DAO code
      const voteCoinColor = generateVoteCoinColor(config.voteTokenContractAddress);
      
      // Create vote coin from configuration with dynamic color generation
      const voteCoin: VoteCoinInfo = {
        nonce: randomBytes(32).toString('hex'), // Generate random nonce for uniqueness
        color: voteCoinColor,
        value: config.voteCoinValue
      };
      
      logger.info(`Generated vote coin color: ${voteCoinColor}`);
      
      const daoVotingContract = await this.getDaoVotingContract();
      const result = await castVote(daoVotingContract, voteType as unknown as VoteType, voteCoin);
      
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
      
      // Generate fund coin color dynamically using the same logic as working DAO code
      const fundCoinColor = generateFundCoinColor(config.fundTokenContractAddress);
      
      // Create fund coin from configuration with dynamic color generation
      const fundCoin: VoteCoinInfo = {
        nonce: randomBytes(32).toString('hex'), // Generate random nonce for uniqueness
        color: fundCoinColor,
        value: amount
      };
      
      logger.info(`Generated fund coin color: ${fundCoinColor}`);
      
      const daoVotingContract = await this.getDaoVotingContract();
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
      
      const daoVotingContract = await this.getDaoVotingContract();
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
