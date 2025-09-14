/* istanbul ignore file */
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
    name: "send",
    description: "Send funds or tokens to another wallet address. Can send native tokens (tDUST) or shielded tokens by name/symbol",
    inputSchema: {
      type: "object",
      properties: {
        destinationAddress: { type: "string" },
        amount: { type: "string" },
        token: { type: "string", description: "Token name, symbol, or 'native'/'tDUST' for native tokens. If not specified, defaults to native tokens." }
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
  },
  // Token balance tool
  {
    name: "getTokenBalance",
    description: "Get the balance of a specific token by name or symbol. Use 'native' or 'tDUST' for native tokens",
    inputSchema: {
      type: "object",
      properties: {
        tokenName: { type: "string" }
      },
      required: ["tokenName"]
    }
  },
  // Marketplace tools
  {
    name: "registerInMarketplace",
    description: "Register a user in the marketplace",
    inputSchema: {
      type: "object",
      properties: {
        userId: { type: "string" },
        userData: { type: "object" }
      },
      required: ["userId", "userData"]
    }
  },
  {
    name: "verifyUserInMarketplace",
    description: "Verify a user in the marketplace",
    inputSchema: {
      type: "object",
      properties: {
        userId: { type: "string" },
        verificationData: { type: "object" }
      },
      required: ["userId", "verificationData"]
    }
  },
  // DAO tools
  {
    name: "openDaoElection",
    description: "Open a new election in the DAO voting contract",
    inputSchema: {
      type: "object",
      properties: {
        contractAddress: { type: "string", description: "DAO voting contract address" },
        electionId: { type: "string", description: "Unique identifier for the election" }
      },
      required: ["contractAddress", "electionId"]
    }
  },
  {
    name: "closeDaoElection",
    description: "Close the current election in the DAO voting contract",
    inputSchema: {
      type: "object",
      properties: {
        contractAddress: { type: "string", description: "DAO voting contract address" }
      },
      required: ["contractAddress"]
    }
  },
  {
    name: "castDaoVote",
    description: "Cast a vote in the DAO election (YES, NO, or ABSENT)",
    inputSchema: {
      type: "object",
      properties: {
        contractAddress: { type: "string", description: "DAO voting contract address" },
        voteType: { type: "string", enum: ["YES", "NO", "ABSENT"], description: "Type of vote to cast" },
        voteCoinNonce: { type: "string", description: "Nonce of the vote coin (hex string)" },
        voteCoinColor: { type: "string", description: "Color of the vote coin (hex string)" },
        voteCoinValue: { type: "string", description: "Value of the vote coin" }
      },
      required: ["contractAddress", "voteType", "voteCoinNonce", "voteCoinColor", "voteCoinValue"]
    }
  },
  {
    name: "fundDaoTreasury",
    description: "Fund the DAO treasury with tokens",
    inputSchema: {
      type: "object",
      properties: {
        contractAddress: { type: "string", description: "DAO voting contract address" },
        fundCoinNonce: { type: "string", description: "Nonce of the fund coin (hex string)" },
        fundCoinColor: { type: "string", description: "Color of the fund coin (hex string)" },
        fundCoinValue: { type: "string", description: "Value of the fund coin" }
      },
      required: ["contractAddress", "fundCoinNonce", "fundCoinColor", "fundCoinValue"]
    }
  },
  {
    name: "payoutDaoProposal",
    description: "Payout an approved proposal from the DAO treasury",
    inputSchema: {
      type: "object",
      properties: {
        contractAddress: { type: "string", description: "DAO voting contract address" }
      },
      required: ["contractAddress"]
    }
  },
  {
    name: "getDaoElectionStatus",
    description: "Get the current status of the DAO election",
    inputSchema: {
      type: "object",
      properties: {
        contractAddress: { type: "string", description: "DAO voting contract address" }
      },
      required: ["contractAddress"]
    }
  },
  {
    name: "getDaoState",
    description: "Get the full state of the DAO voting contract",
    inputSchema: {
      type: "object",
      properties: {
        contractAddress: { type: "string", description: "DAO voting contract address" }
      },
      required: ["contractAddress"]
    }
  }
];

