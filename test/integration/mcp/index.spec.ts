import request from 'supertest';
import * as fs from 'fs';
import * as path from 'path';
import { TestConfig } from './types';
import { convertMicroToDecimal } from '../helpers';

// Load test configuration from JSON file
function loadTestConfig(): TestConfig {
  try {
    const configPath = path.join(__dirname, 'test-config.json');
    
    // Check if file exists
    if (!fs.existsSync(configPath)) {
      console.error('test-config.json not found');
      console.error('Please copy setup-script-output-template.json to test-config.json and update with actual values from your setup script');
      throw new Error('test-config.json not found. Please copy setup-script-output-template.json to test-config.json and update with actual values from your setup script');
    }
    
    const configData = fs.readFileSync(configPath, 'utf8');
    const config: TestConfig = JSON.parse(configData);
    
    // Validate required fields
    const missingFields: string[] = [];
    
    // Check wallet addresses and pubkeys
    if (!config.wallets.wallet1.address) {
      missingFields.push('wallets.wallet1.address');
    }
    if (!config.wallets.wallet1.pubkey) {
      missingFields.push('wallets.wallet1.pubkey');
    }
    if (!config.wallets.wallet2.address) {
      missingFields.push('wallets.wallet2.address');
    }
    if (!config.wallets.wallet2.pubkey) {
      missingFields.push('wallets.wallet2.pubkey');
    }
    
    // Check transaction identifiers
    if (!config.transactions.validPayment.identifier) {
      missingFields.push('transactions.validPayment.identifier');
    }
    if (!config.transactions.wrongAmount.identifier) {
      missingFields.push('transactions.wrongAmount.identifier');
    }
    if (!config.transactions.unknownSender.identifier) {
      missingFields.push('transactions.unknownSender.identifier');
    }
    
    if (missingFields.length > 0) {
      console.error('Missing required fields in test-config.json:', missingFields);
      throw new Error(`Missing required fields in test-config.json: ${missingFields.join(', ')}`);
    }
    
    return config;
  } catch (error) {
    if (error instanceof SyntaxError) {
      console.error('Invalid JSON in test-config.json');
      throw new Error('Invalid JSON in test-config.json. Please check the file format.');
    }
    throw error;
  }
}

