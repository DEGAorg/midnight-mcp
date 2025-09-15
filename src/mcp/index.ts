import { WalletManager, WalletConfig, TestnetRemoteConfig } from '../wallet/index.js';
import { setNetworkId, NetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { createLogger } from '../logger/index.js';
import type { Logger } from 'pino';
import { SeedManager } from '../utils/seed-manager.js';
import { 
  WalletStatus, 
  WalletBalances, 
  SendFundsResult as WalletSendFundsResult,
  TransactionVerificationResult,
  InitiateTransactionResult,
  TransactionStatusResult,
  TransactionRecord,
  TransactionState
} from '../types/wallet.js';

/**
 * Format error for logging
 */
export function formatError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  return String(error);
}

/**
 * Error types for the Wallet Service
 */
export enum WalletServiceErrorType {
  WALLET_NOT_READY = 'WALLET_NOT_READY',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  TX_SUBMISSION_FAILED = 'TX_SUBMISSION_FAILED',
  TX_NOT_FOUND = 'TX_NOT_FOUND',
  IDENTIFIER_VERIFICATION_FAILED = 'IDENTIFIER_VERIFICATION_FAILED',
}

/**
 * Centralized error message mapping for Wallet Service error types
 */
export const ERROR_MESSAGES = {
  [WalletServiceErrorType.WALLET_NOT_READY]: 'Wallet is not ready yet. Please try again later.',
  [WalletServiceErrorType.INSUFFICIENT_FUNDS]: 'Insufficient funds for this transaction.',
  [WalletServiceErrorType.TX_SUBMISSION_FAILED]: 'Transaction submission failed.',
  [WalletServiceErrorType.TX_NOT_FOUND]: 'Transaction not found.',
  [WalletServiceErrorType.IDENTIFIER_VERIFICATION_FAILED]: 'Transaction verification failed.',
};

/**
 * Error class for Wallet Service errors
 */
export class WalletServiceError extends Error {
  constructor(public type: WalletServiceErrorType, message: string) {
    super(message);
    this.name = 'WalletServiceError';
  }
}

/**
 * Generic error handler for Wallet Service errors
 * @param error The error to handle
 * @returns A formatted response with appropriate error message
 */
export function handleWalletServiceError(error: unknown) {
  if (error instanceof WalletServiceError) {
    const message = ERROR_MESSAGES[error.type] || error.message || 'An unexpected error occurred.';
    return { 
      content: [{ 
        type: "text" as const, 
        text: message 
      }] 
    };
  }
  
  // For non-Wallet Service errors, rethrow to be caught by the outer handler
  throw error;
}

/**
 * Higher-order function for tool handlers without parameters
 * @param handler The function to wrap
 * @returns A wrapped function that handles errors
 */
export function createSimpleToolHandler(handler: () => any) {
  return async () => {
    try {
      const result = await handler();
      return { 
        content: [{ 
          type: "text" as const, 
          text: typeof result === 'string' ? result : JSON.stringify(result, null, 2) 
        }] 
      };
    } catch (error: unknown) {
      return handleWalletServiceError(error);
    }
  };
}

/**
 * Higher-order function for tool handlers with parameters
 * @param handler The function to wrap
 * @returns A wrapped function that handles errors
 */
export function createParameterizedToolHandler<T extends Record<string, any>>(handler: (args: T) => any) {
  return async (args: T) => {
    try {
      const result = await handler(args);
      return { 
        content: [{ 
          type: "text" as const, 
          text: typeof result === 'string' ? result : JSON.stringify(result, null, 2) 
        }] 
      };
    } catch (error: unknown) {
      return handleWalletServiceError(error);
    }
  };
}

/**
 * Wallet Service MCP that provides a secure interface to interact with the Midnight blockchain
 * through the wallet implementation
 */
export class WalletServiceMCP {
  private wallet: WalletManager;
  private logger: Logger;
  private externalConfig: WalletConfig;
  private agentId: string;
  
