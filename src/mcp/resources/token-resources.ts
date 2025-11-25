/**
 * Token Resources
 *
 * Defines read-only resources for token data.
 */

import type { Resource } from '@modelcontextprotocol/sdk/types.js';

export const tokenResources: Resource[] = [
  {
    uri: 'midnight://tokens/registered',
    name: 'Registered Tokens',
    description: 'List of all registered shielded tokens',
    mimeType: 'application/json'
  },
  {
    uri: 'midnight://tokens/balances',
    name: 'Token Balances',
    description: 'Balances for all registered tokens',
    mimeType: 'application/json'
  }
];
