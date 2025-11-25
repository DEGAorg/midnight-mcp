/**
 * Marketplace Prompts
 *
 * Pre-defined message templates for marketplace operations.
 */

import type { Prompt } from '@modelcontextprotocol/sdk/types.js';

export const marketplacePrompts: Prompt[] = [
  {
    name: 'marketplace-browse-prompt',
    description: 'Browse available marketplace items with filtering',
    arguments: [
      {
        name: 'status',
        description: 'Filter by status (active, sold, cancelled)',
        required: false
      }
    ]
  },
  {
    name: 'marketplace-item-details-prompt',
    description: 'View detailed information about a marketplace item',
    arguments: [
      {
        name: 'itemId',
        description: 'Item ID to view',
        required: true
      }
    ]
  }
];
