/**
 * Wallet Resources
 *
 * Defines read-only resources for wallet data.
 * Resources are used for static/cached data that's expensive to compute.
 */

import type { Resource } from '@modelcontextprotocol/sdk/types.js';

export const walletResources: Resource[] = [
  {
    uri: 'midnight://wallet/status',
    name: 'Wallet Status',
    description: 'Current wallet synchronization status and readiness',
    mimeType: 'application/json'
  },
  {
    uri: 'midnight://wallet/balance',
    name: 'Wallet Balance',
    description: 'Native token balance and all registered token balances',
    mimeType: 'application/json'
  },
  {
    uri: 'midnight://wallet/address',
    name: 'Wallet Address',
    description: 'Current wallet address (Bech32m format)',
    mimeType: 'text/plain'
  },
  {
    uri: 'midnight://wallet/sync-progress',
    name: 'Wallet Sync Progress',
    description: 'Detailed synchronization progress with blockchain',
    mimeType: 'application/json'
  }
];
