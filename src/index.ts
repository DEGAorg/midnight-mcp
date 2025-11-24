/**
 * Midnight MCP - Main Module Index
 *
 * Professional entry point that exports all public APIs and server components.
 * This package provides:
 * - MCP servers (STDIO and HTTP transports)
 * - REST API server
 * - Service layer components
 * - Utility functions
 */

// ==================== Server Exports ====================
// MCP Servers
import { createServer as createMcpStdioServer } from './mcp/stdio-server.js';
import { startHttpServer as startMcpHttpServer, type HttpServerConfig } from './mcp/http-server.js';
import { MCPServer } from './mcp/mcp-server.js';

// REST API Server
import { createServer as createApiServer } from './api/http-server.js';
import { ApiServer, type ApiServerConfig } from './api/server.js';

// Service Layer
import { WalletOrchestrator, type WalletOrchestratorConfig } from './services/WalletOrchestrator.js';

// Re-export everything
export {
  createMcpStdioServer,
  startMcpHttpServer,
  type HttpServerConfig,
  MCPServer,
  createApiServer,
  ApiServer,
  type ApiServerConfig,
  WalletOrchestrator,
  type WalletOrchestratorConfig
};

// ==================== MCP Components ====================
// Tools
export { ALL_TOOLS } from './mcp/tools/index.js';

// Prompts
export { ALL_PROMPTS } from './mcp/prompts/registry.js';

// Session Management (for HTTP multi-agent support)
export { SessionManager, type SessionManagerConfig } from './mcp/session/index.js';

// ==================== API Components ====================
// Controllers
export {
  WalletController,
  TokenController,
  DaoController,
  MarketplaceController,
} from './api/controllers/index.js';

// Middleware
export {
  ApiError,
  errorHandler,
  requestLogger,
  validateRequest,
} from './api/middleware/index.js';

// Routes
export {
  createApiRoutes,
  successResponse,
  type ApiResponse,
} from './api/routes/index.js';

// ==================== Configuration ====================
export { loadConfig, type AppConfig } from './lib/config/env.js';
export { config } from './lib/config/env.js';

// ==================== Utilities ====================
export { FileManager, FileType } from './lib/utils/file-manager.js';
export { SeedManager } from './lib/utils/seed-manager.js';
export { createLogger } from './lib/logger/index.js';

// ==================== Types ====================
export type { ServiceDependencies } from './mcp/types.js';
export type { ToolDefinition } from './mcp/adapter/types.js';

// ==================== Version Information ====================
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let version = '2.0.0';
try {
  const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8'));
  version = packageJson.version;
} catch {
  // Default version if package.json cannot be read
}

export const VERSION = version;

/**
 * Default export for convenience imports
 */
export default {
  // Servers
  createMcpStdioServer,
  startMcpHttpServer,
  createApiServer,
  // Core classes
  WalletOrchestrator,
  MCPServer,
  ApiServer,
  // Version
  VERSION,
};