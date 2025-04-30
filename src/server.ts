import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from 'zod';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { 
  MCPServer as MidnightMCPServer,
  createSimpleToolHandler,
  createParameterizedToolHandler
} from './mcp/index.js';
import { CloudProvider, configureGlobalLogging, createLogger, logger } from './logger/index.js';
import { config } from './config.js';
import { randomUUID } from 'crypto';

const app = express();

// Only apply JSON middleware to specific routes, not the SSE endpoint
// Use a more targeted approach for middleware
app.use('/mcp', express.json());
// For the messages endpoint, we need to ensure raw bodies are accessible
app.use('/messages', express.json({
  verify: (req: any, res, buf) => {
    // Store the raw body for later use if needed
    req.rawBody = buf.toString();
  }
}));

// Store transports for each session type
const transports = {
  streamable: {} as Record<string, StreamableHTTPServerTransport>,
  sse: {} as Record<string, SSEServerTransport>
};

// Debugging flags
const DEBUG_SSE = process.env.DEBUG_SSE === 'true' || process.env.NODE_ENV !== 'production';

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

// Create the MCP Server with all tools and resources
const server = new McpServer({
  name: 'MidnightMCPServer',
  version: '1.0.0'
});

// Log when the server is created
logger.info('MCP Server instance created');

// Check server connection status for debugging
try {
  logger.debug('MCP Server initialized');
} catch (error) {
  logger.error('Error initializing MCP server:', error);
}

// Add wallet status tool
server.tool(
  'walletStatus',
  'Get the current status of the wallet',
  createSimpleToolHandler(() => {
    logger.info('Tool called: walletStatus');
    return midnightServer.getWalletStatus();
  })
);

// Add wallet address tool
server.tool(
  'walletAddress',
  'Get the wallet address',
  createSimpleToolHandler(() => {
    logger.info('Tool called: walletAddress');
    return midnightServer.getAddress();
  })
);

// Add wallet balance tool
server.tool(
  'walletBalance',
  'Get the current balance of the wallet',
  createSimpleToolHandler(() => {
    logger.info('Tool called: walletBalance');
    return midnightServer.getBalance();
  })
);

// Add send funds tool
server.tool(
  'sendFunds', 
  'Send funds to another wallet address',
  {
    destinationAddress: z.string().min(1), 
    amount: z.string().min(1) 
  },
  createParameterizedToolHandler((args: { destinationAddress: string, amount: string }) => {
    logger.info(`Tool called: sendFunds with args: ${JSON.stringify(args)}`);
    return midnightServer.sendFunds(args.destinationAddress, args.amount);
  })
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

// Add transaction status tool
server.tool(
  'getTransactionStatus',
  'Get the status of a transaction by ID',
  {
    transactionId: z.string().min(1)
  },
  createParameterizedToolHandler((args: { transactionId: string }) => 
    midnightServer.getTransactionStatus(args.transactionId)
  )
);

// Add get all transactions tool
server.tool(
  'getTransactions',
  'Get all transactions, optionally filtered by state',
  {
    state: z.string().optional()
  },
  createParameterizedToolHandler((args: { state?: string }) => 
    midnightServer.getTransactions(args.state as any)
  )
);

// Add get pending transactions tool
server.tool(
  'getPendingTransactions',
  'Get all pending transactions (INITIATED or SENT)',
  createSimpleToolHandler(() => midnightServer.getPendingTransactions())
);

// MCP POST endpoint (streamable)
app.all('/mcp', (async (req, res) => {
  try {
    logger.info(`Received MCP ${req.method} request`);
    
    // Handle request authentication
    const authHeader = req.headers['Authorization'] || req.headers['authorization'];
    if (shouldCheckAuth && authHeader !== `Bearer ${API_KEY}`) {
      return res.status(401).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Unauthorized' },
        id: null
      });
    }

    // Extract session ID from headers if present
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    
    // Handle session requests (GET and DELETE) differently from POST requests
    if (req.method === 'GET' || req.method === 'DELETE') {
      // Handle session-related requests (similar to SSE or session termination)
      if (!sessionId || !transports.streamable[sessionId]) {
        logger.warn(`Invalid or missing session ID for ${req.method} request: ${sessionId}`);
        res.status(400).send('Invalid or missing session ID');
        return;
      }
      
      logger.info(`Handling ${req.method} request for session ${sessionId}`);
      try {
        const transport = transports.streamable[sessionId];
        await transport.handleRequest(req, res);
      } catch (error) {
        logger.error(`Error handling ${req.method} request:`, error);
        if (!res.headersSent) {
          res.status(500).send(`Error processing ${req.method} request`);
        }
      }
      return;
    }
    
    // From here on, handle POST requests for normal MCP communication
    let transport: StreamableHTTPServerTransport;
    
    // Check if this is a request for an existing session
    if (sessionId && transports.streamable[sessionId]) {
      logger.info(`Reusing existing transport for session ${sessionId}`);
      transport = transports.streamable[sessionId];
    } 
    // Check if this is an initialization request
    else if (!sessionId && isInitializeRequest(req.body)) {
      logger.info('Creating new transport for initialization request');
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (newSessionId) => {
          // Store the transport by session ID when it's initialized
          logger.info(`Initialized new session with ID: ${newSessionId}`);
          transports.streamable[newSessionId] = transport;
        }
      });
      
      transport.onclose = () => {
        if (transport.sessionId) {
          logger.info(`Cleaning up transport for session ${transport.sessionId}`);
          delete transports.streamable[transport.sessionId];
        }
      };
      
      // Connect the transport to the server
      await server.connect(transport);
    } 
    // Invalid request without session ID and not an initialization
    else {
      logger.warn('Invalid request: No valid session ID provided and not an initialization request');
      return res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Bad Request: No valid session ID provided',
        },
        id: null,
      });
    }
    
    // Handle progress notifications if requested
    let progressInterval: NodeJS.Timeout | null = null;
    const progressToken = req.body.params?._meta?.progressToken;
    if (progressToken) {
      logger.info(`Setting up progress notifications for token ${progressToken}`);
      let progress = 0;
      
      // Since we don't have direct access to send notifications in our current implementation,
      // we'll skip progress notifications for now.
      // In a production implementation, consider adding a proper notification mechanism
      logger.info('Progress notifications requested but not implemented in this version');
    }
    
    // Handle the request
    logger.info('Processing request');
    await transport.handleRequest(req, res, req.body);
    
    // Clean up progress interval if it exists
    if (progressInterval) {
      clearInterval(progressInterval);
    }
  } catch (error) {
    logger.error('Error handling MCP request:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error',
        },
        id: null,
      });
    }
  }
}) as express.RequestHandler);

