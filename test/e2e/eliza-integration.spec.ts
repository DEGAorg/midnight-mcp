import { describe, it, beforeAll, afterAll, expect, jest } from '@jest/globals';
import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('ElizaOS + MCP Integration E2E Tests', () => {
  let mcpServerProcess: ChildProcess;
  let elizaServerProcess: ChildProcess;
  const testAgentId = 'test-eliza-e2e-agent';
  const testSeedPath = path.join(__dirname, `${testAgentId}.seed`);
  const elizaProjectPath = path.join(__dirname, '../../test-eliza-project');
  const elizaPort = 3001;

  beforeAll(async () => {
    // Setup test environment
    await setupTestEnvironment();
    
    // Start MCP server
    await startMCPServer();
    
    // Create ElizaOS project
    await createElizaProject();
    
    // Configure MCP plugin
    await configureMCPPlugin();
    
    // Start ElizaOS server
    await startElizaServer();
  }, 120000);

  afterAll(async () => {
    await cleanup();
  }, 30000);

  async function setupTestEnvironment(): Promise<void> {
    console.log('Setting up ElizaOS + MCP test environment...');
    
    // Verify test seed file exists
    try {
      await fs.access(testSeedPath);
      console.log('Using existing seed file:', testSeedPath);
    } catch (error) {
      throw new Error(`Test seed file not found at ${testSeedPath}. Please ensure the seed file exists.`);
    }
  }

  async function startMCPServer(): Promise<void> {
    console.log('Starting MCP server for ElizaOS integration...');
    
    mcpServerProcess = spawn('tsx', ['src/stdio-server.ts'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        AGENT_ID: testAgentId,
        NODE_ENV: 'test',
        WALLET_SERVER_HOST: 'localhost',
        WALLET_SERVER_PORT: '3002',
        NETWORK_ID: 'TestNet',
        USE_EXTERNAL_PROOF_SERVER: 'false'
      }
    });

    // Wait for MCP server to start
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  async function createElizaProject(): Promise<void> {
    console.log('Creating ElizaOS test project...');
    
    // Remove existing test project if it exists
    try {
      await fs.rm(elizaProjectPath, { recursive: true, force: true });
    } catch (error) {
      // Ignore if directory doesn't exist
    }

    // Create project directory
    await fs.mkdir(elizaProjectPath, { recursive: true });
    await fs.mkdir(path.join(elizaProjectPath, 'characters'), { recursive: true });

    // Initialize a basic ElizaOS project structure
    const packageJson = {
      name: 'test-eliza-mcp-project',
      version: '1.0.0',
      type: 'module',
      scripts: {
        start: 'elizaos start'
      },
      dependencies: {
        '@elizaos/core': 'latest',
        '@fleek-platform/eliza-plugin-mcp': 'latest'
      }
    };

    await fs.writeFile(
      path.join(elizaProjectPath, 'package.json'), 
      JSON.stringify(packageJson, null, 2)
    );

    // Install dependencies
    await executeCommand('npm', ['install'], elizaProjectPath);
  }

  async function configureMCPPlugin(): Promise<void> {
    console.log('Configuring MCP plugin for ElizaOS...');
    
    const characterConfig = {
      name: 'MCP Test Agent',
      bio: 'A test agent for MCP integration testing',
      lore: ['Test agent for validating MCP server integration'],
      plugins: ['@fleek-platform/eliza-plugin-mcp'],
      settings: {
        mcp: {
          servers: {
            'midnight-mcp': {
              type: 'stdio',
              name: 'Midnight MCP Server',
              command: 'tsx',
              args: [path.join(__dirname, '../../src/stdio-server.ts')],
              env: {
                AGENT_ID: testAgentId,
                NODE_ENV: 'test',
                WALLET_SERVER_HOST: 'localhost',
                WALLET_SERVER_PORT: '3002',
                NETWORK_ID: 'TestNet',
                USE_EXTERNAL_PROOF_SERVER: 'false'
              }
            }
          }
        }
      }
    };

    await fs.writeFile(
      path.join(elizaProjectPath, 'characters', 'test-character.json'),
      JSON.stringify(characterConfig, null, 2)
    );
  }

  async function startElizaServer(): Promise<void> {
    console.log('Starting ElizaOS server...');
    
    elizaServerProcess = spawn('npx', ['elizaos', 'start', '--character', 'characters/test-character.json'], {
      cwd: elizaProjectPath,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PORT: elizaPort.toString()
      }
    });

    // Wait for ElizaOS server to start
    await new Promise((resolve) => setTimeout(resolve, 10000));
    
    // Verify server is running
    await waitForServerReady();
  }

  async function waitForServerReady(): Promise<void> {
    const maxAttempts = 30;
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await fetch(`http://localhost:${elizaPort}/health`);
        if (response.ok) {
          return;
        }
      } catch (error) {
        // Server not ready yet
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error('ElizaOS server failed to start within timeout');
  }

  async function executeCommand(command: string, args: string[], cwd?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const process = spawn(command, args, {
        cwd: cwd || __dirname,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Command failed: ${stderr}`));
        }
      });
    });
  }

  async function cleanup(): Promise<void> {
    console.log('Cleaning up ElizaOS + MCP test environment...');
    
    if (elizaServerProcess) {
      elizaServerProcess.kill('SIGTERM');
      await new Promise((resolve) => setTimeout(resolve, 2000));
      if (!elizaServerProcess.killed) {
        elizaServerProcess.kill('SIGKILL');
      }
    }

    if (mcpServerProcess) {
      mcpServerProcess.kill('SIGTERM');
      await new Promise((resolve) => setTimeout(resolve, 1000));
      if (!mcpServerProcess.killed) {
        mcpServerProcess.kill('SIGKILL');
      }
    }

    // Clean up test files
    try {
      await fs.rm(elizaProjectPath, { recursive: true, force: true });
      // Keep the seed file for reuse - do not delete testSeedPath
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  describe('ElizaOS Integration Setup', () => {
    it('should have ElizaOS server running', async () => {
      const response = await fetch(`http://localhost:${elizaPort}/health`);
      expect(response.ok).toBe(true);
    });

    it('should have loaded the MCP plugin', async () => {
      // Test that MCP plugin is loaded by checking available actions/providers
      const response = await fetch(`http://localhost:${elizaPort}/api/plugins`);
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect((data as any).plugins).toContain('@fleek-platform/eliza-plugin-mcp');
    });
  });

  describe('MCP Tool Integration', () => {
    it('should expose MCP tools through ElizaOS', async () => {
      const response = await fetch(`http://localhost:${elizaPort}/api/tools`);
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      const toolNames = (data as any).tools.map((tool: any) => tool.name);
      
      // Should include MCP tools from our server
      expect(toolNames).toContain('walletStatus');
      expect(toolNames).toContain('walletAddress');
      expect(toolNames).toContain('walletBalance');
    });

    it('should execute MCP tools via ElizaOS agent', async () => {
      const toolRequest = {
        tool: 'walletStatus',
        parameters: {}
      };

      const response = await fetch(`http://localhost:${elizaPort}/api/execute-tool`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(toolRequest)
      });

      expect(response.ok).toBe(true);
      const result = await response.json();
      expect((result as any).success).toBe(true);
      expect((result as any).data).toBeDefined();
    });
  });

  describe('Agent Conversation Integration', () => {
    it('should handle conversation with MCP tool usage', async () => {
      const conversationRequest = {
        message: 'Can you check my wallet status?',
        conversationId: 'test-conversation-1'
      };

      const response = await fetch(`http://localhost:${elizaPort}/api/conversation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(conversationRequest)
      });

      expect(response.ok).toBe(true);
      const result = await response.json();
      
      expect((result as any).response).toBeDefined();
      expect((result as any).toolsUsed).toContain('walletStatus');
    });

    it('should handle complex MCP operations through conversation', async () => {
      const conversationRequest = {
        message: 'What is my wallet address and current balance?',
        conversationId: 'test-conversation-2'
      };

      const response = await fetch(`http://localhost:${elizaPort}/api/conversation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(conversationRequest)
      });

      expect(response.ok).toBe(true);
      const result = await response.json();
      
      expect((result as any).response).toBeDefined();
      expect((result as any).toolsUsed.length).toBeGreaterThan(1);
      expect((result as any).toolsUsed).toContain('walletAddress');
      expect((result as any).toolsUsed).toContain('walletBalance');
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle MCP server errors gracefully', async () => {
      const conversationRequest = {
        message: 'Send funds to an invalid address',
        conversationId: 'test-conversation-error'
      };

      const response = await fetch(`http://localhost:${elizaPort}/api/conversation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(conversationRequest)
      });

      expect(response.ok).toBe(true);
      const result = await response.json();
      
      // Should receive an error response but not crash
      expect((result as any).response).toBeDefined();
      expect((result as any).response).toContain('error');
    });

    it('should handle MCP server disconnection', async () => {
      // Temporarily kill MCP server
      if (mcpServerProcess) {
        mcpServerProcess.kill('SIGTERM');
      }

      const conversationRequest = {
        message: 'Check my wallet status',
        conversationId: 'test-conversation-disconnect'
      };

      const response = await fetch(`http://localhost:${elizaPort}/api/conversation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(conversationRequest)
      });

      expect(response.ok).toBe(true);
      const result = await response.json();
      
      // Should handle disconnection gracefully
      expect((result as any).response).toBeDefined();
      expect((result as any).response).toContain('unavailable');

      // Restart MCP server for other tests
      await startMCPServer();
    });
  });

  describe('Performance Integration', () => {
    it('should respond to MCP-enabled conversations within reasonable time', async () => {
      const startTime = Date.now();

      const conversationRequest = {
        message: 'Quick wallet status check',
        conversationId: 'test-conversation-performance'
      };

      const response = await fetch(`http://localhost:${elizaPort}/api/conversation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(conversationRequest)
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(response.ok).toBe(true);
      expect(duration).toBeLessThan(10000); // Should respond within 10 seconds
    });

    it('should handle concurrent conversations with MCP tools', async () => {
      const promises = Array.from({ length: 3 }, (_, i) => 
        fetch(`http://localhost:${elizaPort}/api/conversation`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: `Concurrent test ${i + 1}: check wallet status`,
            conversationId: `test-conversation-concurrent-${i + 1}`
          })
        })
      );

      const results = await Promise.all(promises);
      
      results.forEach(response => {
        expect(response.ok).toBe(true);
      });
    });
  });
}); 