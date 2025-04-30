# Using with Model Context Protocol

### MCP Server Configuration

To configure an MCP client to use this server, use the following configuration as an example:

```json
{
  "servers": {
    "midnight-wallet": {
      "type": "http",
      "name": "Midnight Blockchain Wallet",
      "url": "http://localhost:3000/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```

Replace `YOUR_API_KEY` with the API key configured in your `.env` file if authentication is enabled.

### Available MCP Tools

The Midnight MCP Server provides the following tools through the MCP interface:

- **walletStatus**: Get the current status of the wallet
- **walletAddress**: Get the wallet address
- **walletBalance**: Get the current balance of the wallet
- **sendFunds**: Send funds to another wallet address
  - Parameters:
    - `destinationAddress`: Recipient's wallet address
    - `amount`: Amount to send
- **verifyTransaction**: Verify if a transaction has been received
  - Parameters:
    - `identifier`: Transaction identifier
- **getTransactionStatus**: Get the status of a transaction by ID
  - Parameters:
    - `transactionId`: ID of the transaction to check
- **getTransactions**: Get all transactions, optionally filtered by state
  - Parameters:
    - `state` (optional): Filter transactions by state
- **getPendingTransactions**: Get all pending transactions (INITIATED or SENT)

### Example MCP Request

```json
{
  "jsonrpc": "2.0",
  "method": "mcp.walletBalance",
  "id": 1
}
```

Response:
```json
{
  "jsonrpc": "2.0",
  "result": {
    "balance": "1000.0000",
    "pendingBalance": "0.0000"
  },
  "id": 1
}
```

### Streaming Support

The server supports HTTP streaming, allowing real-time interaction with the blockchain. This is particularly useful for monitoring transaction status or receiving updates about the wallet.
