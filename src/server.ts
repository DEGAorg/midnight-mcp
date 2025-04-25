import { MCPServer, MCPErrorType, MCPError } from './mcp/index.js';

/**
 * Example implementation showing how to use the MCPServer
 */
async function main() {
  // Create an instance of the MCP server
  const mcpServer = new MCPServer();
  
  console.log('MCP Server initialized, waiting for wallet to be ready...');
  
  // Check if wallet is ready every second
  const readyCheck = setInterval(() => {
    if (mcpServer.isReady()) {
      clearInterval(readyCheck);
      runExampleOperations(mcpServer);
    } else {
      console.log('Wallet not ready yet, waiting...');
    }
  }, 1000);
}

/**
 * Run example operations on the MCP server
 */
async function runExampleOperations(mcp: MCPServer) {
  console.log('Wallet is ready!');
  
  try {
    // Get wallet address
    const address = mcp.getAddress();
    console.log(`Wallet address: ${address}`);
    
    // Get wallet balance
    const balance = mcp.getBalance();
    console.log(`Wallet balance: ${balance}`);
    
    // Send funds
    const destinationAddress = 'midnight_destination_address_example';
    const amountToSend = 100;
    
    // Only send if we have enough funds
    if (balance >= amountToSend) {
      console.log(`Sending ${amountToSend} to ${destinationAddress}...`);
      const { txHash } = mcp.sendFunds(destinationAddress, amountToSend);
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