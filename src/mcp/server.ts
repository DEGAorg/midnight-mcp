/**
 * MCP Server - Main server class coordinating all handlers
 *
 * NEW ARCHITECTURE: Uses tool adapter pattern instead of switch statements.
 * NO HTTP layer - tools call services directly via adapter.
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
import { createToolAdapter } from './adapter/tool-adapter.js';
import type { ToolAdapter } from './adapter/types.js';
import { ALL_RESOURCES } from './resources/registry.js';
import { ALL_PROMPTS } from './prompts/registry.js';

/**
 * MCPServer
 *
 * Coordinates MCP protocol handling with tool adapter.
 * Architecture: MCP Server → Tool Adapter → Tools → Services
 *
 * Benefits:
 * - No HTTP overhead
 * - No switch statements (tools route themselves)
 * - Direct service integration
 * - Clean domain separation
 * - Fully testable
 */
export class MCPServer {
  private mcpServer: McpServer;
  private toolAdapter?: ToolAdapter;

  constructor(
    private services: ServiceDependencies,
    serverInfo: { name: string; version: string }
  ) {
    // Initialize MCP server (using McpServer from SDK)
    this.mcpServer = new McpServer(serverInfo);

    // Setup request handlers (async, toolAdapter created here)
    void this.setupHandlers();
  }

  /**
   * Setup MCP request handlers with tool adapter
   */
  private async setupHandlers(): Promise<void> {
    // Create tool adapter with service injection
    this.toolAdapter = await createToolAdapter(this.services);

    console.error('[MCPServer] Tool adapter created with', this.toolAdapter.listOfTools().length, 'tools');

    // Use underlying Server instance for advanced request handling
    const server = this.mcpServer.server;

    // Handle tool listing
    server.setRequestHandler(
      ListToolsRequestSchema,
      async (_request: ListToolsRequest) => {
        if (!this.toolAdapter) {
          throw new Error('Tool adapter not initialized');
        }
        return {
          tools: this.toolAdapter.listOfTools()
        };
      }
    );

    // Handle tool calls via adapter (no switch statement!)
    server.setRequestHandler(
      CallToolRequestSchema,
      async (request: CallToolRequest) => {
        if (!this.toolAdapter) {
          throw new Error('Tool adapter not initialized');
        }
        const { name, arguments: args } = request.params;
        return await this.toolAdapter.toolHandler(name, args);
      }
    );

    // Handle resource listing
    server.setRequestHandler(
      ListResourcesRequestSchema,
      async (_request: ListResourcesRequest) => {
        return {
          resources: ALL_RESOURCES
        };
      }
    );

    // Handle resource reads
    server.setRequestHandler(
      ReadResourceRequestSchema,
      async (request: ReadResourceRequest) => {
        const { uri } = request.params;
        return await this.handleReadResource(uri);
      }
    );

    // Handle prompt listing
    server.setRequestHandler(
      ListPromptsRequestSchema,
      async (_request: ListPromptsRequest) => {
        return {
          prompts: ALL_PROMPTS
        };
      }
    );

    // Handle prompt requests
    server.setRequestHandler(
      GetPromptRequestSchema,
      async (request: GetPromptRequest) => {
        const { name, arguments: args } = request.params;
        return await this.handleGetPrompt(name, args || {});
      }
    );
  }

  /**
   * Handle prompt requests
   */
  private async handleGetPrompt(name: string, args: Record<string, unknown>) {
    const prompt = ALL_PROMPTS.find(p => p.name === name);

    if (!prompt) {
      throw new Error(`Unknown prompt: ${name}`);
    }

    // For now, return basic prompt structure
    //TODO: Implement dynamic argument substitution
    // This can be enhanced with dynamic argument substitution later
    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: prompt.description || `Prompt: ${name}`
          }
        }
      ]
    };
  }

  /**
   * Handle resource reads
   */
  private async handleReadResource(uri: string) {
    const resource = ALL_RESOURCES.find(r => r.uri === uri);

    if (!resource) {
      throw new Error(`Unknown resource: ${uri}`);
    }

    // Return resource content
    // Resources should define their content in the registry
    return {
      contents: [
        {
          uri: resource.uri,
          mimeType: resource.mimeType || 'text/plain',
          text: `Resource: ${resource.name}\n\n${resource.description}`
        }
      ]
    };
  }

  /**
   * Get the underlying MCP Server instance
   */
  getServer(): McpServer {
    return this.mcpServer;
  }
}