// Legacy SSE endpoint for older clients
app.get('/sse', async (req, res) => {
  try {
    logger.info('Establishing new SSE connection');
    
    if (DEBUG_SSE) {
      logger.debug('SSE debug mode enabled');
      logger.debug('SSE request query params:', req.query);
      logger.debug('SSE request headers:', req.headers);
    }
    
    // Set appropriate headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable proxy buffering
    
    // Create the SSE transport
    const transport = new SSEServerTransport('/messages', res);
    logger.info(`New SSE connection established for sessionId ${transport.sessionId}`);
    
    if (DEBUG_SSE) {
      logger.debug(`SSE transport details:`, {
        sessionId: transport.sessionId,
        messagePath: '/messages'
      });
    }
    
    // Store the transport by session ID
    transports.sse[transport.sessionId] = transport;
    logger.debug(`Added transport to registry with sessionId ${transport.sessionId}`);
    
    // Clean up when the connection closes
    res.on('close', () => {
      logger.info(`SSE connection closed for sessionId ${transport.sessionId}`);
      delete transports.sse[transport.sessionId];
      
      if (DEBUG_SSE) {
        const remaining = Object.keys(transports.sse);
        logger.debug(`Remaining SSE transports after closing ${transport.sessionId}: ${remaining.length}`);
      }
    });
    
    // Log active transports for debugging
    const activeSessions = Object.keys(transports.sse);
    logger.debug(`Active SSE sessions after connection: ${activeSessions.length} (${activeSessions.join(', ')})`);
    
    // Connect the transport to the server - this is critical!
    logger.info(`Connecting SSE transport with sessionId ${transport.sessionId} to MCP server`);
    await server.connect(transport);
    logger.info(`SSE transport with sessionId ${transport.sessionId} connected successfully`);
    
    // Send a comment to keep the connection alive and confirm it's working
    res.write(':connected\n\n');
    
    if (DEBUG_SSE) {
      // Send a ping every 30 seconds to keep the connection alive
      const pingInterval = setInterval(() => {
        try {
          if (res.writableEnded) {
            clearInterval(pingInterval);
            return;
          }
          res.write(':ping\n\n');
          logger.debug(`Sent ping to SSE client for session ${transport.sessionId}`);
        } catch (err) {
          logger.warn(`Error sending SSE ping for session ${transport.sessionId}:`, err);
          clearInterval(pingInterval);
        }
      }, 30000);
      
      // Clean up interval on connection close
      res.on('close', () => {
        clearInterval(pingInterval);
        logger.debug(`Cleared ping interval for session ${transport.sessionId}`);
      });
    }
  } catch (error) {
    logger.error('Error establishing SSE connection:', error);
    if (!res.headersSent) {
      res.status(500).send('Error establishing SSE connection');
    }
  }
});

