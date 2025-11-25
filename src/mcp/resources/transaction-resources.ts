/**
 * Transaction Resources
 *
 * Defines read-only resources for transaction data.
 */

import type { Resource } from '@modelcontextprotocol/sdk/types.js';

export const transactionResources: Resource[] = [
  {
    uri: 'midnight://transactions/pending',
    name: 'Pending Transactions',
    description: 'List of all pending transactions (INITIATED or SENT state)',
    mimeType: 'application/json'
  },
  {
    uri: 'midnight://transactions/recent',
    name: 'Recent Transactions',
    description: 'Recent transaction history (last 50 transactions)',
    mimeType: 'application/json'
  },
  {
    uri: 'midnight://transactions/all',
    name: 'All Transactions',
    description: 'Complete transaction history',
    mimeType: 'application/json'
  }
];
