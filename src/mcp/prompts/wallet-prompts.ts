/**
 * Wallet Prompts
 *
 * Pre-defined message templates for common wallet operations.
 * Prompts help guide LLMs to accomplish specific tasks correctly.
 */

import type { Prompt } from '@modelcontextprotocol/sdk/types.js';

export const walletPrompts: Prompt[] = [
  {
    name: 'send-funds-prompt',
    description: 'Template for sending funds with proper validation and confirmation',
    arguments: [
      {
        name: 'recipient',
        description: 'Recipient wallet address (Bech32m format)',
        required: true
      },
      {
        name: 'amount',
        description: 'Amount to send in base units (1 DUST = 1e6 base units)',
        required: true
      }
    ]
  },
  {
    name: 'check-balance-prompt',
    description: 'Template for checking wallet balance with detailed context',
    arguments: []
  },
  {
    name: 'transaction-status-prompt',
    description: 'Template for checking transaction status with user-friendly formatting',
    arguments: [
      {
        name: 'transactionId',
        description: 'Transaction ID to check',
        required: true
      }
    ]
  },
  {
    name: 'wallet-setup-prompt',
    description: 'Guide user through wallet setup and verification',
    arguments: []
  }
];
