import * as pino from 'pino';

/**
 * Available log levels in ascending order of importance.
 * - trace: Extremely detailed logs
 * - debug: Detailed information for debugging
 * - info: General application flow information
 * - warn: Potentially harmful situations
 * - error: Error events that might still allow the application to continue
 * - fatal: Very severe error events that will likely lead to application termination
 */
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * Supported cloud provider types for logging
 */
export enum CloudProvider {
  NONE = 'none',
  GCP = 'gcp',
  AWS = 'aws',
  AZURE = 'azure'
}

/**
 * Configuration for Google Cloud Logging
 */
export interface GCPLoggerConfig {
  /** 
   * Google Cloud Project ID 
   */
  projectId: string;
  
  /**
   * Log name in GCP
   */
  logName?: string;
  
  /**
   * Resource type and labels
   */
  resource?: {
    type: string;
    labels: Record<string, string>;
  };
  
  /**
   * Service context for error reporting
   */
  serviceContext?: {
    service: string;
    version: string;
  };
  
  /**
   * Additional labels to add to all log entries
   */
  labels?: Record<string, string>;
  
  /**
   * Use synchronous logging (useful for serverless environments)
   * @default false
   */
  synchronous?: boolean;
}

/**
 * Configuration for AWS CloudWatch Logging
 */
export interface AWSLoggerConfig {
  /**
   * CloudWatch log group name
   */
  logGroupName: string;
  
  /**
   * CloudWatch log stream name
   */
  logStreamName?: string;
  
  /**
   * AWS region
   */
  region: string;
  
  /**
   * AWS credentials
   */
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
  };
}

/**
 * Configuration for Azure Monitor Logging
 */
export interface AzureLoggerConfig {
  /**
   * Azure Application Insights connection string or instrumentation key
   */
  connectionString: string;
  
  /**
   * Role name for the service
   */
  role?: string;
  
  /**
   * Role instance name
   */
  roleInstance?: string;
}

/**
 * Cloud provider configuration options
 */
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

/**
 * Logger configuration options
 */
export interface LoggerOptions {
  /**
   * Log level to use
   * @default 'info'
   */
  level?: LogLevel;
  
  /**
   * Enable pretty printing for development
   * @default true
   */
  pretty?: boolean;
  
  /**
   * Additional configuration to pass to pino
   */
  pinoOptions?: pino.LoggerOptions;
  
  /**
   * Optional output file path to write logs to
   */
  outputFile?: string;
  
  /**
   * Cloud provider configuration for sending logs to cloud services
   */
  cloud?: CloudLoggerConfig;
  
  /**
   * Include additional standard fields with each log
   */
  standardFields?: {
    /**
     * Application or service name
     */
    application?: string;
    
    /**
     * Environment (e.g., production, development, staging)
     */
    environment?: string;
    
    /**
     * Version of the application
     */
    version?: string;
    
    /**
     * Custom fields to include with every log
     */
    custom?: Record<string, any>;
  };
}

/**
 * Global logger configuration that can be modified
 */
export const LoggerConfig = {
  /**
   * Default log level for all loggers
   */
  defaultLevel: (process.env.LOG_LEVEL as LogLevel) || 'info',
  
  /**
   * Enable pretty printing by default
   */
  prettyPrint: true,
  
  /**
   * Enable file output by default
   */
  enableFileOutput: false,
  
  /**
   * Default log file location
   */
  defaultLogFile: './logs/app.log',
  
  /**
   * Cloud provider configuration
   */
  cloud: {
    provider: CloudProvider.NONE,
  } as CloudLoggerConfig,
  
  /**
   * Standard fields to include with all logs
   */
  standardFields: {
    application: 'midnight-mcp',
    environment: process.env.NODE_ENV || 'development',
    version: process.env.APP_VERSION || '0.0.1',
  },
};

/**
 * Create GCP-compatible log formatter
 */
function createGCPFormatter(config: GCPLoggerConfig): pino.LoggerOptions {
  return {
    base: {
      serviceContext: config.serviceContext || {
        service: LoggerConfig.standardFields.application,
        version: LoggerConfig.standardFields.version,
      },
      resource: config.resource || {
        type: 'global',
        labels: {},
      },
      labels: config.labels || {},
    },
    messageKey: 'message',
    formatters: {
      level(label, number) {
        // Map pino levels to GCP severity
        const severityMap: Record<string, string> = {
          trace: 'DEBUG',
          debug: 'DEBUG',
          info: 'INFO',
          warn: 'WARNING',
          error: 'ERROR',
          fatal: 'CRITICAL',
        };
        
        return { 
          severity: severityMap[label] || 'DEFAULT',
          level: number,
        };
      },
      log(object) {
        // Add timestamp in RFC3339 format
        const timestamp = new Date().toISOString();
        return { ...object, timestamp };
      },
    },
  };
}

