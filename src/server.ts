import { MCPServer, MCPErrorType, MCPError } from './mcp/index.js';
import { config } from './config.js';
import { logger, configureGlobalLogging, CloudProvider } from './logger/index.js';
import { WalletConfig } from './wallet/index.js';

// Configure global logging settings based on environment
configureGlobalLogging({
  level: (process.env.LOG_LEVEL as any) || 'info',
  prettyPrint: process.env.NODE_ENV !== 'production',
  enableFileOutput: process.env.NODE_ENV === 'production',
  defaultLogFile: './logs/midnight-mcp.log',
  // Example: Configure GCP logging if in production and GCP_PROJECT_ID is set
  ...(process.env.NODE_ENV === 'production' && process.env.GCP_PROJECT_ID ? {
    cloud: {
      provider: CloudProvider.GCP,
      config: {
        projectId: process.env.GCP_PROJECT_ID,
        logName: 'midnight-mcp-logs',
        resource: {
          type: 'k8s_container',
          labels: {
            cluster_name: process.env.K8S_CLUSTER_NAME || 'midnight-cluster',
            namespace_name: process.env.K8S_NAMESPACE || 'default',
            pod_name: process.env.POD_NAME || 'midnight-mcp',
            container_name: 'midnight-mcp',
          },
        },
      },
    },
  } : {}),
  // Standard fields to include with all logs
  standardFields: {
    application: 'midnight-mcp',
    environment: process.env.NODE_ENV || 'development',
    version: process.env.APP_VERSION || '0.0.1',
  },
});

/**
 * Example implementation showing how to use the MCPServer
 */
async function main() {
  // Configuration is loaded from the config module which handles environment variables
  logger.info(`Using network ID: ${config.networkId}`);
  
  try {
    // Check if we should use an external proof server
    let externalConfig: WalletConfig | undefined;
    
    if (config.useExternalProofServer) {
      logger.info('Using external proof server configuration');
      
      // Validate that all required connection parameters are provided
      if (!config.proofServer) {
        throw new Error('PROOF_SERVER environment variable is required when USE_EXTERNAL_PROOF_SERVER=true');
      }
      
      if (!config.indexer) {
        throw new Error('INDEXER environment variable is required when USE_EXTERNAL_PROOF_SERVER=true');
      }
      
      if (!config.indexerWS) {
        throw new Error('INDEXER_WS environment variable is required when USE_EXTERNAL_PROOF_SERVER=true');
      }
      
      if (!config.node) {
        throw new Error('NODE environment variable is required when USE_EXTERNAL_PROOF_SERVER=true');
      }
      
      // Create external config
      externalConfig = {
        proofServer: config.proofServer,
        indexer: config.indexer,
        indexerWS: config.indexerWS,
        node: config.node,
        useExternalProofServer: true,
        networkId: config.networkId
      };
      
      logger.info(`External proof server: ${externalConfig.proofServer}`);
      logger.info(`External indexer: ${externalConfig.indexer}`);
      logger.info(`External indexer WS: ${externalConfig.indexerWS}`);
      logger.info(`External node: ${externalConfig.node}`);
    } else {
      logger.info('Using internal Docker-based proof server');
    }
    
    // Create an instance of the MCP server
    // This will start the Docker environment and begin wallet sync in the background
    const mcpServer = new MCPServer(
      config.networkId, 
      config.seed, 
      config.walletFilename,
      externalConfig
    );
    
    logger.info('MCP Server initialized, wallet synchronization started in background');
    logger.info('Server is ready to handle API requests, but wallet operations will return "not ready" until sync completes');
    
    // Setup graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Shutting down MCP Server...');
      await mcpServer.close();
      process.exit(0);
    });
    
    // Check if wallet is ready every second
    const readyCheck = setInterval(() => {
      if (mcpServer.isReady()) {
        logger.info('Wallet is now fully synced and ready for operations!');
        clearInterval(readyCheck);
      } else {
        logger.info('Wallet syncing in progress, MCP server is responsive but wallet not fully ready yet...');
      }
    }, 5000);
  } catch (error) {
    logger.error('Error initializing MCP Server:', error);
    process.exit(1);
  }
}

// Run the example
main().catch(error => {
  logger.error('Fatal error:', error);
  process.exit(1);
}); 