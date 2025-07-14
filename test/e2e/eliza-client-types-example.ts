import { 
  createElizaClient, 
  IElizaClient, 
  ElizaClientConfig, 
  SendMessageOptions, 
  SendMessageResponse,
  Agent,
  Message
} from './eliza-client';

/**
 * Example demonstrating the typed Eliza client
 */
async function typedElizaClientExample() {
  // Create a typed client configuration
  const config: ElizaClientConfig = {
    baseUrl: 'http://localhost:3001',
    timeout: 15000, // 15 seconds default
    retries: 3,
    logger: console
  };

  // Create a typed client
  const client: IElizaClient = createElizaClient(config);

  try {
    console.log('🚀 Starting typed Eliza client example...');

    // Get agents with proper typing
    const agents: Agent[] = await client.getAgents();
    console.log('📋 Available agents:', agents.map(a => ({ name: a.name, id: a.id })));

    // Get C3PO agent with proper typing
    const c3poAgent: Agent = await client.getC3POAgent();
    console.log('🤖 C3PO agent:', { name: c3poAgent.name, id: c3poAgent.id });

    // Get channel ID with proper typing
    const channelId: string = await client.getAgentChannelId();
    console.log('💬 Channel ID:', channelId);

    // Send message with typed options
    const messageOptions: SendMessageOptions = {
      clearHistory: true,
      waitForResponse: true,
      responseTimeout: 15000
    };

    const response: SendMessageResponse = await client.sendMessage('Hello, can you tell me about Midnight?', messageOptions);

    if (response.success) {
      console.log('✅ Message sent successfully');
      console.log('📨 Message ID:', response.messageId);
      
      if (response.response) {
        // Type-safe access to response messages
        const messages: Message[] = response.response;
        console.log('🤖 Response messages:', messages.length);
        
        // Get the latest response content
        const content: string | null = client.getLatestResponseContent(messages);
        console.log('📝 Latest response content:', content);
      }
    } else {
      console.log('❌ Failed to send message:', response.error);
    }

    // Example of using the retry method with proper typing
    const retryResponse: SendMessageResponse = await client.sendMessageWithRetry('What is your name?', {
      clearHistory: true,
      waitForResponse: true,
      responseTimeout: 10000
    });

    if (retryResponse.success && retryResponse.response) {
      const messages: Message[] = retryResponse.response;
      const content: string | null = client.getLatestResponseContent(messages);
      console.log('🔄 Retry response content:', content);
    }

  } catch (error) {
    console.error('💥 Error in typed example:', error);
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  typedElizaClientExample().catch(console.error);
}

export { typedElizaClientExample }; 