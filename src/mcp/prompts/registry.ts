/**
 * Prompt Registry
 *
 * Central registry of all MCP prompts.
 * Prompts are reusable message templates for common tasks.
 */

import type { Prompt } from '@modelcontextprotocol/sdk/types.js';
import { walletPrompts } from './wallet-prompts.js';
import { daoPrompts } from './dao-prompts.js';
import { marketplacePrompts } from './marketplace-prompts.js';

/**
 * All available MCP prompts
 */
export const ALL_PROMPTS: Prompt[] = [
  ...walletPrompts,
  ...daoPrompts,
  ...marketplacePrompts
];

/**
 * Get prompt by name
 */
export function getPrompt(name: string): Prompt | undefined {
  return ALL_PROMPTS.find(p => p.name === name);
}
