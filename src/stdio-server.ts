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
  WalletServiceError as MidnightMCPError
} from './mcp/index.js';
import { ALL_TOOLS, handleToolCall } from './tools.js';
import { handleListResources, handleReadResource } from './resources.js';

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
  /* istanbul ignore next */
  return String(error);
}

/**
 * Create and configure MCP server
 */
export function createServer() {
  log("Creating Midnight MCP server");

  // Get agent ID from environment
  const agentId = process.env.AGENT_ID;
  if (!agentId) {
    throw new Error('AGENT_ID environment variable is required');
  }

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
        log("Server created successfully");
      } catch (error) {
        log("Failed to start server:", error);
        throw error;
      }
    },
    stop: async () => {
      try {
        await server.close();
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
      return await handleToolCall(toolName, toolArgs, log);
    } catch (error) {
      /* istanbul ignore next */
      return handleError("handling tool call", error);
    }
  });

  // Handle resource listing
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    try {
      return { resources: handleListResources() };
    } catch (error) {
      /* istanbul ignore next */
      return handleError("listing resources", error);
    }
  });

  // Handle resource reading
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    try {
      const resourceUri = request.params.uri;
      const resource = handleReadResource(resourceUri);
      
      /* istanbul ignore next */
      return {
        contents: [{
          uri: resourceUri,
          mimeType: resource.mimeType || "application/json",
          text: JSON.stringify(resource)
        }]
      };
    } catch (error) {
      /* istanbul ignore next */
      handleError("reading resource", error);
    }
  });

  // Handle tool listing
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    try {
      return { tools: ALL_TOOLS };
    } catch (error) {
      /* istanbul ignore next */
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
/* istanbul ignore next */
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
/* istanbul ignore next */
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
/* istanbul ignore next */
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    log("Fatal error:", error);
    process.exit(1);
  });
}
