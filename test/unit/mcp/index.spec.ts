/**
 * MCP Module Exports Unit Tests
 *
 * Tests for the MCP module central export file.
 * Verifies all exports are available and properly structured.
 */

import { describe, it, expect, jest } from '@jest/globals';

// Mock dependencies that use Midnight SDK
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
      getPath: jest.fn(() => '/mock/path'),
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
    getAgentSeed: jest.fn(() => 'mock-seed'),
    hasAgentSeed: jest.fn(() => true),
  },
}));

jest.mock('@services/WalletOrchestrator.js', () => ({
  WalletOrchestrator: jest.fn().mockImplementation(() => ({
    start: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    stop: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    getWalletService: jest.fn(),
    getTransactionService: jest.fn(),
    getTokenService: jest.fn(),
    getDaoService: jest.fn(() => null),
    getMarketplaceService: jest.fn(() => null),
  })),
}));

jest.mock('@midnight-ntwrk/wallet', () => ({
  WalletBuilder: { build: jest.fn(), restore: jest.fn() },
}));

jest.mock('@midnight-ntwrk/midnight-js-network-id', () => ({
  getZswapNetworkId: jest.fn(() => 'testnet'),
}));

jest.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: jest.fn().mockImplementation(() => ({
    registerTool: jest.fn(),
    connect: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  })),
}));

jest.mock('@modelcontextprotocol/sdk/server/streamableHttp.js', () => ({
  StreamableHTTPServerTransport: jest.fn(),
}));

// Import all exports from the MCP module
import {
  // Servers
  MCPServer,
  startHttpServer,
  type HttpServerConfig,

  // Session Management
  SessionManager,
  type Session,
  type SessionManagerConfig,
  type CreateSessionOptions,
  type SessionStats,

  // Middleware
  corsMiddleware,
  requestLoggerMiddleware,
  requestTimeoutMiddleware,
  errorHandlerMiddleware,
  notFoundMiddleware,

  // Adapter
  createToolAdapter,
  type ToolAdapter,
  type ToolDefinition,

  // Tools
  ALL_TOOLS,
  getTool,
  hasTool,
  getAllToolNames,
  WALLET_TOOLS,
  TOKEN_TOOLS,
  DAO_TOOLS,
  MARKETPLACE_TOOLS,

  // Resources
  ALL_RESOURCES,
  getResource,

  // Prompts
  ALL_PROMPTS,
  getPrompt,

  // Types
  type ServiceDependencies,
  type ToolResponse,
} from '@mcp/index.js';

