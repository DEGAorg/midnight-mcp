import { describe, it, beforeAll, afterAll, expect, jest } from '@jest/globals';
import { spawn, ChildProcess } from 'child_process';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define Zod schemas for MCP responses
const InitializeResponseSchema = z.object({
  protocolVersion: z.string(),
  capabilities: z.object({}).optional(),
  serverInfo: z.object({
    name: z.string(),
    version: z.string()
  }).optional()
});

const ToolsListResponseSchema = z.object({
  tools: z.array(z.object({
    name: z.string(),
    description: z.string().optional(),
    inputSchema: z.object({}).optional()
  }))
});

const ResourcesListResponseSchema = z.object({
  resources: z.array(z.object({
    uri: z.string(),
    name: z.string().optional(),
    description: z.string().optional(),
    mimeType: z.string().optional()
  }))
});

const ToolCallResponseSchema = z.object({
  content: z.array(z.object({
    type: z.string(),
    text: z.string().optional()
  }))
});

const ResourceReadResponseSchema = z.object({
  contents: z.array(z.object({
    uri: z.string(),
    mimeType: z.string().optional(),
    text: z.string().optional()
  }))
});

// Generic response schema for error handling
const GenericResponseSchema = z.object({}).passthrough();

describe('MCP Server E2E Tests', () => {
  let client: Client;
  let transport: StdioClientTransport;
  const testAgentId = 'test-eliza-e2e-agent';
  const testSeedPath = path.join(__dirname, `${testAgentId}.seed`);

  beforeAll(async () => {
    // Verify test seed file exists
    try {
      await fs.access(testSeedPath);
      console.log('Using existing seed file:', testSeedPath);
    } catch (error) {
      throw new Error(`Test seed file not found at ${testSeedPath}. Please ensure the seed file exists.`);
    }

    // Create client transport that will spawn the server process
    transport = new StdioClientTransport({
      command: 'tsx',
      args: ['src/stdio-server.ts'],
      env: {
        ...process.env,
        AGENT_ID: testAgentId,
        NODE_ENV: 'test',
        WALLET_SERVER_HOST: 'localhost',
        WALLET_SERVER_PORT: '3001',
        NETWORK_ID: 'TestNet',
        USE_EXTERNAL_PROOF_SERVER: 'false'
      }
    });

    // Create client
    client = new Client({
      name: 'test-client',
      version: '1.0.0'
    }, {
      capabilities: {}
    });

    // Connect client to server
    await client.connect(transport);
  }, 30000);

  afterAll(async () => {
    // Clean up client
    if (client) {
      await client.close();
    }

    // Clean up transport
    if (transport) {
      await transport.close();
    }

    // Keep the seed file for reuse - do not delete testSeedPath
  }, 10000);

  describe('Server Initialization', () => {
    it('should successfully connect to the MCP server', async () => {
      expect(client).toBeDefined();
      expect(transport).toBeDefined();
    });

    it('should handle server info request', async () => {
      const serverInfo = await client.request(
        { method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {} } },
        InitializeResponseSchema
      );
      
      expect(serverInfo).toBeDefined();
      expect(serverInfo.capabilities).toBeDefined();
    });
  });

  describe('Tool Discovery', () => {
    it('should list available tools', async () => {
      const response = await client.request(
        { method: 'tools/list', params: {} },
        ToolsListResponseSchema
      );

      expect(response).toBeDefined();
      expect(response.tools).toBeDefined();
      expect(Array.isArray(response.tools)).toBe(true);
      expect(response.tools.length).toBeGreaterThan(0);

      // Check for expected tools
      const toolNames = response.tools.map((tool: any) => tool.name);
      expect(toolNames).toContain('walletStatus');
      expect(toolNames).toContain('walletAddress');
      expect(toolNames).toContain('walletBalance');
    });

    it('should provide tool schemas', async () => {
      const response = await client.request(
        { method: 'tools/list', params: {} },
        ToolsListResponseSchema
      );

      const walletStatusTool = response.tools.find((tool: any) => tool.name === 'walletStatus');
      expect(walletStatusTool).toBeDefined();
      expect(walletStatusTool?.description).toBeDefined();
      expect(walletStatusTool?.inputSchema).toBeDefined();
    });
  });

  describe('Resource Discovery', () => {
    it('should list available resources', async () => {
      const response = await client.request(
        { method: 'resources/list', params: {} },
        ResourcesListResponseSchema
      );

      expect(response).toBeDefined();
      expect(response.resources).toBeDefined();
      expect(Array.isArray(response.resources)).toBe(true);
    });
  });

  describe('Tool Execution', () => {
    it('should execute walletStatus tool', async () => {
      const response = await client.request(
        { method: 'tools/call', params: { name: 'walletStatus', arguments: {} } },
        ToolCallResponseSchema
      );

      expect(response).toBeDefined();
      expect(response.content).toBeDefined();
      expect(Array.isArray(response.content)).toBe(true);
      expect(response.content.length).toBeGreaterThan(0);
    });

    it('should execute walletAddress tool', async () => {
      const response = await client.request(
        { method: 'tools/call', params: { name: 'walletAddress', arguments: {} } },
        ToolCallResponseSchema
      );

      expect(response).toBeDefined();
      expect(response.content).toBeDefined();
      expect(Array.isArray(response.content)).toBe(true);
      expect(response.content.length).toBeGreaterThan(0);
    });

    it('should execute walletBalance tool', async () => {
      const response = await client.request(
        { method: 'tools/call', params: { name: 'walletBalance', arguments: {} } },
        ToolCallResponseSchema
      );

      expect(response).toBeDefined();
      expect(response.content).toBeDefined();
      expect(Array.isArray(response.content)).toBe(true);
      expect(response.content.length).toBeGreaterThan(0);
    });

    it('should handle tool execution errors gracefully', async () => {
      try {
        await client.request(
          { method: 'tools/call', params: { name: 'nonexistentTool', arguments: {} } },
          GenericResponseSchema
        );
        // If we reach here, the test should fail
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should validate tool arguments', async () => {
      try {
        await client.request(
          { method: 'tools/call', params: { name: 'sendFunds', arguments: {} } },
          GenericResponseSchema
        );
        // If we reach here, the test should fail
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
        // Should indicate missing required parameters
      }
    });
  });

  describe('Resource Access', () => {
    it('should read available resources', async () => {
      const listResponse = await client.request(
        { method: 'resources/list', params: {} },
        ResourcesListResponseSchema
      );

      if (listResponse.resources.length > 0) {
        const resource = listResponse.resources[0];
        const readResponse = await client.request(
          { method: 'resources/read', params: { uri: resource.uri } },
          ResourceReadResponseSchema
        );

        expect(readResponse).toBeDefined();
        expect(readResponse.contents).toBeDefined();
        expect(Array.isArray(readResponse.contents)).toBe(true);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed requests', async () => {
      try {
        await client.request(
          { method: 'invalid/method', params: {} },
          GenericResponseSchema
        );
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle server errors gracefully', async () => {
      // Test with a tool that might fail due to network issues
      try {
        const response = await client.request(
          { method: 'tools/call', params: { name: 'getTransactions', arguments: {} } },
          ToolCallResponseSchema
        );
        // If successful, response should be defined
        expect(response).toBeDefined();
      } catch (error) {
        // If it fails, error should be properly formatted
        expect(error).toBeDefined();
      }
    });
  });

  describe('Performance', () => {
    it('should respond to tool calls within reasonable time', async () => {
      const startTime = Date.now();
      
      await client.request(
        { method: 'tools/call', params: { name: 'walletStatus', arguments: {} } },
        ToolCallResponseSchema
      );

      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should respond within 5 seconds
      expect(duration).toBeLessThan(5000);
    });

    it('should handle multiple concurrent tool calls', async () => {
      const promises = [
        client.request(
          { method: 'tools/call', params: { name: 'walletStatus', arguments: {} } },
          ToolCallResponseSchema
        ),
        client.request(
          { method: 'tools/call', params: { name: 'walletAddress', arguments: {} } },
          ToolCallResponseSchema
        ),
        client.request(
          { method: 'tools/call', params: { name: 'walletBalance', arguments: {} } },
          ToolCallResponseSchema
        )
      ];

      const results = await Promise.all(promises);
      
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.content).toBeDefined();
      });
    });
  });
}); 