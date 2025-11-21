/**
 * Wallet Tools - MCP Tool Definitions with Zod Schemas
 *
 * Defines all wallet-related MCP tools with proper Midnight address validation.
 * Midnight uses Bech32m encoding for addresses (not Ethereum hex).
 */

import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * Midnight Address Validation
 *
 * Bech32m format: hrp + '1' + data
 * - Testnet: addr_test1q... or mtst1q...
 * - Mainnet: addr1q... (typical)
 * - Characters: a-z, 0-9 (no 'b', 'i', 'o', '1' except separator)
 */
const BECH32M_ADDRESS_REGEX = /^(addr_test1|mtst1|addr1)[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{38,}$/;

/**
 * Schemas
 */
export const WalletStatusSchema = z.object({});

export const WalletAddressSchema = z.object({});

export const WalletBalanceSchema = z.object({});

export const SendSchema = z.object({
  destinationAddress: z.string()
    .regex(BECH32M_ADDRESS_REGEX, {
      message: "Invalid Midnight address format. Expected Bech32m encoded address (e.g., addr_test1q...)"
    })
    .describe("Recipient's Midnight wallet address (Bech32m encoded)"),
  amount: z.string()
    .regex(/^\d+$/, {
      message: "Amount must contain only digits"
    })
    .refine(val => BigInt(val) > 0n, {
      message: "Amount must be greater than zero"
    })
    .describe("Amount in base units (smallest denomination)")
});

export const SendAndWaitSchema = z.object({
  destinationAddress: z.string()
    .regex(BECH32M_ADDRESS_REGEX, {
      message: "Invalid Midnight address format. Expected Bech32m encoded address"
    })
    .describe("Recipient's Midnight wallet address (Bech32m encoded)"),
  amount: z.string()
    .regex(/^\d+$/, {
      message: "Amount must contain only digits"
    })
    .refine(val => BigInt(val) > 0n, {
      message: "Amount must be greater than zero"
    })
    .describe("Amount in base units (smallest denomination)")
});

export const GetTransactionSchema = z.object({
  transactionId: z.string()
    .min(1)
    .describe("Transaction identifier")
});

/**
 * Type Inference
 */
export type WalletStatusInput = z.infer<typeof WalletStatusSchema>;
export type WalletAddressInput = z.infer<typeof WalletAddressSchema>;
export type WalletBalanceInput = z.infer<typeof WalletBalanceSchema>;
export type SendInput = z.infer<typeof SendSchema>;
export type SendAndWaitInput = z.infer<typeof SendAndWaitSchema>;
export type GetTransactionInput = z.infer<typeof GetTransactionSchema>;

/**
 * Tool Definitions
 */
export const WALLET_STATUS_TOOL: Tool = {
  name: "walletStatus",
  description: "Get the current wallet synchronization status and readiness state",
  inputSchema: WalletStatusSchema.shape
};

export const WALLET_ADDRESS_TOOL: Tool = {
  name: "walletAddress",
  description: "Get the wallet's Midnight address (Bech32m encoded)",
  inputSchema: WalletAddressSchema.shape
};

export const WALLET_BALANCE_TOOL: Tool = {
  name: "walletBalance",
  description: "Get the wallet's native token balance",
  inputSchema: WalletBalanceSchema.shape
};

export const SEND_TOOL: Tool = {
  name: "send",
  description: "Send native tokens to another Midnight address. Returns immediately with transaction ID for tracking.",
  inputSchema: SendSchema.shape
};

export const SEND_AND_WAIT_TOOL: Tool = {
  name: "sendAndWait",
  description: "Send native tokens and wait for confirmation. Blocks until transaction completes.",
  inputSchema: SendAndWaitSchema.shape
};

export const GET_TRANSACTION_TOOL: Tool = {
  name: "getTransaction",
  description: "Get the status and details of a transaction by its ID",
  inputSchema: GetTransactionSchema.shape
};

/**
 * All wallet tools
 */
export const WALLET_TOOLS: Tool[] = [
  WALLET_STATUS_TOOL,
  WALLET_ADDRESS_TOOL,
  WALLET_BALANCE_TOOL,
  SEND_TOOL,
  SEND_AND_WAIT_TOOL,
  GET_TRANSACTION_TOOL
];
