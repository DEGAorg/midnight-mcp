/**
 * MCP Module Exports
 *
 * Central export file for all MCP components.
 *
 * NEW: Using tool adapter pattern - handlers no longer needed
 */

// Server
export { MCPServer } from './server.js';

// Adapter
export { createToolAdapter } from './adapter/tool-adapter.js';
export type { ToolAdapter, ToolDefinition } from './adapter/types.js';

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
