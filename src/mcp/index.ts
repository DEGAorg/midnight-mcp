import { WalletManager, WalletConfig } from '../wallet/index.js';
import { setNetworkId, NetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { createLogger } from '../logger/index.js';
import type { Logger } from 'pino';

/**
 * Error types for the MCP API
 */
export enum MCPErrorType {
  WALLET_NOT_READY = 'WALLET_NOT_READY',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  TX_SUBMISSION_FAILED = 'TX_SUBMISSION_FAILED',
  TX_NOT_FOUND = 'TX_NOT_FOUND',
  IDENTIFIER_VERIFICATION_FAILED = 'IDENTIFIER_VERIFICATION_FAILED',
}

/**
 * Error class for MCP errors
 */
export class MCPError extends Error {
  constructor(public type: MCPErrorType, message: string) {
    super(message);
    this.name = 'MCPError';
  }
}

/**
 * Result interface for send funds operation
 */
interface SendFundsResult {
  txHash: string;
  syncedIndices: bigint;
  totalIndices: bigint;
  isFullySynced: boolean;
  amountBigInt: bigint;
}

/**
 * MCP Server that provides a secure interface to interact with the Midnight blockchain
 * through the wallet implementation
 */
export class MCPServer {
  private wallet: WalletManager;
  private logger: Logger;
  
  /**
   * Create a new MCP Server instance
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
    
    this.logger = createLogger('mcp-server');
    
    this.logger.info('Initializing Midnight MCP Server');
    
    // Initialize WalletManager with network ID, seed, filename, and optional external config
    this.wallet = new WalletManager(networkId, seed, walletFilename, externalConfig);
    
    this.logger.info('MCP Server initialized, wallet synchronization started in background');
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
   * @throws MCPError if wallet is not ready
   */
  public getAddress(): string {
    try {
      return this.wallet.getAddress();
    } catch (error) {
      this.logger.error('Error getting wallet address', error);
      throw new MCPError(MCPErrorType.WALLET_NOT_READY, 'Error accessing wallet address');
    }
  }
  
  /**
   * Get the wallet's current balance
   * @returns The wallet balance as a number
   * @throws MCPError if wallet is not ready
   */
  public getBalance(): bigint {
    if (!this.isReady()) {
      throw new MCPError(MCPErrorType.WALLET_NOT_READY, 'Wallet is not ready');
    }
    
    try {
      return this.wallet.getBalance();
    } catch (error) {
      this.logger.error('Error getting wallet balance', error);
      throw new MCPError(MCPErrorType.WALLET_NOT_READY, 'Error accessing wallet balance');
    }
  }
  
  /**
   * Send funds to the specified destination address
   * @param destinationAddress Address to send the funds to
   * @param amount Amount of funds to send as a string (decimal value)
   * @returns Transaction hash and sync status
   * @throws MCPError if wallet is not ready, has insufficient funds, or transaction fails
   */
  public async sendFunds(destinationAddress: string, amount: string): Promise<{ 
    txHash: string;
    syncStatus: {
      syncedIndices: bigint;
      totalIndices: bigint;
      isFullySynced: boolean;
    }
  }> {
    if (!this.isReady()) {
      throw new MCPError(MCPErrorType.WALLET_NOT_READY, 'Wallet is not ready');
    }
    
    try {
      const result = await this.wallet.sendFunds(destinationAddress, amount);
      
      return { 
        txHash: result.txHash,
        syncStatus: {
          syncedIndices: result.syncedIndices,
          totalIndices: result.totalIndices,
          isFullySynced: result.isFullySynced
        }
      };
    } catch (error) {
      this.logger.error('Failed to send funds', error);
      throw new MCPError(MCPErrorType.TX_SUBMISSION_FAILED, 'Failed to submit transaction');
    }
  }
  
  /**
   * Verify if a transaction with the specified identifier has been received by the wallet
   * 
   * @param identifier The transaction identifier to verify (not the transaction hash)
   * @returns Verification result with transaction existence and sync status
   * @throws MCPError if wallet is not ready or verification fails
   */
  public confirmTransactionHasBeenReceived(identifier: string): { 
    exists: boolean;
    syncStatus: {
      syncedIndices: bigint;
      totalIndices: bigint;
      isFullySynced: boolean;
    }
  } {
    if (!this.isReady()) {
      throw new MCPError(MCPErrorType.WALLET_NOT_READY, 'Wallet is not ready');
    }
    
    try {
      const result = this.wallet.hasReceivedTransactionByIdentifier(identifier);
      
      return {
        exists: result.exists,
        syncStatus: {
          syncedIndices: result.syncedIndices,
          totalIndices: result.totalIndices,
          isFullySynced: result.isFullySynced
        }
      };
    } catch (error) {
      this.logger.error('Error verifying transaction by identifier', error);
      throw new MCPError(
        MCPErrorType.IDENTIFIER_VERIFICATION_FAILED, 
        `Failed to verify transaction with identifier: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  
  /**
   * Close the MCP server and associated resources
   */
  public async close(): Promise<void> {
    try {
      await this.wallet.close();
      this.logger.info('MCP Server shut down successfully');
    } catch (error) {
      this.logger.error('Error shutting down MCP Server', error);
    }
  }
}

// Export default instance
export default MCPServer;
