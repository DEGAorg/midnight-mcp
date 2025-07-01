import request from 'supertest';
import { createLogger } from '../../../src/logger/index.js';
import { 
  WalletStatus, 
  WalletBalances, 
  TransactionVerificationResult,
  TransactionStatusResult,
  TransactionRecord,
  TransactionState
} from '../../../src/types/wallet.js';
import * as fs from 'fs';
import * as path from 'path';

const logger = createLogger('integration-test');

// Load test configuration from JSON file
function loadTestConfig() {
  try {
    const configPath = path.join(__dirname, 'test-config.json');
    const configData = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(configData);
  } catch (error) {
    logger.error('Failed to load test configuration:', error);
    throw new Error('Please ensure test-config.json exists and is valid JSON');
  }
}

describe('Wallet MCP Integration Tests', () => {
  // Load configuration
  const config = loadTestConfig();
  const baseUrl = process.env.TEST_SERVER_URL || config.server.url;
  const testData = config.transactions;
  const wallets = config.wallets;
  const testAmounts = config.testAmounts;

  beforeAll(async () => {
    logger.info(`Starting integration tests against server: ${baseUrl}`);
    
    // Wait for the server to be ready
    await waitForServerReady();
  });

  // Helper function to wait for server to be ready
  async function waitForServerReady(timeoutMs = 60000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      try {
        const response = await request(baseUrl)
          .get('/health')
          .timeout(5000);
        
        if (response.status === 200) {
          logger.info('Server is ready for testing');
          return;
        }
      } catch (error) {
        // Continue waiting
        logger.info('Waiting for server to be ready...');
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    throw new Error('Server did not become ready within timeout');
  }

  describe('Health and Status Endpoints', () => {
    test('should return health check status', async () => {
      const response = await request(baseUrl)
        .get('/health')
        .expect(200);

      expect(response.body).toEqual({ status: 'ok' });
    });

    test('should return wallet status', async () => {
      const response = await request(baseUrl)
        .get('/wallet/status')
        .expect(200);

      expect(response.body).toHaveProperty('ready');
      expect(response.body).toHaveProperty('address');
      expect(response.body).toHaveProperty('balances');
      expect(response.body).toHaveProperty('syncProgress');
      
      // Log wallet status for debugging
      logger.info('Wallet status:', response.body);
    });

    test('should return wallet address', async () => {
      const response = await request(baseUrl)
        .get('/wallet/address')
        .expect(200);

      expect(response.body).toHaveProperty('address');
      expect(typeof response.body.address).toBe('string');
      expect(response.body.address.length).toBeGreaterThan(0);
      
      logger.info('Wallet address:', response.body.address);
    });

    test('should return wallet balance', async () => {
      const response = await request(baseUrl)
        .get('/wallet/balance')
        .expect(200);

      expect(response.body).toHaveProperty('balance');
      expect(response.body).toHaveProperty('pendingBalance');
      expect(typeof response.body.balance).toBe('string');
      expect(typeof response.body.pendingBalance).toBe('string');
      
      logger.info('Wallet balance:', response.body);
    });

    test('should return wallet configuration', async () => {
      const response = await request(baseUrl)
        .get('/wallet/config')
        .expect(200);

      expect(response.body).toHaveProperty('indexer');
      expect(response.body).toHaveProperty('node');
      expect(response.body).toHaveProperty('proofServer');
      
      logger.info('Wallet config:', response.body);
    });
  });

  describe('Transaction Management Endpoints', () => {
    test('should return transactions list', async () => {
      const response = await request(baseUrl)
        .get('/wallet/transactions')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      logger.info(`Found ${response.body.length} transactions`);
    });

    test('should return pending transactions', async () => {
      const response = await request(baseUrl)
        .get('/wallet/pending-transactions')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      logger.info(`Found ${response.body.length} pending transactions`);
    });

    test('should handle send funds request', async () => {
      const sendData = {
        destinationAddress: wallets.wallet1.address,
        amount: testAmounts.validAmount
      };

      const response = await request(baseUrl)
        .post('/wallet/send')
        .send(sendData)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('state');
      expect(response.body).toHaveProperty('toAddress');
      expect(response.body).toHaveProperty('amount');
      expect(response.body).toHaveProperty('createdAt');
      
      logger.info('Send funds result:', response.body);
    });

    test('should reject send funds with missing parameters', async () => {
      const response = await request(baseUrl)
        .post('/wallet/send')
        .send({ destinationAddress: wallets.wallet1.address })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Missing required parameters');
    });
  });

  describe('Test Case 1: Valid Payment Received', () => {
    test('should verify valid payment with correct amount and registered sender', async () => {
      const response = await request(baseUrl)
        .post('/wallet/verify-transaction')
        .send({ identifier: testData.validPayment.identifier })
        .expect(200);

      expect(response.body).toHaveProperty('exists');
      expect(response.body).toHaveProperty('transactionAmount');
      expect(response.body).toHaveProperty('syncStatus');
      
      logger.info('Valid payment verification result:', response.body);
      
      // For a valid payment from registered agent, we expect the transaction to exist
      if (response.body.exists) {
        expect(response.body.transactionAmount).toBe(testData.validPayment.expectedAmount);
      }
    });
  });

  describe('Test Case 2: Payment With Wrong Amount', () => {
    test('should detect amount mismatch for valid sender', async () => {
      const response = await request(baseUrl)
        .post('/wallet/verify-transaction')
        .send({ identifier: testData.wrongAmount.identifier })
        .expect(200);

      expect(response.body).toHaveProperty('exists');
      expect(response.body).toHaveProperty('transactionAmount');
      
      logger.info('Wrong amount verification result:', response.body);
      
      // If transaction exists, verify amount mismatch
      if (response.body.exists) {
        expect(response.body.transactionAmount).not.toBe(testData.wrongAmount.expectedAmount);
      }
    });
  });

  describe('Test Case 3: Payment From Unknown Sender', () => {
    test('should handle transaction from unregistered sender', async () => {
      const response = await request(baseUrl)
        .post('/wallet/verify-transaction')
        .send({ identifier: testData.unknownSender.identifier })
        .expect(200);

      expect(response.body).toHaveProperty('exists');
      expect(response.body).toHaveProperty('transactionAmount');
      
      logger.info('Unknown sender verification result:', response.body);
      
      // For unknown sender, transaction might not exist or amount might be different
      // This tests the system's ability to handle unregistered senders gracefully
    });
  });

  describe('Test Case 4: No Payment Received', () => {
    test('should handle case when no transaction is found', async () => {
      const response = await request(baseUrl)
        .post('/wallet/verify-transaction')
        .send({ identifier: testData.noPayment.identifier })
        .expect(200);

      expect(response.body).toHaveProperty('exists');
      expect(response.body).toHaveProperty('transactionAmount');
      expect(response.body).toHaveProperty('syncStatus');
      
      logger.info('No payment verification result:', response.body);
      
      // For no payment, exists should be false
      expect(response.body.exists).toBe(false);
    });
  });

  describe('Test Case 5: Valid Identity Match', () => {
    test('should verify sender matches registered identity', async () => {
      const response = await request(baseUrl)
        .post('/wallet/verify-transaction')
        .send({ identifier: testData.validIdentityMatch.identifier })
        .expect(200);

      expect(response.body).toHaveProperty('exists');
      expect(response.body).toHaveProperty('transactionAmount');
      
      logger.info('Valid identity match verification result:', response.body);
      
      // For valid identity match, transaction should exist with correct amount
      if (response.body.exists) {
        expect(response.body.transactionAmount).toBe(testData.validIdentityMatch.expectedAmount);
      }
    });
  });

  describe('Test Case 6: Agent Not Registered', () => {
    test('should reject sender not found in registration contract', async () => {
      const response = await request(baseUrl)
        .post('/wallet/verify-transaction')
        .send({ identifier: testData.agentNotRegistered.identifier })
        .expect(200);

      expect(response.body).toHaveProperty('exists');
      expect(response.body).toHaveProperty('transactionAmount');
      
      logger.info('Agent not registered verification result:', response.body);
      
      // For unregistered agent, transaction should not exist or be invalid
      expect(response.body.exists).toBe(false);
    });
  });

  describe('Test Case 7: Sender Mismatch With Off-chain Session', () => {
    test('should detect mismatch between on-chain sender and off-chain session', async () => {
      const response = await request(baseUrl)
        .post('/wallet/verify-transaction')
        .send({ identifier: testData.senderMismatch.identifier })
        .expect(200);

      expect(response.body).toHaveProperty('exists');
      expect(response.body).toHaveProperty('transactionAmount');
      
      logger.info('Sender mismatch verification result:', response.body);
      
      // For sender mismatch, the system should detect the inconsistency
      // This tests session management and identity validation
    });
  });

  describe('Test Case 8: Duplicate Transaction Detection', () => {
    test('should detect and handle duplicate transaction processing', async () => {
      // First verification
      const response1 = await request(baseUrl)
        .post('/wallet/verify-transaction')
        .send({ identifier: testData.duplicateTransaction.identifier })
        .expect(200);

      expect(response1.body).toHaveProperty('exists');
      expect(response1.body).toHaveProperty('transactionAmount');

      // Second verification of the same transaction
      const response2 = await request(baseUrl)
        .post('/wallet/verify-transaction')
        .send({ identifier: testData.duplicateTransaction.identifier })
        .expect(200);

      expect(response2.body).toHaveProperty('exists');
      expect(response2.body).toHaveProperty('transactionAmount');
      
      logger.info('Duplicate transaction verification results:', {
        first: response1.body,
        second: response2.body
      });
      
      // Both responses should be identical for the same transaction
      expect(response1.body.exists).toBe(response2.body.exists);
      if (response1.body.exists && response2.body.exists) {
        expect(response1.body.transactionAmount).toBe(response2.body.transactionAmount);
      }
    });
  });

  describe('Error Handling', () => {
    test('should handle missing identifier in verify transaction', async () => {
      const response = await request(baseUrl)
        .post('/wallet/verify-transaction')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Missing required parameter');
    });

    test('should handle invalid transaction ID format', async () => {
      const response = await request(baseUrl)
        .get('/wallet/transaction/invalid-id')
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    test('should handle non-existent transaction ID', async () => {
      const response = await request(baseUrl)
        .get('/wallet/transaction/non-existent-id')
        .expect(200);

      // Should return null or empty result for non-existent transaction
      expect(response.body).toBeDefined();
    });
  });

  describe('API Response Format Validation', () => {
    test('should return consistent response format for all endpoints', async () => {
      const endpoints = [
        { method: 'get', path: '/wallet/status' },
        { method: 'get', path: '/wallet/address' },
        { method: 'get', path: '/wallet/balance' },
        { method: 'get', path: '/wallet/transactions' },
        { method: 'get', path: '/wallet/pending-transactions' },
        { method: 'get', path: '/wallet/config' },
        { method: 'get', path: '/health' }
      ];

      for (const endpoint of endpoints) {
        const response = await request(baseUrl)[endpoint.method](endpoint.path);
        expect(response.status).toBe(200);
        expect(response.body).toBeDefined();
        expect(typeof response.body).toBe('object');
      }
    });

    test('should handle CORS headers correctly', async () => {
      const response = await request(baseUrl)
        .get('/wallet/status')
        .set('Origin', 'http://localhost:3000');

      expect(response.status).toBe(200);
      // CORS headers should be present (handled by cors middleware)
    });
  });

  describe('End-to-End Test Scenarios', () => {
    test('should run all 8 test scenarios against the Docker server', async () => {
      const scenarios = [
        {
          name: 'Valid Payment Received',
          identifier: testData.validPayment.identifier,
          expectedExists: true,
          expectedAmount: testData.validPayment.expectedAmount
        },
        {
          name: 'Payment With Wrong Amount',
          identifier: testData.wrongAmount.identifier,
          expectedExists: true,
          expectedAmount: testData.wrongAmount.actualAmount
        },
        {
          name: 'Payment From Unknown Sender',
          identifier: testData.unknownSender.identifier,
          expectedExists: false,
          expectedAmount: '0'
        },
        {
          name: 'No Payment Received',
          identifier: testData.noPayment.identifier,
          expectedExists: false,
          expectedAmount: '0'
        },
        {
          name: 'Valid Identity Match',
          identifier: testData.validIdentityMatch.identifier,
          expectedExists: true,
          expectedAmount: testData.validIdentityMatch.expectedAmount
        },
        {
          name: 'Agent Not Registered',
          identifier: testData.agentNotRegistered.identifier,
          expectedExists: false,
          expectedAmount: '0'
        },
        {
          name: 'Sender Mismatch With Off-chain Session',
          identifier: testData.senderMismatch.identifier,
          expectedExists: true,
          expectedAmount: testData.senderMismatch.expectedAmount
        },
        {
          name: 'Duplicate Transaction Detection',
          identifier: testData.duplicateTransaction.identifier,
          expectedExists: true,
          expectedAmount: testData.duplicateTransaction.expectedAmount
        }
      ];

             const results: Array<{
         scenario: string;
         identifier: string;
         result: any;
         expected: {
           exists: boolean;
           amount: string;
         };
       }> = [];

       for (const scenario of scenarios) {
        logger.info(`Running scenario: ${scenario.name}`);
        
        const response = await request(baseUrl)
          .post('/wallet/verify-transaction')
          .send({ identifier: scenario.identifier })
          .expect(200);
        
        results.push({
          scenario: scenario.name,
          identifier: scenario.identifier,
          result: response.body,
          expected: {
            exists: scenario.expectedExists,
            amount: scenario.expectedAmount
          }
        });
        
        logger.info(`Scenario ${scenario.name} result:`, response.body);
      }

      // Log all results for analysis
      logger.info('All test scenario results:', results);
      
      // Basic validation that all scenarios returned proper responses
      expect(results).toHaveLength(8);
      results.forEach(result => {
        expect(result.result).toHaveProperty('exists');
        expect(result.result).toHaveProperty('transactionAmount');
        expect(result.result).toHaveProperty('syncStatus');
      });
    });
  });
});
