/**
 * MCP HTTP Server
 *
 * HTTP server implementation for Model Context Protocol using StreamableHTTP transport.
 * Supports 100+ concurrent agents with session-based isolation via SessionManager.
 *
 * Features:
 * - McpServer with StreamableHTTPServerTransport
 * - Session-based service isolation (per agent)
 * - Health checks and Prometheus metrics
 * - Graceful shutdown
 * - CORS, logging, timeout middleware
 *
 * Architecture:
 * HTTP Request → Extract agentId → SessionManager → Services → Tool Adapter → Response
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import { randomUUID } from 'crypto';
import { createLogger } from '../lib/logger/index.js';
import { SessionManager, type SessionManagerConfig } from './session/index.js';
import { createToolAdapter } from './adapter/tool-adapter.js';
import {
  corsMiddleware,
  requestLoggerMiddleware,
  requestTimeoutMiddleware,
  errorHandlerMiddleware,
  notFoundMiddleware
} from './middleware/index.js';

const logger = createLogger('mcp-http-server');

/**
 * HTTP status codes
 */
const HTTP_STATUS_OK = 200;
const HTTP_STATUS_BAD_REQUEST = 400;
const HTTP_STATUS_INTERNAL_ERROR = 500;

/**
 * Percentage multiplier for utilization calculation
 */
const PERCENTAGE_MULTIPLIER = 100;

/**
 * Decimal places for metrics
 */
const METRIC_DECIMAL_PLACES = 2;

/**
 * Generate unique session ID using crypto.randomUUID()
 * This is collision-resistant even under high concurrency
 */
function generateAgentId(): string {
  return `agent-${randomUUID()}`;
}

/**
 * HTTP Server configuration
 */
export interface HttpServerConfig {
  /** Port to listen on */
  port: number;

  /** SessionManager configuration */
  session: SessionManagerConfig;
}

/**
 * Start MCP HTTP server
 *
 * This is the main entry point for the HTTP-based multi-agent MCP server.
 * Creates an Express server with StreamableHTTP endpoint for MCP clients.
 *
 * @param config - HTTP server configuration
 */
