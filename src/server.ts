import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { 
  MCPServer as MidnightMCPServer,
  createSimpleToolHandler,
  createParameterizedToolHandler,
  TransactionNotification
} from './mcp/index.js';
import { CloudProvider, configureGlobalLogging, createLogger, logger } from './logger/index.js';
import { config } from './config.js';
import { randomUUID } from 'node:crypto';
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js"

const app = express();
app.use(express.json());

// Initialize Midnight MCP server

// Configure global logging settings based on environment
configureGlobalLogging({
  level: (process.env.LOG_LEVEL as any) || 'info',
  prettyPrint: process.env.NODE_ENV !== 'production',
  enableFileOutput: process.env.NODE_ENV === 'production',
  defaultLogFile: './logs/midnight-mcp.log',
  // Example: Configure GCP logging if in production and GCP_PROJECT_ID is set
  ...(process.env.NODE_ENV === 'production' && process.env.GCP_PROJECT_ID ? {
    cloud: {
      provider: CloudProvider.GCP,
      config: {
        projectId: process.env.GCP_PROJECT_ID,
        logName: 'midnight-mcp-logs',
        resource: {
          type: 'k8s_container',
          labels: {
            cluster_name: process.env.K8S_CLUSTER_NAME || 'midnight-cluster',
            namespace_name: process.env.K8S_NAMESPACE || 'default',
            pod_name: process.env.POD_NAME || 'midnight-mcp',
            container_name: 'midnight-mcp',
          },
        },
      },
    },
  } : {}),
  // Standard fields to include with all logs
  standardFields: {
    application: 'midnight-mcp',
    environment: process.env.NODE_ENV || 'development',
    version: process.env.APP_VERSION || '0.0.1',
  },
});

const shouldCheckAuth = process.env.CHECK_AUTH === 'true';
const API_KEY = process.env.API_KEY;

if (shouldCheckAuth && API_KEY) {
  // Mask key in logs for security
  const maskedKey = API_KEY.length > 8 
    ? `${API_KEY.substring(0, 4)}...${API_KEY.substring(API_KEY.length - 4)}`
    : '********';
  
  if (process.env.NODE_ENV !== 'production') {
    logger.info(`Using development API key: ${API_KEY}`);
  } else {
    logger.info(`API authentication enabled with key: ${maskedKey}`);
  }
} else if (shouldCheckAuth && !API_KEY) {
  logger.info('API authentication disabled');
  throw new Error('No API_KEY defined. Authentication is mandatory.');
} else {
  logger.info('API authentication disabled');
}

const externalConfig = {
  proofServer: config.proofServer,
  indexer: config.indexer,
  indexerWS: config.indexerWS,
  node: config.node,
  useExternalProofServer: config.useExternalProofServer,
  networkId: config.networkId
};

// Initialize Midnight wallet instance
const midnightServer = new MidnightMCPServer(
  config.networkId,
  config.seed,
  config.walletFilename,
  externalConfig
);

// Helper: Create a new MCP Protocol Server instance with tools and resources
function getServer() {
  const server = new McpServer({
    name: 'MidnightMCPServer',
    version: '1.0.0'
  });

  // test notification
  server.tool(
    'testNotification',
    'Test notification',
    createSimpleToolHandler(() => midnightServer.sendNotification())
  );

  // Add wallet status tool
  server.tool(
    'walletStatus',
    'Get the current status of the wallet',
    createSimpleToolHandler(() => midnightServer.getWalletStatus())
  );

  // Add wallet address tool
  server.tool(
    'walletAddress',
    'Get the wallet address',
    createSimpleToolHandler(() => midnightServer.getAddress())
  );

  // Add wallet balance tool
  server.tool(
    'walletBalance',
    'Get the current balance of the wallet',
    createSimpleToolHandler(() => midnightServer.getBalance())
  );

  // Add send funds tool
  server.tool(
    'sendFunds', 
    'Send funds to another wallet address',
    {
      destinationAddress: z.string().min(1), 
      amount: z.string().min(1) 
    },
    createParameterizedToolHandler((args: { destinationAddress: string, amount: string }) => 
      midnightServer.sendFunds(args.destinationAddress, args.amount)
    )
  );

  // Add transaction verification tool
  server.tool(
    'verifyTransaction',
    'Verify if a transaction has been received',
    {
      identifier: z.string().min(1) 
    },
    createParameterizedToolHandler((args: { identifier: string }) => 
      midnightServer.confirmTransactionHasBeenReceived(args.identifier)
    )
  );

  return server;
}

