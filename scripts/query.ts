import { ElizaClient, ExternalMessageParams, MessageSubmitParams } from '@elizaos/api-client';

// Create client instance
const client = ElizaClient.create({
  baseUrl: 'http://localhost:3001',
});


const query = async () => {
  // List all agents
  const { agents } = await client.agents.listAgents();
  console.log(`Found ${agents.length} agents`);
  return agents;
};

const getAgent = async (name: string) => {
  const agents = await query();
  const agent = agents.find((agent) => agent.name === name);
  if (!agent) {
    throw new Error(`Agent ${name} not found`);
  }
  return agent;
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const sendMessage = async () => {
  try {
    
    const C3PO = await getAgent('C3PO');
    // console.log(C3PO);
  
    const channels = await client.messaging.getServerChannels('00000000-0000-0000-0000-000000000000');
    console.log('Channels:', channels);
    const channelToUse = {
      id: "4af73091-392d-47f5-920d-eeaf751e81d2"
    };
    console.log('Channel to use:', channelToUse);

  // attempt to clear the channel messages
  // const clearResponse = await client.messaging.clearChannelHistory(channelToUse.id as `${string}-${string}-${string}-${string}-${string}`);
  // console.log('Channel cleared:', clearResponse);
  // fetch the post message without the client
  // const messageResponse = await fetch('http://localhost:3001/api/messaging/submit', {
  //   method: 'POST',
  //   headers: {
  //     'Content-Type': 'application/json'
  //   },
  //   body: JSON.stringify({
  //     channel_id: channelToUse.id,
  //     server_id: "00000000-0000-0000-0000-000000000000",
  //     author_id: "5c9f5d45-8015-4b76-8a87-cf2efabcaccd",
  //     content: 'This a test message, reply: "Hello Honduras 2"',
  //     source_type: "client_chat",
  //     raw_message: {},
  //     metadata: {
  //       channelType: "DM",
  //       isDm: true,
  //       targetUserId: "22d22d5f-e650-03f9-8a74-1f0aa3107035"
  //     }
  //   }),
  // });

  // const responseData = await messageResponse.json();
  // console.log('Message sent:', responseData);

  // await sleep(5000);

  const responseData = {
    data: {
      id: "9314c73b-4270-4f27-bd31-fe375f16ca7d"
    }
  }

  const messageId = responseData.data.id;
  console.log('Message ID:', messageId);
  const message = await client.messaging.getChannelMessages(channelToUse.id as `${string}-${string}-${string}-${string}-${string}`);
  
  console.log('Retrieved message:', message);
    
  } catch (error) {
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      status: error.status,
      details: error.details
    });
  } 
};

// example of the message response
// Retrieved message: {
//   messages: [
//     {
//       id: '1b12fc3a-fdd6-4a74-b759-96bb146dcd1d',
//       channelId: '4af73091-392d-47f5-920d-eeaf751e81d2',
//       authorId: '22d22d5f-e650-03f9-8a74-1f0aa3107035',
//       content: 'Hello Honduras',
//       rawMessage: [Object],
//       sourceType: 'agent_response',
//       metadata: [Object],
//       inReplyToRootMessageId: 'cb57ac3a-fe60-4ad3-9bdb-42c16be409bb',
//       createdAt: '2025-07-14T15:28:58.231Z',
//       updatedAt: '2025-07-14T15:28:58.231Z',
//       created_at: 1752506938231,
//       updated_at: 1752506938231
//     }
//   ]
// }

query();
sendMessage();
