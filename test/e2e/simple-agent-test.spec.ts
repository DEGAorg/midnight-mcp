import { describe, it, beforeAll, afterAll, expect } from '@jest/globals';
import {
  TestLogger,
  WaitUtils,
  DEFAULT_ELIZA_CONFIG
} from './helpers.js';
import { createElizaClient, IElizaClient } from './eliza-client.js';
import simpleAgentConfig from './simple-agent.json';

/**
 * Simple Agent Test for Midnight MCP Server
 * 
 * This test uses a simple agent without MCP servers to test
 * basic messaging functionality in isolation.
 * 
 * Run with: yarn test:e2e:simple
 */

describe('Simple Agent Test', () => {
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
    logger = new TestLogger('SIMPLE-AGENT');
    
    // Generate a single UUID for the test run
    authorId = generateUUID();
    // authorId = "5c9f5d45-8015-4b76-8a87-cf2efabcaccd";
    logger.info(`Generated Author ID for this test run: ${authorId}`);
    
    logger.info('=== SIMPLE AGENT TEST START ===');
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
    
    logger.info('Starting Simple Agent Test');
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
    
    // Setup: Create and start the simple agent
    logger.info('Setting up simple agent for test...');
    
    try {
      // 1. Create the simple agent
      logger.info('Creating simple agent...');
      const newAgent = await elizaClient.createAgent(simpleAgentConfig);
      logger.info(`Simple agent created: ${newAgent.name} (ID: ${newAgent.id})`);
      // Use the actual ID returned from the API, not the one from config
      agentId = newAgent.id;
      
      // 2. Start the agent
      logger.info('Starting simple agent...');
      const startAgent = await elizaClient.startAgent(agentId);
      if (!startAgent.success) {
        throw new Error(`Failed to start simple agent: ${startAgent.error}`);
      }
      logger.info(`Simple agent started successfully: ${newAgent.name} (ID: ${agentId})`);
      
      // 3. List agents to confirm creation
      logger.info('Confirming simple agent creation...');
      const agents = await elizaClient.getAgents();
      const createdAgent = agents.find((agent: any) => agent.id === agentId);
      if (!createdAgent) {
        throw new Error('Created simple agent not found in agents list');
      }
      logger.info(`Simple agent confirmed in list: ${createdAgent.name} (ID: ${createdAgent.id})`);
      
      // Wait for services to be ready
      logger.info('Waiting for services to be ready...');
      await WaitUtils.wait(2000);
      logger.info('Services ready');
      
    } catch (error) {
      logger.error('Error during simple agent setup:', error);
      throw error;
    }
  });

  afterAll(async () => {
    logger.info('=== SIMPLE AGENT TEST END ===');
  });

  it('should send a simple message and receive a response from simple agent', async () => {
    const testName = 'Simple Agent Message Response Test';
    logger.info(`=== ${testName} START ===`);
    
    try {
      // Get agent panels and logs for debugging
      // logger.info('Getting agent panels and logs for debugging...');
      // try {
      //   const panels = await elizaClient.getAgentPanels(agentId);
      //   logger.info(`Agent panels:`, JSON.stringify(panels, null, 2));
      // } catch (error) {
      //   logger.warn('Failed to get agent panels:', error);
      // }
      
      // try {
      //   const logs = await elizaClient.getAgentLogs(agentId, {
      //     level: 'info',
      //     limit: 50
      //   });
      //   logger.info(`Agent logs count: ${logs.length}`);
      //   logs.forEach((log: any, index: number) => {
      //     logger.info(`Log ${index}: [${log.level}] ${log.message}`);
      //   });
      // } catch (error) {
      //   logger.warn('Failed to get agent logs:', error);
      // }
      
      // Get the channel first
      logger.info('Getting DM channel for simple agent...');
      const channel = await elizaClient.getDmChannel(agentId);
      logger.info(`Channel obtained: ${channel.id}`);
      
      // Check initial messages
      logger.info('Checking initial messages in channel...');
      const initialMessages = await elizaClient.getChannelMessages(channel.id);
      logger.info(`Initial messages count: ${initialMessages.messages.length}`);
      initialMessages.messages.forEach((msg: any, index: number) => {
        logger.info(`Initial message ${index}: authorId=${msg.authorId}, content="${msg.content?.substring(0, 50)}..."`);
      });
      
      // Send a simple message
      logger.info('Sending simple message to simple agent...');
      const messageContent = 'Hello, can you respond to this message?';
      logger.info(`Message content: "${messageContent}"`);
      
      const response = await elizaClient.sendMessage(messageContent, {
        agentId: agentId,
        waitForResponse: true,
        responseTimeout: 10000 // 10 seconds timeout as requested
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
      const finalMessages = await elizaClient.getChannelMessages(channel.id);
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

  it('should test simple conversation with simple agent', async () => {
    const testName = 'Simple Conversation Test';
    logger.info(`=== ${testName} START ===`);
    
    try {
      // Get agent panels and logs for debugging
      logger.info('Getting agent panels and logs for debugging...');
      try {
        const panels = await elizaClient.getAgentPanels(agentId);
        logger.info(`Agent panels:`, JSON.stringify(panels, null, 2));
      } catch (error) {
        logger.warn('Failed to get agent panels:', error);
      }
      
      try {
        const logs = await elizaClient.getAgentLogs(agentId, {
          level: 'info',
          limit: 50
        });
        logger.info(`Agent logs count: ${logs.length}`);
        logs.forEach((log: any, index: number) => {
          logger.info(`Log ${index}: [${log.level}] ${log.message}`);
        });
      } catch (error) {
        logger.warn('Failed to get agent logs:', error);
      }
      
      // Get the channel
      logger.info('Getting DM channel for simple agent...');
      const channel = await elizaClient.getDmChannel(agentId);
      logger.info(`Channel obtained: ${channel.id}`);
      
      // Send a simple conversation message
      logger.info('Sending conversation message...');
      const messageContent = 'What is your name?';
      logger.info(`Message content: "${messageContent}"`);
      
      const response = await elizaClient.sendMessage(messageContent, {
        agentId: agentId,
        waitForResponse: true,
        responseTimeout: 10000 // 10 seconds timeout as requested
      });
      
      logger.info(`Message sent. Response received: ${response.success ? 'SUCCESS' : 'FAILED'}`);
      
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
      
    } catch (error) {
      logger.error(`Error in ${testName}:`, error);
      throw error;
    }
    
    logger.info(`=== ${testName} END ===`);
  }, 180000); // 3 minute timeout
});
