# Midnight Wallet MCP API Documentation

This document defines the API methods exposed by the **Midnight Wallet MCP** module for integration with Eliza AI agents.

The Wallet MCP is responsible for securely managing private keys, maintaining wallet sync state, and providing an interface for Eliza to perform blockchain operations.

---

## General Behavior
- The Wallet Service **initializes at startup**, loading or creating a wallet from local storage.
- Wallet **must fully sync** with the Midnight blockchain before operations can succeed.
- **Most MCP calls do not block**; if the wallet is not ready, an error response is immediately returned.
- Transactions follow a state lifecycle: INITIATED → SENT → COMPLETED (or FAILED).

---

## API Methods

### `isReady()`
**Purpose:**
- Checks if the wallet is fully synced and ready to process operations.

**Returns:**
- `true` if wallet is ready.
- `false` if wallet is still syncing.

**Error Handling:**
- None. Always returns a boolean.

---

### `getAddress()`
**Purpose:**
- Returns the wallet's receiving address.

**Returns:**
- String: Base address of the wallet.

**Error Handling:**
- If wallet has issues: returns error `WALLET_NOT_READY`.

---

### `getBalance()`
**Purpose:**
- Retrieves the wallet's available balance.

**Returns:**
- WalletBalances object containing:
  - `balance`: Available spendable funds (as a string)
  - `pendingBalance`: Funds that are not yet available for spending (as a string)

**Error Handling:**
- If wallet is not ready: returns error `WALLET_NOT_READY`.

---

### `sendFunds(destinationAddress: string, amount: string)`
**Purpose:**
- Initiates a non-blocking transaction to send funds to a destination address.

**Parameters:**
- `destinationAddress`: Address to send funds to.
- `amount`: Amount to transfer (as a string).

**Returns:**
- InitiateTransactionResult object containing:
  - `id`: UUID for the transaction record
  - `state`: Current state (INITIATED)
  - `toAddress`: Recipient address
  - `amount`: Amount to be sent
  - `createdAt`: Timestamp of creation

**Error Handling:**
- If wallet is not ready: returns error `WALLET_NOT_READY`.
- If transaction initialization fails: returns error `TX_SUBMISSION_FAILED`.

---

### `sendFundsAndWait(destinationAddress: string, amount: string)`
**Purpose:**
- Sends funds and waits for the transaction to be fully processed (blocking).

**Parameters:**
- `destinationAddress`: Address to send funds to.
- `amount`: Amount to transfer (as a string).

**Returns:**
- SendFundsResult object containing:
  - `txIdentifier`: Transaction identifier
  - `syncStatus`: Current sync status information
  - `amount`: Amount sent

**Error Handling:**
- If wallet is not ready: returns error `WALLET_NOT_READY`.
- If insufficient balance: returns error `INSUFFICIENT_FUNDS`.
- If transaction submission fails: returns error `TX_SUBMISSION_FAILED`.

**Note:**
- This method is deprecated in favor of the non-blocking `sendFunds` method.

---

### `getTransactionStatus(transactionId: string)`
**Purpose:**
- Gets the current status of a transaction by its ID.

**Parameters:**
- `transactionId`: ID of the transaction to check.

**Returns:**
- TransactionStatusResult object containing:
  - `transaction`: The transaction record
  - `blockchainStatus`: Current blockchain status of the transaction if available

**Error Handling:**
- If wallet is not ready: returns error `WALLET_NOT_READY`.
- If transaction not found: returns error `TX_NOT_FOUND`.

---

### `getTransactions(state?: TransactionState)`
**Purpose:**
- Gets all transactions, optionally filtered by state.

**Parameters:**
- `state`: Optional filter for transaction state (INITIATED, SENT, COMPLETED, FAILED).

**Returns:**
- Array of TransactionRecord objects matching the specified state (or all if no state specified).

**Error Handling:**
- If wallet is not ready: returns error `WALLET_NOT_READY`.

---

### `getPendingTransactions()`
**Purpose:**
- Gets all pending transactions (those in INITIATED or SENT state).

**Returns:**
- Array of TransactionRecord objects that are in a pending state.

**Error Handling:**
- If wallet is not ready: returns error `WALLET_NOT_READY`.

---

### `confirmTransactionHasBeenReceived(identifier: string)`
**Purpose:**
- Verifies if a transaction with the specified identifier has been received by the wallet.

**Parameters:**
- `identifier`: The transaction identifier to verify.

**Returns:**
- TransactionVerificationResult object containing:
  - `exists`: Whether the transaction exists
  - `syncStatus`: Current sync status information

**Error Handling:**
- If wallet is not ready: returns error `WALLET_NOT_READY`.
- If verification fails: returns error `IDENTIFIER_VERIFICATION_FAILED`.

---

### `getWalletStatus()`
**Purpose:**
- Gets detailed wallet status including sync progress, readiness, and recovery state.

**Returns:**
- WalletStatus object containing:
  - `ready`: Whether the wallet is ready for operations
  - `syncing`: Whether the wallet is currently syncing
  - `syncProgress`: Sync progress information
  - `address`: The wallet's address
  - `balances`: Current wallet balances
  - `recovering`: Whether the wallet is in recovery mode
  - `recoveryAttempts`: Number of recovery attempts
  - `maxRecoveryAttempts`: Maximum number of recovery attempts
  - `isFullySynced`: Whether the wallet is fully synced

**Error Handling:**
- If issues retrieving status: returns error `WALLET_NOT_READY`.

---

## Notes
- **Seed management is internal**: no external createWallet, exportSeed, or modifySeed operations are allowed.
- **State persistence**: Wallet state (seed, address, UTXOs) is saved locally to survive restarts.
- **Non-blocking design**: Most operations return immediately, transaction states can be tracked separately.

---

## Error Types
- `WALLET_NOT_READY`: Wallet is not initialized or synced yet.
- `INSUFFICIENT_FUNDS`: Not enough funds for the requested transaction.
- `TX_SUBMISSION_FAILED`: Failed to submit the transaction to the network.
- `TX_NOT_FOUND`: The requested transaction ID was not found.
- `IDENTIFIER_VERIFICATION_FAILED`: Failed to verify transaction by identifier.

---

## Future Extensions
- Disclosed transactions via smart contracts.
- Proof of origin metadata.
- Multi-address management (advanced scenarios).

---

# End of Document

