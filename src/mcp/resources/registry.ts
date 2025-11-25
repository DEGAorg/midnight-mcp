/**
 * Resource Registry
 *
 * Central registry of all MCP resources.
 * Resources are READ-ONLY data sources (wallet status, transactions, etc.)
 */

import type { Resource } from '@modelcontextprotocol/sdk/types.js';
import { walletResources } from './wallet-resources.js';
import { transactionResources } from './transaction-resources.js';
import { tokenResources } from './token-resources.js';

/**
 * All available MCP resources
 */
export const ALL_RESOURCES: Resource[] = [
  ...walletResources,
  ...transactionResources,
  ...tokenResources
];

/**
 * Get resource by URI
 */
export function getResource(uri: string): Resource | undefined {
  return ALL_RESOURCES.find(r => r.uri === uri);
}