// // MCP POST endpoint (streamable)
// app.post('/mcp', (async (req, res) => {
//   try {
//     // handle request authentication
//     const authHeader = req.headers['Authorization'] || req.headers['authorization'];
//     if (shouldCheckAuth && authHeader !== `Bearer ${API_KEY}`) {
//       return res.status(401).json({
//         jsonrpc: '2.0',
//         error: { code: -32000, message: 'Unauthorized' },
//         id: null
//       });
//     }

//     const server = getServer();
//     const transport = new StreamableHTTPServerTransport({
//       sessionIdGenerator: undefined
//     });

//     res.on('close', () => {
//       logger.info('Request closed');
//       transport.close();
//       server.close();
//     });

//     await server.connect(transport);
//     await transport.handleRequest(req, res, req.body);
//     // sample message
//     await transport.send(
//       {
//         jsonrpc: '2.0',
//         method: 'walletStatus',
//         params: {
//           destinationAddress: '0x1234567890abcdef',
//           amount: '1000000000000000000'
//         },
//         id: '1'
//       }
//     )
//   } catch (error) {
//     logger.error('Error handling MCP request:', error);
//     if (!res.headersSent) {
//       res.status(500).json({
//         jsonrpc: '2.0',
//         error: {
//           code: -32603,
//           message: 'Internal server error',
//         },
//         id: null,
//       });
//     }
//   }
// }) as express.RequestHandler);

// // Disallow GET and DELETE
// app.get('/mcp', (async (req, res) => {
//   logger.info('Received GET MCP request');
//   res.status(405).json({
//     jsonrpc: '2.0',
//     error: {
//       code: -32000,
//       message: 'Method not allowed.'
//     },
//     id: null
//   });
// }) as express.RequestHandler);

// app.delete('/mcp', (async (req, res) => {
//   logger.info('Received DELETE MCP request');
//   res.status(405).json({
//     jsonrpc: '2.0',
//     error: {
//       code: -32000,
//       message: 'Method not allowed.'
//     },
//     id: null
//   });
// }) as express.RequestHandler);

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down server...');
  await midnightServer.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Shutting down server...');
  await midnightServer.close();
  process.exit(0);
});

// // Start the server
// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => {
//   logger.info(`Midnight MCP Server listening on port ${PORT}`);
// });

// Map to store transports by session ID
const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

// Handle POST requests for client-to-server communication
app.post('/mcp', async (req, res) => {
  // Check for existing session ID
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  let transport: StreamableHTTPServerTransport;

  if (sessionId && transports[sessionId]) {
    // Reuse existing transport
    transport = transports[sessionId];
  } else if (!sessionId && isInitializeRequest(req.body)) {
    // New initialization request
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sessionId) => {
        // Store the transport by session ID
        transports[sessionId] = transport;
      }
    });

    // Clean up transport when closed
    transport.onclose = () => {
      if (transport.sessionId) {
        delete transports[transport.sessionId];
      }
    };
    const server = getServer();

    midnightServer.setNotificationHandler(
      (notification: TransactionNotification) => {
        // Send notification to the client
        transport.send({
          jsonrpc: '2.0',
          method: 'transactionNotification',
          params: {
            notifications: [notification]
          },
          id: '1'
        });
      }
    )
    // Connect to the MCP server
    await server.connect(transport);
  } else {
    // Invalid request
    res.status(400).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Bad Request: No valid session ID provided',
      },
      id: null,
    });
    return;
  }

  // Handle the request
  await transport.handleRequest(req, res, req.body);
});

// Reusable handler for GET and DELETE requests
const handleSessionRequest = async (req: express.Request, res: express.Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send('Invalid or missing session ID');
    return;
  }
  
  const transport = transports[sessionId];
  await transport.handleRequest(req, res);
};

// Handle GET requests for server-to-client notifications via SSE
app.get('/mcp', handleSessionRequest);

// Handle DELETE requests for session termination
app.delete('/mcp', handleSessionRequest);

app.listen(3000);