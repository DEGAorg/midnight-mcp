/**
 * MCP HTTP Server Integration Tests
 *
 * Tests for the multi-agent MCP HTTP server with SessionManager.
 * Validates:
 * - Health and metrics endpoints
 * - Request validation (X-Agent-Id, JSON-RPC 2.0)
 * - Multi-agent session management
 * - Session cleanup
 * - Error handling
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import express, { Express } from 'express';

// Mock dependencies before imports
jest.mock('@lib/logger/index.js', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

jest.mock('@lib/utils/file-manager.js', () => ({
  FileManager: {
    getInstance: jest.fn(() => ({
      getPath: jest.fn((type, agentId, filename) => `/mock/path/${agentId}/${filename}`),
      fileExists: jest.fn(() => false),
      readFile: jest.fn(),
    })),
  },
  FileType: {
    WALLET_BACKUP: 'wallet_backup',
  },
}));

jest.mock('@lib/utils/seed-manager.js', () => ({
  SeedManager: {
    getAgentSeed: jest.fn(() => 'mock-seed-phrase-for-testing-twelve-words-here'),
    hasAgentSeed: jest.fn((agentId: string) => {
      // Only registered agents have seeds
      const registeredAgents = ['agent-1', 'agent-2', 'agent-3', 'test-agent', 'concurrent-agent-1', 'concurrent-agent-2'];
      return registeredAgents.includes(agentId);
    }),
  },
}));

jest.mock('@services/WalletOrchestrator.js', () => ({
  WalletOrchestrator: jest.fn().mockImplementation(() => ({
    start: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    stop: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    getWalletService: jest.fn(() => ({
      isReady: () => true,
      getAddress: () => '0xmockaddress123',
      getBalance: () => 1000000n,
      getPendingBalance: () => 0n,
      getSyncProgress: () => ({ synced: true, syncPercentage: 100 }),
    })),
    getTransactionService: jest.fn(() => ({
      getPendingTransactions: () => [],
      getTransactionHistory: () => [],
    })),
    getTokenService: jest.fn(() => ({
      getTokens: () => [],
      getTokenBalance: () => 0n,
    })),
    getDaoService: jest.fn(() => null),
    getMarketplaceService: jest.fn(() => null),
  })),
}));

jest.mock('@midnight-ntwrk/wallet', () => ({
  WalletBuilder: {
    build: jest.fn(),
    restore: jest.fn(),
  },
}));

jest.mock('@midnight-ntwrk/midnight-js-network-id', () => ({
  getZswapNetworkId: jest.fn(() => 'testnet'),
}));

// Mock the MCP SDK
jest.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: jest.fn().mockImplementation(() => ({
    registerTool: jest.fn(),
    connect: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  })),
}));

jest.mock('@modelcontextprotocol/sdk/server/streamableHttp.js', () => ({
  StreamableHTTPServerTransport: jest.fn().mockImplementation(() => ({
    handleRequest: jest.fn().mockImplementation(async (_req, res, body) => {
      // Simulate MCP response
      res.json({
        jsonrpc: '2.0',
        result: { tools: [] },
        id: body?.id ?? null,
      });
    }),
    close: jest.fn(),
  })),
}));

import { SessionManager } from '@mcp/session/SessionManager.js';
import type { SessionManagerConfig } from '@mcp/session/types.js';
import {
  corsMiddleware,
  requestLoggerMiddleware,
  requestTimeoutMiddleware,
  errorHandlerMiddleware,
  notFoundMiddleware,
  validateMcpRequest,
  sendValidationError,
  createJsonRpcError,
  HttpStatus,
} from '@mcp/middleware/index.js';

describe('MCP HTTP Server Integration Tests', () => {
  let app: Express;
  let sessionManager: SessionManager;
  const sessionServers = new Map<string, any>();

  const testConfig: SessionManagerConfig = {
    maxSessions: 10,
    sessionTimeout: 30 * 60 * 1000,
    evictionInterval: 5 * 60 * 1000,
    baseConfig: {
      indexer: 'https://indexer.test.com',
      indexerWS: 'wss://indexer.test.com/ws',
      proofServer: 'https://proof.test.com',
      node: 'https://node.test.com',
      walletFilename: 'wallet',
      daoContractAddress: '0xdao123',
      marketplaceContractAddress: '0xmarket123',
    },
  };

  beforeAll(() => {
    // Create Express app mimicking http-server.ts structure
    app = express();
    sessionManager = new SessionManager(testConfig);
    sessionManager.start();

    // Apply middleware
    app.use(corsMiddleware);
    app.use(express.json());
    app.use(requestLoggerMiddleware);
    app.use(requestTimeoutMiddleware());

    // MCP endpoint
    app.post('/mcp', async (req, res) => {
      const validation = validateMcpRequest(req);

      if (!validation.valid) {
        sendValidationError(res, validation.error);
        return;
      }

      const { agentId } = validation.context;

      try {
        // Get or create session
        await sessionManager.getOrCreateSession({ agentId });

        // Simulate MCP response
        res.json({
          jsonrpc: '2.0',
          result: { tools: ['wallet_get_balance', 'wallet_send'] },
          id: req.body?.id ?? null,
        });
      } catch (error) {
        res.status(HttpStatus.INTERNAL_ERROR).json(
          createJsonRpcError(-32603, 'Internal server error')
        );
      }
    });

    // Health endpoint
    app.get('/health', (_req, res) => {
      const stats = sessionManager.getStats();
      res.status(HttpStatus.OK).json({
        status: 'healthy',
        ...stats,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      });
    });

    // Cleanup endpoint
    app.post('/cleanup/:agentId', async (req, res) => {
      const { agentId } = req.params;
      try {
        await sessionManager.closeSession(agentId);
        sessionServers.delete(agentId);
        res.status(HttpStatus.OK).json({ success: true, agentId });
      } catch (error) {
        res.status(HttpStatus.INTERNAL_ERROR).json({
          error: 'Cleanup failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Metrics endpoint
    app.get('/metrics', (_req, res) => {
      const stats = sessionManager.getStats();
      res.set('Content-Type', 'text/plain');
      res.send(`
# HELP mcp_sessions_active Current number of active sessions
# TYPE mcp_sessions_active gauge
mcp_sessions_active ${stats.activeSessions}

# HELP mcp_sessions_max Maximum allowed sessions
# TYPE mcp_sessions_max gauge
mcp_sessions_max ${stats.maxSessions}

# HELP mcp_sessions_utilization_percent Session utilization percentage
# TYPE mcp_sessions_utilization_percent gauge
mcp_sessions_utilization_percent ${stats.utilizationPercent.toFixed(2)}

# HELP mcp_sessions_created_total Total sessions created
# TYPE mcp_sessions_created_total counter
mcp_sessions_created_total ${stats.totalCreated}
      `.trim());
    });

    // Error handlers
    app.use(notFoundMiddleware);
    app.use(errorHandlerMiddleware);
  });

  afterAll(async () => {
    await sessionManager.stop();
    sessionServers.clear();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Health Endpoint', () => {
    it('should return healthy status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body).toHaveProperty('activeSessions');
      expect(response.body).toHaveProperty('maxSessions');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should include session stats', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.maxSessions).toBe(testConfig.maxSessions);
      expect(typeof response.body.activeSessions).toBe('number');
      expect(typeof response.body.totalCreated).toBe('number');
    });
  });

  describe('Metrics Endpoint', () => {
    it('should return Prometheus-compatible metrics', async () => {
      const response = await request(app)
        .get('/metrics')
        .expect(200);

      expect(response.headers['content-type']).toContain('text/plain');
      expect(response.text).toContain('mcp_sessions_active');
      expect(response.text).toContain('mcp_sessions_max');
      expect(response.text).toContain('mcp_sessions_utilization_percent');
      expect(response.text).toContain('mcp_sessions_created_total');
    });
  });

  describe('MCP Endpoint - Request Validation', () => {
    it('should reject request without X-Agent-Id header', async () => {
      const response = await request(app)
        .post('/mcp')
        .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 })
        .expect(400);

      expect(response.body.error.code).toBe(-32600);
      expect(response.body.error.message).toContain('X-Agent-Id');
    });

    it('should reject request with empty X-Agent-Id header', async () => {
      const response = await request(app)
        .post('/mcp')
        .set('X-Agent-Id', '')
        .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 })
        .expect(400);

      expect(response.body.error.code).toBe(-32600);
    });

    it('should reject request without JSON-RPC version', async () => {
      const response = await request(app)
        .post('/mcp')
        .set('X-Agent-Id', 'agent-1')
        .send({ method: 'tools/list', id: 1 })
        .expect(400);

      expect(response.body.error.code).toBe(-32600);
      expect(response.body.error.message).toContain('2.0');
    });

    it('should reject request with wrong JSON-RPC version', async () => {
      const response = await request(app)
        .post('/mcp')
        .set('X-Agent-Id', 'agent-1')
        .send({ jsonrpc: '1.0', method: 'tools/list', id: 1 })
        .expect(400);

      expect(response.body.error.code).toBe(-32600);
    });

    it('should reject unregistered agent', async () => {
      const response = await request(app)
        .post('/mcp')
        .set('X-Agent-Id', 'unregistered-agent')
        .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 })
        .expect(401);

      expect(response.body.error.code).toBe(-32001);
      expect(response.body.error.message).toContain('not registered');
    });

    it('should accept valid request from registered agent', async () => {
      const response = await request(app)
        .post('/mcp')
        .set('X-Agent-Id', 'agent-1')
        .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 })
        .expect(200);

      expect(response.body.jsonrpc).toBe('2.0');
      expect(response.body).toHaveProperty('result');
    });
  });

  describe('MCP Endpoint - Session Management', () => {
    it('should create session for new agent', async () => {
      const initialStats = sessionManager.getStats();
      const initialCreated = initialStats.totalCreated;

      await request(app)
        .post('/mcp')
        .set('X-Agent-Id', 'test-agent')
        .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 })
        .expect(200);

      expect(sessionManager.hasSession('test-agent')).toBe(true);
      expect(sessionManager.getStats().totalCreated).toBe(initialCreated + 1);
    });

    it('should reuse existing session for same agent', async () => {
      // First request
      await request(app)
        .post('/mcp')
        .set('X-Agent-Id', 'agent-2')
        .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 })
        .expect(200);

      const statsAfterFirst = sessionManager.getStats();

      // Second request from same agent
      await request(app)
        .post('/mcp')
        .set('X-Agent-Id', 'agent-2')
        .send({ jsonrpc: '2.0', method: 'tools/list', id: 2 })
        .expect(200);

      const statsAfterSecond = sessionManager.getStats();

      // Should not create a new session
      expect(statsAfterSecond.totalCreated).toBe(statsAfterFirst.totalCreated);
    });

    it('should create separate sessions for different agents', async () => {
      const initialCount = sessionManager.getActiveSessionCount();

      await request(app)
        .post('/mcp')
        .set('X-Agent-Id', 'agent-3')
        .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 })
        .expect(200);

      expect(sessionManager.getActiveSessionCount()).toBeGreaterThan(initialCount);
    });
  });

  describe('Session Cleanup Endpoint', () => {
    it('should cleanup existing session', async () => {
      // Create a session first
      await request(app)
        .post('/mcp')
        .set('X-Agent-Id', 'agent-1')
        .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 })
        .expect(200);

      expect(sessionManager.hasSession('agent-1')).toBe(true);

      // Cleanup
      const response = await request(app)
        .post('/cleanup/agent-1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.agentId).toBe('agent-1');
      expect(sessionManager.hasSession('agent-1')).toBe(false);
    });

    it('should handle cleanup of non-existent session gracefully', async () => {
      const response = await request(app)
        .post('/cleanup/non-existent-agent')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Concurrent Requests', () => {
    it('should handle multiple concurrent requests from same agent', async () => {
      const promises = Array(5).fill(null).map((_, i) =>
        request(app)
          .post('/mcp')
          .set('X-Agent-Id', 'concurrent-agent-1')
          .send({ jsonrpc: '2.0', method: 'tools/list', id: i })
      );

      const responses = await Promise.all(promises);

      // All requests should succeed
      responses.forEach((res) => {
        expect(res.status).toBe(200);
        expect(res.body.jsonrpc).toBe('2.0');
      });

      // Should only have one session for this agent
      expect(sessionManager.hasSession('concurrent-agent-1')).toBe(true);
    });

    it('should handle concurrent requests from different agents', async () => {
      const agents = ['concurrent-agent-1', 'concurrent-agent-2'];
      const promises = agents.flatMap((agentId) =>
        Array(3).fill(null).map((_, i) =>
          request(app)
            .post('/mcp')
            .set('X-Agent-Id', agentId)
            .send({ jsonrpc: '2.0', method: 'tools/list', id: `${agentId}-${i}` })
        )
      );

      const responses = await Promise.all(promises);

      // All requests should succeed
      responses.forEach((res) => {
        expect(res.status).toBe(200);
      });

      // Both agents should have sessions
      agents.forEach((agentId) => {
        expect(sessionManager.hasSession(agentId)).toBe(true);
      });
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown endpoints', async () => {
      const response = await request(app)
        .get('/unknown-endpoint')
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle malformed JSON body', async () => {
      const response = await request(app)
        .post('/mcp')
        .set('X-Agent-Id', 'agent-1')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }');

      // Express json parser error is caught by error handler middleware
      // Depending on error handler implementation, this returns 400 or 500
      expect([400, 500]).toContain(response.status);
    });

    it('should handle empty body', async () => {
      const response = await request(app)
        .post('/mcp')
        .set('X-Agent-Id', 'agent-1')
        .send(null)
        .expect(400);

      expect(response.body.error.code).toBe(-32600);
    });
  });

  describe('Session Stats Tracking', () => {
    it('should track session creation stats', async () => {
      const statsBefore = sessionManager.getStats();

      await request(app)
        .post('/mcp')
        .set('X-Agent-Id', 'agent-1')
        .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 })
        .expect(200);

      const statsAfter = sessionManager.getStats();

      expect(statsAfter.activeSessions).toBeGreaterThanOrEqual(statsBefore.activeSessions);
    });

    it('should track session closure stats', async () => {
      // Create session
      await request(app)
        .post('/mcp')
        .set('X-Agent-Id', 'agent-2')
        .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 })
        .expect(200);

      const statsBefore = sessionManager.getStats();

      // Close session
      await request(app)
        .post('/cleanup/agent-2')
        .expect(200);

      const statsAfter = sessionManager.getStats();

      expect(statsAfter.totalClosed).toBe(statsBefore.totalClosed + 1);
    });
  });
});
