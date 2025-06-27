import type { Logger } from 'pino';



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

const mockLogger: Logger = {
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  trace: jest.fn(),
  fatal: jest.fn(),
  child: jest.fn(() => mockLogger),
  level: 'info',
  levels: { values: {}, labels: {} },
  isLevelEnabled: jest.fn(() => true),
  silent: jest.fn(),
  on: jest.fn(),
  once: jest.fn(),
  emit: jest.fn(),
  addListener: jest.fn(),
  removeListener: jest.fn(),
  removeAllListeners: jest.fn(),
  setMaxListeners: jest.fn(),
  getMaxListeners: jest.fn(),
  listeners: jest.fn(() => []),
  rawListeners: jest.fn(() => []),
  listenerCount: jest.fn(() => 0),
  prependListener: jest.fn(),
  prependOnceListener: jest.fn(),
  eventNames: jest.fn(() => []),
} as any;

function createLogger(name?: string, options?: LoggerOptions): Logger {
  return mockLogger;
}

function configureGlobalLogging(options: {
  level?: LogLevel;
  prettyPrint?: boolean;
  enableFileOutput?: boolean;
  defaultLogFile?: string;
  cloud?: CloudLoggerConfig;
  standardFields?: typeof LoggerConfig.standardFields;
}): void {
  if (options.level) {
    LoggerConfig.defaultLevel = options.level;
  }
  
  if (options.prettyPrint !== undefined) {
    LoggerConfig.prettyPrint = options.prettyPrint;
  }
  
  if (options.enableFileOutput !== undefined) {
    LoggerConfig.enableFileOutput = options.enableFileOutput;
  }
  
  if (options.defaultLogFile) {
    LoggerConfig.defaultLogFile = options.defaultLogFile;
  }
  
  if (options.cloud) {
    LoggerConfig.cloud = options.cloud;
  }
  
  if (options.standardFields) {
    LoggerConfig.standardFields = {
      ...LoggerConfig.standardFields,
      ...options.standardFields,
    };
  }
}

// Mock pino
const mockPino = {
  pino: jest.fn(() => mockLogger),
  transport: jest.fn(),
  destination: jest.fn(),
  multistream: jest.fn(),
  levels: { values: {} },
};

export { createLogger, configureGlobalLogging, mockLogger as logger, mockPino as pino };
export default createLogger; 