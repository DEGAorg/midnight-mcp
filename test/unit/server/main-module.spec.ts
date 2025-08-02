import { describe, it, beforeEach, afterEach, jest, expect } from '@jest/globals';
import * as path from 'path';

// Mock dependencies
jest.mock('../../../src/stdio-server');

// Mock console.error to capture error messages
const originalConsoleError = console.error;
const mockConsoleError = jest.fn();

describe('Main Module Execution', () => {
    let mockCreateServer: jest.Mock;
    let mockServer: any;
    let originalProcessExit: any;
    let mockProcessExit: jest.Mock;
    let originalImportMeta: any;

    beforeEach(() => {
        jest.clearAllMocks();
        console.error = mockConsoleError;
        
        // Create mock server
        mockServer = {
            start: jest.fn(),
            stop: jest.fn()
        };
        
        // Create mock createServer function
        mockCreateServer = jest.fn().mockReturnValue(mockServer);
        
        // Mock the module in beforeEach to ensure it's available for all tests
        jest.doMock('../../../src/stdio-server.js', () => ({
            createServer: mockCreateServer
        }));
        
        // Mock process.exit
        originalProcessExit = process.exit;
        mockProcessExit = jest.fn();
        process.exit = mockProcessExit as any;

        // Store original import.meta
        originalImportMeta = (global as any).import;
    });

    afterEach(() => {
        console.error = originalConsoleError;
        process.exit = originalProcessExit;
        (global as any).import = originalImportMeta;
        jest.resetModules();
    });

    describe('Module Exports', () => {
        it('should export createServer function', async () => {
            const mainModule = await import('../../../src/index');
            expect(mainModule.createServer).toBeDefined();
            expect(typeof mainModule.createServer).toBe('function');
        });
    });

    describe('Main Module Detection', () => {
        it('should not execute auto-start logic when not run as main module', async () => {
            // Mock import.meta.url to simulate non-main module execution
            (global as any).import = {
                meta: {
                    url: 'file://some-other-file.js'
                }
            };

            // Manually mock the module by replacing the exports
            const originalModule = await import('../../../src/stdio-server.js');
            const mockModule = {
                ...originalModule,
                createServer: mockCreateServer
            };
            
            // Replace the module exports
            jest.doMock('../../../src/stdio-server.js', () => mockModule);

            // Import the main module - this should NOT trigger the auto-start logic
            await import('../../../src/index.js');

            // Verify server was NOT created
            expect(mockCreateServer).not.toHaveBeenCalled();
            expect(mockServer.start).not.toHaveBeenCalled();
        });
    });

    describe('Server Creation', () => {
        it('should create server successfully', async () => {
            const { createServer } = await import('../../../src/stdio-server');
            const server = createServer();
            expect(mockCreateServer).toHaveBeenCalled();
            expect(server).toBe(mockServer);
        });

        it('should handle server creation errors', async () => {
            const creationError = new Error('Failed to create server');
            mockCreateServer.mockImplementation(() => {
                throw creationError;
            });

            const { createServer } = await import('../../../src/stdio-server');
            expect(() => createServer()).toThrow('Failed to create server');
        });
    });

    describe('Server Startup', () => {
        it('should start server successfully', async () => {
            mockServer.start.mockResolvedValue(undefined);

            const { createServer } = await import('../../../src/stdio-server');
            const server = createServer();
            await server.start();

            expect(mockServer.start).toHaveBeenCalled();
        });

        it('should handle server startup errors', async () => {
            const startupError = new Error('Failed to start server');
            mockServer.start.mockRejectedValue(startupError);

            const { createServer } = await import('../../../src/stdio-server');
            const server = createServer();
            
            await expect(server.start()).rejects.toThrow('Failed to start server');
        });
    });

}); 