/**
 * Marketplace Handler - Handles NFT marketplace operations
 *
 * Direct service integration - no HTTP layer.
 */

import type { Handler, ToolResponse, ServiceDependencies } from '../types.js';
import {
  GetMarketplaceConfigSchema,
  ListMarketplaceItemsSchema,
  type ListMarketplaceItemsInput
} from '../tools/marketplace-tools.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

/**
 * MarketplaceHandler
 *
 * Handles all marketplace-related operations:
 * - Configuration queries
 * - Listing items
 */
export class MarketplaceHandler implements Handler {
  constructor(private services: ServiceDependencies) {}

  async handle(toolName: string, args: unknown): Promise<ToolResponse> {
    switch (toolName) {
      case 'getMarketplaceConfig':
        return this.handleGetMarketplaceConfig();
      case 'listMarketplaceItems':
        return this.handleListMarketplaceItems(args);
      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown marketplace tool: ${toolName}`
        );
    }
  }

  private async handleGetMarketplaceConfig(): Promise<ToolResponse> {
    try {
      GetMarketplaceConfigSchema.parse({});

      const marketplaceService = this.services.marketplaceService;
      const config = await marketplaceService.getConfig?.();

      if (!config) {
        throw new McpError(
          ErrorCode.InternalError,
          'Marketplace configuration not available'
        );
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(config, null, 2)
        }],
        structuredContent: config
      };
    } catch (error) {
      return this.errorResponse(error, 'Failed to get marketplace configuration');
    }
  }

  private async handleListMarketplaceItems(args: unknown): Promise<ToolResponse> {
    try {
      const validated = ListMarketplaceItemsSchema.parse(args);
      const { status } = validated as ListMarketplaceItemsInput;

      const marketplaceService = this.services.marketplaceService;
      const items = await marketplaceService.listItems?.(status) ?? [];

      const response = {
        items,
        count: items.length,
        filter: status
      };

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }],
        structuredContent: response
      };
    } catch (error) {
      return this.errorResponse(error, 'Failed to list marketplace items');
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