  /**
   * Create a new Wallet Service instance
   * @param networkId The Midnight network ID to connect to
   * @param seed The seed for the wallet
   * @param walletFilename filename to restore wallet from
   * @param externalConfig Optional external configuration for connecting to a proof server
   */
  constructor(networkId: NetworkId, seed: string, walletFilename: string, externalConfig?: WalletConfig) {
    // Set network ID if provided
    if (networkId) {
      setNetworkId(networkId);
    }
    
    this.logger = createLogger('wallet-service');
    this.agentId = process.env.AGENT_ID || 'default';
    
    this.logger.info('Initializing Midnight Wallet Service');

    this.externalConfig = externalConfig || new TestnetRemoteConfig();
    
    // Initialize WalletManager with network ID, seed, filename, and optional external config
    this.wallet = new WalletManager(networkId, seed, walletFilename, externalConfig);
    
    this.logger.info('Wallet Service initialized, wallet synchronization started in background');
  }
  
  /**
   * Check if the wallet is ready for operations
   * @returns true if wallet is synced and ready
   */
  public isReady(): boolean {
    // Pass false to ensure we get a boolean back from the wallet manager
    return this.wallet.isReady(false) as boolean;
  }
  
  /**
   * Get the wallet's address
   * @returns The wallet address as a string
   * @throws WalletServiceError if wallet is not ready
   */
  public getAddress(): string {
    if (!this.isReady()) {
      throw new WalletServiceError(WalletServiceErrorType.WALLET_NOT_READY, 'Wallet is not ready');
    }
    
    try {
      return this.wallet.getAddress();
    } catch (error) {
      this.logger.error('Error getting wallet address', error);
      throw new WalletServiceError(WalletServiceErrorType.WALLET_NOT_READY, 'Error accessing wallet address');
    }
  }
  
  /**
   * Get the wallet's current balance
   * @returns The wallet balance details including available and pending balances
   * @throws WalletServiceError if wallet is not ready
   */
  public getBalance(): WalletBalances {
    if (!this.isReady()) {
      throw new WalletServiceError(WalletServiceErrorType.WALLET_NOT_READY, 'Wallet is not ready');
    }
    
    try {
      return this.wallet.getBalance();
    } catch (error) {
      this.logger.error('Error getting wallet balance', error);
      throw new WalletServiceError(WalletServiceErrorType.WALLET_NOT_READY, 'Error accessing wallet balance');
    }
  }
  
  /**
   * Initiate a transaction to send funds to the specified destination address
   * This method is non-blocking and returns immediately after creating the transaction record
   * 
   * @param destinationAddress Address to send the funds to
   * @param amount Amount of funds to send as a string (decimal value)
   * @returns Transaction initiation details including ID, state, and amount
   * @throws WalletServiceError if wallet is not ready or transaction initialization fails
   */
  public async sendFunds(destinationAddress: string, amount: string): Promise<InitiateTransactionResult> {
    if (!this.isReady()) {
      throw new WalletServiceError(WalletServiceErrorType.WALLET_NOT_READY, 'Wallet is not ready');
    }
    
    try {
      // Use initiateSendFunds instead of sendFunds
      const result = await this.wallet.initiateSendFunds(destinationAddress, amount);
      
      return result;
    } catch (error) {
      this.logger.error('Failed to send funds', error);
      throw new WalletServiceError(WalletServiceErrorType.TX_SUBMISSION_FAILED, 'Failed to submit transaction');
    }
  }
  
  /**
   * Send funds and wait for the transaction to be submitted
   * This method is blocking and waits for the transaction to be fully processed
   * 
   * @param destinationAddress Address to send the funds to
   * @param amount Amount of funds to send as a string (decimal value)
   * @returns Transaction details including identifier, sync status, and amount sent
   * @throws WalletServiceError if wallet is not ready, has insufficient funds, or transaction fails
   * @deprecated Use sendFunds for non-blocking transactions
   */
  public async sendFundsAndWait(destinationAddress: string, amount: string): Promise<WalletSendFundsResult> {
    if (!this.isReady()) {
      throw new WalletServiceError(WalletServiceErrorType.WALLET_NOT_READY, 'Wallet is not ready');
    }
    
    try {
      const result = await this.wallet.sendFunds(destinationAddress, amount);
      
      return {
        txIdentifier: result.txIdentifier,
        syncStatus: result.syncStatus,
        amount: result.amount
      };
    } catch (error) {
      this.logger.error('Failed to send funds', error);
      throw new WalletServiceError(WalletServiceErrorType.TX_SUBMISSION_FAILED, 'Failed to submit transaction');
    }
  }
  
