import { MCPServer } from '../../../src/mcp/index.js';
import { generateTestSeed, waitForWalletReady, getTestNetworkId } from '../helpers.js';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import type { WalletConfig } from '../../../src/wallet/index.js';

/**
 * These tests demonstrate how to connect to a custom network configuration.
 * They are skipped by default as they require a specific network setup.
 * 
 * To run these tests, set the CUSTOM_NETWORK environment variables:
 * - CUSTOM_NETWORK_API_HOST
 * - CUSTOM_NETWORK_API_PORT
 * - CUSTOM_NETWORK_PROOF_HOST
 * - CUSTOM_NETWORK_PROOF_PORT
 * - CUSTOM_NETWORK_PROOF_API_KEY
 */

// Skip tests unless custom network environment variables are set
const skipTests = !process.env.CUSTOM_NETWORK_API_HOST || process.env.SKIP_INTEGRATION_TESTS === 'true';

// Create a temporary wallet file for testing
function createTempWalletFile(): string {
  const tempDir = path.join(os.tmpdir(), 'midnight-mcp-test');
  
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  return path.join(tempDir, `wallet-custom-${randomUUID()}.json`);
}

// Create custom network configuration from environment variables
function createCustomNetworkConfig(): WalletConfig {
  const host = process.env.CUSTOM_NETWORK_API_HOST || 'localhost';
  const port = process.env.CUSTOM_NETWORK_API_PORT || '5001';
  const proofHost = process.env.CUSTOM_NETWORK_PROOF_HOST || host;
  const proofPort = process.env.CUSTOM_NETWORK_PROOF_PORT || '5002';
  const useHttps = process.env.CUSTOM_NETWORK_API_USE_HTTPS === 'true';
  const proofHttps = process.env.CUSTOM_NETWORK_PROOF_USE_HTTPS === 'true';
  
  const protocol = useHttps ? 'https' : 'http';
  const wsProtocol = useHttps ? 'wss' : 'ws';
  const proofProtocol = proofHttps ? 'https' : 'http';
  
  return {
    indexer: `${protocol}://${host}:${port}/api/v1/graphql`,
    indexerWS: `${wsProtocol}://${host}:${port}/api/v1/graphql/ws`,
    node: `${protocol}://${host}:${port}`,
    proofServer: `${proofProtocol}://${proofHost}:${proofPort}`,
    useExternalProofServer: true
  };
}

describe('Custom Network Integration Tests', () => {
  // Skip all tests if environment variables are not set
  if (skipTests) {
    it.skip('Custom network tests are skipped', () => {
      console.log('Skipping custom network tests as environment variables are not set');
    });
    return;
  }
  
  let mcpServer: MCPServer;
  let walletFile: string;
  let seed: string;
  
  beforeAll(() => {
    // Create test wallet and seed
    seed = generateTestSeed();
    walletFile = createTempWalletFile();
    
    console.log('Custom network test wallet file:', walletFile);
    console.log('Connecting to custom network:', {
      apiHost: process.env.CUSTOM_NETWORK_API_HOST,
      apiPort: process.env.CUSTOM_NETWORK_API_PORT,
      proofHost: process.env.CUSTOM_NETWORK_PROOF_HOST,
      proofPort: process.env.CUSTOM_NETWORK_PROOF_PORT
    });
  });
  
  afterAll(async () => {
    // Cleanup - remove the temporary wallet file
    if (fs.existsSync(walletFile)) {
      fs.unlinkSync(walletFile);
    }
  });
  
  beforeEach(async () => {
    // Create a new MCP server for custom network
    mcpServer = new MCPServer(
      getTestNetworkId(),
      seed,
      walletFile,
      createCustomNetworkConfig()
    );
    
    // Wait for the wallet to be ready before running tests
    jest.setTimeout(120000); // Allow 2 minutes for wallet to sync with custom network
    
    try {
      await waitForWalletReady(() => mcpServer.isReady());
      console.log('Wallet is ready for testing on custom network');
    } catch (error) {
      console.error('Failed to initialize wallet for custom network testing:', error);
      throw error;
    }
  });
  
  afterEach(async () => {
    // Close the server after each test
    await mcpServer.close();
  });
  
  it('should connect to custom network and return a valid address', () => {
    const address = mcpServer.getAddress();
    expect(address).toBeDefined();
    expect(typeof address).toBe('string');
    expect(address.length).toBeGreaterThan(10);
    expect(address).toMatch(/^mdnt/);
    
    console.log('Successfully connected to custom network and retrieved address:', address);
  });
  
  // Add more custom network tests as needed
}); 