/**
 * Marketplace Tools - MCP Tool Definitions for NFT Marketplace
 *
 * Defines all marketplace-related MCP tools with Zod validation.
 */

import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * Schemas
 */
export const GetMarketplaceConfigSchema = z.object({});

export const ListMarketplaceItemsSchema = z.object({
  status: z.enum(['active', 'sold', 'cancelled', 'all'])
    .default('active')
    .describe("Filter by listing status")
});

/**
 * Type Inference
 */
export type GetMarketplaceConfigInput = z.infer<typeof GetMarketplaceConfigSchema>;
export type ListMarketplaceItemsInput = z.infer<typeof ListMarketplaceItemsSchema>;

/**
 * Tool Definitions
 */
export const GET_MARKETPLACE_CONFIG_TOOL: Tool = {
  name: "getMarketplaceConfig",
  description: "Get the current marketplace configuration and contract details",
  inputSchema: GetMarketplaceConfigSchema.shape
};

export const LIST_MARKETPLACE_ITEMS_TOOL: Tool = {
  name: "listMarketplaceItems",
  description: "List marketplace items/listings with optional status filter",
  inputSchema: ListMarketplaceItemsSchema.shape
};

/**
 * All marketplace tools
 */
export const MARKETPLACE_TOOLS: Tool[] = [
  GET_MARKETPLACE_CONFIG_TOOL,
  LIST_MARKETPLACE_ITEMS_TOOL
];
