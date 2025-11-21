/**
 * Token Tools - MCP Tool Definitions for Shielded Tokens
 *
 * Defines all token-related MCP tools with Zod validation.
 */

import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

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
 * Tool Definitions
 */
export const GET_TOKEN_BALANCE_TOOL: Tool = {
  name: "getTokenBalance",
  description: "Get the balance of a specific shielded token",
  inputSchema: GetTokenBalanceSchema.shape
};

export const REGISTER_TOKEN_TOOL: Tool = {
  name: "registerToken",
  description: "Register a new shielded token for use with the wallet",
  inputSchema: RegisterTokenSchema.shape
};

export const SEND_TOKEN_TOOL: Tool = {
  name: "sendToken",
  description: "Send shielded tokens to another Midnight address",
  inputSchema: SendTokenSchema.shape
};

export const LIST_TOKENS_TOOL: Tool = {
  name: "listTokens",
  description: "List all registered shielded tokens",
  inputSchema: ListTokensSchema.shape
};

/**
 * All token tools
 */
export const TOKEN_TOOLS: Tool[] = [
  GET_TOKEN_BALANCE_TOOL,
  REGISTER_TOKEN_TOOL,
  SEND_TOKEN_TOOL,
  LIST_TOKENS_TOOL
];
