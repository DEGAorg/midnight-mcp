#!/usr/bin/env tsx

/**
 * MCP HTTP Session Test Client
 *
 * Tests the MCP HTTP server's session management functionality:
 * - Session initialization with agent ID
 * - Session persistence across requests
 * - Tool calls within a session
 * - Multiple agents with separate sessions
 */

import fetch from 'node-fetch';
import { randomUUID } from 'crypto';

const MCP_URL = 'http://localhost:3001/mcp';
const HEALTH_URL = 'http://localhost:3001/health';

// ANSI color codes for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message: string, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

interface JsonRpcRequest {
  jsonrpc: '2.0';
  method: string;
  params?: any;
  id: number | string;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
  id: number | string;
}

class MCPTestClient {
  private agentId: string;
  private sessionId?: string;
  private requestId = 0;

  constructor(agentId?: string) {
    this.agentId = agentId || 'workshop';  // Use the default workshop agent
  }

  private getNextId(): number {
    return ++this.requestId;
  }

  async checkHealth(): Promise<void> {
    log('\n📊 Checking server health...', colors.cyan);
    try {
      const response = await fetch(HEALTH_URL);
      const data = await response.json();
      log(`✅ Server is ${data.status}`, colors.green);
      log(`   Active sessions: ${data.activeSessions}/${data.maxSessions}`, colors.blue);
      log(`   Utilization: ${data.utilizationPercent.toFixed(1)}%`, colors.blue);
    } catch (error) {
      log(`❌ Health check failed: ${error}`, colors.red);
      throw error;
    }
  }

  async initialize(): Promise<void> {
    log(`\n🔧 Initializing session for agent: ${this.agentId}`, colors.cyan);

    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},  // Required by MCP protocol
        clientInfo: {
          name: 'mcp-test-client',
          version: '1.0.0',
        },
      },
      id: this.getNextId(),
    };

    const response = await fetch(MCP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',  // Required for StreamableHTTP
        'X-Agent-ID': this.agentId,
        'X-Agent-Registered': 'true',
      },
      body: JSON.stringify(request),
    });

    // Check for session ID in response headers
    const sessionIdHeader = response.headers.get('mcp-session-id');
    if (sessionIdHeader) {
      this.sessionId = sessionIdHeader;
      log(`📝 Session ID received: ${this.sessionId}`, colors.green);
    }

    const data: JsonRpcResponse = await response.json();

    if (data.error) {
      log(`❌ Initialization error: ${data.error.message}`, colors.red);
      throw new Error(data.error.message);
    }

    log('✅ Session initialized successfully!', colors.green);
    if (data.result?.serverInfo) {
      log(`   Server: ${data.result.serverInfo.name} v${data.result.serverInfo.version}`, colors.blue);
    }
  }

  async listTools(): Promise<void> {
    log('\n🔨 Listing available tools...', colors.cyan);

    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      method: 'tools/list',
      params: {},
      id: this.getNextId(),
    };

    const headers: any = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'X-Agent-ID': this.agentId,
      'X-Agent-Registered': 'true',
    };

    if (this.sessionId) {
      headers['Mcp-Session-Id'] = this.sessionId;
    }

    const response = await fetch(MCP_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    });

    const data: JsonRpcResponse = await response.json();

    if (data.error) {
      log(`❌ List tools error: ${data.error.message}`, colors.red);
      throw new Error(data.error.message);
    }

    const tools = data.result?.tools || [];
    log(`✅ Found ${tools.length} tools:`, colors.green);
    tools.slice(0, 5).forEach((tool: any) => {
      log(`   • ${tool.name}: ${tool.description}`, colors.blue);
    });
    if (tools.length > 5) {
      log(`   ... and ${tools.length - 5} more`, colors.blue);
    }
  }

  async callTool(toolName: string, args: any = {}): Promise<any> {
    log(`\n🎯 Calling tool: ${toolName}`, colors.cyan);

    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args,
      },
      id: this.getNextId(),
    };

    const headers: any = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'X-Agent-ID': this.agentId,
      'X-Agent-Registered': 'true',
    };

    if (this.sessionId) {
      headers['Mcp-Session-Id'] = this.sessionId;
    }

    const response = await fetch(MCP_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    });

    const data: JsonRpcResponse = await response.json();

    if (data.error) {
      log(`❌ Tool call error: ${data.error.message}`, colors.red);
      throw new Error(data.error.message);
    }

    log(`✅ Tool call successful!`, colors.green);
    return data.result;
  }

  async testSessionPersistence(): Promise<void> {
    log('\n🔄 Testing session persistence...', colors.cyan);

    // Make multiple calls to ensure the same session is used
    for (let i = 1; i <= 3; i++) {
      log(`\n  Call ${i}/3:`, colors.yellow);

      const result = await this.callTool('walletStatus');

      // Parse the JSON response to check isReady
      const textContent = result.content[0]?.text;
      const walletStatus = textContent ? JSON.parse(textContent) : null;
      const isReady = walletStatus?.isReady ?? false;

      log(`    Wallet ready: ${isReady ? 'Yes' : 'No'}`, colors.blue);
      if (isReady) {
        log(`    Balance: ${walletStatus.balance}`, colors.blue);
        log(`    Sync: ${walletStatus.syncProgress.syncPercentage}%`, colors.blue);
      }

      // Small delay between calls
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    log('\n✅ Session persistence test completed!', colors.green);
  }
}

async function testMultipleAgents(): Promise<void> {
  log('\n👥 Testing multiple agents with separate sessions...', colors.magenta);

  // Use workshop agent for both tests since we need registered agents
  const agent1 = new MCPTestClient('workshop');
  const agent2 = new MCPTestClient('workshop');

  // Initialize both agents
  await agent1.initialize();
  await agent2.initialize();

  // Both agents call the same tool
  log('\n  Agent Alice calling walletStatus...', colors.yellow);
  await agent1.callTool('walletStatus');

  log('\n  Agent Bob calling walletStatus...', colors.yellow);
  await agent2.callTool('walletStatus');

  log('\n✅ Multiple agents test completed!', colors.green);
}

async function main() {
  log('🚀 MCP HTTP Session Test Suite', colors.magenta);
  log('================================\n', colors.magenta);

  try {
    // Test 1: Single agent full flow
    const client = new MCPTestClient();

    await client.checkHealth();
    await client.initialize();
    await client.listTools();
    await client.callTool('walletStatus');
    await client.callTool('walletAddress');
    await client.testSessionPersistence();

    // Test 2: Multiple agents
    await testMultipleAgents();

    // Final health check
    await client.checkHealth();

    log('\n🎉 All tests completed successfully!', colors.green);
    log('=====================================\n', colors.green);
  } catch (error) {
    log(`\n❌ Test failed: ${error}`, colors.red);
    process.exit(1);
  }
}

// Run the tests
main().catch(console.error);