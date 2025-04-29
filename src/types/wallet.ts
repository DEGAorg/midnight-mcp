/**
 * Shared wallet types used across wallet and MCP modules
 */

/**
 * Wallet balance types breakdown with values represented as dust strings
 */
export interface WalletBalances {
  // The total spendable balance in the wallet
  balance: string;
  // Coins that are pending and not yet available for spending
  pendingBalance: string;
}

/**
 * Wallet sync progress information
 */
export interface WalletSyncProgress {
  synced: string;
  total: string;
  percentage: number;
}

/**
 * Comprehensive wallet status information
 */
export interface WalletStatus {
  ready: boolean;
  syncing: boolean;
  syncProgress: WalletSyncProgress;
  address: string;
  balances: WalletBalances;
  recovering: boolean;
  recoveryAttempts: number;
  maxRecoveryAttempts: number;
  isFullySynced: boolean;
}

/**
 * Transaction verification result
 */
export interface TransactionVerificationResult {
  exists: boolean;
  syncStatus: {
    syncedIndices: bigint;
    totalIndices: bigint;
    isFullySynced: boolean;
  }
}

/**
 * Send funds operation result
 */
export interface SendFundsResult {
  txIdentifier: string;
  syncStatus: {
    syncedIndices: bigint;
    totalIndices: bigint;
    isFullySynced: boolean;
  }
  amount: string; // Amount sent in dust format
}

/**
 * Transaction state enum representing the lifecycle of a transaction
 */
export enum TransactionState {
  INITIATED = 'initiated',  // Transaction has been initiated but not yet broadcast
  SENT = 'sent',            // Transaction has been broadcast with txIdentifier
  COMPLETED = 'completed',  // Transaction appears in transaction history
  FAILED = 'failed'         // Transaction failed for some reason
}

/**
 * Transaction record for storing in the database
 */
export interface TransactionRecord {
  id: string;                    // UUID for the transaction
  state: TransactionState;       // Current state of the transaction
  fromAddress: string;           // Sender address
  toAddress: string;             // Recipient address
  amount: string;                // Amount in dust format
  txIdentifier?: string;         // Transaction identifier (once available)
  createdAt: number;             // Timestamp of creation
  updatedAt: number;             // Timestamp of last update
  errorMessage?: string;         // Error message if transaction failed
}

/**
 * Result when initiating a transaction
 */
export interface InitiateTransactionResult {
  id: string;                    // UUID for the transaction record
  state: TransactionState;       // Current state (should be INITIATED)
  toAddress: string;             // Recipient address
  amount: string;                // Amount in dust format
  createdAt: number;             // Timestamp of creation
}

/**
 * Result when checking transaction status
 */
export interface TransactionStatusResult {
  transaction: TransactionRecord;
  blockchainStatus?: {
    exists: boolean;
    syncStatus: {
      syncedIndices: bigint;
      totalIndices: bigint;
      isFullySynced: boolean;
    }
  }
} 