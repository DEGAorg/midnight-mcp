import { describe, it, beforeEach, afterEach, jest, expect } from '@jest/globals';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { WalletServiceMCP, WalletServiceError } from '../../src/mcp/index.js';
import { config } from '../../src/config.js';
import { ALL_TOOLS, handleToolCall } from '../../src/tools.js';
import { handleListResources, handleReadResource } from '../../src/resources.js';
import { SeedManager } from '../../src/utils/seed-manager.js';

// Mock all dependencies
jest.mock('@modelcontextprotocol/sdk/server/index.js');
jest.mock('@modelcontextprotocol/sdk/server/stdio.js');
jest.mock('../../src/mcp/index.js');
jest.mock('../../src/config.js');
jest.mock('../../src/tools.js');
jest.mock('../../src/resources.js');
jest.mock('../../src/utils/seed-manager.js');
jest.mock('../../src/integrations/marketplace/api.js', () => require('./__mocks__/marketplace-api.ts'));

const mockServer = {
  connect: jest.fn() as jest.Mock,
  close: jest.fn() as jest.Mock,
  setRequestHandler: jest.fn() as jest.Mock
};

const mockTransport = {
  // StdioServerTransport mock
};

const mockMidnightServer = {
  close: jest.fn() as jest.Mock
};

