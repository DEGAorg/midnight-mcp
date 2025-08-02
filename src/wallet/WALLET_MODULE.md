# Midnight MCP Wallet

The Midnight MCP Wallet module provides a secure interface to interact with the Midnight blockchain. It handles wallet creation, recovery, transaction management, and state synchronization with the blockchain.

## Transaction Tracking

One of the key features of the Midnight MCP Wallet is asynchronous transaction tracking, which allows you to:

1. Initiate transactions without blocking the main application flow
2. Track the status of transactions through their lifecycle
3. Query for pending and completed transactions
4. Verify transaction inclusion in the blockchain

### Transaction States

Transactions go through several states during their lifecycle:

- `INITIATED`: Transaction has been created but not yet broadcast to the network
- `SENT`: Transaction has been broadcast with a transaction identifier
- `COMPLETED`: Transaction has been confirmed and appears in transaction history
- `FAILED`: Transaction failed for some reason (with an error message)

### How to Use Transaction Tracking

#### Initiating a Transaction

Instead of using `sendFunds()` which blocks until the transaction is broadcast, use `initiateSendFunds()` to start a transaction asynchronously:

```typescript
const result = await walletManager.initiateSendFunds('recipient_address', '10.5');
console.log(`Transaction initiated with ID: ${result.id}`);
```

The `initiateSendFunds` method returns immediately with a transaction ID, while the transaction processing continues asynchronously.

#### Checking Transaction Status

You can check the status of a transaction using its ID:

```typescript
const status = walletManager.getTransactionStatus(transactionId);

if (status) {
  console.log(`Transaction state: ${status.transaction.state}`);
  
  // If transaction is SENT and has blockchain status
  if (status.transaction.state === TransactionState.SENT && status.blockchainStatus) {
    console.log(`Transaction found on blockchain: ${status.blockchainStatus.exists}`);
  }
}
```

#### Getting Pending Transactions

You can get all pending transactions (in INITIATED or SENT state):

```typescript
const pendingTransactions = walletManager.getPendingTransactions();
```

#### Getting All Transactions

You can get all transactions, optionally filtered by state:

```typescript
// Get all transactions
const allTransactions = walletManager.getTransactions();

// Get only completed transactions
const completedTransactions = walletManager.getTransactions(TransactionState.COMPLETED);
```

### Example

See the `examples/transaction-tracking.ts` file for a complete example of how to use transaction tracking.

### API Reference

#### Transaction Methods

- `initiateSendFunds(to: string, amount: string): Promise<InitiateTransactionResult>`
  
  Initiates a transaction without waiting for completion. Returns transaction ID and initial state.

- `getTransactionStatus(id: string): TransactionStatusResult | null`
  
  Gets the status of a transaction, including blockchain verification if available.

- `getTransactions(state?: TransactionState): TransactionRecord[]`
  
  Gets all transactions, optionally filtered by state.

- `getPendingTransactions(): TransactionRecord[]`
  
  Gets all pending transactions (in INITIATED or SENT state).

- The original `sendFunds` method is still available for backward compatibility and for cases where you want to wait for the transaction to be broadcast before continuing.

## Wallet Management

The wallet module also provides functions for wallet creation, recovery, and state management:

- Automatic recovery from connection issues
- Persistent wallet state storage
- Balance tracking
- Proof generation for transaction privacy
- Integration with Midnight blockchain services

For more details on wallet management, see the main documentation. 