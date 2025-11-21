/**
 * Token Handler - Handles shielded token operations
 *
 * Direct service integration - no HTTP layer.
 */

import type { Handler, ToolResponse, ServiceDependencies } from '../types.js';
import {
  GetTokenBalanceSchema,
  RegisterTokenSchema,
  SendTokenSchema,
  ListTokensSchema,
  type GetTokenBalanceInput,
  type RegisterTokenInput,
  type SendTokenInput
} from '../tools/token-tools.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

/**
 * TokenHandler
 *
 * Handles all token-related operations:
 * - Token registration
 * - Balance queries
 * - Token transfers
 * - Token listing
 */
export class TokenHandler implements Handler {
  constructor(private services: ServiceDependencies) {}

  async handle(toolName: string, args: unknown): Promise<ToolResponse> {
    switch (toolName) {
      case 'getTokenBalance':
        return this.handleGetTokenBalance(args);
      case 'registerToken':
        return this.handleRegisterToken(args);
      case 'sendToken':
        return this.handleSendToken(args);
      case 'listTokens':
        return this.handleListTokens();
      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown token tool: ${toolName}`
        );
    }
  }

  private async handleGetTokenBalance(args: unknown): Promise<ToolResponse> {
    try {
      const validated = GetTokenBalanceSchema.parse(args);
      const { tokenName } = validated as GetTokenBalanceInput;

      const tokenService = this.services.tokenService;
      const balance = await tokenService.getBalance?.(tokenName);

      if (balance === undefined || balance === null) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Token not found or not registered: ${tokenName}`
        );
      }

      const response = {
        tokenName,
        balance: balance.toString(),
        unit: 'token base units'
      };

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }],
        structuredContent: response
      };
    } catch (error) {
      return this.errorResponse(error, 'Failed to get token balance');
    }
  }

  private async handleRegisterToken(args: unknown): Promise<ToolResponse> {
    try {
      const validated = RegisterTokenSchema.parse(args);
      const { name, symbol, contractAddress, decimals } = validated as RegisterTokenInput;

      const tokenService = this.services.tokenService;
      const result = await tokenService.registerToken?.(
        name,
        symbol,
        contractAddress,
        decimals ?? 6
      );

      if (!result) {
        throw new McpError(
          ErrorCode.InternalError,
          'Token registration failed'
        );
      }

      const response = {
        success: true,
        tokenName: name,
        symbol,
        contractAddress,
        decimals: decimals ?? 6,
        message: `Token ${symbol} registered successfully`
      };

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }],
        structuredContent: response
      };
    } catch (error) {
      return this.errorResponse(error, 'Failed to register token');
    }
  }

  private async handleSendToken(args: unknown): Promise<ToolResponse> {
    try {
      const validated = SendTokenSchema.parse(args);
      const { tokenName, destinationAddress, amount } = validated as SendTokenInput;

      // Check if wallet is ready
      const isReady = await this.services.walletService.isReady?.() ?? false;
      if (!isReady) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          'Wallet is not ready. Please wait for synchronization to complete.'
        );
      }

      const tokenService = this.services.tokenService;
      const result = await tokenService.send?.(tokenName, destinationAddress, amount);

      if (!result || !result.transactionId) {
        throw new McpError(
          ErrorCode.InternalError,
          'Token transfer failed'
        );
      }

      const response = {
        transactionId: result.transactionId,
        status: result.status || 'completed',
        tokenName,
        destinationAddress,
        amount,
        message: 'Token transfer completed successfully'
      };

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }],
        structuredContent: response
      };
    } catch (error) {
      return this.errorResponse(error, 'Failed to send token');
    }
  }

  private async handleListTokens(): Promise<ToolResponse> {
    try {
      ListTokensSchema.parse({});

      const tokenService = this.services.tokenService;
      const tokens = await tokenService.listTokens?.() ?? [];

      const response = {
        tokens: tokens.map(token => ({
          name: token.name,
          symbol: token.symbol,
          contractAddress: token.contractAddress,
          decimals: token.decimals,
          balance: token.balance?.toString() ?? '0'
        })),
        count: tokens.length
      };

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }],
        structuredContent: response
      };
    } catch (error) {
      return this.errorResponse(error, 'Failed to list tokens');
    }
  }

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