  /**
   * Get the status of a transaction by its ID
   * @param transactionId The ID of the transaction to check
   * @returns The current status of the transaction including blockchain status if available
   * @throws WalletServiceError if transaction is not found or wallet is not ready
   */
  public getTransactionStatus(transactionId: string): TransactionStatusResult | null {
    if (!this.isReady()) {
      throw new WalletServiceError(WalletServiceErrorType.WALLET_NOT_READY, 'Wallet is not ready');
    }
    
    try {
      const status = this.wallet.getTransactionStatus(transactionId);
      
      if (!status) {
        throw new WalletServiceError(WalletServiceErrorType.TX_NOT_FOUND, `Transaction with ID ${transactionId} not found`);
      }
      
      return status;
    } catch (error) {
      if (error instanceof WalletServiceError) {
        throw error;
      }
      this.logger.error(`Failed to get transaction status for ${transactionId}`, error);
      throw new WalletServiceError(
        WalletServiceErrorType.TX_NOT_FOUND,
        `Failed to get transaction status: ${formatError(error)}`
      );
    }
  }
  
  /**
   * Get all transactions, optionally filtered by state
   * @param state Optional state to filter transactions by (INITIATED, SENT, COMPLETED, FAILED)
   * @returns Array of transaction records matching the specified state or all transactions if no state provided
   * @throws WalletServiceError if wallet is not ready
   */
  public getTransactions(): TransactionRecord[] {
    if (!this.isReady()) {
      throw new WalletServiceError(WalletServiceErrorType.WALLET_NOT_READY, 'Wallet is not ready');
    }
    
    try {
      return this.wallet.getTransactions();
    } catch (error) {
      this.logger.error('Failed to get transactions', error);
      throw new WalletServiceError(
        WalletServiceErrorType.WALLET_NOT_READY,
        `Failed to get transactions: ${formatError(error)}`
      );
    }
  }
  
  /**
   * Get all pending transactions (INITIATED or SENT)
   * @returns Array of pending transaction records
   * @throws WalletServiceError if wallet is not ready
   */
  public getPendingTransactions(): TransactionRecord[] {
    if (!this.isReady()) {
      throw new WalletServiceError(WalletServiceErrorType.WALLET_NOT_READY, 'Wallet is not ready');
    }
    
    try {
      return this.wallet.getPendingTransactions();
    } catch (error) {
      this.logger.error('Failed to get pending transactions', error);
      throw new WalletServiceError(
        WalletServiceErrorType.WALLET_NOT_READY,
        `Failed to get pending transactions: ${formatError(error)}`
      );
    }
  }
  
  /**
   * Verify if a transaction with the specified identifier has been received by the wallet
   * 
   * @param identifier The transaction identifier to verify (not the transaction hash)
   * @returns Verification result with transaction existence and sync status
   * @throws WalletServiceError if wallet is not ready or verification fails
   */
  public confirmTransactionHasBeenReceived(identifier: string): TransactionVerificationResult {
    if (!this.isReady()) {
      throw new WalletServiceError(WalletServiceErrorType.WALLET_NOT_READY, 'Wallet is not ready');
    }
    
    try {
      return this.wallet.hasReceivedTransactionByIdentifier(identifier);
    } catch (error) {
      this.logger.error('Error verifying transaction by identifier', error);
      throw new WalletServiceError(
        WalletServiceErrorType.IDENTIFIER_VERIFICATION_FAILED, 
        `Failed to verify transaction with identifier: ${formatError(error)}`
      );
    }
  }
  
  /**
   * Get detailed wallet status including sync progress, readiness, and recovery state
   * @returns Detailed wallet status with sync information, address, and balances
   * @throws WalletServiceError if there's an issue retrieving wallet status
   */
  public getWalletStatus(): WalletStatus {
    try {
      return this.wallet.getWalletStatus();
    } catch (error) {
      this.logger.error('Error getting wallet status', error);
      throw new WalletServiceError(
        WalletServiceErrorType.WALLET_NOT_READY,
        `Failed to retrieve wallet status: ${formatError(error)}`
      );
    }
  }

  // Get the wallet config
  public getWalletConfig(): WalletConfig {
    return this.externalConfig;
  }
  
  /**
   * Close the Wallet Service and clean up resources
   */
  public async close(): Promise<void> {
    try {
      await this.wallet.close();
    } catch (error) {
      this.logger.error('Error closing Wallet Service:', error);
      // Don't rethrow the error, just log it
    }
  }

