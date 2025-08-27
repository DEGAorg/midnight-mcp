import { describe, it, beforeAll, afterAll, expect } from '@jest/globals';
import {
  TestLogger,
  WaitUtils,
  DEFAULT_ELIZA_CONFIG
} from './helpers.js';
import { createElizaClient, IElizaClient } from './eliza-client.js';

/**
 * Debug Messaging Test for Midnight MCP Server
 * 
 * This test includes extensive logging to debug why the agent
 * is not responding in GitHub Actions environment.
 * 
 * Run with: yarn test:e2e:debug
 */

describe('Debug Messaging', () => {
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
    logger = new TestLogger('DEBUG-MESSAGING');
    
    // Generate a single UUID for the test run
    authorId = generateUUID();
    logger.info(`Generated Author ID for this test run: ${authorId}`);
    
    logger.info('=== DEBUG MESSAGING TEST START ===');
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`Platform: ${process.platform}`);
    logger.info(`Architecture: ${process.arch}`);
    logger.info(`Node version: ${process.version}`);
    
    elizaClient = createElizaClient({
      baseUrl: DEFAULT_ELIZA_CONFIG.baseUrl,
      timeout: 60000,
      retries: DEFAULT_ELIZA_CONFIG.retries,
      logger: logger,
      authorId: authorId
    });
    
    logger.info('Starting Debug Messaging Test');
    logger.info(`Eliza API URL: ${DEFAULT_ELIZA_CONFIG.baseUrl}`);
    
    // Test basic connectivity first
    try {
      logger.info('Testing basic connectivity to Eliza API...');
      const agents = await elizaClient.getAgents();
      logger.info(`Successfully connected to Eliza API. Found ${agents.length} agents`);
      agents.forEach((agent: any, index: number) => {
        logger.info(`Agent ${index + 1}: ${agent.name} (ID: ${agent.id})`);
      });
    } catch (error) {
      logger.error('Failed to connect to Eliza API:', error);
      throw error;
    }
    
    // Setup: Create and start the agent
    logger.info('Setting up agent for debug messaging test...');
    
    try {
      // 1. Create the agent
      logger.info('Creating C3PO agent...');
      const newAgent = await elizaClient.createC3P0Agent();
      logger.info(`Agent created: ${newAgent.name} (ID: ${newAgent.id})`);
      agentId = newAgent.id;
      
      // 2. Start the agent
      logger.info('Starting agent...');
      const startAgent = await elizaClient.startAgent(agentId);
      if (!startAgent.success) {
        throw new Error(`Failed to start agent: ${startAgent.error}`);
      }
      logger.info(`Agent started successfully: ${newAgent.name} (ID: ${agentId})`);
      
      // 3. List agents to confirm creation
      logger.info('Confirming agent creation...');
      const agents = await elizaClient.getAgents();
      const createdAgent = agents.find((agent: any) => agent.id === agentId);
      if (!createdAgent) {
        throw new Error('Created agent not found in agents list');
      }
      logger.info(`Agent confirmed in list: ${createdAgent.name} (ID: ${createdAgent.id})`);
      
      // Wait for services to be ready
      logger.info('Waiting for services to be ready...');
      await WaitUtils.wait(2000);
      logger.info('Services ready');
      
    } catch (error) {
      logger.error('Error during agent setup:', error);
      throw error;
    }
  });

  afterAll(async () => {
    logger.info('=== DEBUG MESSAGING TEST END ===');
  });

  it('should send a simple message and receive a response with detailed logging', async () => {
    const testName = 'Debug Simple Message Response Test';
    logger.info(`=== ${testName} START ===`);
    
    try {
      // Get the channel first
      logger.info('Getting DM channel for agent...');
      const channel = await elizaClient.getAgentChannelId();
      logger.info(`Channel obtained: ${channel}`); 
      
      // Check initial messages
      logger.info('Checking initial messages in channel...');
      const initialMessages = await elizaClient.getChannelMessages(channel);
      logger.info(`Initial messages count: ${initialMessages.messages.length}`);
      initialMessages.messages.forEach((msg: any, index: number) => {
        logger.info(`Initial message ${index}: authorId=${msg.authorId}, content="${msg.content?.substring(0, 50)}..."`);
      });
      
      // Send a simple message
      logger.info('Sending simple message...');
      const messageContent = 'Hello, can you respond to this message?';
      logger.info(`Message content: "${messageContent}"`);
      
      const response = await elizaClient.sendMessage(messageContent, {
        agentId: agentId,
        waitForResponse: true,
        responseTimeout: 60000
      });
      
      logger.info(`Message sent. Response received: ${response.success ? 'SUCCESS' : 'FAILED'}`);
      logger.info(`Response object:`, JSON.stringify(response, null, 2));
      
      if (response.success) {
        logger.info(`Response array length: ${response.response?.length || 0}`);
        if (response.response && response.response.length > 0) {
          response.response.forEach((resp: any, index: number) => {
            logger.info(`Response ${index}:`, JSON.stringify(resp, null, 2));
          });
        }
      } else {
        logger.error(`Error: ${response.error}`);
      }
      
      // Check final messages
      logger.info('Checking final messages in channel...');
      const finalMessages = await elizaClient.getChannelMessages(channel);
      logger.info(`Final messages count: ${finalMessages.messages.length}`);
      finalMessages.messages.forEach((msg: any, index: number) => {
        logger.info(`Final message ${index}: authorId=${msg.authorId}, content="${msg.content?.substring(0, 50)}..."`);
      });
      
      // Basic validation
      expect(response.success).toBe(true);
      expect(response.response).toBeDefined();
      expect(response.response?.length).toBeGreaterThan(0);
      expect(response.response?.[0]?.content).toBeDefined();
      expect(response.response?.[0]?.content.length).toBeGreaterThan(0);
      
      logger.info(`${testName} completed successfully`);
      
    } catch (error) {
      logger.error(`Error in ${testName}:`, error);
      throw error;
    }
    
    logger.info(`=== ${testName} END ===`);
  }, 180000); // 3 minute timeout

  it('should test message polling with detailed logging', async () => {
    const testName = 'Debug Message Polling Test';
    logger.info(`=== ${testName} START ===`);
    
    try {
      // Get the channel
      logger.info('Getting DM channel for agent...');
      const channel = await elizaClient.getAgentChannelId();
      logger.info(`Channel obtained: ${channel}`);
      
      // Send a message without waiting for response
      logger.info('Sending message without waiting for response...');
      const messageContent = 'Test message for polling';
      const sendResponse = await elizaClient.sendMessage(messageContent, {
        agentId: agentId,
        waitForResponse: false
      });
      
      logger.info(`Message sent. Message ID: ${sendResponse.messageId}`);
      
      // Manually poll for responses
      logger.info('Starting manual polling for responses...');
      const startTime = Date.now();
      const timeout = 60000; // 60 seconds
      const interval = 2000; // Check every 2 seconds
      
      while (Date.now() - startTime < timeout) {
        logger.info(`Polling at ${new Date().toISOString()}...`);
        
        const messages = await elizaClient.getChannelMessages(channel);
        logger.info(`Current messages count: ${messages.messages.length}`);
        
        // Find our message
        const ourMessage = messages.messages.find((msg: any) => 
          msg.content === messageContent && msg.authorId === authorId
        );
        
        if (ourMessage) {
          logger.info(`Found our message: ${ourMessage.id}`);
          
          // Look for responses to our message
          const responses = messages.messages.filter((msg: any) => 
            msg.inReplyToRootMessageId === ourMessage.id
          );
          
          logger.info(`Found ${responses.length} responses to our message`);
          
          if (responses.length > 0) {
            responses.forEach((resp: any, index: number) => {
              logger.info(`Response ${index}: authorId=${resp.authorId}, content="${resp.content?.substring(0, 100)}..."`);
            });
            
            // Success - we got a response
            expect(responses.length).toBeGreaterThan(0);
            expect(responses[0].content).toBeDefined();
            expect(responses[0].content.length).toBeGreaterThan(0);
            
            logger.info(`${testName} completed successfully`);
            return;
          }
        }
        
        // Wait before next poll
        logger.info(`No response yet, waiting ${interval}ms...`);
        await new Promise(resolve => setTimeout(resolve, interval));
      }
      
      // If we get here, no response was received
      logger.error('No response received within timeout period');
      throw new Error('No response received within timeout period');
      
    } catch (error) {
      logger.error(`Error in ${testName}:`, error);
      throw error;
    }
    
    logger.info(`=== ${testName} END ===`);
  }, 180000); // 3 minute timeout
});
