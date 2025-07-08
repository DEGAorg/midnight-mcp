#!/usr/bin/env node

/**
 * Test script for Midnight MCP Agent
 * This script demonstrates how to use the compiled MCP server
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🌙 Testing Midnight MCP Agent...');
console.log('=' .repeat(50));

// Configuration
const AGENT_ID = 'test-eliza-e2e-agent';
const serverPath = path.join(__dirname, 'dist', 'stdio-server.js');

// Environment variables
const env = {
  ...process.env,
  AGENT_ID: AGENT_ID,
  NODE_ENV: 'production',
  WALLET_SERVER_HOST: 'localhost',
  WALLET_SERVER_PORT: '3004',
  NETWORK_ID: 'TestNet',
  USE_EXTERNAL_PROOF_SERVER: 'false'
};

console.log('🔧 Configuration:');
console.log('   Agent ID:', AGENT_ID);
console.log('   Server Path:', serverPath);
console.log('   Network:', env.NETWORK_ID);
console.log('   Environment:', env.NODE_ENV);
console.log('');

// Test MCP server startup
console.log('🚀 Starting MCP server...');

const serverProcess = spawn('node', [serverPath], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: env
});

let startupComplete = false;

serverProcess.stdout.on('data', (data) => {
  if (!startupComplete) {
    console.log('📡 Server output:', data.toString().trim());
  }
});

serverProcess.stderr.on('data', (data) => {
  const output = data.toString().trim();
  if (output.includes('Server started successfully')) {
    console.log('✅ MCP server started successfully!');
    startupComplete = true;
    
    // Give it a moment to fully initialize
    setTimeout(() => {
      console.log('');
      console.log('🎯 MCP server is ready for ElizaOS connection!');
      console.log('');
      console.log('📋 Next steps:');
      console.log('   1. Start ElizaOS with: elizaos start --character midnight-mcp-agent.json');
      console.log('   2. Ask questions like:');
      console.log('      - "What is my wallet address?"');
      console.log('      - "Show me my balance"');
      console.log('      - "List my recent transactions"');
      console.log('');
      console.log('🛑 Press Ctrl+C to stop the server');
    }, 2000);
  } else if (output.includes('ERROR') || output.includes('Failed')) {
    console.log('❌ Server error:', output);
  } else {
    console.log('📋 Server log:', output);
  }
});

serverProcess.on('error', (error) => {
  console.error('💥 Failed to start server:', error.message);
  process.exit(1);
});

serverProcess.on('close', (code) => {
  console.log(`🛑 MCP server exited with code ${code}`);
  process.exit(code);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down MCP server...');
  serverProcess.kill('SIGTERM');
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down MCP server...');
  serverProcess.kill('SIGTERM');
}); 