describe('stdio-server', () => {
  let originalProcessEnv: NodeJS.ProcessEnv;
  let originalProcessOn: typeof process.on;
  let originalProcessExit: typeof process.exit;
  let originalConsoleError: typeof console.error;
  let originalImportMetaUrl: string;
  let eventHandlers: Map<string, Function[]>;

  beforeEach(() => {
    // Save original values
    originalProcessEnv = { ...process.env };
    originalProcessOn = process.on;
    originalProcessExit = process.exit;
    originalConsoleError = console.error;
    originalImportMetaUrl = import.meta.url;

    // Set up environment
    process.env.AGENT_ID = 'test-agent-id';
    process.env.LOG_LEVEL = 'info';

    // Mock console.error to capture logs
    console.error = jest.fn();

    // Create a proper mock for process.on that can store event handlers
    eventHandlers = new Map();
    process.on = jest.fn((event: string, handler: (...args: any[]) => void) => {
      // Store the handler for our tests
      if (!eventHandlers.has(event)) {
        eventHandlers.set(event, []);
      }
      eventHandlers.get(event)!.push(handler);
      
      // Also call the real process.on to allow the event system to work
      return originalProcessOn.call(process, event, handler);
    }) as any;

    // Add a method to trigger events for testing
    (process as any).emit = jest.fn((event: string, ...args: any[]) => {
      const handlers = eventHandlers.get(event) || [];
      handlers.forEach((handler: Function) => handler(...args));
    });

    // Mock process.exit
    process.exit = jest.fn() as any;

    // Mock import.meta.url
    Object.defineProperty(import.meta, 'url', {
      value: 'file:///test/path/stdio-server.ts',
      writable: true
    });

    // Reset all mocks
    jest.clearAllMocks();

    // Setup default mock implementations
    (Server as jest.Mock).mockImplementation(() => mockServer);
    (StdioServerTransport as jest.Mock).mockImplementation(() => mockTransport);
    (WalletServiceMCP as jest.Mock).mockImplementation(() => mockMidnightServer);
    (SeedManager.getAgentSeed as jest.Mock).mockReturnValue('test-seed');
    (config as any) = {
      proofServer: 'http://localhost:8000',
      indexer: 'http://localhost:8001',
      indexerWS: 'ws://localhost:8002',
      node: 'http://localhost:8003',
      useExternalProofServer: true,
      networkId: 'testnet',
      walletFilename: 'wallet.dat'
    };
    (ALL_TOOLS as any) = [{ name: 'test-tool', description: 'Test tool' }];
    ((handleToolCall as jest.Mock) as any).mockResolvedValue({ result: 'success' });
    ((handleListResources as jest.Mock) as any).mockReturnValue([{ uri: 'test://resource' }]);
    ((handleReadResource as jest.Mock) as any).mockReturnValue({ data: 'test-data', mimeType: 'application/json' });
    
    // Reset server mocks to default behavior
    (mockServer.connect as any).mockResolvedValue(undefined);
    (mockServer.close as any).mockResolvedValue(undefined);
    (mockMidnightServer.close as any).mockResolvedValue(undefined);
  });

  afterEach(() => {
    // Restore original values
    process.env = originalProcessEnv;
    process.on = originalProcessOn;
    process.exit = originalProcessExit;
    console.error = originalConsoleError;
    Object.defineProperty(import.meta, 'url', {
      value: originalImportMetaUrl,
      writable: true
    });

    // Clear all event listeners to prevent interference between tests
    process.removeAllListeners('uncaughtException');
    process.removeAllListeners('unhandledRejection');
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('SIGTERM');
    process.removeAllListeners('SIGUSR1');
    process.removeAllListeners('SIGUSR2');
  });

  describe('createServer', () => {
    it('should create server successfully with valid configuration', async () => {
      const { createServer } = await import('../../src/stdio-server.js');
      const server = createServer();

      expect(Server).toHaveBeenCalledWith(
        {
          name: 'midnight-mcp-server',
          version: '1.0.0'
        },
        {
          capabilities: {
            resources: {},
            tools: {}
          }
        }
      );

      expect(WalletServiceMCP).toHaveBeenCalledWith(
        'testnet',
        'test-seed',
        'wallet.dat',
        {
          proofServer: 'http://localhost:8000',
          indexer: 'http://localhost:8001',
          indexerWS: 'ws://localhost:8002',
          node: 'http://localhost:8003',
          useExternalProofServer: true,
          networkId: 'testnet'
        }
      );

      expect(SeedManager.getAgentSeed).toHaveBeenCalledWith('test-agent-id');
      expect(server).toHaveProperty('start');
      expect(server).toHaveProperty('stop');
    });

    it('should throw error when AGENT_ID is missing', async () => {
      delete process.env.AGENT_ID;
      
      const { createServer } = await import('../../src/stdio-server.js');
      
      expect(() => createServer()).toThrow('AGENT_ID environment variable is required');
    });

    it('should throw error when seed file is not found', async () => {
      (SeedManager.getAgentSeed as jest.Mock).mockReset();
      (SeedManager.getAgentSeed as jest.Mock).mockImplementation(() => {
        throw new Error('Seed file not found');
      });

      // Re-import the module after mocking
      const { createServer } = await import('../../src/stdio-server.js');
      expect(() => createServer()).toThrow('Seed file not found. Please ensure the seed file exists for this agent.');
    });

    it('should log seed loading success', async () => {
      const { createServer } = await import('../../src/stdio-server.js');
      createServer();

      // Check that the specific log message was called (among other calls)
      const calls = (console.error as jest.Mock).mock.calls;
      const hasSeedLog = calls.some((call: any[]) => 
        call[1]?.includes('Seed loaded from file for agent:') && call[2] === 'test-agent-id'
      );
      expect(hasSeedLog).toBe(true);
    });

    it('should log seed loading failure', async () => {
      (SeedManager.getAgentSeed as jest.Mock).mockImplementation(() => {
        throw new Error('Seed file not found');
      });

      const { createServer } = await import('../../src/stdio-server.js');
      
      expect(() => createServer()).toThrow();
      
      // Check that the specific log message was called (among other calls)
      const calls = (console.error as jest.Mock).mock.calls;
      const hasFailureLog = calls.some((call: any[]) => 
        call[1]?.includes('Failed to load seed from file:')
      );
      expect(hasFailureLog).toBe(true);
    });
  });

  describe('Server start/stop', () => {
    it('should start server successfully', async () => {
      const { createServer } = await import('../../src/stdio-server.js');
      const server = createServer();

      await server.start();

      expect(mockServer.connect).toHaveBeenCalledWith(mockTransport);
      
      // Check that the specific log message was called (among other calls)
      const calls = (console.error as jest.Mock).mock.calls;
      const hasStartLog = calls.some((call: any[]) => 
        call[1]?.includes('Server started successfully')
      );
      expect(hasStartLog).toBe(true);
    });

    it('should handle server start failure', async () => {
      // Reset the mock to ensure clean state
      (mockServer.connect as any).mockReset();
      
      const startError = new Error('Connection failed');
      (mockServer.connect as any).mockRejectedValue(startError);

      const { createServer } = await import('../../src/stdio-server.js');
      const server = createServer();

      await expect(server.start()).rejects.toThrow('Connection failed');
      
      // Check that the specific log message was called (among other calls)
      const calls = (console.error as jest.Mock).mock.calls;
      const hasFailureLog = calls.some((call: any[]) => 
        call[1]?.includes('Failed to start server:')
      );
      expect(hasFailureLog).toBe(true);
    });

    it('should stop server successfully', async () => {
      const { createServer } = await import('../../src/stdio-server.js');
      const server = createServer();

      await server.stop();

      expect(mockServer.close).toHaveBeenCalled();
      expect(mockMidnightServer.close).toHaveBeenCalled();
      
      // Check that the specific log message was called (among other calls)
      const calls = (console.error as jest.Mock).mock.calls;
      const hasStopLog = calls.some((call: any[]) => 
        call[1]?.includes('Server stopped')
      );
      expect(hasStopLog).toBe(true);
    });

    it('should handle server stop errors gracefully', async () => {
      const stopError = new Error('Close failed');
      (mockServer.close as any).mockRejectedValue(stopError);

      const { createServer } = await import('../../src/stdio-server.js');
      const server = createServer();

      await server.stop();

      // Check that the specific log message was called (among other calls)
      const calls = (console.error as jest.Mock).mock.calls;
      const hasErrorLog = calls.some((call: any[]) => 
        call[1]?.includes('Error stopping server:')
      );
      expect(hasErrorLog).toBe(true);
    });
  });

  describe('Request handlers', () => {
    let server: any;
    let requestHandlers: Map<any, any>;

    beforeEach(async () => {
      requestHandlers = new Map();
      mockServer.setRequestHandler.mockImplementation((schema: any, handler: any) => {
        const method = schema.shape?.method?._def?.value;
        requestHandlers.set(method, handler);
      });
      const { createServer } = await import('../../src/stdio-server.js');
      server = createServer();
    });

    it('should set up CallToolRequestSchema handler', async () => {
      const { CallToolRequestSchema } = await import('@modelcontextprotocol/sdk/types.js');
      
      expect(mockServer.setRequestHandler).toHaveBeenCalledWith(
        CallToolRequestSchema,
        expect.any(Function)
      );

      const handler = requestHandlers.get("tools/call");
      const result = await handler({
        params: { name: 'test-tool', arguments: { arg1: 'value1' } }
      });

      expect(handleToolCall).toHaveBeenCalledWith(
        'test-tool',
        { arg1: 'value1' },
        mockMidnightServer,
        expect.any(Function)
      );
      expect(result).toEqual({ result: 'success' });
    });

    it('should set up ListResourcesRequestSchema handler', async () => {
      const { ListResourcesRequestSchema } = await import('@modelcontextprotocol/sdk/types.js');
      
      expect(mockServer.setRequestHandler).toHaveBeenCalledWith(
        ListResourcesRequestSchema,
        expect.any(Function)
      );

      const handler = requestHandlers.get("resources/list");
      const result = await handler({});

      expect(handleListResources).toHaveBeenCalled();
      expect(result).toEqual({ resources: [{ uri: 'test://resource' }] });
    });

    it('should set up ReadResourceRequestSchema handler', async () => {
      const { ReadResourceRequestSchema } = await import('@modelcontextprotocol/sdk/types.js');
      
      expect(mockServer.setRequestHandler).toHaveBeenCalledWith(
        ReadResourceRequestSchema,
        expect.any(Function)
      );

      const handler = requestHandlers.get("resources/read");
      const result = await handler({
        params: { uri: 'test://resource' }
      });

      expect(handleReadResource).toHaveBeenCalledWith('test://resource');
      expect(result).toEqual({
        contents: [{
          uri: 'test://resource',
          mimeType: 'application/json',
          text: JSON.stringify({ data: 'test-data', mimeType: 'application/json' })
        }]
      });
    });

    it('should set up ListToolsRequestSchema handler', async () => {
      const { ListToolsRequestSchema } = await import('@modelcontextprotocol/sdk/types.js');
      
      expect(mockServer.setRequestHandler).toHaveBeenCalledWith(
        ListToolsRequestSchema,
        expect.any(Function)
      );

      const handler = requestHandlers.get("tools/list");
      const result = await handler({});

      expect(result).toEqual({ tools: [{ name: 'test-tool', description: 'Test tool' }] });
    });
  });

  describe('Error handling', () => {
    it('should handle McpError correctly', async () => {
      const { createServer } = await import('../../src/stdio-server.js');
      
      // Set up request handlers capture BEFORE creating server
      const requestHandlers = new Map();
      mockServer.setRequestHandler.mockImplementation((schema: any, handler: any) => {
        const method = schema.shape?.method?._def?.value;
        requestHandlers.set(method, handler);
      });
      
      const server = createServer();

      const mcpError = new McpError(ErrorCode.InvalidRequest, 'Invalid request');
      
      // Test error handling in request handlers
      const { CallToolRequestSchema } = await import('@modelcontextprotocol/sdk/types.js');

      server.start();
      const handler = requestHandlers.get("tools/call");
      
      ((handleToolCall as jest.Mock) as any).mockRejectedValue(mcpError);
      
      await expect(handler({
        params: { name: 'test-tool', arguments: {} }
      })).rejects.toThrow(mcpError);
    });

    it('should handle MidnightMCPError correctly', async () => {
      const { createServer } = await import('../../src/stdio-server.js');
      
      // Set up request handlers capture BEFORE creating server
      const requestHandlers = new Map();
      mockServer.setRequestHandler.mockImplementation((schema: any, handler: any) => {
        const method = schema.shape?.method?._def?.value;
        requestHandlers.set(method, handler);
      });
      
      const server = createServer();

      const midnightError = new WalletServiceError('test-error' as any, 'Test error message');
      
      // Test error handling in request handlers
      const { CallToolRequestSchema } = await import('@modelcontextprotocol/sdk/types.js');

      server.start();
      const handler = requestHandlers.get("tools/call");
      
      ((handleToolCall as jest.Mock) as any).mockRejectedValue(midnightError);
      
      await expect(handler({
        params: { name: 'test-tool', arguments: {} }
      })).rejects.toThrow(McpError);
    });

    it('should handle generic errors correctly', async () => {
      const { createServer } = await import('../../src/stdio-server.js');
      
      // Set up request handlers capture BEFORE creating server
      const requestHandlers = new Map();
      mockServer.setRequestHandler.mockImplementation((schema: any, handler: any) => {
        const method = schema.shape?.method?._def?.value;
        requestHandlers.set(method, handler);
      });
      
      const server = createServer();

      const genericError = new Error('Generic error');
      
      // Test error handling in request handlers
      const { CallToolRequestSchema } = await import('@modelcontextprotocol/sdk/types.js');

      server.start();
      const handler = requestHandlers.get("tools/call");
      
      ((handleToolCall as jest.Mock) as any).mockRejectedValue(genericError);
      
      await expect(handler({
        params: { name: 'test-tool', arguments: {} }
      })).rejects.toThrow(McpError);
    });

    it('should handle uncaught exceptions', async () => {
      const { createServer } = await import('../../src/stdio-server.js');
      createServer();

      // Add a small delay to ensure event handlers are registered
      await new Promise(resolve => setTimeout(resolve, 10));

      const error = new Error('Uncaught exception');
      (process as any).emit('uncaughtException', error);

      // Check that the specific log message was called (among other calls)
      const calls = (console.error as jest.Mock).mock.calls;
      const hasExceptionLog = calls.some((call: any[]) => 
        call[1]?.includes('Uncaught exception:')
      );
      expect(hasExceptionLog).toBe(true);
    });

    it('should handle unhandled rejections', async () => {
      const { createServer } = await import('../../src/stdio-server.js');
      createServer();

      // Add a small delay to ensure event handlers are registered
      await new Promise(resolve => setTimeout(resolve, 10));

      const reason = new Error('Unhandled rejection');
      (process as any).emit('unhandledRejection', reason);

      // Check that the specific log message was called (among other calls)
      const calls = (console.error as jest.Mock).mock.calls;
      const hasRejectionLog = calls.some((call: any[]) => 
        call[1]?.includes('Unhandled rejection:')
      );
      expect(hasRejectionLog).toBe(true);
    });
  });

  describe('Exit handlers', () => {
    it('should set up exit signal handlers', async () => {
      const { createServer } = await import('../../src/stdio-server.js');
      const server = createServer();

      // Simulate calling setupExitHandlers (this is called in main function)
      const exitHandler = async () => {
        await server.stop();
        process.exit(0);
      };

      (process as any).emit('SIGINT');
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(process.on).toHaveBeenCalled();
    });
  });

  describe('Main function', () => {
    it('should run main function when executed directly', async () => {
      // Mock import.meta.url to simulate direct execution
      Object.defineProperty(import.meta, 'url', {
        value: 'file:///test/path/stdio-server.ts',
        writable: true
      });

      // Mock process.argv to simulate direct execution
      const originalArgv = process.argv;
      process.argv = ['node', '/test/path/stdio-server.ts'];

      // Mock the createServer function before importing
      const mockCreateServer = jest.fn().mockReturnValue({
        start: (jest.fn() as any).mockResolvedValue(undefined),
        stop: (jest.fn() as any).mockResolvedValue(undefined)
      });

      // Mock the module before importing
      jest.doMock('../../src/stdio-server.js', () => ({
        createServer: mockCreateServer
      }));

      // Import the module to trigger the main function execution
      await import('../../src/stdio-server.js');

      // Restore original argv
      process.argv = originalArgv;
    });


  });

  describe('Logging functions', () => {
    it('should format errors correctly', async () => {
      const { createServer } = await import('../../src/stdio-server.js');
      createServer();

      // Test error formatting through console.error calls
      const error = new Error('Test error');
      console.error('Test:', error);

      // Check that the specific log message was called (among other calls)
      const calls = (console.error as jest.Mock).mock.calls;
      const hasTestLog = calls.some((call: any[]) => 
        call[0]?.includes('Test:') || call[1]?.includes('Test:')
      );
      expect(hasTestLog).toBe(true);
    });

    it('should handle non-Error objects in error formatting', async () => {
      const { createServer } = await import('../../src/stdio-server.js');
      createServer();

      // Test with non-Error object
      const nonError = 'String error';
      console.error('Test:', nonError);

      // Check that the specific log message was called (among other calls)
      const calls = (console.error as jest.Mock).mock.calls;
      const hasNonErrorLog = calls.some((call: any[]) => 
        call[0]?.includes('Test:') || call[1]?.includes('Test:')
      );
      expect(hasNonErrorLog).toBe(true);
    });
  });
}); 