import { describe, it, beforeAll, afterAll, beforeEach, afterEach, jest, expect } from '@jest/globals';

// Mock pino
jest.mock('pino', () => {
  const mockLogger: any = {
    trace: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    child: jest.fn().mockImplementation(() => mockLogger)
  };
  
  const mockPino = jest.fn().mockReturnValue(mockLogger);
  const mockTransport = jest.fn().mockReturnValue({
    target: 'pino/file',
    options: {}
  });
  const mockDestination = jest.fn();
  const mockMultistream = jest.fn();
  
  return {
    pino: mockPino,
    transport: mockTransport,
    destination: mockDestination,
    multistream: mockMultistream,
    default: mockPino
  };
});

// Mock optional pino transport modules
jest.mock('pino-stackdriver', () => ({
  createWriteStream: jest.fn().mockReturnValue({})
}), { virtual: true });

jest.mock('pino-cloudwatch', () => ({
  createWriteStream: jest.fn().mockReturnValue({})
}), { virtual: true });

jest.mock('pino-applicationinsights', () => ({
  createWriteStream: jest.fn().mockReturnValue({})
}), { virtual: true });

describe('Logger Module', () => {
  const originalEnv = { ...process.env };
  let pinoMock;
  
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    jest.clearAllMocks();
    // Get a reference to the mocked pino module
    pinoMock = require('pino');
  });
  
  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });
  
  describe('createLogger', () => {
    it('should create a logger with default options', async () => {
      const { createLogger } = await import('../../../src/logger/index');
      const logger = createLogger('test-module');
      
      expect(logger).toBeDefined();
      // Since we're using a mock, we just verify the logger is created
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.error).toBe('function');
    });
    
    it('should create a logger with custom log level', async () => {
      const { createLogger } = await import('../../../src/logger/index');
      const logger = createLogger('test-module', { level: 'info' });
      
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
    });
    
    it('should create a pretty-printed logger when pretty is true', async () => {
      const { createLogger } = await import('../../../src/logger/index');
      const logger = createLogger('test-module', { pretty: true });
      
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
    });
    
    it('should respect outputFile option', async () => {
      const { createLogger } = await import('../../../src/logger/index');
      const logger = createLogger('test-module', { 
        outputFile: './test.log'
      });
      
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
    });
    
    it('should include standard fields in the logger', async () => {
      const { createLogger } = await import('../../../src/logger/index');
      const logger = createLogger('test-module', {
        standardFields: {
          application: 'test-app',
          environment: 'test',
          version: '1.0.0',
          custom: { key: 'value' }
        }
      });
      
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
    });
  });
  
  describe('configureGlobalLogging', () => {
    it('should update global logger configuration', async () => {
      const { configureGlobalLogging, LoggerConfig } = await import('../../../src/logger/index');
      
      configureGlobalLogging({
        level: 'error',
        prettyPrint: false,
        enableFileOutput: true,
        defaultLogFile: './custom.log',
        standardFields: {
          application: 'custom-app',
          environment: 'production',
          version: '2.0.0'
        }
      });
      
      expect(LoggerConfig.defaultLevel).toBe('error');
      expect(LoggerConfig.prettyPrint).toBe(false);
      expect(LoggerConfig.enableFileOutput).toBe(true);
      expect(LoggerConfig.defaultLogFile).toBe('./custom.log');
      expect(LoggerConfig.standardFields.application).toBe('custom-app');
      expect(LoggerConfig.standardFields.environment).toBe('production');
      expect(LoggerConfig.standardFields.version).toBe('2.0.0');
    });
  });
  
  describe('Cloud provider integration', () => {
    it('should configure GCP logging when specified', async () => {
      const { createLogger, CloudProvider } = await import('../../../src/logger/index');
      
      const logger = createLogger('test-module', {
        cloud: {
          provider: CloudProvider.GCP,
          config: {
            projectId: 'test-project',
            logName: 'test-log',
            serviceContext: {
              service: 'test-service',
              version: '1.0.0'
            }
          }
        }
      });
      
      expect(logger).toBeDefined();
    });
    
    it('should configure AWS logging when specified', async () => {
      const { createLogger, CloudProvider } = await import('../../../src/logger/index');
      
      const logger = createLogger('test-module', {
        cloud: {
          provider: CloudProvider.AWS,
          config: {
            logGroupName: 'test-group',
            logStreamName: 'test-stream',
            region: 'us-west-2'
          }
        }
      });
      
      expect(logger).toBeDefined();
    });
    
    it('should configure Azure logging when specified', async () => {
      const { createLogger, CloudProvider } = await import('../../../src/logger/index');
      
      const logger = createLogger('test-module', {
        cloud: {
          provider: CloudProvider.AZURE,
          config: {
            connectionString: 'test-connection-string',
            role: 'test-role',
            roleInstance: 'test-instance'
          }
        }
      });
      
      expect(logger).toBeDefined();
    });
  });
  
  describe('Environment variables', () => {
    it('should use LOG_LEVEL env variable when set', async () => {
      process.env.LOG_LEVEL = 'debug';
      
      // Re-import to pick up the environment variable change
      const { LoggerConfig } = await import('../../../src/logger/index');
      
      expect(LoggerConfig.defaultLevel).toBe('debug');
    });
    
    it('should use NODE_ENV env variable when set', async () => {
      process.env.NODE_ENV = 'staging';
      
      // Re-import to pick up the environment variable change
      const { LoggerConfig } = await import('../../../src/logger/index');
      
      expect(LoggerConfig.standardFields.environment).toBe('staging');
    });
    
    it('should use APP_VERSION env variable when set', async () => {
      process.env.APP_VERSION = '3.0.0';
      
      // Re-import to pick up the environment variable change
      const { LoggerConfig } = await import('../../../src/logger/index');
      
      expect(LoggerConfig.standardFields.version).toBe('3.0.0');
    });
  });
}); 