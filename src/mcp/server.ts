/**
 * MCP Server - Main server class coordinating all handlers
 *
 * Implements the handler-based architecture with direct service integration.
 * NO HTTP layer - handlers call services directly.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  type CallToolRequest,
  type ListToolsRequest,
  type ListResourcesRequest,
  type ReadResourceRequest,
  type ListPromptsRequest,
  type GetPromptRequest
} from '@modelcontextprotocol/sdk/types.js';

import type { ServiceDependencies, ToolResponse } from './types.js';
import { WalletHandler } from './handlers/wallet-handler.js';
import { TokenHandler } from './handlers/token-handler.js';
import { DaoHandler } from './handlers/dao-handler.js';
import { MarketplaceHandler } from './handlers/marketplace-handler.js';
import { ResourceHandler } from './handlers/resource-handler.js';
import { PromptHandler } from './handlers/prompt-handler.js';
import { ALL_TOOLS, getTool } from './tools/index.js';
import { ALL_RESOURCES } from './resources/registry.js';
import { ALL_PROMPTS } from './prompts/registry.js';

/**
 * MCPServer
 *
 * Coordinates MCP protocol handling with domain-specific handlers.
 * Architecture: MCP Server → Domain Handlers → Services
 *
 * Benefits:
 * - No HTTP overhead
 * - Direct service integration
 * - Clean domain separation
 * - Fully testable
 */
export class MCPServer {
  private server: McpServer;
  private walletHandler: WalletHandler;
  private tokenHandler: TokenHandler;
  private daoHandler: DaoHandler;
  private marketplaceHandler: MarketplaceHandler;
  private resourceHandler: ResourceHandler;
  private promptHandler: PromptHandler;

  constructor(
    private services: ServiceDependencies,
    serverInfo: { name: string; version: string }
  ) {
    // Initialize MCP server (using McpServer from SDK)
    this.server = new McpServer(serverInfo);

    // Initialize domain handlers
    this.walletHandler = new WalletHandler(services);
    this.tokenHandler = new TokenHandler(services);
    this.daoHandler = new DaoHandler(services);
    this.marketplaceHandler = new MarketplaceHandler(services);
    this.resourceHandler = new ResourceHandler(services);
    this.promptHandler = new PromptHandler(services);

    // Setup request handlers
    this.setupHandlers();
  }

  /**
   * Setup MCP request handlers
   */
  private setupHandlers(): void {
    // Handle tool listing
    this.server.setRequestHandler(
      ListToolsRequestSchema,
      async (_request: ListToolsRequest) => {
        return {
          tools: ALL_TOOLS
        };
      }
    );

    // Handle tool calls
    this.server.setRequestHandler(
      CallToolRequestSchema,
      async (request: CallToolRequest) => {
        return this.handleToolCall(request);
      }
    );

    // Handle resource listing
    this.server.setRequestHandler(
      ListResourcesRequestSchema,
      async (_request: ListResourcesRequest) => {
        return {
          resources: ALL_RESOURCES
        };
      }
    );

    // Handle resource reads
    this.server.setRequestHandler(
      ReadResourceRequestSchema,
      async (request: ReadResourceRequest) => {
        const { uri } = request.params;
        return await this.resourceHandler.handleReadResource(uri);
      }
    );

    // Handle prompt listing
    this.server.setRequestHandler(
      ListPromptsRequestSchema,
      async (_request: ListPromptsRequest) => {
        return {
          prompts: ALL_PROMPTS
        };
      }
    );

    // Handle prompt requests
    this.server.setRequestHandler(
      GetPromptRequestSchema,
      async (request: GetPromptRequest) => {
        const { name, arguments: args } = request.params;
        return await this.promptHandler.handleGetPrompt(name, args || {});
      }
    );
  }

  /**
   * Route tool call to appropriate handler
   */
  private async handleToolCall(request: CallToolRequest): Promise<ToolResponse> {
    const { name, arguments: args } = request.params;

    // Verify tool exists
    const tool = getTool(name);
    if (!tool) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: true,
            message: `Unknown tool: ${name}`
          })
        }],
        isError: true
      };
    }

    // Route to appropriate handler based on tool name prefix
    try {
      if (this.isWalletTool(name)) {
        return await this.walletHandler.handle(name, args);
      } else if (this.isTokenTool(name)) {
        return await this.tokenHandler.handle(name, args);
      } else if (this.isDaoTool(name)) {
        return await this.daoHandler.handle(name, args);
      } else if (this.isMarketplaceTool(name)) {
        return await this.marketplaceHandler.handle(name, args);
      } else {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              error: true,
              message: `No handler found for tool: ${name}`
            })
          }],
          isError: true
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: true,
            message: 'Tool execution failed',
            details: errorMessage
          })
        }],
        isError: true
      };
    }
  }

  /**
   * Tool classification helpers
   */
  private isWalletTool(name: string): boolean {
    return [
      'walletStatus',
      'walletAddress',
      'walletBalance',
      'send',
      'sendAndWait',
      'getTransaction'
    ].includes(name);
  }

  private isTokenTool(name: string): boolean {
    return [
      'getTokenBalance',
      'registerToken',
      'sendToken',
      'listTokens'
    ].includes(name);
  }

  private isDaoTool(name: string): boolean {
    return [
      'getDaoConfig',
      'openDaoElection',
      'castDaoVote',
      'getDaoElection',
      'listDaoElections',
      'getVotingPower',
      'closeDaoElection'
    ].includes(name);
  }

  private isMarketplaceTool(name: string): boolean {
    return [
      'getMarketplaceConfig',
      'listMarketplaceItems'
    ].includes(name);
  }

  /**
   * Get the underlying MCP Server instance
   */
  getServer(): McpServer {
    return this.server;
  }
}
