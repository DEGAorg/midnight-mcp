/**
 * Token Tools - MCP Tool Definitions for Shielded Tokens
 *
 * Defines all token-related MCP tools with Zod validation.
 *
 * NEW: Each tool now has an execute function that receives services.
 * MOCK MODE: Returns hardcoded mock data for testing without actual wallet connections.
 */

import { z } from 'zod';
import type { ServiceDependencies } from '../types.js';
import type { ToolDefinition } from '../adapter/types.js';
import {
  MOCK_TOKENS,
  MOCK_TOKEN_LIST,
  getMockTokenBalance,
  generateMockTransactionId,
  MOCK_ADDRESSES,
} from './mock-data.js';

/**
 * Midnight Address Validation (Bech32m)
 */
const BECH32M_ADDRESS_REGEX = /^(addr_test1|mtst1|addr1)[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{38,}$/;

/**
 * Schemas
 */
export const GetTokenBalanceSchema = z.object({
  tokenName: z.string()
    .min(1)
    .describe("Token name or symbol")
});

export const RegisterTokenSchema = z.object({
  name: z.string()
    .min(1)
    .describe("Token full name"),
  symbol: z.string()
    .min(1)
    .max(10)
    .describe("Token symbol/ticker"),
  contractAddress: z.string()
    .min(1)
    .describe("Contract address for the token"),
  decimals: z.number()
    .int()
    .min(0)
    .max(18)
    .default(6)
    .describe("Number of decimal places (default: 6)")
});

export const SendShieldedTokenSchema = z.object({
  tokenId: z.string()
    .min(1)
    .describe("Token ID (from registered token, format: domainSeparator:contractAddress)"),
  destinationAddress: z.string()
    .regex(BECH32M_ADDRESS_REGEX, {
      message: "Invalid Midnight address format"
    })
    .describe("Recipient's Midnight wallet address (Bech32m encoded)"),
  amount: z.string()
    .regex(/^\d+$/, {
      message: "Amount must contain only digits"
    })
    .refine(val => BigInt(val) > 0n, {
      message: "Amount must be greater than zero"
    })
    .describe("Amount in token's base units")
});

export const SendNativeTokenSchema = z.object({
  destinationAddress: z.string()
    .regex(BECH32M_ADDRESS_REGEX, {
      message: "Invalid Midnight address format"
    })
    .describe("Recipient's Midnight wallet address (Bech32m encoded)"),
  amount: z.string()
    .regex(/^\d+$/, {
      message: "Amount must contain only digits"
    })
    .refine(val => BigInt(val) > 0n, {
      message: "Amount must be greater than zero"
    })
    .describe("Amount in base units (dust)")
});

export const ListTokensSchema = z.object({});

/**
 * Type Inference
 */
export type GetTokenBalanceInput = z.infer<typeof GetTokenBalanceSchema>;
export type RegisterTokenInput = z.infer<typeof RegisterTokenSchema>;
export type SendShieldedTokenInput = z.infer<typeof SendShieldedTokenSchema>;
export type SendNativeTokenInput = z.infer<typeof SendNativeTokenSchema>;
export type ListTokensInput = z.infer<typeof ListTokensSchema>;

/**
 * Tool Definitions with Execute Functions
 */
export const getTokenBalanceTool: ToolDefinition = {
  name: "getTokenBalance",
  description: "Get the balance of a specific shielded token",
  inputSchema: GetTokenBalanceSchema.shape,
  execute: async (args: unknown, services: ServiceDependencies) => {
    const { tokenName } = GetTokenBalanceSchema.parse(args);
    // MOCK: Return hardcoded token balance
    return getMockTokenBalance(tokenName);
  }
};

export const registerTokenTool: ToolDefinition = {
  name: "registerToken",
  description: "Register a new shielded token for use with the wallet",
  inputSchema: RegisterTokenSchema.shape,
  execute: async (args: unknown, services: ServiceDependencies) => {
    const { name, symbol, contractAddress, decimals } = RegisterTokenSchema.parse(args);
    // MOCK: Return success response with registered token info
    return {
      success: true,
      message: 'Token registered successfully (MOCK)',
      token: {
        id: `mock_token:${contractAddress}`,
        name,
        symbol,
        contractAddress,
        decimals,
        domainSeparator: `mock_token`,
      },
    };
  }
};

export const sendShieldedTokenTool: ToolDefinition = {
  name: "sendShieldedToken",
  description: "Send shielded tokens (colored coins) to another Midnight address",
  inputSchema: SendShieldedTokenSchema.shape,
  execute: async (args: unknown, services: ServiceDependencies) => {
    const { tokenId, destinationAddress, amount } = SendShieldedTokenSchema.parse(args);
    // MOCK: Return mock transaction ID
    const txId = generateMockTransactionId();
    return {
      success: true,
      transactionId: txId,
      message: 'Shielded token sent successfully (MOCK)',
      details: {
        tokenId,
        to: destinationAddress,
        amount,
      },
    };
  }
};

export const sendNativeTokenTool: ToolDefinition = {
  name: "sendNativeToken",
  description: "Send native tokens (tDUST/DUST) to another Midnight address",
  inputSchema: SendNativeTokenSchema.shape,
  execute: async (args: unknown, services: ServiceDependencies) => {
    const { destinationAddress, amount } = SendNativeTokenSchema.parse(args);
    // MOCK: Return mock transaction ID
    const txId = generateMockTransactionId();
    return {
      success: true,
      transactionId: txId,
      message: 'Native token sent successfully (MOCK)',
      details: {
        to: destinationAddress,
        amount,
      },
    };
  }
};

export const listTokensTool: ToolDefinition = {
  name: "listTokens",
  description: "List all registered shielded tokens",
  inputSchema: ListTokensSchema.shape,
  execute: async (args: unknown, services: ServiceDependencies) => {
    // MOCK: Return hardcoded token list
    return MOCK_TOKEN_LIST;
  }
};

/**
 * All token tools (ToolDefinition format)
 */
export const TOKEN_TOOLS: ToolDefinition[] = [
  getTokenBalanceTool,
  registerTokenTool,
  sendShieldedTokenTool,
  sendNativeTokenTool,
  listTokensTool
];
