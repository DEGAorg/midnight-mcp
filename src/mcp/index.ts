import { WalletManager } from '../wallet/index.js';
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

export type TransactionStatus = 'pending' | 'confirmed' | 'failed';

/**
 * MCP Server that provides a secure interface to interact with the Midnight blockchain
 * through the wallet implementation
 */
export class MCPServer {
  private wallet: WalletManager;
  private logger: Logger;
  private transactions: Map<string, { status: TransactionStatus; to: string; amount: bigint }>;
  
  /**
   * Create a new MCP Server instance
   * @param networkId The Midnight network ID to connect to
   * @param seed The seed for the wallet
   * @param walletFilename filename to restore wallet from
   */
  constructor(networkId: NetworkId, seed: string, walletFilename: string) {
    // Set network ID if provided
    if (networkId) {
      setNetworkId(networkId);
    }
    
    this.logger = createLogger('mcp-server');
    
    this.logger.info('Initializing Midnight MCP Server');
    
    // Initialize WalletManager with network ID, seed, and filename
    this.wallet = new WalletManager(networkId, seed, walletFilename);
    this.transactions = new Map();
    
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
    if (!this.isReady()) {
      throw new MCPError(MCPErrorType.WALLET_NOT_READY, 'Wallet is not ready');
    }
    
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
   * @param amount Amount of funds to send
   * @returns Transaction hash
   * @throws MCPError if wallet is not ready, has insufficient funds, or transaction fails
   */
  public async sendFunds(destinationAddress: string, amount: bigint): Promise<{ txHash: string }> {
    if (!this.isReady()) {
      throw new MCPError(MCPErrorType.WALLET_NOT_READY, 'Wallet is not ready');
    }
    
    if (this.wallet.getBalance() < amount) {
      throw new MCPError(MCPErrorType.INSUFFICIENT_FUNDS, 'Insufficient funds for transaction');
    }
    
    try {
      const txHash = await this.wallet.sendFunds(destinationAddress, amount);
      
      // Store transaction for later validation
      this.transactions.set(txHash, {
        status: 'pending',
        to: destinationAddress,
        amount
      });
      
      // Simulate transaction confirmation after a delay
      setTimeout(() => {
        const tx = this.transactions.get(txHash);
        if (tx) {
          tx.status = 'confirmed';
          this.transactions.set(txHash, tx);
          this.logger.info(`Transaction ${txHash} confirmed`);
        }
      }, 5000);
      
      return { txHash };
    } catch (error) {
      this.logger.error('Failed to send funds', error);
      throw new MCPError(MCPErrorType.TX_SUBMISSION_FAILED, 'Failed to submit transaction');
    }
  }
  
  /**
   * Validate a transaction by its hash
   * @param txHash The transaction hash to validate
   * @returns Status object containing the transaction status
   * @throws MCPError if wallet is not ready or transaction is not found
   */
  public validateTx(txHash: string): { status: TransactionStatus } {
    if (!this.isReady()) {
      throw new MCPError(MCPErrorType.WALLET_NOT_READY, 'Wallet is not ready');
    }
    
    const transaction = this.transactions.get(txHash);
    if (!transaction) {
      throw new MCPError(MCPErrorType.TX_NOT_FOUND, `Transaction ${txHash} not found`);
    }
    
    return { status: transaction.status };
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
