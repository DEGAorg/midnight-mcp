/**
 * Tool Adapter
 *
 * Collects all tools and provides dynamic routing without switch statements.
 * Based on vechain-mcp-server adapter pattern.
 *
 * Architecture:
 * - Collects tool definitions from tool files
 * - Provides listOfTools() for MCP tool listing
 * - Provides toolHandler() for tool execution with service injection
 * - No switch statements - tools route themselves!
 */

import type { ServiceDependencies } from '../types.js';
import type { ToolDefinition, ToolAdapter } from './types.js';
import { ALL_TOOLS } from '../tools/index.js';

/**
 * Create tool adapter with service injection
 *
 * @param services Service dependencies (WalletService, TokenService, etc.)
 * @returns Tool adapter with listOfTools and toolHandler methods
 */
export async function createToolAdapter(services: ServiceDependencies): Promise<ToolAdapter> {
  // Collect all tools from registries
  const tools: ToolDefinition[] = ALL_TOOLS;

  console.error(`[ToolAdapter] Collected ${tools.length} tools`);
  console.error(`[ToolAdapter] Tools:`, tools.map(t => t.name).join(', '));

  return {
    /**
     * List all available tools
     * Returns tool metadata for MCP ListToolsRequestSchema
     */
    listOfTools: () => {
      return tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        // MCP requires JSON Schema with type: "object"
        // Zod .shape only gives properties, so we wrap it
        inputSchema: {
          type: 'object' as const,
          properties: tool.inputSchema,
          required: Object.keys(tool.inputSchema)
        }
      }));
    },

    /**
     * Execute a tool by name with service injection
     *
     * @param name Tool name (e.g., "walletStatus")
     * @param args Tool arguments (will be validated by tool)
     * @returns MCP response format
     */
    toolHandler: async (name: string, args: unknown) => {
      console.error(`[ToolAdapter] Executing tool: ${name}`);
      console.error(`[ToolAdapter] Args:`, JSON.stringify(args, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      ));

      // Find tool by name
      const tool = tools.find((t) => t.name === name);
      if (!tool) {
        const error = `Tool ${name} not found`;
        console.error(`[ToolAdapter] Error: ${error}`);
        throw new Error(error);
      }

      try {
        // Execute tool with services injected
        console.error(`[ToolAdapter] Executing tool.execute for ${name}...`);
        const result = await tool.execute(args, services);
        console.error(`[ToolAdapter] Tool ${name} executed, result type:`, typeof result);

        // First serialize the result to ensure no BigInt values remain
        console.error(`[ToolAdapter] Attempting to serialize result...`);
        try {
          const serializedResult = JSON.parse(JSON.stringify(result, (key, value) => {
            if (typeof value === 'bigint') {
              console.error(`[ToolAdapter] Converting BigInt ${key}=${value} to string`);
              return value.toString();
            }
            return value;
          }));
          console.error(`[ToolAdapter] Result serialized successfully`);

          // Return in MCP format with pre-serialized data
          const response = {
            content: [{
              type: 'text' as const,
              text: JSON.stringify(serializedResult, null, 2)
            }]
          };
          console.error(`[ToolAdapter] Returning MCP response`);
          return response;
        } catch (serializeError) {
          console.error(`[ToolAdapter] Serialization error:`, serializeError);
          throw serializeError;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[ToolAdapter] Tool ${name} failed:`, errorMessage);

        // Re-throw for MCP error handling
        throw new Error(`Tool execution failed: ${errorMessage}`);
      }
    }
  };
}
