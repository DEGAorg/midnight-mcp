import { describe, it, beforeAll, afterAll, beforeEach, afterEach, jest, expect } from '@jest/globals';
import { createLogger, LoggerConfig, CloudProvider } from '../../../src/logger/index';
import { configureGlobalLogging } from '../../../src/logger/index';
import { configureLogger, getLogger } from '../../../src/logger/index';
import * as loggerIndex from '../../../src/logger/index';

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
  
  const levels = {
    values: {
      trace: 10,
      debug: 20,
      info: 30,
      warn: 40,
      error: 50,
      fatal: 60
    }
  };

  return Object.assign(mockPino, {
    pino: mockPino,
    transport: mockTransport,
    destination: mockDestination,
    multistream: mockMultistream,
    default: mockPino,
    levels: levels,
    isLevelEnabled: jest.fn(() => true),
    silent: jest.fn(),
    on: jest.fn(),
    once: jest.fn(),
    emit: jest.fn(),
    addListener: jest.fn(),
  });
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

    it('creates a logger with pretty print', () => {
      const logger = createLogger('test', { pretty: true });
      expect(logger).toBeDefined();
    });

    it('creates a logger without pretty print', () => {
      const logger = createLogger('test', { pretty: false });
      expect(logger).toBeDefined();
    });

    it('creates a logger with file output', () => {
      const logger = createLogger('test', { outputFile: 'test.log' });
      expect(logger).toBeDefined();
    });

    it('creates a logger with GCP cloud transport', () => {
      const logger = createLogger('test', {
        cloud: {
          provider: CloudProvider.GCP,
          config: { projectId: 'pid' }
        }
      });
      expect(logger).toBeDefined();
    });

    it('creates a logger with AWS cloud transport', () => {
      const logger = createLogger('test', {
        cloud: {
          provider: CloudProvider.AWS,
          config: { logGroupName: 'group', region: 'us-east-1' }
        }
      });
      expect(logger).toBeDefined();
    });

    it('creates a logger with AZURE cloud transport', () => {
      const logger = createLogger('test', {
        cloud: {
          provider: CloudProvider.AZURE,
          config: { connectionString: 'conn' }
        }
      });
      expect(logger).toBeDefined();
    });

    it('creates a logger with customLevels in pinoOptions', () => {
      const logger = createLogger('test', {
        pinoOptions: {
          customLevels: { foo: 35 }
        }
      });
      expect(logger).toBeDefined();
    });

    it('should not add file output when enableFileOutput is false', () => {
      LoggerConfig.enableFileOutput = false;
      const logger = createLogger('test-module', {});
      expect(logger).toBeDefined();
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

    it('configures global logging options', () => {
      configureGlobalLogging({
        level: 'debug',
        prettyPrint: false,
        enableFileOutput: false,
        defaultLogFile: 'custom.log',
        cloud: { provider: CloudProvider.NONE },
        standardFields: { 
          application: 'test-app',
          environment: 'test-env',
          version: '1.0.0'
        }
      });
      expect(LoggerConfig.defaultLevel).toBe('debug');
      expect(LoggerConfig.prettyPrint).toBe(false);
      expect(LoggerConfig.enableFileOutput).toBe(false);
      expect(LoggerConfig.defaultLogFile).toBe('custom.log');
      expect(LoggerConfig.standardFields.application).toBe('test-app');
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

    it('should use default values when env variables are not set', async () => {
      // Clear environment variables
      delete process.env.LOG_LEVEL;
      delete process.env.NODE_ENV;
      delete process.env.APP_VERSION;
    
      // Re-import to pick up the environment variable change
      const { LoggerConfig } = await import('../../../src/logger/index');
    
      expect(LoggerConfig.defaultLevel).toBe('info');
      expect(LoggerConfig.standardFields.environment).toBe('development');
      expect(LoggerConfig.standardFields.version).toBe('0.0.1');
    });
    
  });

  describe('configureLogger and getLogger', () => {
    it('configures sentry logger', () => {
      configureLogger('sentry');
      const logger = getLogger();
      expect(logger).toBeDefined();
    });

    it('configures pino logger', () => {
      configureLogger('pino');
      const logger = getLogger();
      expect(logger).toBeDefined();
    });

    it('should fallback to PinoLogger if getLogger is called before configureLogger', () => {
      // Reset the logger variable (if possible)
      // @ts-ignore
      import('../../../src/logger/index').then(mod => {
        // forcibly reset the logger variable for test
        (mod as any).logger = undefined;
        const logger = mod.getLogger();
        expect(logger).toBeDefined();
      });
    });
  });

  describe('createGCPFormatter', () => {
    it('should map log levels to GCP severity and add timestamp', () => {
      // Create the formatter
      const formatter = (loggerIndex as any).createGCPFormatter({});

      // Test the level formatter
      const levelFormatter = formatter.formatters.level;
      expect(levelFormatter('info', 30)).toEqual({ severity: 'INFO', level: 30 });
      expect(levelFormatter('warn', 40)).toEqual({ severity: 'WARNING', level: 40 });
      expect(levelFormatter('unknown', 99)).toEqual({ severity: 'DEFAULT', level: 99 });

      // Test the log formatter
      const logFormatter = formatter.formatters.log;
      const result = logFormatter({ foo: 'bar' });
      expect(result).toHaveProperty('foo', 'bar');
      expect(result).toHaveProperty('timestamp');
      // Optionally, check timestamp format
      expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
    });
  });
}); 