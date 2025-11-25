/**
 * MCP Module Exports
 *
 * Central export file for all MCP components.
 *
 * NEW: Using tool adapter pattern - handlers no longer needed
 * NEW: SessionManager for multi-agent support
 * NEW: HTTP server with StreamableHTTP transport for 100+ concurrent agents
 */

// Servers
export { MCPServer } from './mcp-server.js';
export { startHttpServer, type HttpServerConfig } from './http-server.js';

// Session Management
export { SessionManager } from './session/index.js';
export type {
  Session,
  SessionManagerConfig,
  CreateSessionOptions,
  SessionStats
} from './session/index.js';

// Middleware
export {
  corsMiddleware,
  requestLoggerMiddleware,
  requestTimeoutMiddleware,
  errorHandlerMiddleware,
  notFoundMiddleware
} from './middleware/index.js';

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
export { ALL_RESOURCES, getResource } from './resources/index.js';

// Prompts
export { ALL_PROMPTS, getPrompt } from './prompts/registry.js';

// Types
export type { ServiceDependencies, ToolResponse } from './types.js';
