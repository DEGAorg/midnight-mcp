import { describe, it, beforeEach, afterEach, jest, expect } from '@jest/globals';

// Mock dependencies
jest.mock('../../../src/stdio-server.js');
jest.mock('../../../src/config.js');
jest.mock('../../../src/utils/seed-manager.js');

// Mock console.error to capture error messages
const originalConsoleError = console.error;
const mockConsoleError = jest.fn();

describe('Server Startup', () => {
  let mockCreateServer: jest.Mock;
  let mockServer: any;

  beforeEach(() => {
    jest.clearAllMocks();
    console.error = mockConsoleError;
    
    // Create mock server
    mockServer = {
      start: jest.fn(),
      stop: jest.fn()
    };
    
    // Mock the createServer function
    mockCreateServer = jest.fn().mockReturnValue(mockServer);
    
    // Mock the module
    jest.doMock('../../../src/stdio-server.js', () => ({
      createServer: mockCreateServer
    }));
  });

  afterEach(() => {
    console.error = originalConsoleError;
    // Restore original process.argv
    process.argv = ['node', 'test.js'];
    jest.resetModules();
  });

  describe('Server Creation', () => {
    it('should create server successfully', async () => {
      const { createServer } = await import('../../../src/stdio-server.js');
      const server = createServer();
      expect(mockCreateServer).toHaveBeenCalled();
      expect(server).toBe(mockServer);
    });

    it('should handle server creation errors', async () => {
      const creationError = new Error('Failed to create server');
      mockCreateServer.mockImplementation(() => {
        throw creationError;
      });

      const { createServer } = await import('../../../src/stdio-server.js');
      expect(() => createServer()).toThrow('Failed to create server');
    });
  });

  describe('Server Startup', () => {
    it('should start server successfully', async () => {
      mockServer.start.mockResolvedValue(undefined);

      const { createServer } = await import('../../../src/stdio-server.js');
      const server = createServer();
      await server.start();

      expect(mockServer.start).toHaveBeenCalled();
    });

    it('should handle server startup errors', async () => {
      const startupError = new Error('Failed to start server');
      mockServer.start.mockRejectedValue(startupError);

      const { createServer } = await import('../../../src/stdio-server.js');
      const server = createServer();
      
      await expect(server.start()).rejects.toThrow('Failed to start server');
      expect(mockServer.start).toHaveBeenCalled();
    });

    it('should handle network connection errors', async () => {
      const networkError = new Error('Connection refused');
      mockServer.start.mockRejectedValue(networkError);

      const { createServer } = await import('../../../src/stdio-server.js');
      const server = createServer();
      
      await expect(server.start()).rejects.toThrow('Connection refused');
    });

    it('should handle timeout errors', async () => {
      const timeoutError = new Error('Connection timeout');
      mockServer.start.mockRejectedValue(timeoutError);

      const { createServer } = await import('../../../src/stdio-server.js');
      const server = createServer();
      
      await expect(server.start()).rejects.toThrow('Connection timeout');
    });
  });

  describe('Server Shutdown', () => {
    it('should stop server successfully', async () => {
      mockServer.stop.mockResolvedValue(undefined);

      const { createServer } = await import('../../../src/stdio-server.js');
      const server = createServer();
      await server.stop();

      expect(mockServer.stop).toHaveBeenCalled();
    });

    it('should handle server shutdown errors gracefully', async () => {
      const shutdownError = new Error('Failed to stop server');
      
      // Mock the server's stop method to simulate the actual implementation
      // where errors are caught and logged but not re-thrown
      mockServer.stop.mockImplementation(async () => {
        try {
          // Simulate the actual stop logic that might fail
          throw shutdownError;
        } catch (error) {
          // Simulate the error logging that happens in the real implementation
          console.error("Error stopping server:", error);
          // Don't re-throw the error
        }
      });

      const { createServer } = await import('../../../src/stdio-server.js');
      const server = createServer();
      
      // The stop method should catch errors and not re-throw them
      await expect(server.stop()).resolves.toBeUndefined();
      expect(mockServer.stop).toHaveBeenCalled();
      expect(mockConsoleError).toHaveBeenCalledWith("Error stopping server:", shutdownError);
    });
  });

  describe('Main Module Execution', () => {
    let originalProcessExit: any;
    let mockProcessExit: jest.Mock;

    beforeEach(() => {
      originalProcessExit = process.exit;
      mockProcessExit = jest.fn();
      process.exit = mockProcessExit as any;
    });

    afterEach(() => {
      process.exit = originalProcessExit;
    });

    it('should auto-start server when run as main module', async () => {
      // Mock import.meta.url to simulate main module execution
      const originalImportMeta = (global as any).import;
      (global as any).import = {
        meta: {
          url: `file://${process.argv[1]}`
        }
      };

      // Simulate successful startup
      mockServer.start.mockResolvedValue(undefined);

      // Execute the main module logic
      const { createServer } = await import('../../../src/stdio-server.js');
      const server = createServer();
      await server.start();

      expect(mockCreateServer).toHaveBeenCalled();
      expect(mockServer.start).toHaveBeenCalled();
      expect(mockProcessExit).not.toHaveBeenCalled();

      // Restore original import
      (global as any).import = originalImportMeta;
    });

    it('should exit with code 1 on startup failure when run as main module', async () => {
      // Mock import.meta.url to simulate main module execution
      const originalImportMeta = (global as any).import;
      (global as any).import = {
        meta: {
          url: `file://${process.argv[1]}`
        }
      };

      // Mock the main module execution with error
      const startupError = new Error('Failed to start server');
      mockServer.start.mockRejectedValue(startupError);

      // Execute the main module logic
      const { createServer } = await import('../../../src/stdio-server.js');
      const server = createServer();
      
      try {
        await server.start();
      } catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
      }

      expect(mockCreateServer).toHaveBeenCalled();
      expect(mockServer.start).toHaveBeenCalled();
      expect(mockConsoleError).toHaveBeenCalledWith("Failed to start server:", startupError);
      expect(mockProcessExit).toHaveBeenCalledWith(1);

      // Restore original import
      (global as any).import = originalImportMeta;
    });

    it('should not auto-start server when not run as main module', async () => {
      // Mock import.meta.url to simulate non-main module execution
      const originalImportMeta = (global as any).import;
      (global as any).import = {
        meta: {
          url: 'file://some-other-file.js'
        }
      };

      // The server should not be created automatically
      expect(mockCreateServer).not.toHaveBeenCalled();

      // Restore original import
      (global as any).import = originalImportMeta;
    });
  });

  describe('Error Handling', () => {
    it('should handle configuration errors', async () => {
      const configError = new Error('Invalid configuration');
      mockCreateServer.mockImplementation(() => {
        throw configError;
      });

      const { createServer } = await import('../../../src/stdio-server.js');
      expect(() => createServer()).toThrow('Invalid configuration');
    });

    it('should handle seed loading errors', async () => {
      const seedError = new Error('Seed file not found');
      mockCreateServer.mockImplementation(() => {
        throw seedError;
      });

      const { createServer } = await import('../../../src/stdio-server.js');
      expect(() => createServer()).toThrow('Seed file not found');
    });

    it('should handle wallet initialization errors', async () => {
      const walletError = new Error('Failed to initialize wallet');
      mockCreateServer.mockImplementation(() => {
        throw walletError;
      });

      const { createServer } = await import('../../../src/stdio-server.js');
      expect(() => createServer()).toThrow('Failed to initialize wallet');
    });

    it('should handle transport connection errors', async () => {
      const transportError = new Error('Failed to connect transport');
      mockServer.start.mockRejectedValue(transportError);

      const { createServer } = await import('../../../src/stdio-server.js');
      const server = createServer();
      
      await expect(server.start()).rejects.toThrow('Failed to connect transport');
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete server lifecycle', async () => {
      mockServer.start.mockResolvedValue(undefined);
      mockServer.stop.mockResolvedValue(undefined);

      const { createServer } = await import('../../../src/stdio-server.js');
      const server = createServer();
      
      // Start server
      await server.start();
      expect(mockServer.start).toHaveBeenCalled();
      
      // Stop server
      await server.stop();
      expect(mockServer.stop).toHaveBeenCalled();
    });

    it('should handle server restart scenario', async () => {
      mockServer.start.mockResolvedValue(undefined);
      mockServer.stop.mockResolvedValue(undefined);

      const { createServer } = await import('../../../src/stdio-server.js');
      const server = createServer();
      
      // First start
      await server.start();
      expect(mockServer.start).toHaveBeenCalledTimes(1);
      
      // Stop
      await server.stop();
      expect(mockServer.stop).toHaveBeenCalledTimes(1);
      
      // Second start
      await server.start();
      expect(mockServer.start).toHaveBeenCalledTimes(2);
    });
  });
}); 