describe('Wallet MCP Integration Tests', () => {
  // Load configuration
  const config: TestConfig = loadTestConfig();
  const baseUrl = process.env.TEST_SERVER_URL || config.server.url;
  const testData = config.transactions;
  const wallets = config.wallets;
  const testAmounts = config.testAmounts;

  beforeAll(async () => {    
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
          return;
        }
      } catch (error) {
        // continue waiting
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
    });

    test('should return wallet address', async () => {
      const response = await request(baseUrl)
        .get('/wallet/address')
        .expect(200);

      expect(response.body).toHaveProperty('address');
      expect(typeof response.body.address).toBe('string');
      expect(response.body.address.length).toBeGreaterThan(0);
    });

    test('should return wallet balance', async () => {
      const response = await request(baseUrl)
        .get('/wallet/balance')
        .expect(200);

      expect(response.body).toHaveProperty('balance');
      expect(response.body).toHaveProperty('pendingBalance');
      expect(typeof response.body.balance).toBe('string');
      expect(typeof response.body.pendingBalance).toBe('string');
    });

    test('should return wallet configuration', async () => {
      const response = await request(baseUrl)
        .get('/wallet/config')
        .expect(200);

      expect(response.body).toHaveProperty('indexer');
      expect(response.body).toHaveProperty('node');
      expect(response.body).toHaveProperty('proofServer');
    });
  });

  describe('Transaction Management Endpoints', () => {
    test('should return transactions list', async () => {
      const response = await request(baseUrl)
        .get('/wallet/transactions')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    test('should return pending transactions', async () => {
      const response = await request(baseUrl)
        .get('/wallet/pending-transactions')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    test('should handle send funds request', async () => {
      const smallAmount = convertMicroToDecimal('10000');
      const sendData = {
        destinationAddress: wallets.wallet1.address,
        amount: smallAmount
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

  describe('Test Case 1: Valid Identity Match', () => {
    test('should verify sender matches registered identity', async () => {
      // validate sender is registered in marketplace
      const senderResponse = await request(baseUrl)
        .post('/marketplace/verify')
        .send({ 
          userId: config.wallets.wallet1.userId, 
          verificationData: {
            marketplaceAddress: config.marketplace.address,
            pubkey: config.wallets.wallet1.pubkey
          } 
        })
        .expect(200);

      expect(senderResponse.body).toHaveProperty('valid');
      expect(senderResponse.body.valid).toBe(true);
    }, 30000);
  });

  describe('Test Case 2: Agent Not Registered', () => {
    test('should reject sender not found in registration contract', async () => {
      // valid sender but not registered in marketplace
      const senderResponse = await request(baseUrl)
        .post('/marketplace/verify')
        .send({ 
          userId: config.wallets.wallet2.userId, 
          verificationData: {
            marketplaceAddress: config.marketplace.address,
            pubkey: config.wallets.wallet2.pubkey
          } 
        })
        .expect(200);

      expect(senderResponse.body).toHaveProperty('valid');
      expect(senderResponse.body.valid).toBe(false);
    });

    test('should reject invalid pubkey for registered wallet', async () => {
      // Test with invalid pubkey for wallet1 (which should be registered)
      const senderResponse = await request(baseUrl)
        .post('/marketplace/verify')
        .send({ 
          userId: config.wallets.wallet1.userId, 
          verificationData: {
            marketplaceAddress: config.marketplace.address,
            pubkey: 'invalid_pubkey_for_registered_wallet_1234567890abcdef'
          } 
        })
        .timeout(30000)
        .expect(200);

      expect(senderResponse.body).toHaveProperty('valid');
      expect(senderResponse.body.valid).toBe(false);
    }, 30000);

    test('should reject verification without pubkey', async () => {
      // Test without pubkey in verification data
      const senderResponse = await request(baseUrl)
        .post('/marketplace/verify')
        .send({ 
          userId: config.wallets.wallet1.pubkey, 
          verificationData: {
            marketplaceAddress: config.marketplace.address
          } 
        })
        .expect(400);

      expect(senderResponse.body).toHaveProperty('error');
      expect(senderResponse.body.error).toContain('pubkey');
    });
  });

  describe('Test Case 3: Sender Mismatch With Off-chain Session', () => {
    test('should detect mismatch between on-chain sender and off-chain session', async () => {
      // Marketplace logic and off-chain session logic
      const senderResponse = await request(baseUrl)
        .post('/marketplace/verify')
        .send({ 
          userId: '1234567890',  // invalid user id sent by off-chain session coming from the agent marketplace
          verificationData: {
            marketplaceAddress: config.marketplace.address,
            pubkey: config.wallets.wallet1.pubkey
          } 
        })
        .expect(200);

      expect(senderResponse.body).toHaveProperty('valid');
      expect(senderResponse.body.valid).toBe(false);
    });
  });

  describe('Test Case 4: Valid Payment Received', () => {
    test('should verify valid payment with correct amount and registered sender', async () => {
      // validate sender is registered in marketplace
      const senderResponse = await request(baseUrl)
        .post('/marketplace/verify')
        .send({ 
          userId: config.wallets.wallet1.userId, 
          verificationData: {
            marketplaceAddress: config.marketplace.address,
            pubkey: config.wallets.wallet1.pubkey
          } 
        })
        .expect(200);

      expect(senderResponse.body).toHaveProperty('valid');
      expect(senderResponse.body.valid).toBe(true);

      // verify transaction
      const response = await request(baseUrl)
        .post('/wallet/verify-transaction')
        .send({ identifier: testData.validPayment.identifier })
        .expect(200);

      expect(response.body).toHaveProperty('exists');
      expect(response.body).toHaveProperty('transactionAmount');
      expect(response.body).toHaveProperty('syncStatus');

      // For a valid payment from registered agent, we expect the transaction to exist
      if (response.body.exists) {
        expect(response.body.transactionAmount).toBe(convertMicroToDecimal(testData.validPayment.expectedAmount));
      }
    });
  });

  describe('Test Case 5: Payment With Wrong Amount', () => {
    test('should detect amount mismatch for valid sender', async () => {
      // validate sender is registered in marketplace
      const senderResponse = await request(baseUrl)
        .post('/marketplace/verify')
        .send({ 
          userId: config.wallets.wallet1.userId, 
          verificationData: {
            marketplaceAddress: config.marketplace.address,
            pubkey: config.wallets.wallet1.pubkey
          } 
        })
        .expect(200);

      expect(senderResponse.body.valid).toBe(true);

      const response = await request(baseUrl)
        .post('/wallet/verify-transaction')
        .send({ identifier: testData.wrongAmount.identifier })
        .expect(200);

      expect(response.body).toHaveProperty('exists');
      expect(response.body).toHaveProperty('transactionAmount');

      // If transaction exists, verify amount mismatch
      if (response.body.exists) {
        expect(response.body.transactionAmount).not.toBe(convertMicroToDecimal(testData.wrongAmount.expectedAmount));
      }
    }, 30000);
  });

  describe('Test Case 6: Payment From Unknown Sender', () => {
    test('should handle transaction from unregistered sender', async () => {
      // validate sender is registered in marketplace
      const senderResponse = await request(baseUrl)
        .post('/marketplace/verify')
        .send({ 
          userId: config.wallets.wallet2.userId, 
          verificationData: {
            marketplaceAddress: config.marketplace.address,
            pubkey: config.wallets.wallet2.pubkey
          } 
        })
        .timeout(30000)
        .expect(200);

      expect(senderResponse.body).toHaveProperty('valid');
      expect(senderResponse.body.valid).toBe(false);

      const response = await request(baseUrl)
        .post('/wallet/verify-transaction')
        .send({ identifier: testData.unknownSender.identifier })
        .timeout(30000)
        .expect(200);

      expect(response.body).toHaveProperty('exists');
      expect(response.body).toHaveProperty('transactionAmount');
      expect(response.body.exists).toBe(true);
    }, 30000);
  });

  describe('Test Case 7: No Payment Received', () => {
    test('should handle case when no transaction is found', async () => {
      const response = await request(baseUrl)
        .post('/wallet/verify-transaction')
        .send({ identifier: testData.noPayment.identifier })
        .expect(200);

      expect(response.body).toHaveProperty('exists');
      expect(response.body).toHaveProperty('transactionAmount');
      expect(response.body).toHaveProperty('syncStatus');

      // For no payment, exists should be false
      expect(response.body.exists).toBe(false);
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

    test('should handle missing pubkey in marketplace verification', async () => {
      const response = await request(baseUrl)
        .post('/marketplace/verify')
        .send({ 
          userId: config.wallets.wallet1.pubkey, 
          verificationData: {
            marketplaceAddress: config.marketplace.address
          } 
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('pubkey');
    });
  });

});
