import type { Logger } from 'pino';
import { ILogger } from '../../../src/logger/types';



// Mock CloudProvider enum
export enum CloudProvider {
  NONE = 'none',
  GCP = 'gcp',
  AWS = 'aws',
  AZURE = 'azure'
}

// Mock state for LoggerConfig
let mockDefaultLevel: LogLevel = 'info';
let mockPrettyPrint = true;
let mockEnableFileOutput = true;
let mockDefaultLogFile = 'wallet-app.log';
let mockCloud: CloudLoggerConfig = { provider: CloudProvider.NONE };
let mockStandardFields = {
  application: 'midnight-mcp',
  environment: 'development',
  version: '0.0.1',
};

// Flags to track if values have been explicitly set
let defaultLevelSet = false;
let environmentSet = false;
let versionSet = false;

// Mock LoggerConfig
export const LoggerConfig = {
  get defaultLevel() {
    return defaultLevelSet ? mockDefaultLevel : ((process.env.LOG_LEVEL as LogLevel) || mockDefaultLevel);
  },
  set defaultLevel(value: LogLevel) {
    mockDefaultLevel = value;
    defaultLevelSet = true;
  },
  get prettyPrint() {
    return mockPrettyPrint;
  },
  set prettyPrint(value: boolean) {
    mockPrettyPrint = value;
  },
  get enableFileOutput() {
    return mockEnableFileOutput;
  },
  set enableFileOutput(value: boolean) {
    mockEnableFileOutput = value;
  },
  get defaultLogFile() {
    return mockDefaultLogFile;
  },
  set defaultLogFile(value: string) {
    mockDefaultLogFile = value;
  },
  get cloud() {
    return mockCloud;
  },
  set cloud(value: CloudLoggerConfig) {
    mockCloud = value;
  },
  get standardFields() {
    return {
      application: mockStandardFields.application,
      environment: environmentSet ? mockStandardFields.environment : (process.env.NODE_ENV || mockStandardFields.environment),
      version: versionSet ? mockStandardFields.version : (process.env.APP_VERSION || mockStandardFields.version),
    };
  },
  set standardFields(value: typeof mockStandardFields) {
    mockStandardFields = { ...mockStandardFields, ...value };
    if (value.environment !== undefined) environmentSet = true;
    if (value.version !== undefined) versionSet = true;
  },
};

// Mock types
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface GCPLoggerConfig {
  projectId: string;
  logName?: string;
  resource?: {
    type: string;
    labels: Record<string, string>;
  };
  serviceContext?: {
    service: string;
    version: string;
  };
  labels?: Record<string, string>;
  synchronous?: boolean;
}

export interface AWSLoggerConfig {
  logGroupName: string;
  logStreamName?: string;
  region: string;
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
  };
}

export interface AzureLoggerConfig {
  connectionString: string;
  role?: string;
  roleInstance?: string;
}

export type CloudLoggerConfig = {
  provider: CloudProvider.GCP;
  config: GCPLoggerConfig;
} | {
  provider: CloudProvider.AWS;
  config: AWSLoggerConfig;
} | {
  provider: CloudProvider.AZURE;
  config: AzureLoggerConfig;
} | {
  provider: CloudProvider.NONE;
};

export interface LoggerOptions {
  level?: LogLevel;
  pretty?: boolean;
  pinoOptions?: any;
  outputFile?: string;
  cloud?: CloudLoggerConfig;
  standardFields?: {
    application?: string;
    environment?: string;
    version?: string;
    agentId?: string;
    custom?: Record<string, any>;
  };
}

type MockLogger = {
  error: jest.Mock;
  info: jest.Mock;
  debug: jest.Mock;
  warn: jest.Mock;
  trace: jest.Mock;
  fatal: jest.Mock;
  child: jest.Mock<MockLogger, []>;
};

const mockLogger = {} as MockLogger;
mockLogger.error = jest.fn().mockImplementation((...args: any[]) => {
  // Only log errors in non-test environments or when explicitly enabled
  if (process.env.NODE_ENV !== 'test' || process.env.ENABLE_TEST_LOGGING === 'true') {
    console.error('[MOCK LOGGER ERROR]', ...args);
  }
});
mockLogger.info = jest.fn().mockImplementation((...args: any[]) => {
  if (process.env.NODE_ENV !== 'test' || process.env.ENABLE_TEST_LOGGING === 'true') {
    console.log('[MOCK LOGGER INFO]', ...args);
  }
});
mockLogger.debug = jest.fn().mockImplementation((...args: any[]) => {
  if (process.env.NODE_ENV !== 'test' || process.env.ENABLE_TEST_LOGGING === 'true') {
    console.log('[MOCK LOGGER DEBUG]', ...args);
  }
});
mockLogger.warn = jest.fn().mockImplementation((...args: any[]) => {
  if (process.env.NODE_ENV !== 'test' || process.env.ENABLE_TEST_LOGGING === 'true') {
    console.warn('[MOCK LOGGER WARN]', ...args);
  }
});
mockLogger.trace = jest.fn().mockImplementation((...args: any[]) => {
  if (process.env.NODE_ENV !== 'test' || process.env.ENABLE_TEST_LOGGING === 'true') {
    console.log('[MOCK LOGGER TRACE]', ...args);
  }
});
mockLogger.fatal = jest.fn().mockImplementation((...args: any[]) => {
  if (process.env.NODE_ENV !== 'test' || process.env.ENABLE_TEST_LOGGING === 'true') {
    console.error('[MOCK LOGGER FATAL]', ...args);
  }
});
mockLogger.child = jest.fn(() => mockLogger);

export function createLogger() {
  return mockLogger;
}

export default mockLogger;

export function createGCPFormatter(config: GCPLoggerConfig): any {
  return {
    formatters: {
      level: (level: string, code: number) => ({ severity: level, level: code }),
      log: (log: any) => ({ ...log, timestamp: new Date().toISOString() })
    }
  };
}

