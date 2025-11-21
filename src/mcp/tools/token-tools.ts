/**
 * Token Tools - MCP Tool Definitions for Shielded Tokens
 *
 * Defines all token-related MCP tools with Zod validation.
 *
 * NEW: Each tool now has an execute function that receives services.
 */

import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { ServiceDependencies } from '../types.js';
import type { ToolDefinition } from '../adapter/types.js';

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

export const SendTokenSchema = z.object({
  tokenName: z.string()
    .min(1)
    .describe("Token name or symbol to send"),
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

export const ListTokensSchema = z.object({});

/**
 * Type Inference
 */
export type GetTokenBalanceInput = z.infer<typeof GetTokenBalanceSchema>;
export type RegisterTokenInput = z.infer<typeof RegisterTokenSchema>;
export type SendTokenInput = z.infer<typeof SendTokenSchema>;
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
    return await services.tokenService.getTokenBalance(tokenName);
  }
};

export const registerTokenTool: ToolDefinition = {
  name: "registerToken",
  description: "Register a new shielded token for use with the wallet",
  inputSchema: RegisterTokenSchema.shape,
  execute: async (args: unknown, services: ServiceDependencies) => {
    const { name, symbol, contractAddress, decimals } = RegisterTokenSchema.parse(args);
    // TokenService.registerToken takes individual params, not an object
    return services.tokenService.registerToken(
      name,
      symbol,
      contractAddress,
      decimals
    );
  }
};

export const sendTokenTool: ToolDefinition = {
  name: "sendToken",
  description: "Send shielded tokens to another Midnight address",
  inputSchema: SendTokenSchema.shape,
  execute: async (args: unknown, services: ServiceDependencies) => {
    const { tokenName, destinationAddress, amount } = SendTokenSchema.parse(args);
    return await services.tokenService.sendToken(
      tokenName,
      destinationAddress,
      BigInt(amount)
    );
  }
};

export const listTokensTool: ToolDefinition = {
  name: "listTokens",
  description: "List all registered shielded tokens",
  inputSchema: ListTokensSchema.shape,
  execute: async (args: unknown, services: ServiceDependencies) => {
    return await services.tokenService.listTokens();
  }
};

/**
 * All token tools (ToolDefinition format)
 */
export const TOKEN_TOOLS: ToolDefinition[] = [
  getTokenBalanceTool,
  registerTokenTool,
  sendTokenTool,
  listTokensTool
];