describe('MCP Module Exports', () => {
  describe('Server Exports', () => {
    it('should export MCPServer', () => {
      expect(MCPServer).toBeDefined();
      expect(typeof MCPServer).toBe('function');
    });

    it('should export startHttpServer', () => {
      expect(startHttpServer).toBeDefined();
      expect(typeof startHttpServer).toBe('function');
    });
  });

  describe('Session Management Exports', () => {
    it('should export SessionManager', () => {
      expect(SessionManager).toBeDefined();
      expect(typeof SessionManager).toBe('function');
    });

    it('should be able to instantiate SessionManager', () => {
      const config: SessionManagerConfig = {
        maxSessions: 10,
        sessionTimeout: 30000,
        evictionInterval: 5000,
        baseConfig: {
          indexer: 'https://test.com',
          indexerWS: 'wss://test.com/ws',
          proofServer: 'https://proof.test.com',
          node: 'https://node.test.com',
          walletFilename: 'wallet',
        },
      };

      const manager = new SessionManager(config);
      expect(manager).toBeDefined();
      expect(manager.getActiveSessionCount()).toBe(0);
    });
  });

  describe('Middleware Exports', () => {
    it('should export corsMiddleware', () => {
      expect(corsMiddleware).toBeDefined();
      expect(typeof corsMiddleware).toBe('function');
    });

    it('should export requestLoggerMiddleware', () => {
      expect(requestLoggerMiddleware).toBeDefined();
      expect(typeof requestLoggerMiddleware).toBe('function');
    });

    it('should export requestTimeoutMiddleware', () => {
      expect(requestTimeoutMiddleware).toBeDefined();
      expect(typeof requestTimeoutMiddleware).toBe('function');
    });

    it('should export errorHandlerMiddleware', () => {
      expect(errorHandlerMiddleware).toBeDefined();
      expect(typeof errorHandlerMiddleware).toBe('function');
    });

    it('should export notFoundMiddleware', () => {
      expect(notFoundMiddleware).toBeDefined();
      expect(typeof notFoundMiddleware).toBe('function');
    });
  });

  describe('Adapter Exports', () => {
    it('should export createToolAdapter', () => {
      expect(createToolAdapter).toBeDefined();
      expect(typeof createToolAdapter).toBe('function');
    });
  });

  describe('Tool Exports', () => {
    it('should export ALL_TOOLS array', () => {
      expect(ALL_TOOLS).toBeDefined();
      expect(Array.isArray(ALL_TOOLS)).toBe(true);
      expect(ALL_TOOLS.length).toBeGreaterThan(0);
    });

    it('should export getTool function', () => {
      expect(getTool).toBeDefined();
      expect(typeof getTool).toBe('function');
    });

    it('should export hasTool function', () => {
      expect(hasTool).toBeDefined();
      expect(typeof hasTool).toBe('function');
    });

    it('should export getAllToolNames function', () => {
      expect(getAllToolNames).toBeDefined();
      expect(typeof getAllToolNames).toBe('function');
    });

    it('should export WALLET_TOOLS array', () => {
      expect(WALLET_TOOLS).toBeDefined();
      expect(Array.isArray(WALLET_TOOLS)).toBe(true);
    });

    it('should export TOKEN_TOOLS array', () => {
      expect(TOKEN_TOOLS).toBeDefined();
      expect(Array.isArray(TOKEN_TOOLS)).toBe(true);
    });

    it('should export DAO_TOOLS array', () => {
      expect(DAO_TOOLS).toBeDefined();
      expect(Array.isArray(DAO_TOOLS)).toBe(true);
    });

    it('should export MARKETPLACE_TOOLS array', () => {
      expect(MARKETPLACE_TOOLS).toBeDefined();
      expect(Array.isArray(MARKETPLACE_TOOLS)).toBe(true);
    });

    it('ALL_TOOLS should contain tools from all domains', () => {
      const totalExpected =
        WALLET_TOOLS.length +
        TOKEN_TOOLS.length +
        DAO_TOOLS.length +
        MARKETPLACE_TOOLS.length;

      expect(ALL_TOOLS.length).toBe(totalExpected);
    });
  });

  describe('Resource Exports', () => {
    it('should export ALL_RESOURCES', () => {
      expect(ALL_RESOURCES).toBeDefined();
      expect(Array.isArray(ALL_RESOURCES)).toBe(true);
    });

    it('should export getResource function', () => {
      expect(getResource).toBeDefined();
      expect(typeof getResource).toBe('function');
    });
  });

  describe('Prompt Exports', () => {
    it('should export ALL_PROMPTS', () => {
      expect(ALL_PROMPTS).toBeDefined();
      expect(Array.isArray(ALL_PROMPTS)).toBe(true);
    });

    it('should export getPrompt function', () => {
      expect(getPrompt).toBeDefined();
      expect(typeof getPrompt).toBe('function');
    });
  });

  describe('Tool Functions', () => {
    it('getTool should return tool for valid name', () => {
      const tool = getTool('walletStatus');
      expect(tool).toBeDefined();
      expect(tool?.name).toBe('walletStatus');
    });

    it('getTool should return undefined for invalid name', () => {
      const tool = getTool('nonExistentTool');
      expect(tool).toBeUndefined();
    });

    it('hasTool should return true for existing tool', () => {
      expect(hasTool('walletStatus')).toBe(true);
      expect(hasTool('getTokenBalance')).toBe(true);
    });

    it('hasTool should return false for non-existent tool', () => {
      expect(hasTool('nonExistentTool')).toBe(false);
    });

    it('getAllToolNames should return array of strings', () => {
      const names = getAllToolNames();
      expect(Array.isArray(names)).toBe(true);
      expect(names.length).toBe(ALL_TOOLS.length);
      names.forEach((name) => {
        expect(typeof name).toBe('string');
      });
    });
  });

  describe('Tool Structure Validation', () => {
    it('all tools should have required properties', () => {
      ALL_TOOLS.forEach((tool) => {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('inputSchema');
        expect(tool).toHaveProperty('execute');
        expect(typeof tool.name).toBe('string');
        expect(typeof tool.description).toBe('string');
        expect(typeof tool.execute).toBe('function');
      });
    });

    it('all tool names should be unique', () => {
      const names = ALL_TOOLS.map((t) => t.name);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });
  });
});
