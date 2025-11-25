/**
 * Prompt Generator
 *
 * Generates dynamic prompt messages with argument substitution.
 * Each prompt has a template that incorporates the provided arguments.
 */

import type { Prompt } from '@modelcontextprotocol/sdk/types.js';

/**
 * Prompt templates keyed by prompt name
 * Templates use {{argName}} syntax for substitution
 */
const PROMPT_TEMPLATES: Record<string, string> = {
  // Wallet prompts
  'send-funds-prompt': `You are helping the user send funds on the Midnight blockchain.

**Task:** Send {{amount}} base units to {{recipient}}

Please:
1. First verify the recipient address format (should be Bech32m)
2. Check the current wallet balance to ensure sufficient funds
3. Execute the transfer using the send_funds tool
4. Report the transaction result with the transaction ID

Note: 1 DUST = 1,000,000 base units`,

  'check-balance-prompt': `You are helping the user check their Midnight wallet balance.

**Task:** Check the current wallet balance

Please:
1. Use the get_balance tool to retrieve the current balance
2. Show both the raw value (in base units) and the human-readable value (in DUST)
3. If the balance is zero, suggest how the user can obtain testnet tokens`,

  'transaction-status-prompt': `You are helping the user check the status of a transaction.

**Task:** Check status of transaction {{transactionId}}

Please:
1. Use the get_transaction_status tool with the provided transaction ID
2. Report the current status (pending, confirmed, failed)
3. If confirmed, show the block number and any relevant details
4. If failed, explain what might have gone wrong`,

  'wallet-setup-prompt': `You are helping the user set up and verify their Midnight wallet.

**Task:** Guide the user through wallet setup and verification

Please:
1. Check wallet status using get_wallet_status tool
2. If not connected, explain the connection process
3. Show the wallet address using get_address tool
4. Verify the wallet can interact with the network
5. Explain how to back up the wallet seed securely`,

  // DAO prompts
  'dao-vote-analysis-prompt': `You are helping the user analyze a DAO proposal before voting.

**Task:** Analyze election {{electionId}}{{voteChoice}}

Please:
1. Use get_election_info to retrieve election details
2. Summarize the proposal and what it aims to achieve
3. Show current voting results (if available)
4. Explain the implications of each voting option
5. If a vote choice was specified, explain what that vote means`,

  'dao-create-proposal-prompt': `You are helping the user create a new DAO proposal.

**Task:** Create a proposal about: {{topic}}

Please:
1. Check the user's voting power using get_voter_info
2. Explain the proposal creation process and requirements
3. Help structure the proposal clearly
4. Use create_election to submit when ready
5. Provide the election ID for tracking`,

  'dao-election-status-prompt': `You are checking the status of a DAO election.

**Task:** Check status of election {{electionId}}

Please:
1. Use get_election_info to retrieve current status
2. Show voting progress and current results
3. Display time remaining (if applicable)
4. List the voting options and their current support
5. Explain what happens when the election concludes`,

  // Marketplace prompts
  'marketplace-browse-prompt': `You are helping the user browse marketplace items.

**Task:** Browse marketplace items{{status}}

Please:
1. Use list_marketplace_items to retrieve available items
2. Format results in a clear, readable table
3. Show key details: ID, name, price, seller, status
4. Provide filtering suggestions if many results
5. Explain how to view more details about specific items`,

  'marketplace-item-details-prompt': `You are helping the user view details of a marketplace item.

**Task:** View details for item {{itemId}}

Please:
1. Use get_marketplace_item to retrieve full details
2. Show: name, description, price, seller address
3. Display item status (active, sold, cancelled)
4. If active, explain how to purchase
5. If sold, show transaction history if available`
};

/**
 * Validate that all required arguments are provided
 *
 * @param prompt - The prompt definition
 * @param args - The provided arguments
 * @returns Error message if validation fails, undefined if valid
 */
export function validatePromptArguments(
  prompt: Prompt,
  args: Record<string, unknown>
): string | undefined {
  if (!prompt.arguments || prompt.arguments.length === 0) {
    return undefined;
  }

  const missingRequired: string[] = [];

  for (const arg of prompt.arguments) {
    if (arg.required && !(arg.name in args)) {
      missingRequired.push(arg.name);
    }
  }

  if (missingRequired.length > 0) {
    return `Missing required arguments: ${missingRequired.join(', ')}`;
  }

  return undefined;
}

/**
 * Generate prompt message with argument substitution
 *
 * @param prompt - The prompt definition
 * @param args - The provided arguments
 * @returns Generated message with arguments substituted
 */
export function generatePromptMessage(
  prompt: Prompt,
  args: Record<string, unknown>
): string {
  const template = PROMPT_TEMPLATES[prompt.name];

  if (!template) {
    // Fallback for prompts without templates
    return generateFallbackMessage(prompt, args);
  }

  // Substitute arguments into template
  let message = template;

  // Replace all {{argName}} placeholders
  for (const [key, value] of Object.entries(args)) {
    const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    message = message.replace(placeholder, String(value));
  }

  // Handle optional arguments that weren't provided
  // For example, {{voteChoice}} becomes empty or a contextual phrase
  if (prompt.arguments) {
    for (const arg of prompt.arguments) {
      const placeholder = new RegExp(`\\{\\{${arg.name}\\}\\}`, 'g');
      if (message.includes(`{{${arg.name}}}`)) {
        // Replace unsubstituted optional args with empty or contextual text
        message = message.replace(placeholder, '');
      }
    }
  }

  // Clean up any double spaces from removed placeholders
  message = message.replace(/\s{2,}/g, ' ').trim();

  return message;
}

/**
 * Generate fallback message for prompts without templates
 *
 * @param prompt - The prompt definition
 * @param args - The provided arguments
 * @returns Fallback message
 */
function generateFallbackMessage(
  prompt: Prompt,
  args: Record<string, unknown>
): string {
  let message = `**${prompt.name}**\n\n${prompt.description || 'Execute this prompt.'}`;

  if (Object.keys(args).length > 0) {
    message += '\n\n**Arguments:**\n';
    for (const [key, value] of Object.entries(args)) {
      message += `- ${key}: ${String(value)}\n`;
    }
  }

  return message;
}
