/**
 * Wallet Service Types
 *
 * Type definitions for wallet service operations
 */

import type {
  WalletStatus,
  WalletBalances,
  SendFundsResult,
  InitiateTransactionResult,
  TransactionStatusResult,
  TransactionRecord,
  TransactionVerificationResult,
} from '@shared/wallet.js';

// Re-export wallet types for convenience
export type {
  WalletStatus,
  WalletBalances,
  SendFundsResult,
  InitiateTransactionResult,
  TransactionStatusResult,
  TransactionRecord,
  TransactionVerificationResult,
};

// Service-specific types
export interface SendFundsParams {
  to: string;
  amount: string;
  token?: string;
}

export interface TransactionQuery {
  status?: string;
  limit?: number;
  offset?: number;
}

export interface WalletInfo {
  address: string;
  balance: WalletBalances;
  status: WalletStatus;
  isReady: boolean;
}
