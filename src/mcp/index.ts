import { WalletManager } from '../wallet/index.js';
import { setNetworkId, type NetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import * as pino from 'pino';

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
  private logger: pino.Logger;
  private transactions: Map<string, { status: TransactionStatus; to: string; amount: number }>;
  
  /**
   * Create a new MCP Server instance
   * @param networkId The Midnight network ID to connect to
   */
  constructor(networkId?: NetworkId) {
    // Set network ID if provided
    if (networkId) {
      setNetworkId(networkId);
    }
    
    this.logger = pino.pino({ 
      level: process.env.LOG_LEVEL || 'info',
      transport: {
        target: 'pino-pretty'
      }
    });
    
    this.logger.info('Initializing Midnight MCP Server');
    this.wallet = new WalletManager();
    this.transactions = new Map();
    
    this.logger.info('MCP Server initialized, waiting for wallet to be ready');
  }
  
  /**
   * Check if the wallet is ready for operations
   * @returns true if wallet is synced and ready
   */
  public isReady(): boolean {
    return this.wallet.isReady();
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
    
    return this.wallet.getAddress();
  }
  
  /**
   * Get the wallet's current balance
   * @returns The wallet balance as a number
   * @throws MCPError if wallet is not ready
   */
  public getBalance(): number {
    if (!this.isReady()) {
      throw new MCPError(MCPErrorType.WALLET_NOT_READY, 'Wallet is not ready');
    }
    
    return this.wallet.getBalance();
  }
  
  /**
   * Send funds to the specified destination address
   * @param destinationAddress Address to send the funds to
   * @param amount Amount of funds to send
   * @returns Transaction hash
   * @throws MCPError if wallet is not ready, has insufficient funds, or transaction fails
   */
  public sendFunds(destinationAddress: string, amount: number): { txHash: string } {
    if (!this.isReady()) {
      throw new MCPError(MCPErrorType.WALLET_NOT_READY, 'Wallet is not ready');
    }
    
    if (this.wallet.getBalance() < amount) {
      throw new MCPError(MCPErrorType.INSUFFICIENT_FUNDS, 'Insufficient funds for transaction');
    }
    
    try {
      const result = this.wallet.sendFunds(destinationAddress, amount);
      
      // Generate a mock transaction hash
      const txHash = `tx_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      
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
}

// Export default instance
export default MCPServer;