  /**
   * Register a user in the marketplace
   * @param userId The user ID to register
   * @param userData The user data to register
   * @returns Registration result
   */
  public async registerInMarketplace(userId: string, userData: any): Promise<any> {
    if (!this.isReady()) {
      throw new WalletServiceError(WalletServiceErrorType.WALLET_NOT_READY, 'Wallet is not ready');
    }
    
    try {
      return await this.wallet.registerInMarketplace(userId, userData);
    } catch (error) {
      this.logger.error('Error registering in marketplace', error);
      throw new WalletServiceError(WalletServiceErrorType.TX_SUBMISSION_FAILED, 'Failed to register in marketplace');
    }
  }

  /**
   * Verify a user in the marketplace
   * @param userId The user ID to verify
   * @param verificationData The verification data
   * @returns Verification result
   */
  public async verifyUserInMarketplace(userId: string, verificationData: any): Promise<any> {
    if (!this.isReady()) {
      throw new WalletServiceError(WalletServiceErrorType.WALLET_NOT_READY, 'Wallet is not ready');
    }
    
    try {
      return await this.wallet.verifyUserInMarketplace(userId, verificationData);
    } catch (error) {
      this.logger.error('Error verifying user in marketplace', error);
      throw new WalletServiceError(WalletServiceErrorType.IDENTIFIER_VERIFICATION_FAILED, 'Failed to verify user in marketplace');
    }
  }

  // ==================== TOKEN OPERATIONS ====================

  /**
   * Register a token with a human-readable name
   * @param name Human-readable token name
   * @param symbol Token symbol
   * @param contractAddress Contract address for the token
   * @param domainSeparator Domain separator for token type generation
   * @param description Optional description
   * @returns Token operation result
   */
  public registerToken(
    name: string, 
    symbol: string, 
    contractAddress: string,
    domainSeparator: string = 'custom_token',
    description?: string,
    decimals?: number
  ) {
    return this.wallet.registerToken(name, symbol, contractAddress, domainSeparator, description, decimals);
  }

  /**
   * Get token balance by name
   * @param tokenName Token name
   * @returns Token balance as string
   */
  public getTokenBalance(tokenName: string): string {
    return this.wallet.getTokenBalance(tokenName);
  }

  /**
   * Send tokens to another address
   * @param tokenName Token name
   * @param toAddress Recipient address
   * @param amount Amount to send
   * @returns Transaction result
   */
  public async sendToken(tokenName: string, toAddress: string, amount: string) {
    if (!this.isReady()) {
      throw new WalletServiceError(WalletServiceErrorType.WALLET_NOT_READY, 'Wallet is not ready');
    }
    
    try {
      return await this.wallet.sendToken(tokenName, toAddress, amount);
    } catch (error) {
      this.logger.error('Error sending token:', error);
      throw new WalletServiceError(WalletServiceErrorType.TX_SUBMISSION_FAILED, 'Failed to send token');
    }
  }

  /**
   * List all registered tokens with their balances
   * @returns Array of token balances
   */
  public listWalletTokens() {
    return this.wallet.listWalletTokens();
  }

  /**
   * Register multiple tokens in batch
   * @param tokenConfigs Array of token configurations
   * @returns Batch registration result
   */
  public registerTokensBatch(tokenConfigs: Array<{
    name: string;
    symbol: string;
    contractAddress: string;
    domainSeparator?: string;
    description?: string;
  }>) {
    return this.wallet.registerTokensBatch(tokenConfigs);
  }

  /**
   * Register tokens from environment variable string
   * @param envValue Environment variable value with token configurations
   * @returns Batch registration result
   */
  public registerTokensFromEnvString(envValue: string) {
    return this.wallet.registerTokensFromEnvString(envValue);
  }

  /**
   * Get token configuration template for environment variables
   * @returns Example configuration string
   */
  public getTokenEnvConfigTemplate(): string {
    return this.wallet.getTokenEnvConfigTemplate();
  }

  /**
   * Get token registry statistics
   * @returns Registry statistics
   */
  public getTokenRegistryStats() {
    return this.wallet.getTokenRegistryStats();
  }

  // ==================== DAO OPERATIONS ====================

