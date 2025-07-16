import { createElizaClient } from './eliza-client';

/**
 * Example usage of the Eliza client
 */
async function exampleUsage() {
  // Create a client instance
const client = createElizaClient({
  baseUrl: 'http://localhost:3001',
  timeout: 15000, // 15 seconds default
  retries: 3,
  logger: console
});

  try {
    console.log('🚀 Starting Eliza client example...');

    // Example 1: Send a message and wait for response
    console.log('\n📤 Sending message and waiting for response...');
    const result1 = await client.sendMessage('Hello, can you tell me about Midnight?', {
      clearHistory: true, // Clear chat history first
      waitForResponse: true, // Wait for the agent to respond
      responseTimeout: 15000 // Wait up to 15 seconds for response
    });

    if (result1.success) {
      console.log('✅ Message sent successfully');
      console.log('📨 Message ID:', result1.messageId);
      console.log('🤖 Agent response:', result1.response);
      
      // Get the latest response content
      if (result1.response) {
        const responseContent = client.getLatestResponseContent(result1.response);
        console.log('📝 Latest response content:', responseContent);
      }
    } else {
      console.log('❌ Failed to send message:', result1.error);
    }

    // Example 2: Send another message without waiting
    console.log('\n📤 Sending another message...');
    const result2 = await client.sendMessage('What is your name?', {
      clearHistory: false // Don't clear history this time
    });

    if (result2.success) {
      console.log('✅ Message sent successfully');
      console.log('📨 Message ID:', result2.messageId);
      
      // Manually wait for response
      console.log('⏳ Waiting for response...');
      const response = await client.waitForResponse(
        '4af73091-392d-47f5-920d-eeaf751e81d2', // channel ID - will be dynamically obtained from getAgentChannel()
        result2.messageId!,
        10000 // 10 second timeout
      );
      console.log('🤖 Agent response:', response);
    }

    // Example 3: Send message with retries
    console.log('\n📤 Sending message with retries...');
    const result3 = await client.sendMessageWithRetry('Tell me a joke', {
      clearHistory: true,
      waitForResponse: true,
      responseTimeout: 10000
    });

    if (result3.success) {
      console.log('✅ Message sent with retries');
      console.log('🤖 Agent response:', result3.response);
    } else {
      console.log('❌ Failed to send message with retries:', result3.error);
    }

  } catch (error) {
    console.error('💥 Error in example:', error);
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  exampleUsage().catch(console.error);
}

export { exampleUsage }; 