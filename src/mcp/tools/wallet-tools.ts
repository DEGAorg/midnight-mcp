/**
 * Wallet Tools - MCP Tool Definitions with Zod Schemas
 *
 * Defines all wallet-related MCP tools with proper Midnight address validation.
 * Midnight uses Bech32m encoding for addresses (not Ethereum hex).
 *
 * NEW: Each tool now has an execute function that receives services.
 */

import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { ServiceDependencies } from '../types.js';
import type { ToolDefinition } from '../adapter/types.js';

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
 * Tool Definitions with Execute Functions
 */
export const walletStatusTool: ToolDefinition = {
  name: "walletStatus",
  description: "Get the current wallet synchronization status and readiness state",
  inputSchema: WalletStatusSchema.shape,
  execute: async (args: unknown, services: ServiceDependencies) => {
    // Compose status from available methods
    return {
      isReady: services.walletService.isReady(),
      address: services.walletService.getAddress(),
      balance: services.walletService.getBalance().toString(),
      syncProgress: services.walletService.getSyncProgress(),
      isSyncing: services.walletService.isSyncInProgress()
    };
  }
};

export const walletAddressTool: ToolDefinition = {
  name: "walletAddress",
  description: "Get the wallet's Midnight address (Bech32m encoded)",
  inputSchema: WalletAddressSchema.shape,
  execute: async (args: unknown, services: ServiceDependencies) => {
    return { address: services.walletService.getAddress() };
  }
};

export const walletBalanceTool: ToolDefinition = {
  name: "walletBalance",
  description: "Get the wallet's native token balance",
  inputSchema: WalletBalanceSchema.shape,
  execute: async (args: unknown, services: ServiceDependencies) => {
    return {
      balance: services.walletService.getBalance().toString(),
      pendingBalance: services.walletService.getPendingBalance().toString()
    };
  }
};

// TODO: Implement send functionality
// export const sendTool: ToolDefinition = {
//   name: "send",
//   description: "Send native tokens to another Midnight address. Returns immediately with transaction ID for tracking.",
//   inputSchema: SendSchema.shape,
//   execute: async (args: unknown, services: ServiceDependencies) => {
//     const { destinationAddress, amount } = SendSchema.parse(args);
//     // TODO: Implement actual sending - TransactionService is for tracking, not sending
//     throw new Error('Send functionality not yet implemented');
//   }
// };

// TODO: Implement sendAndWait functionality
// export const sendAndWaitTool: ToolDefinition = {
//   name: "sendAndWait",
//   description: "Send native tokens and wait for confirmation. Blocks until transaction completes.",
//   inputSchema: SendAndWaitSchema.shape,
//   execute: async (args: unknown, services: ServiceDependencies) => {
//     const { destinationAddress, amount} = SendAndWaitSchema.parse(args);
//     // TODO: Implement actual sending with waiting
//     throw new Error('SendAndWait functionality not yet implemented');
//   }
// };

export const getTransactionTool: ToolDefinition = {
  name: "getTransaction",
  description: "Get the status and details of a transaction by its ID",
  inputSchema: GetTransactionSchema.shape,
  execute: async (args: unknown, services: ServiceDependencies) => {
    const { transactionId } = GetTransactionSchema.parse(args);
    return services.transactionService.getTransaction(transactionId);
  }
};

/**
 * All wallet tools (ToolDefinition format)
 */
export const WALLET_TOOLS: ToolDefinition[] = [
  walletStatusTool,
  walletAddressTool,
  walletBalanceTool,
  // sendTool,  // TODO: Implement
  // sendAndWaitTool,  // TODO: Implement
  getTransactionTool
];
