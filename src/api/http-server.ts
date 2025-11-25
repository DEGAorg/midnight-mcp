/**
 * HTTP Server - REST API Entry Point
 *
 * Initializes services and starts the REST API server over HTTP transport.
 * Mirrors stdio-server.ts architecture but for HTTP instead of MCP.
 *
 * Architecture: HTTP Server -> Routes -> Controllers -> Services via WalletOrchestrator
 */

import path from 'path';
import { WalletBuilder } from '@midnight-ntwrk/wallet';
import type { Wallet } from '@midnight-ntwrk/wallet-api';
import type { Resource } from '@midnight-ntwrk/wallet';
import { NetworkId, setNetworkId, getZswapNetworkId } from '@midnight-ntwrk/midnight-js-network-id';

import { ApiServer } from './server.js';
import { WalletOrchestrator, type WalletOrchestratorConfig } from '@services/WalletOrchestrator.js';
import { loadConfig, getNetworkId, getWalletBackupFolder, type AppConfig } from '@lib/config/env.js';
import { FileManager, FileType } from '@lib/utils/file-manager.js';
import { SeedManager } from '@lib/utils/seed-manager.js';

// Reset FileManager singleton before initialization to ensure correct path
FileManager.resetInstance();

/**
 * Simple logging to stderr
 */
function log(...args: unknown[]) {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}]`, ...args);
}

/**
 * Create wallet factory function
 */
function createWalletFactory(appConfig: AppConfig): () => Promise<Wallet & Resource> {
  const { INDEXER: indexer, INDEXER_WS: indexerWS, MN_NODE: node, PROOF_SERVER: proofServer } = appConfig;
  const fileManager = FileManager.getInstance();
  const walletFilename = appConfig.WALLET_FILENAME;
  const agentId = appConfig.AGENT_ID;

  const seed = SeedManager.getAgentSeed(agentId);

  return async (): Promise<Wallet & Resource> => {
    log("Building wallet from seed...");

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
 */
async function initializeServices(): Promise<{
  orchestrator: WalletOrchestrator;
}> {
  log("Initializing services with WalletOrchestrator...");

  const appConfig = loadConfig();
  log(`Agent ID: ${appConfig.AGENT_ID}`);
  log(`Network: ${appConfig.NETWORK_ID}`);

  SeedManager.initialize(appConfig.BASE_STORAGE_DIR);
  log(`SeedManager initialized with storage: ${appConfig.BASE_STORAGE_DIR}`);

  const networkId = getNetworkId(appConfig);
  setNetworkId(networkId);
  log(`Network ID set to: ${NetworkId[networkId]}`);

  log(`Indexer: ${appConfig.INDEXER}`);
  log(`Proof Server: ${appConfig.PROOF_SERVER}`);

  const walletFactory = createWalletFactory(appConfig);

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

  log("Creating WalletOrchestrator...");
  const orchestrator = new WalletOrchestrator(orchestratorConfig);

  log("Starting orchestrator...");
  await orchestrator.start();
  log("Orchestrator started successfully");

  return { orchestrator };
}

/**
 * Create and configure HTTP API server
 */
export async function createServer(port?: number) {
  log("Creating Midnight HTTP API server");

  const { orchestrator } = await initializeServices();

  const apiPort = port ?? parseInt(process.env.API_PORT ?? '3000', 10);

  const server = new ApiServer({
    port: apiPort,
    orchestrator,
    corsOptions: {
      origin: process.env.CORS_ORIGIN ?? '*',
      credentials: true,
    },
  });

  return {
    start: async () => {
      try {
        await server.start();
        log("HTTP API Server started successfully");
        log(`Architecture: HTTP Server -> Routes -> Controllers -> Services`);
        log(`Port: ${apiPort}`);
        log(`Endpoints: /health, /wallet/*, /dao/*, /marketplace/*`);
      } catch (error) {
        log("Failed to start server:", error);
        throw error;
      }
    },
    stop: async () => {
      try {
        await orchestrator.stop();
        await server.stop();
        log("Server stopped gracefully");
      } catch (error) {
        log("Error stopping server:", error);
      }
    },
    server,
    orchestrator,
  };
}

/**
 * Set up process exit signal handlers
 */
function setupExitHandlers(server: Awaited<ReturnType<typeof createServer>>) {
  const exitHandler = async () => {
    log("Shutting down server...");
    await server.stop();
    process.exit(0);
  };

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
    log("Uncaught exception:", error);
    process.exit(1);
  });

  process.on("unhandledRejection", (reason) => {
    log("Unhandled rejection:", reason);
    process.exit(1);
  });
}

/**
 * Main function - Program entry point
 */
async function main() {
  try {
    log("Starting Midnight HTTP API server");
    log("================================================");

    setupErrorHandlers();

    const server = await createServer();
    await server.start();

    log("================================================");
    log("Ready to accept HTTP requests");

    setupExitHandlers(server);
  } catch (error) {
    log("Failed to start server:", error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    log("Fatal error:", error);
    process.exit(1);
  });
}
