// Use the global fetch available in Node.js 18+
const fetch = globalThis.fetch;

// Import the API client
import { AgentCreateParams, DmChannelParams, MessageChannel, ElizaClient as ApiClient } from '@elizaos/api-client';
import agentConfig from './agent.json';

/**
 * Configuration for Eliza client
 */
export interface ElizaClientConfig {
  baseUrl?: string;
  timeout?: number;
  retries?: number;
  logger?: any;
}

/**
 * Options for sending messages
 */
export interface SendMessageOptions {
  agentId: string;
  clearHistory?: boolean;
  waitForResponse?: boolean;
  responseTimeout?: number; // Default: 60000ms (60 seconds) - increased from 15000
  contentValidator?: (content: string) => boolean; // New option for content validation
}

/**
 * Response from sending a message
 */
export interface SendMessageResponse {
  success: boolean;
  messageId?: string;
  response?: any[];
  error?: string;
}

/**
 * Options for getting channel messages
 */
export interface GetChannelMessagesOptions {
  after?: string;
  limit?: number;
}

/**
 * Agent information
 */
export interface Agent {
  id: string;
  name: string;
  [key: string]: any;
}

/**
 * Channel information
 */
export interface Channel {
  id: string;
  messageServerId: string;
  name: string;
  type: string;
  metadata: {
    isDm: boolean;
    user1: string;
    user2: string;
    forAgent: string;
    createdAt: string;
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * Message information
 */
export interface Message {
  id: string;
  channelId: string;
  authorId: string;
  content: string;
  rawMessage: any;
  sourceType: string;
  metadata: any;
  inReplyToRootMessageId?: string;
  createdAt: string;
  updatedAt: string;
  created_at: number;
  updated_at: number;
}

/**
 * Type definition for ElizaClient
 */
export interface IElizaClient {
  // Agent management
  getAgents(): Promise<Agent[]>;
  getC3POAgent(): Promise<Agent>;
  createC3P0Agent(): Promise<Agent>;
  startAgent(agentId: string): Promise<{ success: boolean, error?: string }>;
  
  // Channel management
  getOrCreateDmChannel(params: DmChannelParams): Promise<MessageChannel>;
  getAgentChannelId(): Promise<string>;
  clearChannelHistory(channelId: string): Promise<{ success: boolean, error?: string }>;
  
  // Message operations
  sendMessage(message: string, options?: SendMessageOptions): Promise<SendMessageResponse>;
  sendMessageWithRetry(message: string, options?: SendMessageOptions): Promise<SendMessageResponse>;
  waitForResponse(channelId: string, messageId: string, timeout?: number): Promise<Message[]>;
  waitForResponseWithContent(channelId: string, messageId: string, contentValidator: (content: string) => boolean, timeout?: number): Promise<Message[]>;
  getChannelMessages(channelId: string, options?: GetChannelMessagesOptions): Promise<{ success: boolean, messages: Message[] }>;
  
  // Utility methods
  getLatestResponseContent(responseMessages: Message[]): string | null;
  sleep(ms: number): Promise<void>;
}

/**
 * Enhanced Eliza client that incorporates query.ts logic
 * for sending messages and waiting for specific responses
 */
export class ElizaClient implements IElizaClient {
  private baseUrl: string;
  private timeout: number;
  private retries: number;
  private logger: any;

  constructor(config: ElizaClientConfig = {}) {
    this.baseUrl = config.baseUrl || process.env.ELIZA_API_URL || 'http://localhost:3001';
    this.timeout = config.timeout || 60000; // Increased from 15000 to 60000 (60 seconds)
    this.retries = config.retries || 3;
    this.logger = config.logger || console;
  }



  /**
   * Get all available agents
   */
  async getAgents(): Promise<Agent[]> {
    const url = `${this.baseUrl}/api/agents`;
    const response = await fetch(url);
    const parsedResponse = await response.json();
    const agents = parsedResponse.data.agents;
    
    try {
      return agents;
    } catch (error) {
      this.logger.error(`Error getting agents: ${error}`);
      throw error;
    }
  }

  /**
   * Get C3PO agent specifically
   */
  async getC3POAgent(): Promise<Agent> {
    const agents = await this.getAgents();
    
    try {
      const c3poAgent = agents.find((agent: any) => agent.name === 'C3PO');
      if (!c3poAgent) {
        throw new Error('C3PO agent not found');
      }
      return c3poAgent;
    } catch (error) {
      this.logger.error(`Error finding C3PO agent: ${error}`);
      throw error;
    }
  }

  // Create a new agent
  async createC3P0Agent(): Promise<Agent> {
    const agentData: AgentCreateParams = {
      characterJson: agentConfig
    };
    
    const response = await fetch(`${this.baseUrl}/api/agents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(agentData),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const newAgent = await response.json();
    return newAgent.data.character;
  }

  /**
   * Start an existing agent
   */
  async startAgent(agentId: string): Promise<{ success: boolean, error?: string }> {
    const response = await fetch(`${this.baseUrl}/api/agents/${agentId}/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    return result;
  }

  // /**
  //  * Find or create a DM channel
  //  */
  async getOrCreateDmChannel(params: DmChannelParams): Promise<MessageChannel> {
    const url = new URL(`${this.baseUrl}/api/messaging/dm-channel`);
    
    // Handle participantIds array properly - add each UUID as a separate query parameter
    if (params.participantIds && Array.isArray(params.participantIds)) {
      params.participantIds.forEach((participantId: string) => {
        url.searchParams.append('participantIds', participantId);
      });
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    return result;
  }

  /**
   * Get or create a DM channel with the C3PO agent
   */
  async getAgentChannelId(): Promise<string> {
    const agent = await this.getC3POAgent();
    if (!agent || !agent.id) {
      throw new Error('C3PO agent not found');
    }
    
    // Get channels from the central server
    const url = `${this.baseUrl}/api/messaging/central-servers/00000000-0000-0000-0000-000000000000/channels`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const channels = await response.json();
    
    // Find the DM channel with the C3PO agent
    const dmChannel = channels.data?.channels?.find((channel: any) => 
      channel.type === 'DM' && 
      channel.metadata?.forAgent === agent.id
    );
    
    if (!dmChannel) {
      throw new Error(`No DM channel found for C3PO agent (${agent.id}). Available channels:`, channels.data?.channels);
    }
    
    return dmChannel.id;
  }

  /**
   * Clear channel history to start fresh
   */
  async clearChannelHistory(channelId: string): Promise<{ success: boolean, error?: string }> {
    const url = `${this.baseUrl}/api/messaging/central-channels/${channelId}/messages`;
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    if (response.status === 204) {
      this.logger.info('Channel history cleared');
      return { success: true };
    }

    return { success: false, error: 'Failed to clear channel history' };
  }

  /**
   * Send a message using the query.ts logic
   */
  async sendMessage(message: string, options: SendMessageOptions): Promise<SendMessageResponse> {
    try {
      // validate message
      if (!message) {
        throw new Error('Message is required');
      }
      if (!options.agentId) {
        throw new Error('Agent ID is required');
      }

      if (message.length > 1000) {
        throw new Error('Message is too long');
      }
      // Get the channel
      const channelId = await this.getAgentChannelId();
      
      if (!channelId) {
        throw new Error('Could not obtain channel ID');
      }

      // Clear history if requested
      if (options.clearHistory) {
        await this.clearChannelHistory(channelId);
      }

      // Send the message using the query.ts approach
      const messageResponse = await fetch(`${this.baseUrl}/api/messaging/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          channel_id: channelId,
          server_id: "00000000-0000-0000-0000-000000000000",
          author_id: "5c9f5d45-8015-4b76-8a87-cf2efabcaccd",
          content: message,
          source_type: "client_chat",
          raw_message: {},
          metadata: {
            channelType: "DM",
            isDm: true,
            targetUserId: options.agentId
          }
        }),
      });

      if (!messageResponse.ok) {
        throw new Error(`HTTP ${messageResponse.status}: ${messageResponse.statusText}`);
      }

      const responseData = await messageResponse.json();

      const messageId = responseData.data?.id;

      // Wait for response if requested
      if (options.waitForResponse && messageId) {
        if (options.contentValidator) {
          // Use content validation if provided
          const response = await this.waitForResponseWithContent(
            channelId, 
            messageId, 
            options.contentValidator, 
            options.responseTimeout || 60000
          );
          return {
            success: true,
            messageId,
            response
          };
          
        } else {
          // Use standard response waiting
          const response = await this.waitForResponse(channelId, messageId, options.responseTimeout || 60000);
          return {
            success: true,
            messageId,
            response
          };
        }
      }

      return {
        success: true,
        messageId
      };

    } catch (error) {
      this.logger.error('Error sending message:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Wait for a response to a specific message
   */
  async waitForResponse(
    channelId: string, 
    messageId: string, 
    timeout: number = 60000 // Increased from 30000 to 60000 (60 seconds)
  ): Promise<Message[]> {
    const startTime = Date.now();
    const interval = 1000; // Check every second

    while (Date.now() - startTime < timeout) {
      try {
        // Get more messages to handle multiple responses
        const messages = await this.getChannelMessages(channelId, {limit: 10});

        if (messages.messages && messages.messages.length > 0) {
          // Filter messages to find responses to our specific message
          const responseMessages = messages.messages.filter((message: any) => 
            message.inReplyToRootMessageId === messageId
          );

          if (responseMessages.length > 0) {
            this.logger.info(`Found ${responseMessages.length} response messages for messageId: ${messageId}`);
            return responseMessages;
          }

          // Continue waiting as long as we're within the timeout
          this.logger.info(`Found ${messages.messages.length} total messages, continuing to wait for response...`);
        }

        // Wait before next check
        await new Promise(resolve => setTimeout(resolve, interval));
      } catch (error) {
        this.logger.warn('Error checking for response:', error);
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    }

    throw new Error(`Timeout waiting for response after ${timeout}ms`);
  }

  /**
   * Wait for a response with specific content validation
   * This method continues waiting until the expected content is found in any response message
   */
  async waitForResponseWithContent(
    channelId: string,
    messageId: string,
    contentValidator: (content: string) => boolean,
    timeout: number = 60000
  ): Promise<Message[]> {
    const startTime = Date.now();
    const interval = 1000; // Check every second

    while (Date.now() - startTime < timeout) {
      try {
        // Get more messages to handle multiple responses
        const messages = await this.getChannelMessages(channelId, {limit: 15});

        if (messages.messages && messages.messages.length > 0) {
          // Filter messages to find responses to our specific message
          const responseMessages = messages.messages.filter((message: any) => 
            message.inReplyToRootMessageId === messageId
          );

          // Debug: Log all messages to see what we're working with
          this.logger.info(`Debug: Found ${messages.messages.length} total messages, ${responseMessages.length} responses`);
          messages.messages.forEach((msg: any, index: number) => {
            this.logger.info(`Debug: Message ${index}: content="${msg.content?.substring(0, 100)}...", inReplyToRootMessageId="${msg.inReplyToRootMessageId}", authorId="${msg.authorId}"`);
          });

          // Check only response messages for the expected content
          for (const message of responseMessages) {
            if (message.content && contentValidator(message.content)) {
              this.logger.info(`Found message with expected content for messageId: ${messageId}`);
              return [message];
            }
          }

          // Continue waiting as long as we're within the timeout
          this.logger.info(`Found ${messages.messages.length} total messages, ${responseMessages.length} responses, continuing to wait for expected content...`);
        }

        // Wait before next check
        await new Promise(resolve => setTimeout(resolve, interval));
      } catch (error) {
        this.logger.warn('Error checking for response with content:', error);
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    }

    throw new Error(`Timeout waiting for response with expected content after ${timeout}ms`);
  }

  /**
   * Get channel messages
   */
  async getChannelMessages(channelId: string, options: GetChannelMessagesOptions = {}): Promise<{ success: boolean, messages: Message[] }> {
    const url = `${this.baseUrl}/api/messaging/central-channels/${channelId}/messages`;
    const params = new URLSearchParams();
    
    if (options.after) {
      params.append('after', options.after);
    }
    if (options.limit) {
      params.append('limit', options.limit.toString());
    }

    const response = await fetch(`${url}?${params}`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();

    return {
      success: true,
      messages: result.data.messages
    };
  }

  /**
   * Send message with retries
   */
  async sendMessageWithRetry(
    message: string, 
    options: SendMessageOptions
  ): Promise<SendMessageResponse> {
    let lastError: string | undefined;

    for (let attempt = 1; attempt <= this.retries; attempt++) {
      this.logger.info(`Attempt ${attempt}/${this.retries} to send message`);
      
      const result = await this.sendMessage(message, options);
      
      if (result.success) {
        return result;
      }

      lastError = result.error;
      
      if (attempt < this.retries) {
        // Wait before retry with exponential backoff
        const waitTime = Math.pow(2, attempt) * 1000;
        this.logger.info(`Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    return {
      success: false,
      error: `Failed after ${this.retries} attempts. Last error: ${lastError}`
    };
  }

  /**
   * Get the latest response message content
   */
  getLatestResponseContent(responseMessages: Message[]): string | null {
    if (!responseMessages || responseMessages.length === 0) {
      return null;
    }
    
    // Get the most recent response (first in the array)
    const latestMessage = responseMessages[0];
    return latestMessage.content || null;
  }

  /**
   * Utility method to sleep/wait
   */
  async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Convenience function to create a new Eliza client
 */
export function createElizaClient(config?: ElizaClientConfig): ElizaClient {
  return new ElizaClient(config);
} 