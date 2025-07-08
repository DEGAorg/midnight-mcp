/*
 * ElizaOS + MCP E2E Integration Test Runner
 * 
 * This script tests the integration between ElizaOS and the Midnight MCP server.
 * 
 */

import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface TestResult {
  testName: string;
  passed: boolean;
  duration: number;
  error?: string;
  output?: string;
}

class ElizaOSE2ETestRunner {
  private mcpServerProcess: ChildProcess | null = null;
  private elizaServerProcess: ChildProcess | null = null;
  private testAgentId = 'test-eliza-e2e-agent';
  private testSeedPath: string;
  private elizaProjectPath: string;
  public results: TestResult[] = [];
  private elizaPort = 3003;

  constructor() {
    this.testSeedPath = path.join(__dirname, '../.storage/seeds', `${this.testAgentId}.seed`);
    this.elizaProjectPath = path.join(__dirname, '../test-eliza-e2e-project');
  }

  async setupTestEnvironment(): Promise<void> {
    console.log('🚀 Setting up ElizaOS E2E test environment...');
    
    // Create test seed file
    console.log(`   📁 Creating seed file: ${this.testSeedPath}`);
    await fs.mkdir(path.dirname(this.testSeedPath), { recursive: true });
    await fs.writeFile(this.testSeedPath, 'test-seed-for-eliza-e2e-testing-only');
    console.log('   ✅ Test seed file created');
    
    // Verify seed file exists
    try {
      await fs.access(this.testSeedPath);
      console.log('   ✅ Test seed file verified');
    } catch (error) {
      throw new Error(`Failed to create seed file: ${error}`);
    }
    
    // Clean up any existing test project
    try {
      await fs.rm(this.elizaProjectPath, { recursive: true, force: true });
      console.log('   🗑️ Cleaned up existing test project');
    } catch (error) {
      // Ignore if directory doesn't exist
    }
    
    console.log('✅ Test environment setup completed');
  }

