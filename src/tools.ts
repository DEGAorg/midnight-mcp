import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { httpClient } from './utils/http-client.js';

// Define tools with their schemas
export const ALL_TOOLS = [
  // Midnight wallet tools
  {
    name: "walletStatus",
    description: "Get the current status of the wallet",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    },
  },
  {
    name: "walletAddress",
    description: "Get the wallet address",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    },
  },
  {
    name: "walletBalance",
    description: "Get the current balance of the wallet",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    },
  },
  {
    name: "sendFunds",
    description: "Send funds to another wallet address",
    inputSchema: {
      type: "object",
      properties: {
        destinationAddress: { type: "string" },
        amount: { type: "string" }
      },
      required: ["destinationAddress", "amount"]
    }
  },
  {
    name: "verifyTransaction",
    description: "Verify if a transaction has been received",
    inputSchema: {
      type: "object",
      properties: {
        identifier: { type: "string" }
      },
      required: ["identifier"]
    }
  },
  {
    name: "getTransactionStatus",
    description: "Get the status of a transaction by ID",
    inputSchema: {
      type: "object",
      properties: {
        transactionId: { type: "string" }
      },
      required: ["transactionId"]
    }
  },
  {
    name: "getTransactions",
    description: "Get all transactions, optionally filtered by state",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name:"getWalletConfig",
    description: "Get the configuration of the wallet NODE and Indexer",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    },
  }
];

// Define tool handlers
export async function handleToolCall(toolName: string, toolArgs: any, midnightServer: any, log: (...args: any[]) => void) {
  try {
    switch (toolName) {
      // Midnight wallet tool handlers
      case "walletStatus":
        const status = await httpClient.get('/wallet/status');
        return {
          "content": [
            {
              "type": "text",
              "text": JSON.stringify(status, null, 2),
              "mimeType": "application/json"
            }
          ]
        };
        
      case "walletAddress":
        const address = await httpClient.get('/wallet/address');
        return {
          "content": [
            {
              "type": "text",
              "text": address,
              "mimeType": "application/json"
            }
          ]
        };
        
      case "walletBalance":
        const balance = await httpClient.get('/wallet/balance');
        return {
          "content": [
            {
              "type": "text",
              "text": JSON.stringify(balance, null, 2),
              "mimeType": "application/json"
            }
          ]
        };
        
      case "sendFunds":
        const { destinationAddress, amount } = toolArgs;
        if (!destinationAddress || !amount) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "Missing required parameters: destinationAddress and amount"
          );
        }
        const sendResult = await httpClient.post('/wallet/send', { destinationAddress, amount });
        return {
          "content": [
            {
              "type": "text",
              "text": JSON.stringify(sendResult, null, 2),
              "mimeType": "application/json"
            }
          ]
        };
        
      case "verifyTransaction":
        const { identifier } = toolArgs;
        if (!identifier) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "Missing required parameter: identifier"
          );
        }
        const verifyResult = await httpClient.post('/wallet/verify-transaction', { identifier });
        return {
          "content": [
            {
              "type": "text",
              "text": JSON.stringify(verifyResult, null, 2),
              "mimeType": "application/json"
            }
          ]
        };
        
      case "getTransactionStatus":
        const { transactionId } = toolArgs;
        if (!transactionId) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "Missing required parameter: transactionId"
          );
        }
        const statusResult = await httpClient.get(`/wallet/transaction/${transactionId}`);
        return {
          "content": [
            {
              "type": "text",
              "text": JSON.stringify(statusResult, null, 2),
              "mimeType": "application/json"
            }
          ]
        };
        
      case "getTransactions":
        const transactions = await httpClient.get('/wallet/transactions');
        return {
          "content": [
            {
              "type": "text",
              "text": JSON.stringify(transactions, null, 2),
              "mimeType": "application/json"
            }
          ]
        };
        
      case "getPendingTransactions":
        const pendingTransactions = await httpClient.get('/wallet/pending-transactions');
        return {
          "content": [
            {
              "type": "text",
              "text": JSON.stringify(pendingTransactions, null, 2),
              "mimeType": "application/json"
            }
          ]
        };
      
      case "getWalletConfig":
        const config = await httpClient.get('/wallet/config');
        return {
          "content": [
            {
              "type": "text",
              "text": JSON.stringify(config, null, 2),
              "mimeType": "application/json"
            }
          ]
        };
      
      default:
        throw new McpError(
          ErrorCode.InvalidParams,
          `Unknown tool: ${toolName}`
        );
    }
  } catch (error) {
    log(`Error handling tool call for ${toolName}:`, error);
    throw error;
  }
}
