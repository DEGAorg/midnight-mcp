import { describe, it, beforeAll, afterAll, beforeEach, afterEach, expect } from '@jest/globals';
import {
  TestValidator,
  TestResult,
  TestResultFormatter,
  TestLogger,
  WaitUtils,
  DEFAULT_ELIZA_CONFIG
} from './helpers.js';
import { createElizaClient, IElizaClient } from './eliza-client.js';
import { DmChannelParams } from '@elizaos/api-client';

/**
 * Eliza Channel Search Tests
 * 
 * These tests validate the ability to find and interact with agents
 * and their corresponding channels in the Eliza OS project.
 * 
 * Tests include:
 * - Listing all available agents
 * - Finding specific agents by name
 * - Getting channel IDs for agent conversations
 * - Validating channel information
 * 
 * Prerequisites:
 * - Eliza AI agents are up and running
 * - All services are accessible via HTTP
 */

describe('Eliza Channel Search Tests', () => {
  let elizaClient: IElizaClient;
  let logger: TestLogger;
  let testResults: Array<{ name: string; result: TestResult }> = [];

  beforeAll(async () => {
    logger = new TestLogger('ELIZA-SEARCH');
    elizaClient = createElizaClient({
      baseUrl: DEFAULT_ELIZA_CONFIG.baseUrl,
      timeout: 60000,
      retries: DEFAULT_ELIZA_CONFIG.retries,
      logger: logger
    });
    
    logger.info('Starting Eliza Channel Search Tests');
    logger.info(`Eliza API URL: ${DEFAULT_ELIZA_CONFIG.baseUrl}`);
    
    // Wait for services to be ready
    await WaitUtils.wait(2000);
  });

  afterAll(async () => {
    logger.info('Eliza Channel Search Tests completed');
    logger.info(TestResultFormatter.formatSummary(testResults));
  });

  describe.only('Agent Discovery', () => {
    
    it('01 - should get all available agents', async () => {
      const testName = 'Get All Available Agents';
      logger.info(`Running: ${testName}`);
      
      const agents = await elizaClient.getAgents();
      
      const result: TestResult = {
        passed: Array.isArray(agents) && agents.length > 0,
        message: Array.isArray(agents) ? 
          `Found ${agents.length} available agents` :
          'Failed to retrieve agents or agents is not an array',
        data: { 
          agents,
          agentCount: Array.isArray(agents) ? agents.length : 0,
          agentNames: Array.isArray(agents) ? agents.map((agent: any) => agent.name) : []
        },
        error: Array.isArray(agents) ? undefined : 'Agents not found or invalid response'
      };
      
      testResults.push({ name: testName, result });
      expect(result.passed).toBe(true);
      
      // Log agent information for debugging
      if (Array.isArray(agents)) {
        agents.forEach((agent: any, index: number) => {
          logger.info(`Agent ${index + 1}: ${agent.name} (ID: ${agent.id})`);
        });
      }
      
      // Wait between tests for sequential execution
      await WaitUtils.waitBetweenTests(logger);
    }, 180000);

    it('01-1 - should create and start a new agent', async () => {
      const testName = 'Create a new agent';
      logger.info(`Running: ${testName}`);
      
      const newAgent = await elizaClient.createC3P0Agent();
      logger.info(`New agent created: ${newAgent.name} (ID: ${newAgent.id})`);
      expect(newAgent.name).toBe('C3PO');
      const startAgent = await elizaClient.startAgent(newAgent.id);
      logger.info(`New agent started: ${newAgent.name} (ID: ${newAgent.id})`);
      expect(startAgent.success).toBeTruthy();
    });

    it('01-2 - should get all available agents', async () => {
      const testName = 'Get All Available Agents';
      logger.info(`Running: ${testName}`);
      
      const agents = await elizaClient.getAgents();
      
      const result: TestResult = {
        passed: Array.isArray(agents) && agents.length > 0,
        message: Array.isArray(agents) ? 
          `Found ${agents.length} available agents` :
          'Failed to retrieve agents or agents is not an array',
        data: { 
          agents,
          agentCount: Array.isArray(agents) ? agents.length : 0,
          agentNames: Array.isArray(agents) ? agents.map((agent: any) => agent.name) : []
        },
        error: Array.isArray(agents) ? undefined : 'Agents not found or invalid response'
      };
      
      testResults.push({ name: testName, result });
      expect(result.passed).toBe(true);
      
      // Log agent information for debugging
      if (Array.isArray(agents)) {
        agents.forEach((agent: any, index: number) => {
          logger.info(`Agent ${index + 1}: ${agent.name} (ID: ${agent.id})`);
        });
      }
      
      // Wait between tests for sequential execution
      await WaitUtils.waitBetweenTests(logger);
    }, 180000);

    it('02 - should find C3PO agent specifically', async () => {
      const testName = 'Find C3PO Agent';
      logger.info(`Running: ${testName}`);
      
      const c3poAgent = await elizaClient.getC3POAgent();
      
      const result: TestResult = {
        passed: !!(c3poAgent && c3poAgent.id && c3poAgent.name === 'C3PO'),
        message: c3poAgent ? 
          `Found C3PO agent: ${c3poAgent.name} (ID: ${c3poAgent.id})` :
          'C3PO agent not found',
        data: { 
          c3poAgent,
          agentId: c3poAgent?.id,
          agentName: c3poAgent?.name
        },
        error: c3poAgent ? undefined : 'C3PO agent not found'
      };
      
      testResults.push({ name: testName, result });
      expect(result.passed).toBe(true);
      
      // Wait between tests for sequential execution
      await WaitUtils.waitBetweenTests(logger);
    }, 180000);

    it('03 - should list all agent names and IDs', async () => {
      const testName = 'List Agent Names and IDs';
      logger.info(`Running: ${testName}`);
      
      const agents = await elizaClient.getAgents();
      
      const agentList = Array.isArray(agents) ? agents.map((agent: any) => ({
        name: agent.name,
        id: agent.id,
        type: agent.type || 'unknown'
      })) : [];
      
      const result: TestResult = {
        passed: Array.isArray(agents) && agents.length > 0,
        message: Array.isArray(agents) ? 
          `Successfully listed ${agents.length} agents with their details` :
          'Failed to retrieve agents list',
        data: { 
          agentList,
          totalAgents: agentList.length,
          agentDetails: agentList
        },
        error: Array.isArray(agents) ? undefined : 'Failed to get agents'
      };
      
      testResults.push({ name: testName, result });
      expect(result.passed).toBe(true);
      
      // Log detailed agent information
      agentList.forEach((agent, index) => {
        logger.info(`Agent ${index + 1}: ${agent.name} (ID: ${agent.id}, Type: ${agent.type})`);
      });
      
      // Wait between tests for sequential execution
      await WaitUtils.waitBetweenTests(logger);
    }, 180000);
  });

  describe('Channel Discovery', () => {
    
    it('04 - should get channel ID for C3PO agent', async () => {
      const testName = 'Get C3PO Channel ID';
      logger.info(`Running: ${testName}`);
      
      const channelId = await elizaClient.getAgentChannelId();
      
      const result: TestResult = {
        passed: !!(channelId && typeof channelId === 'string' && channelId.length > 0),
        message: channelId ? 
          `Successfully retrieved channel ID: ${channelId}` :
          'Failed to get channel ID for C3PO agent',
        data: { 
          channelId,
          channelIdLength: channelId?.length || 0,
          isValidUUID: !!(channelId ? /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(channelId) : false)
        },
        error: channelId ? undefined : 'Channel ID not found'
      };
      
      testResults.push({ name: testName, result });
      expect(result.passed).toBe(true);
      
      logger.info(`C3PO Channel ID: ${channelId}`);
      
      // Wait between tests for sequential execution
      await WaitUtils.waitBetweenTests(logger);
    }, 180000);

    it('05 - should get channel messages for C3PO agent', async () => {
      const testName = 'Get C3PO Channel Messages';
      logger.info(`Running: ${testName}`);
      
      const channelId = await elizaClient.getAgentChannelId();
      const messagesResponse = await elizaClient.getChannelMessages(channelId);
      
      const result: TestResult = {
        passed: messagesResponse.success && Array.isArray(messagesResponse.messages),
        message: messagesResponse.success ? 
          `Successfully retrieved ${messagesResponse.messages.length} messages from channel` :
          'Failed to get channel messages',
        data: { 
          channelId,
          messagesCount: messagesResponse.messages?.length || 0,
          messages: messagesResponse.messages,
          success: messagesResponse.success
        },
        error: messagesResponse.success ? undefined : 'Failed to get channel messages'
      };
      
      testResults.push({ name: testName, result });
      expect(result.passed).toBe(true);
      
      logger.info(`Channel ${channelId} has ${messagesResponse.messages.length} messages`);
      
      // Wait between tests for sequential execution
      await WaitUtils.waitBetweenTests(logger);
    }, 180000);

    it('06 - should clear channel history and verify it is empty', async () => {
      const testName = 'Clear Channel History';
      logger.info(`Running: ${testName}`);
      
      const channelId = await elizaClient.getAgentChannelId();
      const clearResponse = await elizaClient.clearChannelHistory(channelId);
      
      // Verify the channel is now empty
      const messagesResponse = await elizaClient.getChannelMessages(channelId);
      
      const result: TestResult = {
        passed: clearResponse.success && messagesResponse.success && messagesResponse.messages.length === 0,
        message: clearResponse.success ? 
          `Successfully cleared channel history. Channel now has ${messagesResponse.messages.length} messages` :
          'Failed to clear channel history',
        data: { 
          channelId,
          clearSuccess: clearResponse.success,
          messagesAfterClear: messagesResponse.messages?.length || 0,
          clearResponse,
          messagesResponse
        },
        error: clearResponse.success ? undefined : 'Failed to clear channel history'
      };
      
      testResults.push({ name: testName, result });
      expect(result.passed).toBe(true);
      
      logger.info(`Channel ${channelId} cleared successfully`);
      
      // Wait between tests for sequential execution
      await WaitUtils.waitBetweenTests(logger);
    }, 180000);
  });

  describe('Agent Interaction', () => {
    
    it('07 - should send a simple message to C3PO and get response', async () => {
      const testName = 'Send Message to C3PO';
      logger.info(`Running: ${testName}`);
      
      const message = 'Hello C3PO, can you help me find my channel ID?';
      const response = await elizaClient.sendMessage(message, {
        agentId: '4af73091-392d-47f5-920d-eeaf751e81d2', // Using the default channel ID as agent ID
        waitForResponse: true,
        responseTimeout: 60000
      });
      
      const result: TestResult = {
        passed: !!(response.success && response.response && response.response.length > 0),
        message: response.success ? 
          `Successfully sent message and received ${response.response?.length || 0} response(s)` :
          'Failed to send message or get response',
        data: { 
          messageSent: message,
          responseCount: response.response?.length || 0,
          response: response.response,
          messageId: response.messageId
        },
        error: response.success ? undefined : response.error
      };
      
      testResults.push({ name: testName, result });
      expect(result.passed).toBe(true);
      
      if (response.response && response.response.length > 0) {
        logger.info(`Received response: ${response.response[0].content?.substring(0, 100)}...`);
      }
      
      // Wait between tests for sequential execution
      await WaitUtils.waitBetweenTests(logger);
    }, 180000);

    it('08 - should ask C3PO about available agents', async () => {
      const testName = 'Ask C3PO About Agents';
      logger.info(`Running: ${testName}`);
      
      const message = 'What agents are available in this system?';
      const response = await elizaClient.sendMessage(message, {
        agentId: '4af73091-392d-47f5-920d-eeaf751e81d2', // Using the default channel ID as agent ID
        waitForResponse: true,
        responseTimeout: 60000
      });
      
      const result: TestResult = {
        passed: !!(response.success && response.response && response.response.length > 0),
        message: response.success ? 
          `Successfully asked about agents and received response` :
          'Failed to ask about agents or get response',
        data: { 
          messageSent: message,
          responseCount: response.response?.length || 0,
          response: response.response,
          messageId: response.messageId
        },
        error: response.success ? undefined : response.error
      };
      
      testResults.push({ name: testName, result });
      expect(result.passed).toBe(true);
      
      if (response.response && response.response.length > 0) {
        const responseContent = response.response[0].content;
        logger.info(`C3PO response about agents: ${responseContent?.substring(0, 200)}...`);
      }
      
      // Wait between tests for sequential execution
      await WaitUtils.waitBetweenTests(logger);
    }, 180000);
  });

  describe('Channel Information Validation', () => {
    
    it('09 - should validate channel structure and metadata', async () => {
      const testName = 'Validate Channel Structure';
      logger.info(`Running: ${testName}`);
      
      const channelId = await elizaClient.getAgentChannelId();
      
      // Get channel information by making a request to the channels endpoint
      const url = `${DEFAULT_ELIZA_CONFIG.baseUrl}/api/messaging/central-servers/00000000-0000-0000-0000-000000000000/channels`;
      const response = await fetch(url);
      const channels = await response.json();
      
      // Find our specific channel
      const ourChannel = channels.data?.channels?.find((channel: any) => channel.id === channelId);
      
      const result: TestResult = {
        passed: ourChannel && ourChannel.id && ourChannel.type === 'DM',
        message: ourChannel ? 
          `Channel validation successful. Type: ${ourChannel.type}, ID: ${ourChannel.id}` :
          'Failed to validate channel structure',
        data: { 
          channelId,
          channelFound: !!ourChannel,
          channelType: ourChannel?.type,
          channelMetadata: ourChannel?.metadata,
          allChannels: channels.data?.channels
        },
        error: ourChannel ? undefined : 'Channel not found in channels list'
      };
      
      testResults.push({ name: testName, result });
      expect(result.passed).toBe(true);
      
      if (ourChannel) {
        logger.info(`Channel validated: ${ourChannel.type} channel with ID ${ourChannel.id}`);
        logger.info(`Channel metadata: ${JSON.stringify(ourChannel.metadata, null, 2)}`);
      }
      
      // Wait between tests for sequential execution
      await WaitUtils.waitBetweenTests(logger);
    }, 180000);
  });
});