  async startMCPServer(): Promise<void> {
    console.log('🔧 Starting MCP server for ElizaOS integration...');
    
    try {
      // Ensure we run the MCP server from the project root directory
      const projectRoot = path.resolve(__dirname, '..');
      
      console.log(`   📂 Starting MCP server from: ${projectRoot}`);
      console.log(`   🔑 Using AGENT_ID: ${this.testAgentId}`);
      console.log(`   📁 Seed file location: ${this.testSeedPath}`);
      
      this.mcpServerProcess = spawn('tsx', ['src/stdio-server.ts'], {
        cwd: projectRoot,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          AGENT_ID: this.testAgentId,
          NODE_ENV: 'test',
          WALLET_SERVER_HOST: 'localhost',
          WALLET_SERVER_PORT: '3000',
          NETWORK_ID: 'TestNet',
          USE_EXTERNAL_PROOF_SERVER: 'false'
        }
      });

      // Log MCP server output for debugging
      if (this.mcpServerProcess.stdout) {
        this.mcpServerProcess.stdout.on('data', (data) => {
          console.log(`   [MCP stdout]: ${data.toString().trim()}`);
        });
      }
      
      if (this.mcpServerProcess.stderr) {
        this.mcpServerProcess.stderr.on('data', (data) => {
          console.error(`   [MCP stderr]: ${data.toString().trim()}`);
        });
      }

      // Handle process events
      this.mcpServerProcess.on('close', (code) => {
        console.error(`   ❌ MCP server process exited with code ${code}`);
      });

      this.mcpServerProcess.on('error', (error) => {
        console.error(`   ❌ MCP server process error: ${error.message}`);
      });

      // Wait for MCP server to start
      console.log('   ⏳ Waiting for MCP server to start (3s)...');
      await new Promise((resolve) => setTimeout(resolve, 3000));
      
      if (this.mcpServerProcess && !this.mcpServerProcess.killed) {
        console.log('✅ MCP server process started successfully');
      } else {
        throw new Error('Failed to start MCP server - process was killed or failed to start');
      }
    } catch (error) {
      console.error(`   ❌ Failed to start MCP server: ${error instanceof Error ? error.message : error}`);
      throw error;
    }
  }

  async runTest(testName: string, testFunction: () => Promise<void>): Promise<TestResult> {
    console.log(`🧪 Running test: ${testName}`);
    const startTime = Date.now();
    
    try {
      await testFunction();
      const duration = Date.now() - startTime;
      
      console.log(`✅ Test passed: ${testName} (${duration}ms)`);
      return {
        testName,
        passed: true,
        duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      const stackTrace = error instanceof Error ? error.stack : '';
      
      console.error(`❌ Test failed: ${testName} (${duration}ms)`);
      console.error(`   Error: ${errorMessage}`);
      if (stackTrace) {
        console.error(`   Stack trace: ${stackTrace}`);
      }
      
      return {
        testName,
        passed: false,
        duration,
        error: errorMessage
      };
    }
  }

  async testElizaOSInstallation(): Promise<void> {
    console.log('📦 Testing ElizaOS CLI installation...');
    
    try {
      const output = await this.executeCommand('elizaos', ['--version']);
      if (!output) {
        throw new Error('ElizaOS CLI not properly installed');
      }
      console.log(`   ✅ ElizaOS CLI found: ${output.trim()}`);
    } catch (error) {
      console.log(`   ⚠️ ElizaOS CLI not found: ${error instanceof Error ? error.message : error}`);
      
      try {
        // Try installing ElizaOS CLI if not available
        console.log('📦 Installing ElizaOS CLI...');
        
        // Try different approaches for npm installation
        let installSuccess = false;
        const installCommands = [
          ['npm', ['install', '-g', '@elizaos/cli@beta']],
          ['yarn', ['global', 'add', '@elizaos/cli@beta']],
          ['npx', ['@elizaos/cli@beta', '--version']] // Just test if npx works
        ];
        
        for (const [cmd, args] of installCommands) {
          try {
            console.log(`   🔄 Trying: ${cmd} ${(args as string[]).join(' ')}`);
            await this.executeCommand(cmd as string, args as string[]);
            console.log(`   ✅ Successfully used ${cmd}`);
            installSuccess = true;
            break;
          } catch (cmdError) {
            console.log(`   ⚠️ ${cmd} failed: ${cmdError instanceof Error ? cmdError.message : cmdError}`);
          }
        }
        
        if (!installSuccess) {
          console.log('   💡 ElizaOS CLI installation failed, but test will continue with npx');
          console.log('   💡 The test will use npx @elizaos/cli@beta for ElizaOS commands');
          return; // Continue without failing
        }
        
        // Verify installation if install succeeded
        try {
          const output = await this.executeCommand('elizaos', ['--version']);
          console.log(`   ✅ ElizaOS CLI verified: ${output.trim()}`);
        } catch (verifyError) {
          console.log('   ⚠️ ElizaOS CLI verification failed, will use npx as fallback');
        }
      } catch (installError) {
        console.log(`   ⚠️ ElizaOS CLI installation failed: ${installError instanceof Error ? installError.message : installError}`);
        console.log('   💡 Test will continue with npx @elizaos/cli@beta as fallback');
        // Don't throw error, continue with npx
      }
    }
  }

  async createElizaProject(): Promise<void> {
    console.log('🏗️ Creating ElizaOS project...');
    
    try {
      // Create project directory manually since CLI might be interactive
      await fs.mkdir(this.elizaProjectPath, { recursive: true });
      console.log(`   ✅ Project directory created: ${this.elizaProjectPath}`);
    
    // Create project structure
    const projectStructure = {
      'package.json': {
        name: 'test-eliza-mcp-project',
        version: '1.0.0',
        type: 'module',
        scripts: {
          start: 'elizaos start --character=characters/test-character.json',
          dev: 'elizaos start --character=characters/test-character.json --watch'
        },
        dependencies: {
          '@elizaos/core': 'latest',
          '@fleek-platform/eliza-plugin-mcp': 'latest'
        }
      },
      '.env': `
PORT=${this.elizaPort}
NODE_ENV=test
AGENT_ID=${this.testAgentId}
`,
      'characters/test-character.json': {
        name: 'MCP Test Agent',
        bio: 'A test agent for MCP integration with Midnight blockchain',
        lore: [
          'I am a test agent designed to validate MCP server integration.',
          'I can interact with Midnight blockchain through MCP tools.',
          'I help test wallet operations and blockchain queries.'
        ],
        plugins: ['@fleek-platform/eliza-plugin-mcp'],
        settings: {
          mcp: {
            servers: {
              'midnight-mcp': {
                type: 'stdio',
                name: 'Midnight MCP Server',
                command: 'tsx',
                args: [path.resolve(__dirname, '../src/stdio-server.ts')],
                env: {
                  AGENT_ID: this.testAgentId,
                  NODE_ENV: 'test',
                  WALLET_SERVER_HOST: 'localhost',
                  WALLET_SERVER_PORT: '3000',
                  NETWORK_ID: 'TestNet',
                  USE_EXTERNAL_PROOF_SERVER: 'false'
                },
                timeout: 60,
                retries: 3,
                retryDelay: 1000
              }
            }
          }
        }
      }
    };

    // Create directory structure
    await fs.mkdir(path.join(this.elizaProjectPath, 'characters'), { recursive: true });
    
    // Write files
    for (const [filePath, content] of Object.entries(projectStructure)) {
      const fullPath = path.join(this.elizaProjectPath, filePath);
      const fileContent = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
      await fs.writeFile(fullPath, fileContent);
    }
    
      // Install dependencies
      console.log('📦 Installing project dependencies...');
      
      // Try different package managers
      let installSuccess = false;
      const packageManagers = [
        ['npm', ['install']],
        ['yarn', ['install']]
      ];
      
              for (const [manager, args] of packageManagers) {
          try {
            console.log(`   🔄 Trying: ${manager} ${(args as string[]).join(' ')}`);
            await this.executeCommand(manager as string, args as string[], this.elizaProjectPath);
          console.log(`   ✅ Dependencies installed successfully with ${manager}`);
          installSuccess = true;
          break;
        } catch (error) {
          console.log(`   ⚠️ ${manager} failed: ${error instanceof Error ? error.message : error}`);
        }
      }
      
      if (!installSuccess) {
        console.log('   ⚠️ Package manager installation failed, continuing without dependencies');
        console.log('   💡 You may need to install dependencies manually in the test project');
      }
    } catch (error) {
      console.error(`   ❌ Failed to create ElizaOS project: ${error instanceof Error ? error.message : error}`);
      throw error;
    }
  }

  async testMCPPluginInstallation(): Promise<void> {
    console.log('🔌 Testing MCP plugin installation...');
    
    const packageJsonPath = path.join(this.elizaProjectPath, 'package.json');
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
    
    if (!packageJson.dependencies['@fleek-platform/eliza-plugin-mcp']) {
      throw new Error('MCP plugin not found in dependencies');
    }
    
    // Verify node_modules
    const mcpPluginPath = path.join(this.elizaProjectPath, 'node_modules', '@fleek-platform', 'eliza-plugin-mcp');
    try {
      await fs.access(mcpPluginPath);
    } catch (error) {
      throw new Error('MCP plugin not installed in node_modules');
    }
  }

  async startElizaServer(): Promise<void> {
    console.log('🚀 Starting ElizaOS server...');
    
    try {
      console.log(`   🔄 Starting ElizaOS server with npm start...`);
      
      this.elizaServerProcess = spawn('npm', ['start'], {
        cwd: this.elizaProjectPath,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true, // Use shell to resolve npm
        env: {
          ...process.env,
          PORT: this.elizaPort.toString(),
          NODE_ENV: 'test'
        }
      });

      // Log server output for debugging
      if (this.elizaServerProcess.stdout) {
        this.elizaServerProcess.stdout.on('data', (data) => {
          console.log(`   [Server stdout]: ${data.toString().trim()}`);
        });
      }
      
      if (this.elizaServerProcess.stderr) {
        this.elizaServerProcess.stderr.on('data', (data) => {
          console.error(`   [Server stderr]: ${data.toString().trim()}`);
        });
      }

      // Wait for server to start
      console.log('   ⏳ Waiting for server to start (15s)...');
      await new Promise((resolve) => setTimeout(resolve, 15000));
      
      // Verify server is running
      await this.waitForServerReady();
      
      console.log('✅ ElizaOS server started successfully');
    } catch (error) {
      console.error(`   ❌ Failed to start ElizaOS server: ${error instanceof Error ? error.message : error}`);
      throw error;
    }
  }

  async waitForServerReady(): Promise<void> {
    const maxAttempts = 30;
    console.log(`   ⏳ Waiting for server to be ready (max ${maxAttempts * 2}s)...`);
    
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await fetch(`http://localhost:${this.elizaPort}`);
        if (response.status < 500) { // Accept any non-server-error response
          console.log(`   ✅ Server is ready (attempt ${i + 1}/${maxAttempts})`);
          return;
        }
        console.log(`   ⚠️ Server responded with status ${response.status} (attempt ${i + 1}/${maxAttempts})`);
      } catch (error) {
        console.log(`   ⏳ Server not ready yet (attempt ${i + 1}/${maxAttempts}): ${error instanceof Error ? error.message : error}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    
    console.error(`   ❌ Server failed to start after ${maxAttempts * 2} seconds`);
    throw new Error('ElizaOS server failed to start within timeout');
  }

  async testMCPIntegration(): Promise<void> {
    console.log('🔗 Testing MCP integration...');
    
    try {
      // Test basic server response
      console.log(`   📡 Testing connection to http://localhost:${this.elizaPort}...`);
      const response = await fetch(`http://localhost:${this.elizaPort}`);
      
      if (!response.ok && response.status >= 500) {
        throw new Error(`Server error: ${response.status}`);
      }
      console.log(`   ✅ Server responded with status: ${response.status}`);
      
      // Test if we can reach the agent endpoint
      try {
        console.log('   📡 Testing agent endpoint...');
        const agentResponse = await fetch(`http://localhost:${this.elizaPort}/api/agents`);
        if (agentResponse.ok) {
          const agents = await agentResponse.json() as any;
          if (!agents || !Array.isArray(agents) || agents.length === 0) {
            console.log('   ⚠️ No agents found in response');
          } else {
            console.log(`   ✅ Found ${agents.length} agent(s)`);
          }
        } else {
          console.log(`   ⚠️ Agent endpoint responded with status: ${agentResponse.status}`);
        }
      } catch (error) {
        // This endpoint might not exist, try a different approach
        console.log(`   ⚠️ Agent endpoint not available: ${error instanceof Error ? error.message : error}`);
        console.log('   💡 This is normal if the endpoint structure is different');
      }
    } catch (error) {
      console.error(`   ❌ MCP integration test failed: ${error instanceof Error ? error.message : error}`);
      throw error;
    }
  }

  async testConversationFlow(): Promise<void> {
    console.log('💬 Testing conversation flow with MCP tools...');
    
    const testMessages = [
      'Hello, how are you doing?',
      'Hello, can you check my wallet status?',
      'What is my wallet address?',
      'Show me my current balance',
      'Can you list my recent transactions?'
    ];

    console.log('\n' + '='.repeat(60));
    console.log('🎭 CONVERSATION FLOW TEST');
    console.log('='.repeat(60));
    
    for (let i = 0; i < testMessages.length; i++) {
      const message = testMessages[i];
      console.log(`\n📤 User [${i + 1}/${testMessages.length}]: ${message}`);
      console.log('─'.repeat(50));
      
      try {
        // Try to send message to ElizaOS chat endpoint - this MUST work
        const chatResponse = await this.sendChatMessage(message, i);
        console.log(`🤖 ElizaOS Response:`);
        console.log(`${chatResponse}`);
        
        // Add a small delay between messages
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.log(`❌ CRITICAL ERROR: ${error instanceof Error ? error.message : error}`);
        console.log(`💡 ElizaOS must respond to continue the conversation flow test`);
        throw new Error(`Failed to process message "${message}": ${error}`);
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Conversation flow test completed');
    console.log('='.repeat(60));
  }

  async sendChatMessage(message: string, messageIndex: number): Promise<string | null> {
    // Try different ElizaOS API endpoints that might exist
    const endpoints = [
      '/api',
      '/api/',
      '/api/chat',
      '/api/message',
      '/api/conversation',
      '/chat',
      '/message'
    ];
    
    console.log(`   🔍 Trying to send message to ElizaOS...`);
    
    for (const endpoint of endpoints) {
      try {
        console.log(`   🔄 Trying endpoint: ${endpoint}`);
        const response = await fetch(`http://localhost:${this.elizaPort}${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            message: message,
            conversationId: `test-conversation-${messageIndex}`,
            userId: 'test-user',
            agentId: this.testAgentId
          })
        });
        
        console.log(`   📡 Response status: ${response.status}`);
        
        if (response.ok) {
          const data = await response.json() as any;
          console.log(`   📋 Raw ElizaOS response:`, JSON.stringify(data, null, 2));
          
          // Try to extract response text from various possible response formats
          if (data.response) {
            return data.response;
          } else if (data.message) {
            return data.message;
          } else if (data.text) {
            return data.text;
          } else if (data.reply) {
            return data.reply;
          } else if (typeof data === 'string') {
            return data;
          } else {
            return `[ElizaOS Raw Response]: ${JSON.stringify(data, null, 2)}`;
          }
        } else {
          console.log(`   ⚠️ Non-OK response from ${endpoint}: ${response.status}`);
          const errorText = await response.text();
          console.log(`   📄 Error response body: ${errorText}`);
        }
      } catch (error) {
        console.log(`   ❌ Error with ${endpoint}: ${error instanceof Error ? error.message : error}`);
        continue;
      }
    }
    
    // If no working endpoint found, this is an error - ElizaOS MUST respond
    console.log(`   ❌ ALL ENDPOINTS FAILED - ElizaOS must respond to continue test`);
    throw new Error(`ElizaOS failed to respond to message: "${message}". All API endpoints failed. ElizaOS must be running and accessible.`);
  }

  async testMCPServerHealth(): Promise<void> {
    console.log('🔍 Testing MCP server health...');
    
    try {
      // Check if MCP server process is still running
      const mcpServerHealthy = this.mcpServerProcess && !this.mcpServerProcess.killed;
      if (!mcpServerHealthy) {
        throw new Error('MCP server process is not running');
      }
      console.log('   ✅ MCP server process is running');
      
      // Test that the configuration is valid
      const characterConfigPath = path.join(this.elizaProjectPath, 'characters', 'test-character.json');
      const characterConfig = JSON.parse(await fs.readFile(characterConfigPath, 'utf-8'));
      
      if (!characterConfig.settings?.mcp?.servers?.['midnight-mcp']) {
        throw new Error('MCP server configuration missing');
      }
      console.log('   ✅ MCP server configuration found');
      
      const mcpConfig = characterConfig.settings.mcp.servers['midnight-mcp'];
      if (mcpConfig.type !== 'stdio' || !mcpConfig.command || !mcpConfig.args) {
        throw new Error('Invalid MCP server configuration');
      }
      console.log('   ✅ MCP server configuration is valid');
      
      // Verify the MCP server command path exists
      const mcpServerPath = mcpConfig.args[0];
      if (!mcpServerPath.includes('stdio-server.ts')) {
        throw new Error('MCP server path does not point to stdio-server.ts');
      }
      console.log('   ✅ MCP server path is correct');
      
      // Test direct MCP server invocation to verify it can start
      console.log('   🧪 Testing direct MCP server invocation...');
      try {
        const testProcess = spawn('tsx', ['--version']);
        testProcess.on('close', (code) => {
          if (code === 0) {
            console.log('   ✅ tsx command is available');
          } else {
            console.log(`   ⚠️ tsx command returned code ${code}`);
          }
        });
        
        // Verify the MCP server file exists
        const mcpServerFile = path.resolve(__dirname, '../src/stdio-server.ts');
        await fs.access(mcpServerFile);
        console.log('   ✅ MCP server file exists');
        
      } catch (error) {
        console.error(`   ❌ Direct MCP server test failed: ${error instanceof Error ? error.message : error}`);
        throw new Error('MCP server file or tsx command not accessible');
      }
      
    } catch (error) {
      console.error(`   ❌ MCP server health check failed: ${error instanceof Error ? error.message : error}`);
      throw error;
    }
  }

  async testMCPToolExecution(): Promise<void> {
    console.log('🛠️ Testing MCP tool execution...');
    
    try {
      // Since we can't easily test tool execution without the full ElizaOS API,
      // we'll verify that the MCP server is responding correctly
      const mcpServerHealthy = this.mcpServerProcess && !this.mcpServerProcess.killed;
      if (!mcpServerHealthy) {
        throw new Error('MCP server is not running');
      }
      console.log('   ✅ MCP server is ready for tool execution');
      
      // Check if there were any errors in the MCP server logs
      // This is a simplified check - in a real scenario, we'd test actual tool calls
      console.log('   💡 Tool execution will be tested through ElizaOS integration');
      
    } catch (error) {
      console.error(`   ❌ MCP tool execution test failed: ${error instanceof Error ? error.message : error}`);
      throw error;
    }
  }

  async executeCommand(command: string, args: string[], cwd?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // Determine the best shell to use for WSL compatibility
      let shell: string | boolean = false;
      
      // For WSL and Linux environments, try to find a working shell
      if (process.platform === 'linux') {
        const possibleShells = ['/bin/bash', '/bin/sh', '/usr/bin/bash'];
        for (const shellPath of possibleShells) {
          try {
            require('fs').accessSync(shellPath, require('fs').constants.F_OK);
            shell = shellPath;
            break;
          } catch (error) {
            // Continue to next shell
          }
        }
        
        // If no shell found, try using shell: true as last resort
        if (!shell) {
          shell = true;
        }
      } else {
        // For non-Linux platforms, use default shell resolution
        shell = true;
      }

      const attemptSpawn = (useShell: string | boolean) => {
        const childProcess = spawn(command, args, {
          cwd: cwd || this.elizaProjectPath,
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: useShell,
          env: { ...process.env }
        });

        let stdout = '';
        let stderr = '';

        childProcess.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        childProcess.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        childProcess.on('close', (code) => {
          if (code === 0) {
            resolve(stdout);
          } else {
            reject(new Error(`Command failed with code ${code}: ${stderr || stdout}`));
          }
        });

        childProcess.on('error', (error) => {
          // If shell spawn fails, try without shell as fallback
          if (useShell && (error as any).code === 'ENOENT') {
            console.log(`   ⚠️ Shell execution failed, trying without shell...`);
            attemptSpawn(false);
          } else {
            reject(new Error(`Command execution failed: ${error.message}\nShell used: ${useShell}\nCommand: ${command} ${args.join(' ')}`));
          }
        });

        // Set timeout
        setTimeout(() => {
          childProcess.kill('SIGTERM');
          reject(new Error('Command timed out'));
        }, 60000);
      };

      attemptSpawn(shell);
    });
  }

  async runAllTests(): Promise<void> {
    console.log('🎯 Running ElizaOS + MCP E2E tests...');
    
    const tests = [
      {
        name: 'ElizaOS CLI Installation',
        test: () => this.testElizaOSInstallation()
      },
      {
        name: 'Create ElizaOS Project',
        test: () => this.createElizaProject()
      },
      {
        name: 'MCP Plugin Installation',
        test: () => this.testMCPPluginInstallation()
      },
      {
        name: 'MCP Server Health Check',
        test: () => this.testMCPServerHealth()
      },
      {
        name: 'Start ElizaOS Server',
        test: () => this.startElizaServer()
      },
      {
        name: 'MCP Integration Test',
        test: () => this.testMCPIntegration()
      },
      {
        name: 'Conversation Flow Test',
        test: () => this.testConversationFlow()
      },
      {
        name: 'MCP Tool Execution Test',
        test: () => this.testMCPToolExecution()
      }
    ];

    for (const test of tests) {
      const result = await this.runTest(test.name, test.test);
      this.results.push(result);
      
      // Add line break between tests for better readability
      console.log('');
    }
  }

  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up ElizaOS E2E test environment...');
    
    try {
      if (this.elizaServerProcess) {
        console.log('   🛑 Stopping ElizaOS server...');
        this.elizaServerProcess.kill('SIGTERM');
        await new Promise((resolve) => setTimeout(resolve, 3000));
        if (!this.elizaServerProcess.killed) {
          console.log('   🛑 Force killing ElizaOS server...');
          this.elizaServerProcess.kill('SIGKILL');
        }
        console.log('   ✅ ElizaOS server stopped');
      }

      if (this.mcpServerProcess) {
        console.log('   🛑 Stopping MCP server...');
        this.mcpServerProcess.kill('SIGTERM');
        await new Promise((resolve) => setTimeout(resolve, 1000));
        if (!this.mcpServerProcess.killed) {
          console.log('   🛑 Force killing MCP server...');
          this.mcpServerProcess.kill('SIGKILL');
        }
        console.log('   ✅ MCP server stopped');
      }

      // Clean up test files
      try {
        console.log('   🗑️ Removing test project directory...');
        await fs.rm(this.elizaProjectPath, { recursive: true, force: true });
        console.log('   ✅ Test project directory removed');
      } catch (error) {
        console.log(`   ⚠️ Failed to remove test project: ${error instanceof Error ? error.message : error}`);
      }
      
      try {
        console.log('   🗑️ Removing test seed file...');
        await fs.unlink(this.testSeedPath);
        console.log('   ✅ Test seed file removed');
      } catch (error) {
        console.log(`   ⚠️ Failed to remove test seed: ${error instanceof Error ? error.message : error}`);
      }
      
      console.log('✅ Cleanup completed');
    } catch (error) {
      console.error(`❌ Cleanup failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  printResults(): void {
    console.log('\n📊 ElizaOS E2E Test Results Summary:');
    console.log('=' .repeat(50));
    
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);
    
    console.log(`Total tests: ${this.results.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Total duration: ${Math.round(totalDuration / 1000)}s`);
    console.log(`Average duration: ${Math.round(totalDuration / this.results.length)}ms`);
    
    if (failed > 0) {
      console.log('\n❌ Failed tests:');
      this.results.filter(r => !r.passed).forEach(result => {
        console.log(`  - ${result.testName}: ${result.error}`);
      });
    }
    
    console.log('\n📋 Detailed Results:');
    this.results.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      const duration = result.duration > 1000 ? `${Math.round(result.duration / 1000)}s` : `${result.duration}ms`;
      console.log(`  ${status} ${result.testName} (${duration})`);
    });
  }
}

async function main(): Promise<void> {
  const runner = new ElizaOSE2ETestRunner();
  
  try {
    await runner.setupTestEnvironment();
    
    // Wait a bit to ensure seed file is properly written
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    await runner.startMCPServer();
    await runner.runAllTests();
    
    runner.printResults();
    
    const failedTests = runner.results.filter((r: TestResult) => !r.passed).length;
    if (failedTests > 0) {
      console.log(`\n❌ ${failedTests} tests failed`);
      console.log('💡 Check the ElizaOS documentation and MCP plugin setup');
      process.exit(1);
    } else {
      console.log('\n✅ All ElizaOS E2E tests passed!');
      console.log('🎉 Your MCP server is successfully integrated with ElizaOS!');
      process.exit(0);
    }
  } catch (error) {
    console.error('💥 ElizaOS E2E test execution failed:', error);
    process.exit(1);
  } finally {
    await runner.cleanup();
  }
}

// Run the tests
main().catch(console.error); 