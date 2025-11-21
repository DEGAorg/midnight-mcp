/**
 * STDIO Server - MCP Server Entry Point
 *
 * Initializes services and starts the MCP server over STDIO transport.
 * NEW ARCHITECTURE: Direct service integration via WalletOrchestrator, no HTTP layer.
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { WalletBuilder } from '@midnight-ntwrk/wallet';
import type { Wallet } from '@midnight-ntwrk/wallet-api';
import type { Resource } from '@midnight-ntwrk/wallet';
import { NetworkId, setNetworkId, getZswapNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import path from 'path';

import { MCPServer } from './server.js';
import type { ServiceDependencies } from './types.js';
import { WalletOrchestrator, type WalletOrchestratorConfig } from '../services/WalletOrchestrator.js';
import { loadConfig, getNetworkId, getWalletBackupFolder, type AppConfig } from '../lib/config/env.js';
import { FileManager, FileType } from '../lib/utils/file-manager.js';
import { SeedManager } from '../lib/utils/seed-manager.js';

/**
 * Simple logging to stderr (stdout is reserved for JSON-RPC)
 */
function log(...args: any[]) {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}]`, ...args);
}

/**
 * Create wallet factory function
 *
 * Reuses the pattern from WalletManager.buildWalletFromSeed()
 * with proper file restoration and error handling.
 */
function createWalletFactory(appConfig: AppConfig): () => Promise<Wallet & Resource> {
  const indexer = appConfig.INDEXER || 'https://indexer.testnet-02.midnight.network/api/v1/graphql';
  const indexerWS = appConfig.INDEXER_WS || 'wss://indexer.testnet-02.midnight.network/api/v1/graphql/ws';
  const node = appConfig.MN_NODE || 'https://rpc.testnet-02.midnight.network';
  const proofServer = appConfig.PROOF_SERVER || 'http://127.0.0.1:6300';
  const fileManager = FileManager.getInstance();
  const walletFilename = appConfig.WALLET_FILENAME;
  const agentId = appConfig.AGENT_ID;

  // Load seed from agent-specific storage (not from env!)
  const seed = SeedManager.getAgentSeed(agentId);

  return async (): Promise<Wallet & Resource> => {
    log("Building wallet from seed...");

    // Try to restore wallet from file if it exists
    const formattedFilename = `${walletFilename}.json`;
    if (fileManager.fileExists(FileType.WALLET_BACKUP, appConfig.AGENT_ID, formattedFilename)) {
      log(`Restoring wallet from ${formattedFilename}`);
      try {
        const serialized = fileManager.readFile(FileType.WALLET_BACKUP, appConfig.AGENT_ID, formattedFilename);

        const cleanSerialized = serialized.trim().startsWith('"')
          ? JSON.parse(serialized)
          : serialized;

        const wallet = await WalletBuilder.restore(
          indexer,
          indexerWS,
          proofServer,
          node,
          seed,
          cleanSerialized,
          'info'
        );

        wallet.start();
        log('Wallet restored from file');
        return wallet;
      } catch (error) {
        log('Failed to restore wallet, building from seed:', error);
      }
    }

    // Build new wallet from seed
    log('Building fresh wallet from seed');
    const wallet = await WalletBuilder.build(
      indexer,
      indexerWS,
      proofServer,
      node,
      seed,
      getZswapNetworkId(),
      'info'
    );

    wallet.start();
    log('Wallet built successfully');
    return wallet;
  };
}

/**
 * Initialize services using WalletOrchestrator
 *
 * Uses existing config infrastructure:
 * - loadConfig() from env.ts for environment validation
 * - WalletOrchestrator for service coordination
 * - FileManager for wallet persistence
 *
 * Note: WalletOrchestrator.initializeServices() handles all service
 * creation and dependency injection internally. We just need to:
 * 1. Create orchestrator config
 * 2. Call orchestrator.start()
 * 3. Get services via orchestrator.getXService()
 */
async function initializeServices(): Promise<{
  services: ServiceDependencies;
  orchestrator: WalletOrchestrator;
}> {
  log("Initializing services with WalletOrchestrator...");

  // Load and validate configuration from environment (with Zod validation)
  const appConfig = loadConfig();
  log(`Agent ID: ${appConfig.AGENT_ID}`);
  log(`Network: ${appConfig.NETWORK_ID}`);

  // Initialize SeedManager for this agent
  // Seeds are stored per-agent in .storage/seeds/{agentId}/seed
  SeedManager.initialize('.storage');
  log(`SeedManager initialized for agent: ${appConfig.AGENT_ID}`);

  // Set network ID globally
  const networkId = getNetworkId(appConfig);
  setNetworkId(networkId);
  log(`Network ID set to: ${NetworkId[networkId]}`);

  // Log configuration
  const indexer = appConfig.INDEXER || 'https://indexer.testnet-02.midnight.network/api/v1/graphql';
  const proofServer = appConfig.PROOF_SERVER || 'http://127.0.0.1:6300';
  log(`Indexer: ${indexer}`);
  log(`Proof Server: ${proofServer}`);

  // Create wallet factory (reuses WalletManager pattern)
  const walletFactory = createWalletFactory(appConfig);

  // Create WalletOrchestrator configuration
  const walletBackupFolder = getWalletBackupFolder(appConfig);
  const walletPath = path.join(walletBackupFolder, `${appConfig.WALLET_FILENAME}.json`);
  log(`Wallet path: ${walletPath}`);

  const orchestratorConfig: WalletOrchestratorConfig = {
    walletConfig: {
      walletFactory,
      walletPath,
      agentId: appConfig.AGENT_ID,
    },
    agentId: appConfig.AGENT_ID,
    daoContractAddress: appConfig.DAO_CONTRACT_ADDRESS,
    marketplaceContractAddress: appConfig.MARKETPLACE_CONTRACT_ADDRESS,
  };

  // Initialize WalletOrchestrator
  // Note: The orchestrator's initializeServices() method (WalletOrchestrator.ts:96)
  // handles all service creation with dependency injection automatically
  log("Creating WalletOrchestrator...");
  const orchestrator = new WalletOrchestrator(orchestratorConfig);

  // Start all services
  // Note: orchestrator.start() (WalletOrchestrator.ts:155) starts services in
  // correct dependency order and handles any initialization errors
  log("Starting orchestrator...");
  await orchestrator.start();
  log("Orchestrator started successfully");

  // Get services from orchestrator
  // Note: Services are already initialized by orchestrator.start()
  // If initialization failed, orchestrator.start() would have thrown
  const services: ServiceDependencies = {
    walletService: orchestrator.getWalletService(),
    transactionService: orchestrator.getTransactionService(),
    tokenService: orchestrator.getTokenService(),
    daoService: orchestrator.getDaoService()!,
    marketplaceService: orchestrator.getMarketplaceService()!,
  };

  log("All services initialized successfully");
  return { services, orchestrator };
}

/**
 * Create and configure MCP server
 */
export async function createServer() {
  log("Creating Midnight MCP server with new architecture");

  // Initialize services via WalletOrchestrator
  const { services, orchestrator } = await initializeServices();

  // Create MCP server with handler-based architecture
  const mcpServer = new MCPServer(services, {
    name: "midnight-mcp-server",
    version: "2.0.0"
  });

  // Get underlying server instance
  const server = mcpServer.getServer();

  // Create STDIO transport
  const transport = new StdioServerTransport();

  return {
    start: async () => {
      try {
        await server.connect(transport);
        log("✅ MCP Server started successfully");
        log("📊 Architecture: MCP Server → Handlers → Services via WalletOrchestrator");
        log("🔧 Tools: 18 tools across 4 domains");
        log("🏗️  No HTTP layer - direct service integration");
      } catch (error) {
        log("❌ Failed to start server:", error);
        throw error;
      }
    },
    stop: async () => {
      try {
        // Stop WalletOrchestrator (handles all service shutdown in correct order)
        await orchestrator.stop();

        // Close MCP server
        await server.close();
        log("✅ Server stopped gracefully");
      } catch (error) {
        log("⚠️  Error stopping server:", error);
      }
    },
    services, // Expose services for testing
    orchestrator // Expose orchestrator for testing
  };
}

/**
 * Set up process exit signal handlers
 */
function setupExitHandlers(server: any) {
  const exitHandler = async () => {
    log("🛑 Shutting down server...");
    await server.stop();
    process.exit(0);
  };

  // Handle various exit signals
  process.on("SIGINT", exitHandler);
  process.on("SIGTERM", exitHandler);
  process.on("SIGUSR1", exitHandler);
  process.on("SIGUSR2", exitHandler);
}

/**
 * Handle uncaught errors
 */
function setupErrorHandlers() {
  process.on("uncaughtException", (error) => {
    log("💥 Uncaught exception:", error);
    process.exit(1);
  });

  process.on("unhandledRejection", (reason) => {
    log("💥 Unhandled rejection:", reason);
    process.exit(1);
  });
}

/**
 * Main function - Program entry point
 */
async function main() {
  try {
    log("🚀 Starting Midnight MCP server (NEW ARCHITECTURE)");
    log("================================================");

    // Setup error handlers
    setupErrorHandlers();

    // Create and start server
    const server = await createServer();
    await server.start();

    log("================================================");
    log("✅ Ready to accept MCP requests");

    // Handle process exit signals
    setupExitHandlers(server);
  } catch (error) {
    log("❌ Failed to start server:", error);
    process.exit(1);
  }
}

// Run the main function if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    log("💥 Fatal error:", error);
    process.exit(1);
  });
}