  /**
   * Open a new election in the DAO voting contract
   * @param electionId Unique identifier for the election
   * @returns Transaction result
   */
  public async openDaoElection(electionId: string) {
    if (!this.isReady()) {
      throw new WalletServiceError(WalletServiceErrorType.WALLET_NOT_READY, 'Wallet is not ready');
    }
    
    try {
      return await this.wallet.openDaoElection(electionId);
    } catch (error) {
      this.logger.error('Error opening DAO election:', error);
      throw new WalletServiceError(WalletServiceErrorType.TX_SUBMISSION_FAILED, 'Failed to open DAO election');
    }
  }

  /**
   * Close the current election in the DAO voting contract
   * @returns Transaction result
   */
  public async closeDaoElection() {
    if (!this.isReady()) {
      throw new WalletServiceError(WalletServiceErrorType.WALLET_NOT_READY, 'Wallet is not ready');
    }
    
    try {
      return await this.wallet.closeDaoElection();
    } catch (error) {
      this.logger.error('Error closing DAO election:', error);
      throw new WalletServiceError(WalletServiceErrorType.TX_SUBMISSION_FAILED, 'Failed to close DAO election');
    }
  }

  /**
   * Cast a vote in the DAO election
   * @param voteType Type of vote (YES, NO, ABSENT)
   * @returns Transaction result
   */
  public async castDaoVote(voteType: string) {
    if (!this.isReady()) {
      throw new WalletServiceError(WalletServiceErrorType.WALLET_NOT_READY, 'Wallet is not ready');
    }
    
    try {
      return await this.wallet.castDaoVote(voteType);
    } catch (error) {
      this.logger.error('Error casting DAO vote:', error);
      throw new WalletServiceError(WalletServiceErrorType.TX_SUBMISSION_FAILED, 'Failed to cast DAO vote');
    }
  }

  /**
   * Fund the DAO treasury with tokens
   * @param amount Amount to fund the treasury
   * @returns Transaction result
   */
  public async fundDaoTreasury(amount: string) {
    if (!this.isReady()) {
      throw new WalletServiceError(WalletServiceErrorType.WALLET_NOT_READY, 'Wallet is not ready');
    }
    
    try {
      return await this.wallet.fundDaoTreasury(amount);
    } catch (error) {
      this.logger.error('Error funding DAO treasury:', error);
      throw new WalletServiceError(WalletServiceErrorType.TX_SUBMISSION_FAILED, 'Failed to fund DAO treasury');
    }
  }

  /**
   * Payout an approved proposal from the DAO treasury
   * @returns Transaction result
   */
  public async payoutDaoProposal() {
    if (!this.isReady()) {
      throw new WalletServiceError(WalletServiceErrorType.WALLET_NOT_READY, 'Wallet is not ready');
    }
    
    try {
      return await this.wallet.payoutDaoProposal();
    } catch (error) {
      this.logger.error('Error paying out DAO proposal:', error);
      throw new WalletServiceError(WalletServiceErrorType.TX_SUBMISSION_FAILED, 'Failed to payout DAO proposal');
    }
  }

  /**
   * Get the current status of the DAO election
   * @returns Election status
   */
  public async getDaoElectionStatus() {
    if (!this.isReady()) {
      throw new WalletServiceError(WalletServiceErrorType.WALLET_NOT_READY, 'Wallet is not ready');
    }
    
    try {
      return await this.wallet.getDaoElectionStatus();
    } catch (error) {
      this.logger.error('Error getting DAO election status:', error);
      throw new WalletServiceError(WalletServiceErrorType.WALLET_NOT_READY, 'Failed to get DAO election status');
    }
  }

  /**
   * Get the full state of the DAO voting contract
   * @returns DAO state
   */
  public async getDaoState() {
    if (!this.isReady()) {
      throw new WalletServiceError(WalletServiceErrorType.WALLET_NOT_READY, 'Wallet is not ready');
    }
    
    try {
      return await this.wallet.getDaoState();
    } catch (error) {
      this.logger.error('Error getting DAO state:', error);
      throw new WalletServiceError(WalletServiceErrorType.WALLET_NOT_READY, 'Failed to get DAO state');
    }
  }

  /**
   * Get DAO configuration template
   * @returns DAO configuration template
   */
  public getDaoConfigTemplate(): string {
    return this.wallet.getDaoConfigTemplate();
  }
}

// Export default instance
export default WalletServiceMCP;
