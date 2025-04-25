import { MCPServer, MCPErrorType, MCPError } from './mcp/index.js';
import { NetworkId } from '@midnight-ntwrk/midnight-js-network-id';

/**
 * Example implementation showing how to use the MCPServer
 */
async function main() {
  // Define wallet configuration
  const networkId = NetworkId.TestNet;
  // This seed is just for testing - in production a secure seed would be generated or loaded
  const seedHex = '6206f1dea1553e6551755ba9341e366c94e9d1dbe5d705e9af4a05d3cb322a3b';
  const walletFilename = 'midnight-wallet';
  
  try {
    // Create an instance of the MCP server
    // This will start the Docker environment and begin wallet sync in the background
    const mcpServer = new MCPServer(networkId, seedHex, walletFilename);
    
    console.log('MCP Server initialized, wallet synchronization started in background');
    console.log('Server is ready to handle API requests, but wallet operations will return "not ready" until sync completes');
    
    // Setup graceful shutdown
    process.on('SIGINT', async () => {
      console.log('Shutting down MCP Server...');
      await mcpServer.close();
      process.exit(0);
    });
    
    // Check if wallet is ready every second
    const readyCheck = setInterval(() => {
      if (mcpServer.isReady()) {
        console.log('Wallet is now fully synced and ready for operations!');
        clearInterval(readyCheck);
        runExampleOperations(mcpServer);
      } else {
        console.log('Wallet syncing in progress, MCP server is responsive but wallet not fully ready yet...');
      }
    }, 5000);
  } catch (error) {
    console.error('Error initializing MCP Server:', error);
    process.exit(1);
  }
}

/**
 * Run example operations on the MCP server
 */
async function runExampleOperations(mcp: MCPServer) {
  console.log('Wallet is ready! Running example operations:');
  
  try {
    // Get wallet address
    const address = mcp.getAddress();
    console.log(`Wallet address: ${address}`);
    
    // Get wallet balance
    const balance = mcp.getBalance();
    console.log(`Wallet balance: ${balance}`);
    
    // Example transaction (only if balance is sufficient)
    const destinationAddress = 'midnight_destination_address_example';
    const amountToSend = 10n; // Using BigInt for amounts
    
    // Only send if we have enough funds
    if (balance >= amountToSend) {
      console.log(`Sending ${amountToSend} tokens to ${destinationAddress}...`);
      
      try {
        // Send funds (async method)
        const { txHash } = await mcp.sendFunds(destinationAddress, amountToSend);
        console.log(`Transaction submitted with hash: ${txHash}`);
        
        // Check transaction status after a delay
        setTimeout(() => {
          try {
            const txStatus = mcp.validateTx(txHash);
            console.log(`Transaction status: ${txStatus.status}`);
          } catch (error) {
            if (error instanceof MCPError && error.type === MCPErrorType.TX_NOT_FOUND) {
              console.error('Transaction not found');
            } else {
              console.error('Error checking transaction status:', error);
            }
          }
        }, 6000);
      } catch (error) {
        console.error('Error sending funds:', error);
      }
    } else {
      console.log(`Insufficient funds: needed ${amountToSend}, have ${balance}`);
    }
  } catch (error) {
    if (error instanceof MCPError) {
      console.error(`MCP Error (${error.type}): ${error.message}`);
    } else {
      console.error('Unknown error:', error);
    }
  }
}

// Run the example
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
}); 