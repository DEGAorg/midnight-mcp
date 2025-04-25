# Midnight MCP Server

This module provides a secure MCP (Midnight Contact Point) server implementation for interacting with the Midnight blockchain through a wallet service.

## Structure

- `mcp/` - Core MCP server implementation
- `wallet/` - Wallet management implementation
- `server.ts` - Example server implementation

## Features

- Wallet initialization and management
- Blockchain syncing and status checks
- Secure transaction operations
- Error handling with specific error types
- Transaction status validation

## MCP API Methods

| Method | Description |
|--------|-------------|
| `isReady()` | Checks if the wallet is synced and ready |
| `getAddress()` | Returns the wallet's receiving address |
| `getBalance()` | Retrieves the available wallet balance |
| `sendFunds(destinationAddress, amount)` | Sends funds to another address |
| `validateTx(txHash)` | Validates the status of a transaction |

## Usage

### Installation

The project uses the dependencies listed in the root package.json.

### Running the Example Server

```bash
# Build the project
yarn build:mcp

# Run the server
yarn start:mcp

# For development with hot-reloading
yarn dev:mcp
```

### Code Example

```typescript
import { MCPServer } from './mcp/index.js';

// Create a new MCP server instance
const mcpServer = new MCPServer();

// Wait for the wallet to be ready
if (mcpServer.isReady()) {
  // Get wallet address
  const address = mcpServer.getAddress();
  console.log(`Wallet address: ${address}`);
  
  // Get wallet balance
  const balance = mcpServer.getBalance();
  console.log(`Wallet balance: ${balance}`);
  
  // Send funds
  try {
    const { txHash } = mcpServer.sendFunds('destination_address', 100);
    console.log(`Transaction submitted: ${txHash}`);
    
    // Check transaction status
    const status = mcpServer.validateTx(txHash);
    console.log(`Transaction status: ${status.status}`);
  } catch (error) {
    console.error('Transaction error:', error);
  }
}
```

## Error Handling

The MCP API uses specific error types to provide clear error messages:

- `WALLET_NOT_READY` - The wallet is not ready for operations
- `INSUFFICIENT_FUNDS` - Not enough funds for the requested transaction
- `TX_SUBMISSION_FAILED` - Failed to submit the transaction
- `TX_NOT_FOUND` - The requested transaction was not found

## Development

To extend this implementation:

1. Add new methods to the `MCPServer` class in `src/mcp/index.ts`
2. Update the wallet integration in `src/wallet/index.ts` as needed
3. Run tests to ensure everything works correctly

## ES Module Compatibility

This project is configured as an ES module project (`"type": "module"` in package.json) for compatibility with the counter-cli project. Key compatibility features:

- Uses `.js` extensions in import statements
- Configured with `moduleResolution: "node"` 
- Uses `--experimental-specifier-resolution=node` for Node.js compatibility
- Compatible TypeScript settings with counter-cli

When incorporating wallet logic from counter-cli, be sure to maintain the ES module patterns.

## Security Considerations

- The MCP server never exposes private keys
- All operations check wallet readiness before execution
- Error messages are specific but don't reveal sensitive information 