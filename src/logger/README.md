# Midnight MCP Logger

A flexible, extensible logging system for the Midnight MCP project built on top of the [Pino](https://github.com/pinojs/pino) library.

## Overview

This logger module provides:

- Structured JSON logging
- Support for multiple log levels (trace, debug, info, warn, error, fatal)
- Console output with pretty printing for development
- File output for storing logs locally
- Cloud provider integrations for GCP, AWS, and Azure
- Customizable metadata fields

## Basic Usage

```typescript
// Import the default logger
import { logger } from './logger';

// Use the logger
logger.info('Application started');
logger.error('Something went wrong', new Error('Oops!'));

// Log with additional data
logger.info({ userId: '123', action: 'login' }, 'User logged in');

// Different log levels
logger.trace('Detailed trace information');
logger.debug('Debugging information');
logger.info('General information');
logger.warn('Warning');
logger.error('Error');
logger.fatal('Fatal error that will cause the application to terminate');
```

## Creating Custom Loggers

Use the `createLogger` function to create loggers for specific components:

```typescript
import { createLogger } from './logger';

// Create a logger for a specific component
const walletLogger = createLogger('wallet-component', {
  level: 'debug',
  pretty: true,
  // Additional options...
});

walletLogger.info('Wallet initialized');
```

## Global Configuration

You can configure the global logging settings for the entire application:

```typescript
import { configureGlobalLogging } from './logger';

configureGlobalLogging({
  level: 'info',
  prettyPrint: process.env.NODE_ENV !== 'production',
  enableFileOutput: true,
  defaultLogFile: './logs/app.log',
  standardFields: {
    application: 'my-app',
    environment: 'production',
    version: '1.0.0',
  },
});
```

## Cloud Provider Integration

### Google Cloud Platform (GCP)

To send logs to Google Cloud Logging:

1. Install the required dependency:

```bash
npm install pino-stackdriver
```

2. Configure the logger:

```typescript
import { configureGlobalLogging, CloudProvider } from './logger';

configureGlobalLogging({
  cloud: {
    provider: CloudProvider.GCP,
    config: {
      projectId: 'your-gcp-project-id',
      logName: 'your-log-name',
      resource: {
        type: 'k8s_container', // or another resource type
        labels: {
          cluster_name: 'your-cluster',
          namespace_name: 'your-namespace',
          pod_name: 'your-pod',
          container_name: 'your-container',
        },
      },
    },
  },
});
```

### Amazon Web Services (AWS)

To send logs to AWS CloudWatch:

1. Install the required dependency:

```bash
npm install pino-cloudwatch
```

2. Configure the logger:

```typescript
import { configureGlobalLogging, CloudProvider } from './logger';

configureGlobalLogging({
  cloud: {
    provider: CloudProvider.AWS,
    config: {
      logGroupName: 'your-log-group',
      logStreamName: 'your-log-stream',
      region: 'us-west-2',
      credentials: {
        accessKeyId: 'YOUR_ACCESS_KEY',
        secretAccessKey: 'YOUR_SECRET_KEY',
      },
    },
  },
});
```

### Microsoft Azure

To send logs to Azure Monitor:

1. Install the required dependency:

```bash
npm install pino-applicationinsights
```

2. Configure the logger:

```typescript
import { configureGlobalLogging, CloudProvider } from './logger';

configureGlobalLogging({
  cloud: {
    provider: CloudProvider.AZURE,
    config: {
      connectionString: 'your-application-insights-connection-string',
      role: 'midnight-mcp',
      roleInstance: 'instance-1',
    },
  },
});
```

## Environment Variables

The logger supports the following environment variables:

- `LOG_LEVEL`: Set the default log level (trace, debug, info, warn, error, fatal)
- `NODE_ENV`: Environment (development, production, test, etc.)
- `APP_VERSION`: Application version
- `GCP_PROJECT_ID`: Google Cloud Project ID (for GCP logging)
- `K8S_CLUSTER_NAME`: Kubernetes cluster name (for GCP resource labels)
- `K8S_NAMESPACE`: Kubernetes namespace (for GCP resource labels)
- `POD_NAME`: Pod name (for GCP resource labels)

## Best Practices

1. Create separate loggers for different components using `createLogger`
2. Use appropriate log levels:
   - `trace`: Extremely detailed information useful for debugging
   - `debug`: Information helpful for development and debugging
   - `info`: General operational information
   - `warn`: Something unexpected happened but the application can continue
   - `error`: Something went wrong that may affect functionality
   - `fatal`: A critical error that will likely cause the application to terminate
3. Include contextual data with each log message
4. Use structured logging with objects rather than string concatenation
5. Configure log level appropriately for production environments 