/**
 * Tool Registry - Central registry for all MCP tools
 *
 * Aggregates all tools from different domains into a single registry.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { WALLET_TOOLS } from './wallet-tools.js';
import { TOKEN_TOOLS } from './token-tools.js';
import { DAO_TOOLS } from './dao-tools.js';
import { MARKETPLACE_TOOLS } from './marketplace-tools.js';

/**
 * All registered MCP tools
 *
 * Total: 18 tools across 4 domains
 * - Wallet: 6 tools
 * - Token: 4 tools
 * - DAO: 7 tools
 * - Marketplace: 2 tools (1 removed)
 */
export const ALL_TOOLS: Tool[] = [
  ...WALLET_TOOLS,
  ...TOKEN_TOOLS,
  ...DAO_TOOLS,
  ...MARKETPLACE_TOOLS
];

/**
 * Tool lookup by name (for quick access)
 */
export const TOOL_MAP = new Map<string, Tool>(
  ALL_TOOLS.map(tool => [tool.name, tool])
);

/**
 * Get tool by name
 */
export function getTool(name: string): Tool | undefined {
  return TOOL_MAP.get(name);
}

/**
 * Check if tool exists
 */
export function hasTool(name: string): boolean {
  return TOOL_MAP.has(name);
}

/**
 * Get all tool names
 */
export function getAllToolNames(): string[] {
  return ALL_TOOLS.map(tool => tool.name);
}

/**
 * Export individual tool collections for domain-specific use
 */
export { WALLET_TOOLS, TOKEN_TOOLS, DAO_TOOLS, MARKETPLACE_TOOLS };
