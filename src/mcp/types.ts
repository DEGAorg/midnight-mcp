/**
 * MCP Types - Shared type definitions for MCP server
 */

import type { WalletService } from '../services/wallet/WalletService.js';
import type { TransactionService } from '../services/wallet/TransactionService.js';
import type { TokenService } from '../services/wallet/TokenService.js';
import type { DaoService } from '../services/wallet/DaoService.js';
import type { MarketplaceService } from '../services/wallet/MarketplaceService.js';

/**
 * MCP Tool Response
 */
export interface ToolResponse {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
}

/**
 * Service Dependencies
 *
 * All services needed by MCP handlers to perform operations.
 * Injected via dependency injection.
 */
export interface ServiceDependencies {
  walletService: WalletService;
  transactionService: TransactionService;
  tokenService: TokenService;
  daoService: DaoService;
  marketplaceService: MarketplaceService;
}

/**
 * Handler interface
 *
 * All handlers must implement this interface for consistent routing.
 */
export interface Handler {
  /**
   * Handle a tool call
   * @param toolName - Name of the tool being called
   * @param args - Tool arguments (already validated by Zod)
   * @returns Tool response with content
   */
  handle(toolName: string, args: unknown): Promise<ToolResponse>;
}
