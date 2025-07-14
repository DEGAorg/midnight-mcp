// Use the global fetch available in Node.js 18+
const fetch = globalThis.fetch;

/**
 * Enhanced Eliza client that incorporates query.ts logic
 * for sending messages and waiting for specific responses
 */
export class ElizaClient {
  private baseUrl: string;
  private timeout: number;
  private retries: number;
  private logger: any;

  constructor(config: {
    baseUrl?: string;
    timeout?: number;
    retries?: number;
    logger?: any;
  } = {}) {
    this.baseUrl = config.baseUrl || process.env.ELIZA_API_URL || 'http://localhost:3001';
    this.timeout = config.timeout || 30000;
    this.retries = config.retries || 3;
    this.logger = config.logger || console;
  }

  /**
   * Get all available agents
   */
  async getAgents(): Promise<any[]> {
    const url = `${this.baseUrl}/api/agents`;
    const response = await fetch(url);
    const parsedResponse = await response.json();
    const agents = parsedResponse.data.agents;
    
    try {
      const agentNamesAndIds = agents.map((agent: any) => ({ name: agent.name, id: agent.id }));
      this.logger.info('Available agents:', agentNamesAndIds);
      return agents;
    } catch (error) {
      this.logger.error(`Error getting agents: ${error}`);
      throw error;
    }
  }

  /**
   * Get C3PO agent specifically
   */
  async getC3POAgent(): Promise<any> {
    const agents = await this.getAgents();
    this.logger.info('Attempting to find C3PO agent...');
    
    try {
      const c3poAgent = agents.find((agent: any) => agent.name === 'C3PO');
      if (!c3poAgent) {
        throw new Error('C3PO agent not found');
      }
      this.logger.info(`C3PO agent found: ${c3poAgent.name}`);
      return c3poAgent;
    } catch (error) {
      this.logger.error(`Error finding C3PO agent: ${error}`);
      throw error;
    }
  }

  /**
   * Get or create a DM channel with the C3PO agent
   */
  async getAgentChannelId(): Promise<any> {
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
    this.logger.info('Channels obtained:', channels);
    
    // Find the DM channel with the C3PO agent
    const dmChannel = channels.data?.channels?.find((channel: any) => 
      channel.type === 'DM' && 
      channel.metadata?.forAgent === agent.id
    );
    
    if (!dmChannel) {
      throw new Error(`No DM channel found for C3PO agent (${agent.id}). Available channels:`, channels.data?.channels);
    }
    
    this.logger.info('DM channel found:', dmChannel);
    return dmChannel.id;
  }

  /**
   * Clear channel history to start fresh
   */
  async clearChannelHistory(channelId: string): Promise<any> {
    const url = `${this.baseUrl}/api/messaging/clear-channel-history`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        channel_id: channelId 
      }),
    });
    
    const result = await response.json();
    this.logger.info('Channel history cleared:', result);
    return result;
  }

  /**
   * Send a message using the query.ts logic
   */
  async sendMessage(message: string, options: {
    clearHistory?: boolean;
    waitForResponse?: boolean;
    responseTimeout?: number;
  } = {}): Promise<{
    success: boolean;
    messageId?: string;
    response?: any;
    error?: string;
  }> {
    try {
      // Get the channel
      const channelId = await this.getAgentChannelId();
      
      if (!channelId) {
        throw new Error('Could not obtain channel ID');
      }

      this.logger.info('Using channel ID:', channelId);

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
            targetUserId: "22d22d5f-e650-03f9-8a74-1f0aa3107035"
          }
        }),
      });

      if (!messageResponse.ok) {
        throw new Error(`HTTP ${messageResponse.status}: ${messageResponse.statusText}`);
      }

      const responseData = await messageResponse.json();
      this.logger.info('Message sent successfully:', responseData);

      const messageId = responseData.data?.id;

      // Wait for response if requested
      if (options.waitForResponse && messageId) {
        const response = await this.waitForResponse(channelId, messageId, options.responseTimeout);
        return {
          success: true,
          messageId,
          response
        };
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
    timeout: number = 10000
  ): Promise<any> {
    const startTime = Date.now();
    const interval = 1000; // Check every second

    while (Date.now() - startTime < timeout) {
      try {
        const messages = await this.getChannelMessages(channelId, {limit: 2});

        if (messages.messages && messages.messages.length > 0) {
          // Filter messages to find the response to our specific message
          const responseMessages = messages.messages.filter((message: any) => 
            message.inReplyToRootMessageId === messageId
          );

          if (responseMessages.length > 0) {
            this.logger.info('Response received:', responseMessages);
            return responseMessages;
          }
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
   * Get channel messages
   */
  async getChannelMessages(channelId: string, options: {
    after?: string;
    limit?: number;
  } = {}): Promise<any> {
    const url = `${this.baseUrl}/api/messaging/channel/${channelId}/messages`;
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

    return await response.json();
  }

  /**
   * Send message with retries
   */
  async sendMessageWithRetry(
    message: string, 
    options: {
      clearHistory?: boolean;
      waitForResponse?: boolean;
      responseTimeout?: number;
    } = {}
  ): Promise<{
    success: boolean;
    messageId?: string;
    response?: any;
    error?: string;
  }> {
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
  getLatestResponseContent(responseMessages: any[]): string | null {
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
export function createElizaClient(config?: {
  baseUrl?: string;
  timeout?: number;
  retries?: number;
  logger?: any;
}): ElizaClient {
  return new ElizaClient(config);
} 