/**
 * Wallet Service Error Types
 *
 * Custom error classes for wallet operations
 */

export enum WalletServiceErrorType {
  WALLET_NOT_READY = 'WALLET_NOT_READY',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  TX_SUBMISSION_FAILED = 'TX_SUBMISSION_FAILED',
  TX_NOT_FOUND = 'TX_NOT_FOUND',
  IDENTIFIER_VERIFICATION_FAILED = 'IDENTIFIER_VERIFICATION_FAILED',
  INVALID_ADDRESS = 'INVALID_ADDRESS',
  INVALID_AMOUNT = 'INVALID_AMOUNT',
}

export const ERROR_MESSAGES = {
  [WalletServiceErrorType.WALLET_NOT_READY]: 'Wallet is not ready yet. Please try again later.',
  [WalletServiceErrorType.INSUFFICIENT_FUNDS]: 'Insufficient funds for this transaction.',
  [WalletServiceErrorType.TX_SUBMISSION_FAILED]: 'Transaction submission failed.',
  [WalletServiceErrorType.TX_NOT_FOUND]: 'Transaction not found.',
  [WalletServiceErrorType.IDENTIFIER_VERIFICATION_FAILED]: 'Transaction verification failed.',
  [WalletServiceErrorType.INVALID_ADDRESS]: 'Invalid wallet address provided.',
  [WalletServiceErrorType.INVALID_AMOUNT]: 'Invalid amount provided.',
};

export class WalletServiceError extends Error {
  constructor(
    public readonly type: WalletServiceErrorType,
    message?: string,
    public readonly cause?: unknown
  ) {
    super(message || ERROR_MESSAGES[type]);
    this.name = 'WalletServiceError';
  }
}

export class SendFundsError extends WalletServiceError {
  constructor(message: string, cause?: unknown) {
    super(WalletServiceErrorType.TX_SUBMISSION_FAILED, message, cause);
    this.name = 'SendFundsError';
  }
}

export class TransactionNotFoundError extends WalletServiceError {
  constructor(transactionId: string) {
    super(WalletServiceErrorType.TX_NOT_FOUND, `Transaction ${transactionId} not found`);
    this.name = 'TransactionNotFoundError';
  }
}

export class WalletNotReadyError extends WalletServiceError {
  constructor() {
    super(WalletServiceErrorType.WALLET_NOT_READY);
    this.name = 'WalletNotReadyError';
  }
}
