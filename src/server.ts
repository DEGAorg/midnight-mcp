#!/usr/bin/env node

/**
 * Identus MCP Server
 *
 * Model Context Protocol server for Hyperledger Identus DID management.
 * Provides tools for creating and resolving Decentralized Identifiers (DIDs)
 * for Midnight City AI agents.
 *
 * Architecture:
 * - Apollo: Cryptography primitives
 * - Castor: DID creation and resolution
 * - Pollux: Verifiable Credentials
 * - Mercury: DIDComm messaging
 *
 * Usage:
 *   npm run dev          # Development mode with tsx
 *   npm start            # Production mode
 *   npm test             # Test tools
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';

import { createDIDTool } from './tools/create-did.js';
import { resolveDIDTool } from './tools/resolve-did.js';

/**
 * All available Identus MCP tools
 */
const TOOLS: Tool[] = [
  createDIDTool.definition,
  resolveDIDTool.definition,
];

/**
 * Tool executor map
 */
const TOOL_EXECUTORS = new Map<string, (args: unknown) => Promise<any>>([
  ['createDID', createDIDTool.execute],
  ['resolveDID', resolveDIDTool.execute],
]);

/**
 * Create and configure the MCP server
 */
const server = new Server(
  {
    name: 'identus-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * Handle list_tools request
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

/**
 * Handle call_tool request
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  const executor = TOOL_EXECUTORS.get(name);
  if (!executor) {
    throw new Error(`Unknown tool: ${name}`);
  }

  try {
    const result = await executor(args || {});
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ error: errorMessage }, null, 2),
        },
      ],
      isError: true,
    };
  }
});

/**
 * Start the server
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error(`Identus MCP Server running...`);
  console.error(`Mode: PRODUCTION (Real Identus SDK v7.0.0)`);
  console.error(`Tools: ${TOOLS.length}`);
  console.error(`  - ${TOOLS.map(t => t.name).join('\\n  - ')}`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
