/**
 * Prompt Handler
 *
 * Generates contextualized prompt messages for LLMs.
 * Prompts provide templates that include current state/context.
 */

import type { PromptMessage } from '@modelcontextprotocol/sdk/types.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import type { ServiceDependencies } from '../types.js';

export class PromptHandler {
  constructor(private services: ServiceDependencies) {}

  /**
   * Handle GetPrompt request
   */
  async handleGetPrompt(
    name: string,
    args: Record<string, string>
  ): Promise<{ description?: string; messages: PromptMessage[] }> {
    try {
      switch (name) {
        case 'send-funds-prompt':
          return await this.getSendFundsPrompt(args);
        case 'check-balance-prompt':
          return await this.getCheckBalancePrompt();
        case 'transaction-status-prompt':
          return await this.getTransactionStatusPrompt(args);
        case 'wallet-setup-prompt':
          return await this.getWalletSetupPrompt();
        case 'dao-vote-analysis-prompt':
          return await this.getDaoVoteAnalysisPrompt(args);
        case 'dao-create-proposal-prompt':
          return await this.getDaoCreateProposalPrompt(args);
        case 'dao-election-status-prompt':
          return await this.getDaoElectionStatusPrompt(args);
        case 'marketplace-browse-prompt':
          return await this.getMarketplaceBrowsePrompt(args);
        case 'marketplace-item-details-prompt':
          return await this.getMarketplaceItemDetailsPrompt(args);
        default:
          throw new McpError(
            ErrorCode.InvalidRequest,
            `Unknown prompt: ${name}`
          );
      }
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to generate prompt: ${message}`
      );
    }
  }

  /**
   * Send Funds Prompt - Context-aware template for sending funds
   */
  private async getSendFundsPrompt(args: {
    recipient: string;
    amount: string;
  }): Promise<{ description: string; messages: PromptMessage[] }> {
    const { recipient, amount } = args;

    if (!recipient || !amount) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Both recipient and amount are required'
      );
    }

    // Get current wallet status for context
    const isReady = this.services.walletService.isReady();
    const balance = this.services.walletService.getBalance();
    const address = this.services.walletService.getAddress();

    const messages: PromptMessage[] = [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `I want to send ${amount} base units to ${recipient}.`
        }
      },
      {
        role: 'assistant',
        content: {
          type: 'text',
          text: [
            'I can help you send funds. Let me verify a few things:',
            '',
            '**Current Wallet Status:**',
            `- Address: ${address}`,
            `- Balance: ${balance.toString()} base units`,
            `- Ready: ${isReady ? 'Yes' : 'No (wallet syncing)'}`,
            '',
            '**Transaction Details:**',
            `- Recipient: ${recipient}`,
            `- Amount: ${amount} base units`,
            '',
            'Please confirm:',
            '1. Is the recipient address correct?',
            '2. Is the amount correct?',
            '3. Do you have sufficient balance?',
            '',
            isReady
              ? "If everything looks good, I'll use the 'send' tool to execute this transaction."
              : '⚠️ Note: Wallet is still syncing. Please wait for sync to complete before sending funds.'
          ].join('\n')
        }
      }
    ];

    return {
      description: 'Send funds with validation and confirmation',
      messages
    };
  }

  /**
   * Check Balance Prompt
   */
  private async getCheckBalancePrompt(): Promise<{ description: string; messages: PromptMessage[] }> {
    const isReady = this.services.walletService.isReady();
    const balance = this.services.walletService.getBalance();
    const address = this.services.walletService.getAddress();
    const syncProgress = this.services.walletService.getSyncProgress();

    const messages: PromptMessage[] = [
      {
        role: 'user',
        content: {
          type: 'text',
          text: 'What is my wallet balance?'
        }
      },
      {
        role: 'assistant',
        content: {
          type: 'text',
          text: [
            '**Wallet Balance:**',
            '',
            `**Native DUST:** ${balance.toString()} base units`,
            '',
            `**Wallet Status:** ${isReady ? 'Ready ✅' : 'Syncing ⏳'}`,
            syncProgress.synced ? '' : `**Sync Progress:** ${syncProgress.syncPercentage}%`,
            `**Address:** ${address}`,
            '',
            'Note: 1 DUST = 1,000,000 base units'
          ].filter(Boolean).join('\n')
        }
      }
    ];

    return {
      description: 'Check wallet balance with detailed information',
      messages
    };
  }

  /**
   * Transaction Status Prompt
   */
  private async getTransactionStatusPrompt(args: {
    transactionId: string;
  }): Promise<{ description: string; messages: PromptMessage[] }> {
    const { transactionId } = args;

    if (!transactionId) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Transaction ID is required'
      );
    }

    const messages: PromptMessage[] = [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `What is the status of transaction ${transactionId}?`
        }
      },
      {
        role: 'assistant',
        content: {
          type: 'text',
          text: [
            `I'll check the status of transaction ${transactionId}.`,
            '',
            `Use the 'getTransaction' tool to retrieve the current status.`
          ].join('\n')
        }
      }
    ];

    return {
      description: 'Check transaction status',
      messages
    };
  }

  /**
   * Wallet Setup Prompt
   */
  private async getWalletSetupPrompt(): Promise<{ description: string; messages: PromptMessage[] }> {
    const isReady = this.services.walletService.isReady();
    const syncProgress = this.services.walletService.getSyncProgress();

    const messages: PromptMessage[] = [
      {
        role: 'user',
        content: {
          type: 'text',
          text: 'Help me set up my wallet'
        }
      },
      {
        role: 'assistant',
        content: {
          type: 'text',
          text: [
            '**Wallet Setup Guide**',
            '',
            `**Current Status:** ${isReady ? 'Wallet is ready! ✅' : 'Wallet is syncing... ⏳'}`,
            '',
            isReady ? [
              '✅ Your wallet is set up and ready to use!',
              '',
              '**What you can do:**',
              "1. Check your balance: Use 'check-balance-prompt'",
              "2. Send funds: Use 'send-funds-prompt'",
              "3. View transactions: Use 'getTransaction' tool",
              "4. Check wallet status: Use 'walletStatus' tool"
            ].join('\n') : [
              '⏳ Your wallet is currently syncing with the blockchain.',
              '',
              `**Sync Progress:** ${syncProgress.syncPercentage}%`,
              `**Apply Gap:** ${syncProgress.applyGap.toString()}`,
              `**Source Gap:** ${syncProgress.sourceGap.toString()}`,
              '',
              '**This usually takes:** 1-2 minutes',
              '',
              "Check back in a moment using 'walletStatus' tool."
            ].join('\n')
          ].join('\n')
        }
      }
    ];

    return {
      description: 'Guide for wallet setup and verification',
      messages
    };
  }

  /**
   * DAO Vote Analysis Prompt
   */
  private async getDaoVoteAnalysisPrompt(args: {
    electionId: string;
    voteChoice?: string;
  }): Promise<{ description: string; messages: PromptMessage[] }> {
    const { electionId, voteChoice } = args;

    if (!electionId) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Election ID is required'
      );
    }

    const messages: PromptMessage[] = [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `I'm considering voting "${voteChoice || 'undecided'}" on DAO election ${electionId}. Can you help me analyze this?`
        }
      },
      {
        role: 'assistant',
        content: {
          type: 'text',
          text: [
            `I'll help you analyze DAO election ${electionId}.`,
            '',
            `First, let me retrieve the election details using the 'getDaoElection' tool.`,
            '',
            'I can help you understand:',
            '1. What this proposal is about',
            '2. Current voting status',
            '3. Your voting power',
            '4. Potential implications of your vote'
          ].join('\n')
        }
      }
    ];

    return {
      description: 'Analyze DAO proposal before voting',
      messages
    };
  }

  /**
   * DAO Create Proposal Prompt
   */
  private async getDaoCreateProposalPrompt(args: {
    topic: string;
  }): Promise<{ description: string; messages: PromptMessage[] }> {
    const { topic } = args;

    if (!topic) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Proposal topic is required'
      );
    }

    const messages: PromptMessage[] = [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `I want to create a DAO proposal about: ${topic}`
        }
      },
      {
        role: 'assistant',
        content: {
          type: 'text',
          text: [
            "I'll help you create a DAO proposal.",
            '',
            '**Proposal Topic:**',
            topic,
            '',
            '**Next Steps:**',
            "1. Set an end timestamp for voting (use 'openDaoElection' tool)",
            '2. Ensure you have voting tokens registered',
            '3. Share the election ID with DAO members',
            '',
            'Would you like to proceed with creating this election?'
          ].join('\n')
        }
      }
    ];

    return {
      description: 'Guide for creating a new DAO proposal',
      messages
    };
  }

  /**
   * DAO Election Status Prompt
   */
  private async getDaoElectionStatusPrompt(args: {
    electionId: string;
  }): Promise<{ description: string; messages: PromptMessage[] }> {
    const { electionId } = args;

    if (!electionId) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Election ID is required'
      );
    }

    const messages: PromptMessage[] = [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `What is the current status of DAO election ${electionId}?`
        }
      },
      {
        role: 'assistant',
        content: {
          type: 'text',
          text: `I'll retrieve the status of election ${electionId} using the 'getDaoElection' tool.`
        }
      }
    ];

    return {
      description: 'Check current status of a DAO election',
      messages
    };
  }

  /**
   * Marketplace Browse Prompt
   */
  private async getMarketplaceBrowsePrompt(args: {
    status?: string;
  }): Promise<{ description: string; messages: PromptMessage[] }> {
    const { status } = args;

    const messages: PromptMessage[] = [
      {
        role: 'user',
        content: {
          type: 'text',
          text: status
            ? `Show me ${status} marketplace items`
            : 'Show me available marketplace items'
        }
      },
      {
        role: 'assistant',
        content: {
          type: 'text',
          text: [
            "I'll browse the marketplace for you.",
            '',
            status ? `**Filter:** ${status} items only` : '**Showing:** All items',
            '',
            `Using the 'listMarketplaceItems' tool to fetch items...`
          ].join('\n')
        }
      }
    ];

    return {
      description: 'Browse available marketplace items',
      messages
    };
  }

  /**
   * Marketplace Item Details Prompt
   */
  private async getMarketplaceItemDetailsPrompt(args: {
    itemId: string;
  }): Promise<{ description: string; messages: PromptMessage[] }> {
    const { itemId } = args;

    if (!itemId) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Item ID is required'
      );
    }

    const messages: PromptMessage[] = [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `Show me details about marketplace item ${itemId}`
        }
      },
      {
        role: 'assistant',
        content: {
          type: 'text',
          text: `I'll retrieve the details for item ${itemId} from the marketplace.`
        }
      }
    ];

    return {
      description: 'View detailed information about a marketplace item',
      messages
    };
  }
}