/**
 * Create a compatible transport for the given cloud provider
 */
function createCloudTransport(cloudConfig: CloudLoggerConfig): pino.DestinationStream | null {
  switch (cloudConfig.provider) {
    case CloudProvider.GCP:
      // For GCP we'll use pino-stackdriver
      return pino.transport({
        target: 'pino-stackdriver',
        options: {
          projectId: cloudConfig.config.projectId,
          logName: cloudConfig.config.logName || 'midnight-mcp',
          // Spread the config but exclude projectId to avoid duplication
          ...(({ projectId, ...rest }) => rest)(cloudConfig.config),
        },
      });
      
    case CloudProvider.AWS:
      // For AWS we'd use pino-cloudwatch
      return pino.transport({
        target: 'pino-cloudwatch',
        options: {
          group: cloudConfig.config.logGroupName,
          stream: cloudConfig.config.logStreamName || `${new Date().toISOString().split('T')[0]}-${LoggerConfig.standardFields.environment}`,
          aws: {
            region: cloudConfig.config.region,
            credentials: cloudConfig.config.credentials,
          },
        },
      });
      
    case CloudProvider.AZURE:
      // For Azure we'd use pino-applicationinsights
      return pino.transport({
        target: 'pino-applicationinsights',
        options: {
          connectionString: cloudConfig.config.connectionString,
          role: cloudConfig.config.role || LoggerConfig.standardFields.application,
          roleInstance: cloudConfig.config.roleInstance || LoggerConfig.standardFields.environment,
        },
      });
      
    case CloudProvider.NONE:
    default:
      return null;
  }
}

/**
 * Create a logger instance with the provided configuration
 * @param name Name of the logger (typically a component or module name)
 * @param options Configuration options
 * @returns Configured logger instance
 */
export function createLogger(name: string, options: LoggerOptions = {}): pino.Logger {
  const level = options.level || LoggerConfig.defaultLevel;
  const pretty = options.pretty ?? LoggerConfig.prettyPrint;
  const cloud = options.cloud || LoggerConfig.cloud;
  
  // Prepare standard fields
  const standardFields = {
    ...LoggerConfig.standardFields,
    ...options.standardFields,
  };
  
  // Base logger options
  let baseOptions: pino.LoggerOptions = {
    level,
    name,
    base: {
      application: standardFields.application,
      environment: standardFields.environment,
      version: standardFields.version,
      ...standardFields.custom,
    },
    ...options.pinoOptions,
  };
  
  // Apply cloud-specific formatters if needed
  if (cloud.provider === CloudProvider.GCP) {
    baseOptions = {
      ...baseOptions,
      ...createGCPFormatter(cloud.config),
    };
  }
  
  // Configure destination streams
  const destinations: pino.DestinationStream[] = [];
  
  // Add pretty console transport if enabled
  if (pretty) {
    destinations.push(
      pino.transport({
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        }
      })
    );
  } else {
    // Standard output without pretty printing
    destinations.push(pino.destination(1)); // stdout
  }
  
  // Add file transport if enabled and file path provided
  const outputFile = options.outputFile || (LoggerConfig.enableFileOutput ? LoggerConfig.defaultLogFile : undefined);
  if (outputFile) {
    destinations.push(pino.destination(outputFile));
  }
  
  // Add cloud transport if configured
  const cloudTransport = createCloudTransport(cloud);
  if (cloudTransport) {
    destinations.push(cloudTransport);
  }
  
  // If multiple destinations, use multistream
  if (destinations.length > 1) {
    return pino.pino(baseOptions, pino.multistream(destinations));
  }
  
  // Single destination
  return pino.pino(baseOptions, destinations[0]);
}

/**
 * Configure global logger settings
 * @param options Configuration options to apply globally
 */
export function configureGlobalLogging(options: {
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

/**
 * Default application logger
 */
export const logger = createLogger('midnight-mcp');

/**
 * Export the pino library for advanced usage
 */
export { pino };

export default createLogger; 