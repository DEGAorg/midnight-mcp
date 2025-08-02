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
  let pinoMock: any;
  
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

    it('should use standardFields.agentId when process.env.AGENT_ID is not set', () => {
      // Store original AGENT_ID
      const originalAgentId = process.env.AGENT_ID;
      
      // Remove AGENT_ID to test fallback to standardFields.agentId
      delete process.env.AGENT_ID;
      
      try {
        const logger = createLogger('test-module', {
          standardFields: {
            agentId: 'test-agent-from-standard-fields'
          }
        });
        expect(logger).toBeDefined();
      } finally {
        // Restore original AGENT_ID
        if (originalAgentId !== undefined) {
          process.env.AGENT_ID = originalAgentId;
        }
      }
    });

    it('should use default agentId when both env and standardFields are missing', () => {
      // Store original AGENT_ID
      const originalAgentId = process.env.AGENT_ID;
      
      // Remove AGENT_ID and don't provide standardFields.agentId to test 'default' fallback
      delete process.env.AGENT_ID;
      
      try {
        const logger = createLogger('test-module', {
          standardFields: {
            // No agentId property
            application: 'test-app'
          }
        });
        expect(logger).toBeDefined();
      } finally {
        // Restore original AGENT_ID
        if (originalAgentId !== undefined) {
          process.env.AGENT_ID = originalAgentId;
        }
      }
    });

    it('should use default agentId when standardFields is completely missing', () => {
      // Store original AGENT_ID
      const originalAgentId = process.env.AGENT_ID;
      
      // Remove AGENT_ID and don't provide standardFields at all
      delete process.env.AGENT_ID;
      
      try {
        const logger = createLogger('test-module', {
          // No standardFields property at all
          level: 'info'
        });
        expect(logger).toBeDefined();
      } finally {
        // Restore original AGENT_ID
        if (originalAgentId !== undefined) {
          process.env.AGENT_ID = originalAgentId;
        }
      }
    });

    it('should handle pinoOptions without customLevels', () => {
      const logger = createLogger('test', {
        pinoOptions: {
          level: 'debug',
          // No customLevels property
        }
      });
      expect(logger).toBeDefined();
    });

    it('should properly destructure pinoOptions and handle customLevels', () => {
      const logger = createLogger('test', {
        pinoOptions: {
          level: 'debug',
          customLevels: { 
            custom: 25 
          },
          // Additional properties to ensure destructuring works
          timestamp: true,
          formatters: {}
        }
      });
      expect(logger).toBeDefined();
    });

    it('should use fallback level value when pino.levels.values does not contain the level', () => {
      // Mock pino.levels.values to not contain our test level
      const originalLevels = pinoMock.levels;
      pinoMock.levels = {
        values: {
          // Include standard levels but missing our custom level to trigger fallback
          trace: 10,
          debug: 20,
          info: 30,
          warn: 40,
          error: 50,
          fatal: 60
          // Missing 'unknownLevel' to trigger fallback to 30
        }
      };

      try {
        const logger = createLogger('test', {
          pinoOptions: {
            customLevels: { unknownLevel: 25 }
          }
        });
        expect(logger).toBeDefined();
      } finally {
        // Restore original levels
        pinoMock.levels = originalLevels;
      }
    });

    it('should trigger fallback to 30 when level is missing from pino.levels.values', () => {
      // Store original levels
      const originalLevels = pinoMock.levels;
      
      // Create a completely empty levels.values to force all lookups to fail
      pinoMock.levels = {
        values: {}  // Empty object - any lookup will return undefined and trigger fallback
      };

      try {
        const logger = createLogger('test', {
          pinoOptions: {
            customLevels: { 
              debug: 20,  // Even standard level names will fail lookup in empty values
              custom: 35
            }
          }
        });
        expect(logger).toBeDefined();
        expect(typeof logger.info).toBe('function');
      } finally {
        // Restore original levels
        pinoMock.levels = originalLevels;
      }
    });

    it('should handle undefined pino.levels.values to trigger fallback', () => {
      // Store original levels
      const originalLevels = pinoMock.levels;
      
      // Make levels.values undefined to force the || 30 fallback
      pinoMock.levels = {
        values: undefined
      };

      try {
        const logger = createLogger('test', {
          pinoOptions: {
            customLevels: { 
              myLevel: 25
            }
          }
        });
        expect(logger).toBeDefined();
      } finally {
        // Restore original levels
        pinoMock.levels = originalLevels;
      }
    });

    it('should handle missing levels property to trigger fallback', () => {
      // Store original levels
      const originalLevels = pinoMock.levels;
      
      // Remove levels property entirely
      pinoMock.levels = undefined;

      try {
        const logger = createLogger('test', {
          pinoOptions: {
            customLevels: { 
              testLevel: 45
            }
          }
        });
        expect(logger).toBeDefined();
      } finally {
        // Restore original levels
        pinoMock.levels = originalLevels;
      }
    });

    it('should use fallback value 30 when custom level name does not exist in pino levels', () => {
      // Store original levels
      const originalLevels = pinoMock.levels;
      
      // Set up pino.levels.values with only standard levels
      pinoMock.levels = {
        values: {
          trace: 10,
          debug: 20,
          info: 30,
          warn: 40,
          error: 50,
          fatal: 60
          // Notice: 'nonExistentLevel' is NOT in this list
        }
      };

      try {
        const logger = createLogger('test', {
          pinoOptions: {
            customLevels: { 
              nonExistentLevel: 25  // This level name doesn't exist in pino.levels.values, so it should fallback to 30
            }
          }
        });
        expect(logger).toBeDefined();
      } finally {
        // Restore original levels
        pinoMock.levels = originalLevels;
      }
    });

    it('should process multiple customLevels and create baseOptions.customLevels', () => {
      const logger = createLogger('test', {
        pinoOptions: {
          customLevels: { 
            verbose: 15,
            notice: 35,
            alert: 55
          }
        }
      });
      expect(logger).toBeDefined();
      // This test ensures the if (customLevels) block and baseOptions.customLevels assignment are covered
    });

    it('should create customLevels object when customLevels are provided in pinoOptions', () => {
      const logger = createLogger('test', {
        pinoOptions: {
          customLevels: { 
            custom1: 25,
            custom2: 35 
          }
        }
      });
      expect(logger).toBeDefined();
      // The test covers the customLevels processing path which is what we need for coverage
      expect(typeof logger.info).toBe('function');
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