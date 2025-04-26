import { MCPServer } from '../../../src/mcp/index.js';
import { generateTestSeed, createLocalNetworkConfig, waitForWalletReady, getTestNetworkId } from '../helpers.js';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { randomUUID } from 'node:crypto';

/**
 * These integration tests require a running local Midnight network.
 * To run these tests, you can start a local network using docker-compose from the Midnight repository.
 * 
 * The tests can be skipped when the local network is not available by setting the SKIP_INTEGRATION_TESTS environment variable.
 */

// Skip all tests if SKIP_INTEGRATION_TESTS is set
const skipTests = process.env.SKIP_INTEGRATION_TESTS === 'true';

// Create a temporary wallet file for testing
function createTempWalletFile(): string {
  const tempDir = path.join(os.tmpdir(), 'midnight-mcp-test');
  
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  return path.join(tempDir, `wallet-${randomUUID()}.json`);
}

describe('MCPServer Integration Tests', () => {
  // Skip all tests if environment variable is set
  if (skipTests) {
    it.skip('Integration tests are skipped', () => {
      console.log('Skipping integration tests as SKIP_INTEGRATION_TESTS is set');
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
    
    console.log('Integration test wallet file:', walletFile);
  });
  
  afterAll(async () => {
    // Cleanup - remove the temporary wallet file
    if (fs.existsSync(walletFile)) {
      fs.unlinkSync(walletFile);
    }
  });
  
  beforeEach(async () => {
    // Create a new MCP server for each test to ensure clean state
    mcpServer = new MCPServer(
      getTestNetworkId(),
      seed,
      walletFile,
      createLocalNetworkConfig()
    );
    
    // Wait for the wallet to be ready before running tests
    jest.setTimeout(60000); // Allow 60 seconds for wallet to sync
    
    try {
      await waitForWalletReady(() => mcpServer.isReady());
      console.log('Wallet is ready for testing');
    } catch (error) {
      console.error('Failed to initialize wallet for testing:', error);
      throw error;
    }
  });
  
  afterEach(async () => {
    // Close the server after each test
    await mcpServer.close();
  });
  
  describe('Basic Wallet Operations', () => {
    it('should return a valid address', () => {
      const address = mcpServer.getAddress();
      expect(address).toBeDefined();
      expect(typeof address).toBe('string');
      expect(address.length).toBeGreaterThan(10); // Simple validation
      expect(address).toMatch(/^mdnt/); // Midnight addresses start with mdnt
    });
    
    it('should return a balance', () => {
      const balance = mcpServer.getBalance();
      expect(balance).toBeDefined();
      expect(typeof balance).toBe('bigint');
      // In a local test network, we might have a zero balance initially
    });
  });
  
  /**
   * The following test is commented out because it requires an actual transaction on the network.
   * In a real integration test environment, you would use a faucet or pre-fund the test wallet.
   */
  /*
  describe('Transaction Operations', () => {
    it('should send funds if wallet has balance', async () => {
      const balance = mcpServer.getBalance();
      
      // Skip test if we don't have any funds
      if (balance <= 0n) {
        console.log('Skipping sendFunds test - no balance available');
        return;
      }
      
      const testAmount = 1n; // Send minimal amount
      const destinationAddress = 'mdnt1test_destination_address'; // Use a valid test address
      
      const result = await mcpServer.sendFunds(destinationAddress, testAmount);
      expect(result).toBeDefined();
      expect(result.txHash).toBeDefined();
      expect(typeof result.txHash).toBe('string');
      
      // Validate the transaction
      const txStatus = mcpServer.validateTx(result.txHash);
      expect(txStatus).toBeDefined();
      expect(txStatus.status).toBe('pending');
      
      // For a complete test, you would wait for confirmation here
    });
  });
  */
}); 