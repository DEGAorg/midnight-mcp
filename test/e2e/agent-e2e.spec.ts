import { describe, it, beforeAll, afterAll, beforeEach, afterEach, expect } from '@jest/globals';
import {
  ElizaHttpClient,
  TestValidator,
  TestResult,
  TestResultFormatter,
  TestLogger,
  WaitUtils,
  DEFAULT_ELIZA_CONFIG,
  ElizaResponse
} from './helpers.js';

/**
 * Eliza Integration Tests for Midnight MCP Server
 * 
 * These tests validate the complete integration between Eliza AI agents
 * and the Midnight MCP server through HTTP API calls.
 * 
 * Prerequisites:
 * - Docker backend is up and running
 * - Eliza AI agents are up and running
 * - All services are accessible via HTTP
 */

describe('Eliza Integration Tests', () => {
  let elizaClient: ElizaHttpClient;
  let logger: TestLogger;
  let testResults: Array<{ name: string; result: TestResult }> = [];

  beforeAll(async () => {
    logger = new TestLogger('ELIZA-E2E');
    elizaClient = new ElizaHttpClient(DEFAULT_ELIZA_CONFIG);
    
    logger.info('Starting Eliza Integration Tests');
    logger.info(`Eliza API URL: ${DEFAULT_ELIZA_CONFIG.baseUrl}`);
    
    // Wait for services to be ready
    await WaitUtils.wait(2000);
  });

  afterAll(async () => {
    logger.info('Eliza Integration Tests completed');
    logger.info(TestResultFormatter.formatSummary(testResults));
  });

  beforeEach(() => {
    // Reset test results for each test suite
    testResults = [];
  });

  afterEach(() => {
    // Log results for each test suite
    if (testResults.length > 0) {
      logger.info(`Test suite completed with ${testResults.length} tests`);
      testResults.forEach(({ name, result }) => {
        logger.info(TestResultFormatter.formatResult(name, result));
      });
    }
  });

  /**
   * WALLET TESTS
   */
  describe('Wallet Functionality', () => {
    
    describe('Wallet Status', () => {
      it('should check wallet status', async () => {
        const testName = 'Check Wallet Status';
        logger.info(`Running: ${testName}`);
        
        const response = await elizaClient.sendMessageWithRetry('What is the midnight wallet status?');
        
        const result: TestResult = {
          passed: response.success && TestValidator.hasWalletInfo(response.message),
          message: response.success ? 
            `Wallet status check successful. Response: ${response.message.substring(0, 200)}...` :
            `Failed to check wallet status: ${response.error}`,
          data: response.data,
          error: response.error
        };
        
        testResults.push({ name: testName, result });
        expect(result.passed).toBe(true);
      }, 30000);

      it.only('should get wallet address', async () => {
        const testName = 'Get Wallet Address';
        logger.info(`Running: ${testName}`);
        
        const response = await elizaClient.sendMessageWithRetry('What is my wallet address?');
        
        const walletAddress = TestValidator.extractWalletAddress(response.message);
        const result: TestResult = {
          passed: response.success && TestValidator.hasValidAddress(response.message),
          message: response.success ? 
            `Wallet address retrieved successfully: ${walletAddress}` :
            `Failed to get wallet address: ${response.error}`,
          data: { 
            walletAddress,
            isValidMidnight: walletAddress ? TestValidator.isValidMidnightAddress(walletAddress) : false,
            isValidHex: walletAddress ? TestValidator.isValidHexAddress(walletAddress) : false
          },
          error: response.error
        };
        
        testResults.push({ name: testName, result });
        console.log('result', result);
        expect(result.passed).toBe(true);
      }, 30000);

      it('should get wallet balance', async () => {
        const testName = 'Get Wallet Balance';
        logger.info(`Running: ${testName}`);
        
        const response = await elizaClient.sendMessageWithRetry('What is my balance?');
        
        const balance = TestValidator.extractBalance(response.message);
        const result: TestResult = {
          passed: response.success && TestValidator.hasWalletInfo(response.message),
          message: response.success ? 
            `Balance retrieved successfully: ${balance || 'amount not extracted'}` :
            `Failed to get balance: ${response.error}`,
          data: { balance },
          error: response.error
        };
        
        testResults.push({ name: testName, result });
        expect(result.passed).toBe(true);
      }, 30000);

      it('should get wallet configuration', async () => {
        const testName = 'Get Wallet Configuration';
        logger.info(`Running: ${testName}`);
        
        const response = await elizaClient.sendMessageWithRetry('What is the wallet configuration?');
        
        const result: TestResult = {
          passed: response.success && TestValidator.hasWalletInfo(response.message),
          message: response.success ? 
            `Wallet configuration retrieved successfully. Response: ${response.message.substring(0, 200)}...` :
            `Failed to get wallet configuration: ${response.error}`,
          data: response.data,
          error: response.error
        };
        
        testResults.push({ name: testName, result });
        expect(result.passed).toBe(true);
      }, 30000);
    });

    describe('Transaction Operations', () => {
      it('should send funds to a sample address', async () => {
        const testName = 'Send Funds to Sample Address';
        logger.info(`Running: ${testName}`);
        
        const sampleAddress = 'mn_shield-addr_test19xcjsrp9qku2t7w59uelzfzgegey9ghtefapn9ga3ys5nq0qazksxqy9ej627ysrd0946qswt8feer7j86pvltk4p6m63zwavfkdqnj2zgqp93ev';
        const amount = '1'; // 1 MID in dust units
        
        const response = await elizaClient.sendMessageWithRetry(
          `Send ${amount} dust units to address ${sampleAddress}`
        );
        
        const transactionId = TestValidator.extractTransactionId(response.message);
        const result: TestResult = {
          passed: response.success && (TestValidator.hasSuccessIndicators(response.message) || transactionId !== null),
          message: response.success ? 
            `Funds sent successfully. Transaction ID: ${transactionId || 'not extracted'}` :
            `Failed to send funds: ${response.error}`,
          data: { 
            destinationAddress: sampleAddress,
            amount,
            transactionId 
          },
          error: response.error
        };
        
        testResults.push({ name: testName, result });
        expect(result.passed).toBe(true);
      }, 30000);

      it('should verify a transaction that has not been received', async () => {
        const testName = 'Verify Non-Existent Transaction';
        logger.info(`Running: ${testName}`);
        
        const fakeTransactionId = 'fake-transaction-id-12345';
        const response = await elizaClient.sendMessageWithRetry(
          `Verify transaction ${fakeTransactionId}`
        );
        
        const result: TestResult = {
          passed: response.success && (
            TestValidator.hasErrorIndicators(response.message) || 
            response.message.toLowerCase().includes('not found') ||
            response.message.toLowerCase().includes('not received')
          ),
          message: response.success ? 
            `Transaction verification completed. Expected not found result: ${response.message.substring(0, 200)}...` :
            `Failed to verify transaction: ${response.error}`,
          data: { transactionId: fakeTransactionId },
          error: response.error
        };
        
        testResults.push({ name: testName, result });
        expect(result.passed).toBe(true);
      }, 30000);

    });
  });

  /**
   * MARKETPLACE TESTS
   */
  describe('Marketplace Functionality', () => {
    
    describe('Authentication and Status', () => {
      it('should check marketplace login status', async () => {
        const testName = 'Check Marketplace Login Status';
        logger.info(`Running: ${testName}`);
        
        const response = await elizaClient.sendMessageWithRetry('Am I logged into the marketplace?');
        
        const result: TestResult = {
          passed: response.success && (
            TestValidator.hasMarketplaceInfo(response.message) || 
            response.message.toLowerCase().includes('marketplace')
          ),
          message: response.success ? 
            `Marketplace login status checked: ${response.message.substring(0, 200)}...` :
            `Failed to check marketplace login: ${response.error}`,
          data: response.data,
          error: response.error
        };
        
        testResults.push({ name: testName, result });
        expect(result.passed).toBe(true);
      }, 30000);
    });

    describe('Service Management', () => {
      it('should list available services', async () => {
        const testName = 'List Available Services';
        logger.info(`Running: ${testName}`);
        
        const response = await elizaClient.sendMessageWithRetry('List services available in the marketplace');
        
        const result: TestResult = {
          passed: response.success && TestValidator.hasMarketplaceInfo(response.message),
          message: response.success ? 
            `Services listed successfully: ${response.message.substring(0, 200)}...` :
            `Failed to list services: ${response.error}`,
          data: response.data,
          error: response.error
        };
        
        testResults.push({ name: testName, result });
        expect(result.passed).toBe(true);
      }, 30000);

      it('should register a new service', async () => {
        const testName = 'Register New Service';
        logger.info(`Running: ${testName}`);
        
        const serviceName = 'Test Service';
        const serviceDescription = 'A test service for E2E testing';
        const sampleAddress = 'mn_shield-addr_test19xcjsrp9qku2t7w59uelzfzgegey9ghtefapn9ga3ys5nq0qazksxqy9ej627ysrd0946qswt8feer7j86pvltk4p6m63zwavfkdqnj2zgqp93ev';
        
        const response = await elizaClient.sendMessageWithRetry(
          `Register a new service called "${serviceName}" with description "${serviceDescription}" price 25 DUST and to receive payment at address ${sampleAddress}`
        );
        
        const result: TestResult = {
          passed: response.success && (
            TestValidator.hasSuccessIndicators(response.message) || 
            response.message.toLowerCase().includes('registered') ||
            response.message.toLowerCase().includes('created')
          ),
          message: response.success ? 
            `Service registration attempted: ${response.message.substring(0, 200)}...` :
            `Failed to register service: ${response.error}`,
          data: { serviceName, serviceDescription },
          error: response.error
        };
        
        testResults.push({ name: testName, result });
        expect(result.passed).toBe(true);
      }, 30000);  

      it('should add content to a registered service', async () => {
        const testName = 'Add Content to Service';
        logger.info(`Running: ${testName}`);
        
        const content = 'This is test content for the service';
        
        const response = await elizaClient.sendMessageWithRetry(
          `Add content to the service: "${content}"`
        );
        
        const result: TestResult = {
          passed: response.success && (
            TestValidator.hasSuccessIndicators(response.message) || 
            TestValidator.hasMarketplaceInfo(response.message)
          ),
          message: response.success ? 
            `Content addition attempted: ${response.message.substring(0, 200)}...` :
            `Failed to add content: ${response.error}`,
          data: { content },
          error: response.error
        };
        
        testResults.push({ name: testName, result });
        expect(result.passed).toBe(true);
      }, 30000);
    });
  });

  /**
   * INTEGRATION TESTS
   */
  describe('Cross-Functionality Integration', () => {
    
    it('should perform a complete wallet-to-marketplace flow', async () => {
      const testName = 'Complete Wallet-to-Marketplace Flow';
      logger.info(`Running: ${testName}`);
      
      // Step 1: Check wallet status
      const walletResponse = await elizaClient.sendMessageWithRetry('What is my wallet status?');
      
      // Step 2: Check marketplace status
      const marketplaceResponse = await elizaClient.sendMessageWithRetry('Am I logged into the marketplace?');
      
      // Step 3: List services
      const servicesResponse = await elizaClient.sendMessageWithRetry('List available services');
      
      const result: TestResult = {
        passed: walletResponse.success && marketplaceResponse.success && servicesResponse.success,
        message: `Integration flow completed:
          - Wallet status: ${walletResponse.success ? 'OK' : 'FAILED'}
          - Marketplace status: ${marketplaceResponse.success ? 'OK' : 'FAILED'}
          - Services listing: ${servicesResponse.success ? 'OK' : 'FAILED'}`,
        data: {
          walletStatus: walletResponse.success,
          marketplaceStatus: marketplaceResponse.success,
          servicesStatus: servicesResponse.success
        },
        error: walletResponse.error || marketplaceResponse.error || servicesResponse.error
      };
      
      testResults.push({ name: testName, result });
      expect(result.passed).toBe(true);
    }, 30000);

    it('should handle error conditions gracefully', async () => {
      const testName = 'Error Handling Test';
      logger.info(`Running: ${testName}`);
      
      // Try to access a non-existent endpoint or invalid data
      const response = await elizaClient.sendMessageWithRetry('Access invalid wallet data');
      
      const result: TestResult = {
        passed: response.success, // Even error responses should be handled gracefully
        message: response.success ? 
          `Error handling test completed: ${response.message.substring(0, 200)}...` :
          `Error handling test failed: ${response.error}`,
        data: response.data,
        error: response.error
      };
      
      testResults.push({ name: testName, result });
      expect(result.passed).toBe(true);
    }, 30000);
  });
});
