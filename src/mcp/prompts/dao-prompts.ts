/**
 * DAO Prompts
 *
 * Pre-defined message templates for DAO governance operations.
 */

import type { Prompt } from '@modelcontextprotocol/sdk/types.js';

export const daoPrompts: Prompt[] = [
  {
    name: 'dao-vote-analysis-prompt',
    description: 'Analyze a DAO proposal before voting',
    arguments: [
      {
        name: 'electionId',
        description: 'Election ID to analyze',
        required: true
      },
      {
        name: 'voteChoice',
        description: 'Intended vote (yes, no, or absence)',
        required: false
      }
    ]
  },
  {
    name: 'dao-create-proposal-prompt',
    description: 'Guide for creating a new DAO proposal',
    arguments: [
      {
        name: 'topic',
        description: 'Proposal topic or description',
        required: true
      }
    ]
  },
  {
    name: 'dao-election-status-prompt',
    description: 'Check current status of a DAO election',
    arguments: [
      {
        name: 'electionId',
        description: 'Election ID to check',
        required: true
      }
    ]
  }
];
