/**
 * Resource Handler
 *
 * Handles MCP resource requests by fetching data from services.
 * Resources are READ-ONLY - use tools for mutations.
 */

import type { ResourceContents } from '@modelcontextprotocol/sdk/types.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import type { ServiceDependencies } from '../types.js';

export class ResourceHandler {
  constructor(private services: ServiceDependencies) {}

  /**
   * Handle ReadResource request
   */
  async handleReadResource(uri: string): Promise<{ contents: ResourceContents[] }> {
    const [scheme, domain, path] = this.parseUri(uri);

    if (scheme !== 'midnight') {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Invalid URI scheme: ${scheme}. Expected 'midnight:'`
      );
    }

    try {
      switch (domain) {
        case 'wallet':
          return await this.handleWalletResource(path, uri);
        case 'transactions':
          return await this.handleTransactionResource(path, uri);
        case 'tokens':
          return await this.handleTokenResource(path, uri);
        default:
          throw new McpError(
            ErrorCode.InvalidRequest,
            `Unknown resource domain: ${domain}`
          );
      }
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to read resource: ${message}`
      );
    }
  }

  /**
   * Handle wallet resources
   */
  private async handleWalletResource(path: string, uri: string): Promise<{ contents: ResourceContents[] }> {
    switch (path) {
      case 'status': {
        const status = this.services.walletService.isReady();
        const syncProgress = this.services.walletService.getSyncProgress();

        const statusData = {
          ready: status,
          synced: syncProgress.synced,
          syncPercentage: syncProgress.syncPercentage,
          applyGap: syncProgress.applyGap.toString(),
          sourceGap: syncProgress.sourceGap.toString()
        };

        return {
          contents: [{
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(statusData, null, 2)
          }]
        };
      }

      case 'balance': {
        const balance = this.services.walletService.getBalance();
        const address = this.services.walletService.getAddress();

        const balanceData = {
          address,
          balance: balance.toString(),
          balanceFormatted: `${balance.toString()} base units`
        };

        return {
          contents: [{
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(balanceData, null, 2)
          }]
        };
      }

      case 'address': {
        const address = this.services.walletService.getAddress();

        return {
          contents: [{
            uri,
            mimeType: 'text/plain',
            text: address
          }]
        };
      }

      case 'sync-progress': {
        const syncProgress = this.services.walletService.getSyncProgress();

        const progressData = {
          synced: syncProgress.synced,
          percentage: syncProgress.syncPercentage,
          applyGap: syncProgress.applyGap.toString(),
          sourceGap: syncProgress.sourceGap.toString()
        };

        return {
          contents: [{
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(progressData, null, 2)
          }]
        };
      }

      default:
        throw new McpError(
          ErrorCode.InvalidRequest,
          `Unknown wallet resource: ${path}`
        );
    }
  }

  /**
   * Handle transaction resources
   */
  private async handleTransactionResource(path: string, uri: string): Promise<{ contents: ResourceContents[] }> {
    switch (path) {
      case 'pending': {
        const pending = this.services.transactionService.getPendingTransactions?.() || [];

        return {
          contents: [{
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({ transactions: pending, count: pending.length }, null, 2)
          }]
        };
      }

      case 'recent': {
        const all = this.services.transactionService.getTransactions?.() || [];
        const recent = all.slice(0, 50); // Last 50 transactions

        return {
          contents: [{
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({ transactions: recent, count: recent.length }, null, 2)
          }]
        };
      }

      case 'all': {
        const all = this.services.transactionService.getTransactions?.() || [];

        return {
          contents: [{
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({ transactions: all, count: all.length }, null, 2)
          }]
        };
      }

      default:
        throw new McpError(
          ErrorCode.InvalidRequest,
          `Unknown transaction resource: ${path}`
        );
    }
  }

  /**
   * Handle token resources
   */
  private async handleTokenResource(path: string, uri: string): Promise<{ contents: ResourceContents[] }> {
    switch (path) {
      case 'registered': {
        const tokens = this.services.tokenService.getRegisteredTokens?.() || [];

        return {
          contents: [{
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({ tokens, count: tokens.length }, null, 2)
          }]
        };
      }

      case 'balances': {
        const balances = this.services.tokenService.getTokenBalances?.() || [];

        return {
          contents: [{
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({ balances, count: balances.length }, null, 2)
          }]
        };
      }

      default:
        throw new McpError(
          ErrorCode.InvalidRequest,
          `Unknown token resource: ${path}`
        );
    }
  }

  /**
   * Parse URI into components
   * Example: midnight://wallet/status -> ['midnight', 'wallet', 'status']
   */
  private parseUri(uri: string): [string, string, string] {
    const match = uri.match(/^([^:]+):\/\/([^\/]+)\/(.+)$/);
    if (!match) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Invalid URI format: ${uri}. Expected format: scheme://domain/path`
      );
    }
    return [match[1], match[2], match[3]];
  }
}
