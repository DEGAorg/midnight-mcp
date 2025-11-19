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
  synced: boolean; // true if fully synced (applyGap and sourceGap are zero)
  lag: {
    applyGap: string;
    sourceGap: string;
  };
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
    syncedIndices: string;
    lag: {
      applyGap: string;
      sourceGap: string;
    };
    isFullySynced: boolean;
  },
  transactionAmount: string;
}

/**
 * Send funds operation result
 */
export interface SendFundsResult {
  txIdentifier: string;
  syncStatus: {
    syncedIndices: string;
    lag: {
      applyGap: string;
      sourceGap: string;
    };
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
      syncedIndices: string;
      lag: {
        applyGap: string;
        sourceGap: string;
      };
      isFullySynced: boolean;
    }
  }
} 

export type MarketplaceUserData = {
  marketplaceAddress: string;
  pubkey: string;
}

export type RegistrationResult = {
  success: boolean;
  userId: string;
  userData: MarketplaceUserData;
  transactionId: string;
}

export type VerificationResult = {
  valid: boolean;
  userId: string;
  userData: MarketplaceUserData;
  reason: string;
}

/**
 * Token information structure
 */
export interface TokenInfo {
  name: string;           // Human-readable name (e.g., "DAO_VOTING", "FUNDING")
  symbol: string;         // Short symbol (e.g., "DVT", "FUND")
  contractAddress: string; // Contract address for operations
  domainSeparator: string; // Domain separator for token type generation (e.g., "dega_dao_vote")
  tokenTypeHex?: string;  // Generated token type (computed from domain + contract)
  description?: string;   // Optional description
  decimals?: number;      // Number of decimal places (default: 6)
}

/**
 * Token balance information
 */
export interface TokenBalance {
  tokenName: string;
  symbol: string;
  balance: string;
  contractAddress: string;
  description?: string;
  decimals?: number;
}

/**
 * Token operation result
 */
export interface TokenOperationResult {
  success: boolean;
  tokenName: string;
  amount?: string;
  transactionId?: string;
  error?: string;
}

/**
 * Coin information for transactions
 */
export interface CoinInfo {
  nonce: Uint8Array;
  color: Uint8Array;
  value: bigint;
}