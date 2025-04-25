# Midnight Wallet MCP API Documentation

This document defines the API methods exposed by the **Midnight Wallet MCP** module for integration with Eliza AI agents.

The Wallet MCP is responsible for securely managing private keys, maintaining wallet sync state, and providing an interface for Eliza to perform blockchain operations.

---

## General Behavior
- The Wallet Service **initializes at startup**, loading or creating a wallet from local storage.
- Wallet **must fully sync** with the Midnight blockchain before operations can succeed.
- **MCP calls do not block**; if the wallet is not ready, an error response is immediately returned.

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
- If wallet is not ready: returns error `WALLET_NOT_READY`.

---

### `getBalance()`
**Purpose:**
- Retrieves the wallet's available balance.

**Returns:**
- Numeric value representing available funds.

**Error Handling:**
- If wallet is not ready: returns error `WALLET_NOT_READY`.

---

### `sendFunds(destinationAddress: string, amount: number)`
**Purpose:**
- Sends specified amount to a given destination address.

**Parameters:**
- `destinationAddress`: Address to send funds to.
- `amount`: Amount to transfer.

**Returns:**
- `txHash`: Hash of the submitted transaction.

**Error Handling:**
- If wallet is not ready: returns error `WALLET_NOT_READY`.
- If insufficient balance: returns error `INSUFFICIENT_FUNDS`.
- If transaction submission fails: returns error `TX_SUBMISSION_FAILED`.

---

### `validateTx(txHash: string)`
**Purpose:**
- Validates the status of a previously submitted transaction.

**Parameters:**
- `txHash`: Hash of the transaction to validate.

**Returns:**
- Status object (e.g., `pending`, `confirmed`, `failed`).

**Error Handling:**
- If wallet is not ready: returns error `WALLET_NOT_READY`.
- If transaction not found: returns error `TX_NOT_FOUND`.

---

## Notes
- **Seed management is internal**: no external createWallet, exportSeed, or modifySeed operations are allowed.
- **State persistence**: Wallet state (seed, address, UTXOs) is saved locally to survive restarts.

---

## Future Extensions
- Disclosed transactions via smart contracts.
- Proof of origin metadata.
- Multi-address management (advanced scenarios).

---

# End of Document

