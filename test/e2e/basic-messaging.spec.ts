import { describe, it, beforeAll, afterAll, expect } from '@jest/globals';
import {
  TestLogger,
  WaitUtils,
  DEFAULT_ELIZA_CONFIG
} from './helpers.js';
import { createElizaClient, IElizaClient } from './eliza-client.js';

/**
 * Basic Messaging Test for Midnight MCP Server
 * 
 * This test focuses ONLY on basic messaging functionality to isolate
 * issues where the agent is not responding in GitHub Actions.
 * 
 * This test can be run independently with:
 * yarn test:e2e --testNamePattern="Basic Messaging"
 */

describe('Basic Messaging', () => {
  let elizaClient: IElizaClient;
  let logger: TestLogger;
  let agentId: string;
  let authorId: string;

  // Generate a UUID for the test run
  const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  beforeAll(async () => {
    logger = new TestLogger('BASIC-MESSAGING');
    
    // Generate a single UUID for the test run
    authorId = generateUUID();
    logger.info(`Generated Author ID for this test run: ${authorId}`);
    
    elizaClient = createElizaClient({
      baseUrl: DEFAULT_ELIZA_CONFIG.baseUrl,
      timeout: 60000,
      retries: DEFAULT_ELIZA_CONFIG.retries,
      logger: logger,
      authorId: authorId
    });
    
    logger.info('Starting Basic Messaging Test');
    logger.info(`Eliza API URL: ${DEFAULT_ELIZA_CONFIG.baseUrl}`);
    
    // Setup: Create and start the agent
    logger.info('Setting up agent for basic messaging test...');
    
    // 1. Create the agent
    const newAgent = await elizaClient.createC3P0Agent();
    logger.info(`Agent created: ${newAgent.name} (ID: ${newAgent.id})`);
    agentId = newAgent.id;
    
    // 2. Start the agent
    const startAgent = await elizaClient.startAgent(agentId);
    if (!startAgent.success) {
      throw new Error(`Failed to start agent: ${startAgent.error}`);
    }
    logger.info(`Agent started successfully: ${newAgent.name} (ID: ${agentId})`);
    
    // 3. List agents to confirm creation
    const agents = await elizaClient.getAgents();
    const createdAgent = agents.find((agent: any) => agent.id === agentId);
    if (!createdAgent) {
      throw new Error('Created agent not found in agents list');
    }
    logger.info(`Agent confirmed in list: ${createdAgent.name} (ID: ${createdAgent.id})`);
    
    // Wait for services to be ready
    await WaitUtils.wait(2000);
  });

  afterAll(async () => {
    logger.info('Basic Messaging Test completed');
  });

  it('should send a simple message and receive a response', async () => {
    const testName = 'Simple Message Response Test';
    logger.info(`Running: ${testName}`);
    
    // Send a simple message that should get a response
    const response = await elizaClient.sendMessage('Hello, can you respond to this message?', {
      agentId: agentId,
      waitForResponse: true,
      responseTimeout: 60000
    });
    
    logger.info(`Response received: ${response.success ? 'SUCCESS' : 'FAILED'}`);
    if (response.success) {
      logger.info(`Response content: ${response.response?.[0]?.content?.substring(0, 200) || 'No content'}...`);
    } else {
      logger.error(`Error: ${response.error}`);
    }
    
    // Basic validation - just check if we got any response
    expect(response.success).toBe(true);
    expect(response.response).toBeDefined();
    expect(response.response?.length).toBeGreaterThan(0);
    expect(response.response?.[0]?.content).toBeDefined();
    expect(response.response?.[0]?.content.length).toBeGreaterThan(0);
    
    logger.info(`${testName} completed successfully`);
  }, 120000); // 2 minute timeout

  it('should send a wallet status message and receive a response', async () => {
    const testName = 'Wallet Status Message Test';
    logger.info(`Running: ${testName}`);
    
    // Send a wallet-related message
    const response = await elizaClient.sendMessage('What is the midnight wallet status?', {
      agentId: agentId,
      waitForResponse: true,
      responseTimeout: 60000
    });
    
    logger.info(`Response received: ${response.success ? 'SUCCESS' : 'FAILED'}`);
    if (response.success) {
      logger.info(`Response content: ${response.response?.[0]?.content?.substring(0, 200) || 'No content'}...`);
    } else {
      logger.error(`Error: ${response.error}`);
    }
    
    // Basic validation
    expect(response.success).toBe(true);
    expect(response.response).toBeDefined();
    expect(response.response?.length).toBeGreaterThan(0);
    expect(response.response?.[0]?.content).toBeDefined();
    expect(response.response?.[0]?.content.length).toBeGreaterThan(0);
    
    logger.info(`${testName} completed successfully`);
  }, 120000); // 2 minute timeout
});
