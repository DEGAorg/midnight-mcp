/**
 * MCP Module Exports
 *
 * Central export file for all MCP components.
 */

// Server
export { MCPServer } from './server.js';

// Handlers
export { WalletHandler } from './handlers/wallet-handler.js';
export { TokenHandler } from './handlers/token-handler.js';
export { DaoHandler } from './handlers/dao-handler.js';
export { MarketplaceHandler } from './handlers/marketplace-handler.js';
export { ResourceHandler } from './handlers/resource-handler.js';
export { PromptHandler } from './handlers/prompt-handler.js';

// Tools
export {
  ALL_TOOLS,
  getTool,
  hasTool,
  getAllToolNames,
  WALLET_TOOLS,
  TOKEN_TOOLS,
  DAO_TOOLS,
  MARKETPLACE_TOOLS
} from './tools/index.js';

// Resources
export { ALL_RESOURCES, getResource } from './resources/registry.js';

// Prompts
export { ALL_PROMPTS, getPrompt } from './prompts/registry.js';

// Types
export type { ServiceDependencies, ToolResponse } from './types.js';