// Legacy message endpoint for older clients
app.post('/messages', async (req, res) => {
  try {
    const sessionId = req.query.sessionId as string;
    logger.info(`Received message for SSE sessionId ${sessionId}`);
    
    if (DEBUG_SSE) {
      logger.debug(`Message endpoint details:`, {
        sessionId,
        method: req.method,
        contentType: req.headers['content-type'],
        query: req.query,
      });
    }
    
    // Log the message body to help with debugging
    if (DEBUG_SSE) {
      const bodyContent = req.body ? JSON.stringify(req.body) : '<empty>';
      logger.debug(`Message body: ${bodyContent}`);
    }
    
    // Ensure the body is properly parsed as JSON
    if (!req.body || typeof req.body !== 'object') {
      logger.warn(`Invalid or missing message body for session ${sessionId}`);
      
      if (DEBUG_SSE) {
        // Check if we have the raw body from our middleware
        const rawReq = req as any;
        if (rawReq.rawBody) {
          logger.debug(`Raw message body from middleware: ${rawReq.rawBody}`);
          try {
            const parsedBody = JSON.parse(rawReq.rawBody);
            logger.debug(`Manually parsed body:`, parsedBody);
          } catch (e: any) {
            logger.debug(`Failed to manually parse body: ${e.message}`);
          }
        } else {
          // Try to parse the body manually if the middleware didn't parse it
          let rawBody = '';
          req.on('data', (chunk) => {
            rawBody += chunk.toString();
          });
          
          req.on('end', () => {
            logger.debug(`Raw message body from stream: ${rawBody}`);
            try {
              const parsedBody = JSON.parse(rawBody);
              logger.debug(`Manually parsed body:`, parsedBody);
            } catch (e: any) {
              logger.debug(`Failed to manually parse body: ${e.message}`);
            }
          });
        }
      }
      
      // Continue anyway as the transport might be able to handle it
    }
    
    // Find the corresponding transport
    const transport = transports.sse[sessionId];
    if (transport) {
      logger.debug(`Found transport for session ${sessionId}`);
      
      if (DEBUG_SSE) {
        logger.debug(`Transport details for session ${sessionId}:`, {
          hasSessionId: !!transport.sessionId,
          sessionId: transport.sessionId,
        });
      }
      
      try {
        // Use the transport to handle the post message
        logger.info(`Processing message for session ${sessionId}`);
        
        if (DEBUG_SSE) {
          logger.debug(`Calling handlePostMessage for session ${sessionId}`);
        }
        
        await transport.handlePostMessage(req, res);
        logger.info(`Successfully processed message for session ${sessionId}`);
      } catch (error: any) {
        logger.error(`Error in handlePostMessage for session ${sessionId}:`, error);
        
        if (DEBUG_SSE) {
          logger.debug(`Stack trace for handlePostMessage error:`, error.stack);
        }
        
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: '2.0',
            error: {
              code: -32603,
              message: 'Error processing message',
              data: error instanceof Error ? error.message : String(error)
            },
            id: req.body?.id || null
          });
        }
      }
    } else {
      logger.warn(`No SSE transport found for sessionId ${sessionId}`);
      
      if (DEBUG_SSE) {
        const availableSessions = Object.keys(transports.sse);
        logger.debug(`Available SSE sessions: ${availableSessions.length} (${availableSessions.join(', ')})`);
      }
      
      // Return a proper JSONRPC error response
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: `No transport found for sessionId ${sessionId}`
        },
        id: req.body?.id || null
      });
    }
  } catch (error) {
    logger.error('Error handling message request:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error',
          data: error instanceof Error ? error.message : String(error)
        },
        id: null
      });
    }
  }
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down server...');
  
  // Close all active transports
  for (const sessionId in transports.sse) {
    try {
      await transports.sse[sessionId].close();
      delete transports.sse[sessionId];
    } catch (error) {
      logger.error(`Error closing SSE transport for session ${sessionId}:`, error);
    }
  }
  
  for (const sessionId in transports.streamable) {
    try {
      await transports.streamable[sessionId].close();
      delete transports.streamable[sessionId];
    } catch (error) {
      logger.error(`Error closing streamable transport for session ${sessionId}:`, error);
    }
  }
  
  await midnightServer.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Shutting down server...');
  
  // Close all active transports (same as SIGINT handler)
  for (const sessionId in transports.sse) {
    try {
      await transports.sse[sessionId].close();
      delete transports.sse[sessionId];
    } catch (error) {
      logger.error(`Error closing SSE transport for session ${sessionId}:`, error);
    }
  }
  
  for (const sessionId in transports.streamable) {
    try {
      await transports.streamable[sessionId].close();
      delete transports.streamable[sessionId];
    } catch (error) {
      logger.error(`Error closing streamable transport for session ${sessionId}:`, error);
    }
  }
  
  await midnightServer.close();
  process.exit(0);
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Midnight MCP Server listening on port ${PORT}`);
  logger.info(`SSE endpoint available at http://localhost:${PORT}/sse`);
  logger.info(`Message endpoint available at http://localhost:${PORT}/messages`);
  logger.info(`StreamableHTTP endpoint available at http://localhost:${PORT}/mcp`);
});
