/**
 * Wallet Handler - Handles wallet-related MCP tool calls
 *
 * Direct service integration - no HTTP layer.
 */

import type { Handler, ToolResponse, ServiceDependencies } from '../types.js';
import {
  WalletStatusSchema,
  WalletAddressSchema,
  WalletBalanceSchema,
  SendSchema,
  SendAndWaitSchema,
  GetTransactionSchema,
  type SendInput,
  type SendAndWaitInput,
  type GetTransactionInput
} from '../tools/wallet-tools.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

/**
 * WalletHandler
 *
 * Handles all wallet-related operations:
 * - Status queries
 * - Balance inquiries
 * - Fund transfers
 * - Transaction tracking
 */
export class WalletHandler implements Handler {
  constructor(private services: ServiceDependencies) {}

  async handle(toolName: string, args: unknown): Promise<ToolResponse> {
    switch (toolName) {
      case 'walletStatus':
        return this.handleWalletStatus();
      case 'walletAddress':
        return this.handleWalletAddress();
      case 'walletBalance':
        return this.handleWalletBalance();
      case 'send':
        return this.handleSend(args);
      case 'sendAndWait':
        return this.handleSendAndWait(args);
      case 'getTransaction':
        return this.handleGetTransaction(args);
      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown wallet tool: ${toolName}`
        );
    }
  }

  private async handleWalletStatus(): Promise<ToolResponse> {
    try {
      // Validate empty args
      WalletStatusSchema.parse({});

      const walletService = this.services.walletService;
      const isReady = await walletService.isReady?.() ?? false;

      const status = {
        ready: isReady,
        syncing: !isReady,
        message: isReady ? 'Wallet is ready' : 'Wallet is synchronizing'
      };

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(status, null, 2)
        }],
        structuredContent: status
      };
    } catch (error) {
      return this.errorResponse(error, 'Failed to get wallet status');
    }
  }

  private async handleWalletAddress(): Promise<ToolResponse> {
    try {
      // Validate empty args
      WalletAddressSchema.parse({});

      const walletService = this.services.walletService;
      const address = await walletService.getAddress?.() ?? null;

      const response = {
        address: address,
        format: 'Bech32m',
        network: process.env.NETWORK_ID || 'testnet'
      };

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }],
        structuredContent: response
      };
    } catch (error) {
      return this.errorResponse(error, 'Failed to get wallet address');
    }
  }

  private async handleWalletBalance(): Promise<ToolResponse> {
    try {
      // Validate empty args
      WalletBalanceSchema.parse({});

      const walletService = this.services.walletService;
      const balance = await walletService.getBalance?.() ?? '0';

      const response = {
        balance: balance.toString(),
        unit: 'base units',
        formatted: this.formatBalance(balance.toString())
      };

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }],
        structuredContent: response
      };
    } catch (error) {
      return this.errorResponse(error, 'Failed to get wallet balance');
    }
  }

  private async handleSend(args: unknown): Promise<ToolResponse> {
    try {
      // Validate and parse arguments
      const validated = SendSchema.parse(args);
      const { destinationAddress, amount } = validated as SendInput;

      // Check if wallet is ready
      const isReady = await this.services.walletService.isReady?.() ?? false;
      if (!isReady) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          'Wallet is not ready. Please wait for synchronization to complete.'
        );
      }

      // Initiate transaction (non-blocking)
      const transactionService = this.services.transactionService;
      const result = await transactionService.initiateSend?.(destinationAddress, amount);

      if (!result || !result.transactionId) {
        throw new McpError(
          ErrorCode.InternalError,
          'Transaction initiation failed'
        );
      }

      const response = {
        transactionId: result.transactionId,
        status: 'initiated',
        destinationAddress,
        amount,
        message: 'Transaction initiated. Use getTransaction to track status.'
      };

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }],
        structuredContent: response
      };
    } catch (error) {
      return this.errorResponse(error, 'Failed to send funds');
    }
  }

  private async handleSendAndWait(args: unknown): Promise<ToolResponse> {
    try {
      // Validate and parse arguments
      const validated = SendAndWaitSchema.parse(args);
      const { destinationAddress, amount } = validated as SendAndWaitInput;

      // Check if wallet is ready
      const isReady = await this.services.walletService.isReady?.() ?? false;
      if (!isReady) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          'Wallet is not ready. Please wait for synchronization to complete.'
        );
      }

      // Send and wait for confirmation
      const transactionService = this.services.transactionService;
      const result = await transactionService.sendAndWait?.(destinationAddress, amount);

      if (!result || !result.transactionId) {
        throw new McpError(
          ErrorCode.InternalError,
          'Transaction failed'
        );
      }

      const response = {
        transactionId: result.transactionId,
        status: result.status || 'completed',
        destinationAddress,
        amount,
        message: 'Transaction completed successfully'
      };

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }],
        structuredContent: response
      };
    } catch (error) {
      return this.errorResponse(error, 'Failed to send funds and wait');
    }
  }

  private async handleGetTransaction(args: unknown): Promise<ToolResponse> {
    try {
      // Validate and parse arguments
      const validated = GetTransactionSchema.parse(args);
      const { transactionId } = validated as GetTransactionInput;

      const transactionService = this.services.transactionService;
      const status = await transactionService.getStatus?.(transactionId);

      if (!status) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Transaction not found: ${transactionId}`
        );
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(status, null, 2)
        }],
        structuredContent: status
      };
    } catch (error) {
      return this.errorResponse(error, 'Failed to get transaction status');
    }
  }

  /**
   * Helper: Format balance for display
   */
  private formatBalance(balance: string): string {
    const balanceBigInt = BigInt(balance);
    const divisor = BigInt(1_000_000); // Assuming 6 decimals
    const whole = balanceBigInt / divisor;
    const fractional = balanceBigInt % divisor;
    return `${whole}.${fractional.toString().padStart(6, '0')} DUST`;
  }

  /**
   * Helper: Create error response
   */
  private errorResponse(error: unknown, message: string): ToolResponse {
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: true,
          message,
          details: errorMessage
        }, null, 2)
      }],
      isError: true
    };
  }
}
