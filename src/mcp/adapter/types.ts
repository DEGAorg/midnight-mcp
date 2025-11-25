/**
 * Tool Adapter Types
 *
 * Type definitions for the tool adapter pattern.
 * Based on vechain-mcp-server adapter architecture.
 */

import type { ServiceDependencies } from '../types.js';

/**
 * Tool definition with execute function
 *
 * Each tool exports this structure:
 * - name: Tool identifier (e.g., "walletStatus")
 * - description: Human-readable description
 * - inputSchema: Zod schema shape or JSON Schema object
 * - execute: Function that receives args and services
 */
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (args: unknown, services: ServiceDependencies) => Promise<unknown>;
}

/**
 * Tool adapter interface
 *
 * Provides two methods:
 * - listOfTools: Returns tool metadata for MCP list request
 * - toolHandler: Executes tool by name with injected services
 */
export interface ToolAdapter {
  /**
   * List all available tools
   * Used by MCP ListToolsRequestSchema handler
   */
  listOfTools: () => Array<{
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
  }>;

  /**
   * Execute a tool by name
   * Finds tool, injects services, executes handler
   *
   * @param name Tool name (e.g., "walletStatus")
   * @param args Tool arguments (validated by tool's schema)
   * @returns MCP response format
   */
  toolHandler: (name: string, args: unknown) => Promise<{
    content: Array<{
      type: 'text';
      text: string;
    }>;
  }>;
}