// Define tool handlers
export async function handleToolCall(toolName: string, toolArgs: any, log: (...args: any[]) => void) {
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
              "text": JSON.stringify(address, null, 2),
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
        
      case "send":
        const { destinationAddress, amount, token } = toolArgs;
        if (!destinationAddress || !amount) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "Missing required parameters: destinationAddress and amount"
          );
        }
        
        // Determine if this is a native token or shielded token
        const isNativeToken = !token || 
          token.toLowerCase() === 'native' || 
          token.toLowerCase() === 'tdust' || 
          token.toLowerCase() === 'dust';
        
        if (isNativeToken) {
          // Send native tokens
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
        } else {
          // Send shielded tokens
          const sendTokenResult = await httpClient.post('/wallet/tokens/send', { 
            tokenName: token, 
            toAddress: destinationAddress, 
            amount 
          });
          return {
            "content": [
              {
                "type": "text",
                "text": JSON.stringify(sendTokenResult, null, 2),
                "mimeType": "application/json"
              }
            ]
          };
        }
        
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
        
      // Token balance tool handler
      case "getTokenBalance":
        const { tokenName: balanceTokenName } = toolArgs;
        if (!balanceTokenName) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "Missing required parameter: tokenName"
          );
        }
        
        // Check if this is a native token request
        const isNativeTokenBalance = balanceTokenName.toLowerCase() === 'native' || 
          balanceTokenName.toLowerCase() === 'tdust' || 
          balanceTokenName.toLowerCase() === 'dust';
        
        if (isNativeTokenBalance) {
          // Get native token balance
          const nativeBalance = await httpClient.get('/wallet/balance');
          return {
            "content": [
              {
                "type": "text",
                "text": JSON.stringify(nativeBalance, null, 2),
                "mimeType": "application/json"
              }
            ]
          };
        } else {
          // Get shielded token balance
          const tokenBalance = await httpClient.get(`/wallet/tokens/balance/${balanceTokenName}`);
          return {
            "content": [
              {
                "type": "text",
                "text": JSON.stringify(tokenBalance, null, 2),
                "mimeType": "application/json"
              }
            ]
          };
        }
      
      // Marketplace tool handlers
      case "registerInMarketplace":
        const { userId, userData } = toolArgs;
        if (!userId || !userData) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "Missing required parameters: userId and userData"
          );
        }
        const registerResult = await httpClient.post('/marketplace/register', { userId, userData });
        return {
          "content": [
            {
              "type": "text",
              "text": JSON.stringify(registerResult, null, 2),
              "mimeType": "application/json"
            }
          ]
        };
      
      case "verifyUserInMarketplace":
        const { userId: verifyUserId, verificationData } = toolArgs;
        if (!verifyUserId || !verificationData) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "Missing required parameters: userId and verificationData"
          );
        }
        const verifyUserResult = await httpClient.post('/marketplace/verify', { userId: verifyUserId, verificationData });
        return {
          "content": [
            {
              "type": "text",
              "text": JSON.stringify(verifyUserResult, null, 2),
              "mimeType": "application/json"
            }
          ]
        };
      
      // DAO tool handlers
      case "openDaoElection":
        const { contractAddress: openContractAddress, electionId } = toolArgs;
        if (!openContractAddress || !electionId) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "Missing required parameters: contractAddress and electionId"
          );
        }
        const openElectionResult = await httpClient.post('/dao/open-election', { contractAddress: openContractAddress, electionId });
        return {
          "content": [
            {
              "type": "text",
              "text": JSON.stringify(openElectionResult, null, 2),
              "mimeType": "application/json"
            }
          ]
        };
      
      case "closeDaoElection":
        const { contractAddress: closeContractAddress } = toolArgs;
        if (!closeContractAddress) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "Missing required parameter: contractAddress"
          );
        }
        const closeElectionResult = await httpClient.post('/dao/close-election', { contractAddress: closeContractAddress });
        return {
          "content": [
            {
              "type": "text",
              "text": JSON.stringify(closeElectionResult, null, 2),
              "mimeType": "application/json"
            }
          ]
        };
      
      case "castDaoVote":
        const { 
          contractAddress: voteContractAddress, 
          voteType, 
          voteCoinNonce, 
          voteCoinColor, 
          voteCoinValue 
        } = toolArgs;
        if (!voteContractAddress || !voteType || !voteCoinNonce || !voteCoinColor || !voteCoinValue) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "Missing required parameters: contractAddress, voteType, voteCoinNonce, voteCoinColor, voteCoinValue"
          );
        }
        const castVoteResult = await httpClient.post('/dao/cast-vote', {
          contractAddress: voteContractAddress,
          voteType,
          voteCoin: {
            nonce: voteCoinNonce,
            color: voteCoinColor,
            value: voteCoinValue
          }
        });
        return {
          "content": [
            {
              "type": "text",
              "text": JSON.stringify(castVoteResult, null, 2),
              "mimeType": "application/json"
            }
          ]
        };
      
      case "fundDaoTreasury":
        const { 
          contractAddress: fundContractAddress, 
          fundCoinNonce, 
          fundCoinColor, 
          fundCoinValue 
        } = toolArgs;
        if (!fundContractAddress || !fundCoinNonce || !fundCoinColor || !fundCoinValue) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "Missing required parameters: contractAddress, fundCoinNonce, fundCoinColor, fundCoinValue"
          );
        }
        const fundTreasuryResult = await httpClient.post('/dao/fund-treasury', {
          contractAddress: fundContractAddress,
          fundCoin: {
            nonce: fundCoinNonce,
            color: fundCoinColor,
            value: fundCoinValue
          }
        });
        return {
          "content": [
            {
              "type": "text",
              "text": JSON.stringify(fundTreasuryResult, null, 2),
              "mimeType": "application/json"
            }
          ]
        };
      
      case "payoutDaoProposal":
        const { contractAddress: payoutContractAddress } = toolArgs;
        if (!payoutContractAddress) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "Missing required parameter: contractAddress"
          );
        }
        const payoutResult = await httpClient.post('/dao/payout-proposal', { contractAddress: payoutContractAddress });
        return {
          "content": [
            {
              "type": "text",
              "text": JSON.stringify(payoutResult, null, 2),
              "mimeType": "application/json"
            }
          ]
        };
      
      case "getDaoElectionStatus":
        const { contractAddress: statusContractAddress } = toolArgs;
        if (!statusContractAddress) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "Missing required parameter: contractAddress"
          );
        }
        const electionStatusResult = await httpClient.get(`/dao/election-status/${statusContractAddress}`);
        return {
          "content": [
            {
              "type": "text",
              "text": JSON.stringify(electionStatusResult, null, 2),
              "mimeType": "application/json"
            }
          ]
        };
      
      case "getDaoState":
        const { contractAddress: stateContractAddress } = toolArgs;
        if (!stateContractAddress) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "Missing required parameter: contractAddress"
          );
        }
        const daoStateResult = await httpClient.get(`/dao/state/${stateContractAddress}`);
        return {
          "content": [
            {
              "type": "text",
              "text": JSON.stringify(daoStateResult, null, 2),
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
