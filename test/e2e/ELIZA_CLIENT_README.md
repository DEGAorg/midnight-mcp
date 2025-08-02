# Eliza Client for E2E Testing

This directory contains an enhanced Eliza client that incorporates the logic from `query.ts` for sending messages to the Eliza agent and waiting for responses. The client provides a clean API for e2e testing scenarios.

## Files

- `eliza-client.ts` - Main client implementation with query.ts logic and TypeScript types
- `eliza-client-example.ts` - Example usage of the client
- `eliza-client-types-example.ts` - Example demonstrating TypeScript types
- `helpers.ts` - Original helpers (now deprecated in favor of eliza-client.ts)

## Quick Start

```typescript
import { createElizaClient, IElizaClient, SendMessageOptions } from './eliza-client';

// Create a typed client instance
const client: IElizaClient = createElizaClient({
  baseUrl: 'http://localhost:3001',
  timeout: 30000,
  retries: 3
});

// Send a message with typed options
const options: SendMessageOptions = {
  clearHistory: true, // Clear chat history first
  waitForResponse: true, // Wait for the agent to respond
  responseTimeout: 15000 // Wait up to 15 seconds for response
};

const result = await client.sendMessage('Hello, can you tell me about Midnight?', options);

if (result.success && result.response) {
  const content = client.getLatestResponseContent(result.response);
  console.log('Agent response:', content);
}
```

## API Reference

### `createElizaClient(config?)`

Creates a new Eliza client instance.

**Parameters:**
- `config.baseUrl` (optional): API base URL (default: `http://localhost:3001`)
- `config.timeout` (optional): Request timeout in ms (default: `15000`)
- `config.retries` (optional): Number of retry attempts (default: `3`)
- `config.logger` (optional): Logger instance (default: `console`)

### `client.sendMessage(message, options?)`

Sends a message to the Eliza agent.

**Parameters:**
- `message`: The message to send
- `options.clearHistory` (optional): Clear chat history before sending (default: `false`)
- `options.waitForResponse` (optional): Wait for agent response (default: `false`)
- `options.responseTimeout` (optional): Timeout for waiting response in ms (default: `15000`)

**Returns:**
```typescript
{
  success: boolean;
  messageId?: string;
  response?: any;
  error?: string;
}
```

### `client.sendMessageWithRetry(message, options?)`

Sends a message with automatic retries on failure.

**Parameters:** Same as `sendMessage()`

**Returns:** Same as `sendMessage()`

### `client.waitForResponse(channelId, messageId, timeout?)`

Manually wait for a response to a specific message.

**Parameters:**
- `channelId`: The channel ID
- `messageId`: The message ID to wait for response to
- `timeout` (optional): Timeout in ms (default: `15000`)

**Returns:** Array of response messages that have `inReplyToRootMessageId` matching the provided `messageId`

### `client.getLatestResponseContent(responseMessages)`

Extract the content from the latest response message.

**Parameters:**
- `responseMessages`: Array of response messages

**Returns:** String content of the latest response, or null if no messages

### `client.clearChannelHistory(channelId)`

Clears the chat history for a specific channel.

**Parameters:**
- `channelId`: The channel ID to clear

**Returns:** Clear operation result

### `client.getAgents()`

Gets all available agents.

**Returns:** Array of agent objects

### `client.getC3POAgent()`

Gets the C3PO agent specifically.

**Returns:** C3PO agent object

### `client.getAgentChannel()`

Gets the DM channel with the C3PO agent from the central server.

**Returns:** Channel object with structure:
```typescript
{
  id: string;
  messageServerId: string;
  name: string;
  type: "DM";
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
```

## TypeScript Interfaces

The client provides several TypeScript interfaces for type safety:

- `IElizaClient` - Main client interface with all available methods
- `ElizaClientConfig` - Configuration options for creating the client
- `SendMessageOptions` - Options for sending messages
- `SendMessageResponse` - Response structure from sending messages
- `Agent` - Agent information structure
- `Message` - Message information structure
- `Channel` - Channel information structure
- `GetChannelMessagesOptions` - Options for getting channel messages

### Example with Types

```typescript
import { 
  createElizaClient, 
  IElizaClient, 
  SendMessageOptions, 
  SendMessageResponse,
  Agent 
} from './eliza-client';

// Create a typed client
const client: IElizaClient = createElizaClient();

// Get agents with proper typing
const agents: Agent[] = await client.getAgents();

// Send message with typed options
const options: SendMessageOptions = {
  clearHistory: true,
  waitForResponse: true,
  responseTimeout: 15000
};

const response: SendMessageResponse = await client.sendMessage('Hello', options);
```

## Usage Examples

### Basic Message Sending

```typescript
const client = createElizaClient();

// Send a simple message
const result = await client.sendMessage('Hello');
console.log('Message sent:', result.success);
```

### Send and Wait for Response

```typescript
const client = createElizaClient();

// Send message and wait for response
const result = await client.sendMessage('What is Midnight?', {
  clearHistory: true,
  waitForResponse: true,
  responseTimeout: 15000
});

if (result.success && result.response) {
  // Get the latest response content
  const responseContent = client.getLatestResponseContent(result.response);
  console.log('Agent said:', responseContent);
}
```

### Manual Response Waiting

```typescript
const client = createElizaClient();

// Send message
const result = await client.sendMessage('Tell me a joke');

if (result.success) {
  // Manually wait for response
  const response = await client.waitForResponse(
    'channel-id',
    result.messageId!,
    10000
  );
  console.log('Response:', response);
}
```

### Using Retries

```typescript
const client = createElizaClient({ retries: 5 });

// Send with automatic retries
const result = await client.sendMessageWithRetry('Hello', {
  waitForResponse: true
});

if (result.success) {
  console.log('Success after retries:', result.response);
}
```

## Migration from Old Helpers

The old `ElizaHttpClient` class in `helpers.ts` is now deprecated. To migrate:

**Old way:**
```typescript
import { ElizaHttpClient } from './helpers';

const client = new ElizaHttpClient();
const response = await client.sendMessage('Hello');
```

**New way:**
```typescript
import { createElizaClient } from './eliza-client';

const client = createElizaClient();
const result = await client.sendMessage('Hello', {
  waitForResponse: true
});
```

## Key Features

1. **Query.ts Logic**: Incorporates the exact message sending logic from `query.ts`
2. **Response Waiting**: Built-in support for waiting for agent responses
3. **History Clearing**: Easy way to clear chat history for clean tests
4. **Retry Logic**: Automatic retries with exponential backoff
5. **Better Error Handling**: More detailed error information
6. **Flexible Configuration**: Configurable timeouts, retries, and logging
7. **Backward Compatibility**: Old helpers still work but are deprecated

## Testing

Run the example to test the client:

```bash
npx ts-node test/e2e/eliza-client-example.ts
```

This will demonstrate various usage patterns and show how the client works with the Eliza agent. 