export async function startHttpServer(config: HttpServerConfig): Promise<void> {
  logger.info('Starting MCP HTTP server...', {
    port: config.port,
    maxSessions: config.session.maxSessions
  });

  /**
   * Store for session-specific MCP servers
   * Map<agentId, McpServer>
   */
  const sessionServers = new Map<string, McpServer>();

  // Create session manager
  const sessionManager = new SessionManager(config.session);
  sessionManager.start();

  // Create Express app
  const app = express();

  // Apply middleware
  app.use(corsMiddleware);
  app.use(express.json());
  app.use(requestLoggerMiddleware);
  app.use(requestTimeoutMiddleware());

  /**
   * MCP endpoint for clients
   *
   * Handles JSON-RPC 2.0 requests via StreamableHTTP transport
   */
  app.post('/mcp', async (req, res) => {
    // Validate request body exists
    if (!req.body || typeof req.body !== 'object') {
      logger.warn({ ip: req.ip }, 'Invalid request: missing or invalid body');
      res.status(HTTP_STATUS_BAD_REQUEST).json({
        jsonrpc: '2.0',
        error: {
          code: -32600,
          message: 'Invalid Request: body must be an object'
        },
        id: null
      });
      return;
    }

    // Type-safe access to body
    const body = req.body as Record<string, unknown>;

    // Validate JSON-RPC version
    if (body['jsonrpc'] !== '2.0') {
      logger.warn({ ip: req.ip, jsonrpc: body['jsonrpc'] }, 'Invalid JSON-RPC version');
      res.status(HTTP_STATUS_BAD_REQUEST).json({
        jsonrpc: '2.0',
        error: {
          code: -32600,
          message: 'Invalid Request: jsonrpc must be "2.0"'
        },
        id: null
      });
      return;
    }

    // Extract or generate agent ID
    // - Existing clients send 'mcp-session-id' header (from previous initialization)
    // - New clients get a fresh agent ID generated
    // This allows us to create SessionManager services before handling the request
    const agentId =
      (req.headers['mcp-session-id'] as string) || generateAgentId();

    logger.info(
      { agentId, ip: req.ip, userAgent: req.headers['user-agent'] },
      'MCP request received'
    );

    try {
      // Get or create MCP server for this agent
      let mcpServer = sessionServers.get(agentId);

      if (!mcpServer) {
        logger.info({ agentId }, 'Creating new MCP server for agent');

        // Create MCP server instance for this agent
        mcpServer = new McpServer({
          name: 'midnight-wallet-mcp',
          version: '1.0.0'
        });

        // Get or create session services
        const services = await sessionManager.getOrCreateSession({ agentId });

        // Create tool adapter with session services
        const toolAdapter = await createToolAdapter(services);

        // Register tools with MCP server using the modern SDK API
        // Tools are registered via the adapter, which provides:
        // - Tool listing (listOfTools)
        // - Tool execution (toolHandler)
        for (const tool of toolAdapter.listOfTools()) {
          mcpServer.registerTool(
            tool.name,
            {
              description: tool.description
              // inputSchema is part of tool definition but not passed to registerTool
            },
            async (args: unknown) => {
              const result = await toolAdapter.toolHandler(tool.name, args);
              return {
                content: result.content
              };
            }
          );
        }

        sessionServers.set(agentId, mcpServer);

        logger.info(
          {
            agentId,
            activeSessions: sessionManager.getActiveSessionCount(),
            utilization: `${((sessionManager.getActiveSessionCount() / config.session.maxSessions) * PERCENTAGE_MULTIPLIER).toFixed(1)}%`
          },
          'Session created'
        );
      }

      // Create transport for this request
      //
      // Using STATELESS mode (sessionIdGenerator: undefined) because:
      // 1. We manage sessions at the application layer via SessionManager
      // 2. We need the agent ID upfront to create services (chicken-and-egg with stateful)
      // 3. SessionManager provides custom logic (LRU eviction, cleanup callbacks, metrics)
      // 4. Easier to scale horizontally (can move to Redis/database for sessions)
      //
      // In stateless mode:
      // - Transport doesn't generate or validate session IDs
      // - We handle session IDs via 'mcp-session-id' header
      // - SessionManager controls the entire session lifecycle
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // Stateless mode
        enableJsonResponse: true
      });

      res.on('close', () => {
        void transport.close();
      });

      // Connect and handle request
      await mcpServer.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          agentId
        },
        'Failed to handle MCP request'
      );
      if (!res.headersSent) {
        res.status(HTTP_STATUS_INTERNAL_ERROR).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal server error'
          },
          id: null
        });
      }
    }
  });

  /**
   * Health check endpoint
   *
   * Returns server health status and session metrics
   */
  app.get('/health', (_req, res) => {
    const stats = sessionManager.getStats();
    res.status(HTTP_STATUS_OK).json({
      status: 'healthy',
      ...stats,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  });

  /**
   * Session cleanup endpoint
   *
   * Manually close a specific session
   */
  app.post('/cleanup/:agentId', async (req, res) => {
    const { agentId } = req.params;
    try {
      await sessionManager.closeSession(agentId);
      sessionServers.delete(agentId);
      logger.info({ agentId }, 'Session cleaned up via API');
      res.status(HTTP_STATUS_OK).json({ success: true, agentId });
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          agentId
        },
        'Session cleanup failed'
      );
      res.status(HTTP_STATUS_INTERNAL_ERROR).json({
        error: 'Cleanup failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Metrics endpoint (Prometheus format)
   *
   * Returns Prometheus-compatible metrics for monitoring
   */
  app.get('/metrics', (_req, res) => {
    const stats = sessionManager.getStats();
    res.set('Content-Type', 'text/plain');
    res.send(
      `
# HELP mcp_sessions_active Current number of active sessions
# TYPE mcp_sessions_active gauge
mcp_sessions_active ${stats.activeSessions}

# HELP mcp_sessions_max Maximum allowed sessions
# TYPE mcp_sessions_max gauge
mcp_sessions_max ${stats.maxSessions}

# HELP mcp_sessions_utilization_percent Session utilization percentage
# TYPE mcp_sessions_utilization_percent gauge
mcp_sessions_utilization_percent ${stats.utilizationPercent.toFixed(METRIC_DECIMAL_PLACES)}

# HELP mcp_sessions_created_total Total sessions created
# TYPE mcp_sessions_created_total counter
mcp_sessions_created_total ${stats.totalCreated}

# HELP mcp_sessions_evicted_total Total sessions evicted
# TYPE mcp_sessions_evicted_total counter
mcp_sessions_evicted_total ${stats.totalEvicted}

# HELP mcp_sessions_closed_total Total sessions closed
# TYPE mcp_sessions_closed_total counter
mcp_sessions_closed_total ${stats.totalClosed}

# HELP mcp_uptime_seconds Server uptime in seconds
# TYPE mcp_uptime_seconds counter
mcp_uptime_seconds ${process.uptime().toFixed(METRIC_DECIMAL_PLACES)}
      `.trim()
    );
  });

  // Apply error handling middleware (must be last)
  app.use(notFoundMiddleware);
  app.use(errorHandlerMiddleware);

  /**
   * Graceful shutdown handlers
   */
  const shutdown = async (): Promise<void> => {
    logger.info('Shutting down gracefully...');
    await sessionManager.stop();
    sessionServers.clear();
    logger.info('Shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => {
    void shutdown();
  });

  process.on('SIGINT', () => {
    void shutdown();
  });

  // Start server
  app.listen(config.port, () => {
    logger.info(
      {
        port: config.port,
        transport: 'streamableHttp',
        maxSessions: config.session.maxSessions,
        endpoints: {
          mcp: `http://localhost:${config.port}/mcp`,
          health: `http://localhost:${config.port}/health`,
          metrics: `http://localhost:${config.port}/metrics`,
          cleanup: `http://localhost:${config.port}/cleanup/:agentId`
        }
      },
      'MCP HTTP Server listening'
    );
  });
}
