import {
  Server
} from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  McpError,
  ErrorCode,
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import { 
  WalletServiceMCP as MidnightMCPServer,
  WalletServiceError as MidnightMCPError
} from './mcp/index.js';
import { config } from './config.js';
import { ALL_TOOLS, handleToolCall } from './tools.js';
import { handleListResources, handleReadResource } from './resources.js';
import { SeedManager } from './utils/seed-manager.js';

/**
 * Simple logging function
 */
function log(...args: any[]) {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}]`, ...args);
}

/**
 * Format error for logging
 */
function formatError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  return String(error);
}

/**
 * Initialize Midnight wallet instance
 */
const externalConfig = {
  proofServer: config.proofServer,
  indexer: config.indexer,
  indexerWS: config.indexerWS,
  node: config.node,
  useExternalProofServer: config.useExternalProofServer,
  networkId: config.networkId
};

// Get agent ID from environment
const agentId = process.env.AGENT_ID;
if (!agentId) {
  throw new Error('AGENT_ID environment variable is required');
}

// Get seed from file
let seed: string;
try {
  seed = SeedManager.getAgentSeed(agentId);
  log('Seed loaded from file for agent:', agentId);
} catch (error) {
  log('Failed to load seed from file:', error);
  throw new Error('Seed file not found. Please ensure the seed file exists for this agent.');
}

// Initialize Midnight wallet instance
const midnightServer = new MidnightMCPServer(
  config.networkId,
  seed,
  config.walletFilename,
  externalConfig
);

/**
 * Create and configure MCP server
 */
export function createServer() {
  log("Creating Midnight MCP server");

  // Create server instance
  const server = new Server({
    name: "midnight-mcp-server",
    version: "1.0.0"
  }, {
    capabilities: {
      resources: {},
      tools: {}
    }
  });

  // Set up request handlers
  setupRequestHandlers(server);

  // Create STDIO transport
  const transport = new StdioServerTransport();

  return {
    start: async () => {
      try {
        await server.connect(transport);
        log("Server started successfully");
      } catch (error) {
        log("Failed to start server:", error);
        throw error;
      }
    },
    stop: async () => {
      try {
        await server.close();
        await midnightServer.close();
        log("Server stopped");
      } catch (error) {
        log("Error stopping server:", error);
      }
    }
  };
}

/**
 * Helper function to handle errors uniformly
 */
function handleError(context: string, error: unknown): never {
  log(`Error ${context}:`, error);

  if (error instanceof McpError) {
    throw error;
  }

  // Handle Midnight MCP errors
  if (error instanceof MidnightMCPError) {
    throw new McpError(
      ErrorCode.InternalError,
      `Midnight MCP Error (${error.type}): ${error.message}`
    );
  }

  throw new McpError(
    ErrorCode.InternalError,
    `${context}: ${formatError(error)}`
  );
}

/**
 * Set up server request handlers
 */
function setupRequestHandlers(server: Server) {
  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      const toolName = request.params.name;
      const toolArgs = request.params.arguments;

      log(`Tool call received: ${toolName}`);
      return await handleToolCall(toolName, toolArgs, midnightServer, log);
    } catch (error) {
      return handleError("handling tool call", error);
    }
  });

  // Handle resource listing
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    try {
      return { resources: handleListResources() };
    } catch (error) {
      return handleError("listing resources", error);
    }
  });

  // Handle resource reading
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    try {
      const resourceUri = request.params.uri;
      const resource = handleReadResource(resourceUri);
      
      return {
        contents: [{
          uri: resourceUri,
          mimeType: resource.mimeType || "application/json",
          text: JSON.stringify(resource)
        }]
      };
    } catch (error) {
      handleError("reading resource", error);
    }
  });

  // Handle tool listing
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    try {
      return { tools: ALL_TOOLS };
    } catch (error) {
      return handleError("listing tools", error);
    }
  });

  // Handle global errors
  process.on("uncaughtException", (error) => {
    log("Uncaught exception:", error);
  });

  process.on("unhandledRejection", (reason) => {
    log("Unhandled rejection:", reason);
  });
}

/**
 * Set up process exit signal handlers
 */
function setupExitHandlers(server: any) {
  const exitHandler = async () => {
    log("Shutting down server...");
    await server.stop();
    process.exit(0);
  };

  // Handle various exit signals
  process.on("SIGINT", exitHandler);
  process.on("SIGTERM", exitHandler);
  process.on("SIGUSR1", exitHandler);
  process.on("SIGUSR2", exitHandler);
}

/**
 * Main function - Program entry point
 */
async function main() {
  try {
    log("Starting Midnight MCP server");
    const server = createServer();
    
    // Start server
    await server.start();
    log("Server started successfully");
    
    // Handle process exit signals
    setupExitHandlers(server);
  } catch (error) {
    log("Failed to start server:", error);
    process.exit(1);
  }
}

// Run the main function if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    log("Fatal error:", error);
    process.exit(1);
  });
}
