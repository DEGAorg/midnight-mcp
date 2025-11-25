#!/usr/bin/env node

/**
 * Token Registration Script
 *
 * Registers common tokens or tokens from environment variable using the new
 * WalletOrchestrator architecture.
 *
 * Usage:
 *   yarn register-tokens              # Register common tokens
 *   yarn register-tokens --env        # Register from TOKENS env variable
 */

import { WalletBuilder } from '@midnight-ntwrk/wallet';
import type { Wallet } from '@midnight-ntwrk/wallet-api';
import type { Resource } from '@midnight-ntwrk/wallet';
import { NetworkId, setNetworkId, getZswapNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import path from 'path';

import { WalletOrchestrator, type WalletOrchestratorConfig } from '../src/services/WalletOrchestrator.js';
import { loadConfig, getNetworkId, getWalletBackupFolder, type AppConfig } from '../src/lib/config/env.js';
import { FileManager, FileType } from '../src/lib/utils/file-manager.js';
import { SeedManager } from '../src/lib/utils/seed-manager.js';
import { createLogger } from '../src/lib/logger/index.js';

const logger = createLogger('register-tokens');

// Reset FileManager singleton before initialization
FileManager.resetInstance();

/**
 * Create wallet factory function (same pattern as stdio-server.ts)
 */
function createWalletFactory(appConfig: AppConfig): () => Promise<Wallet & Resource> {
  const { INDEXER: indexer, INDEXER_WS: indexerWS, MN_NODE: node, PROOF_SERVER: proofServer } = appConfig;
  const fileManager = FileManager.getInstance();
  const walletFilename = appConfig.WALLET_FILENAME;
  const agentId = appConfig.AGENT_ID;

  // Load seed from agent-specific storage
  const seed = SeedManager.getAgentSeed(agentId);

  return async (): Promise<Wallet & Resource> => {
    logger.info("Building wallet from seed...");

    // Try to restore wallet from file if it exists
    const formattedFilename = `${walletFilename}.json`;
    if (fileManager.fileExists(FileType.WALLET_BACKUP, appConfig.AGENT_ID, formattedFilename)) {
      logger.info(`Restoring wallet from ${formattedFilename}`);
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
        logger.info('Wallet restored from file');
        return wallet;
      } catch (error) {
        logger.info('Failed to restore wallet, building from seed:', error);
      }
    }

    // Build new wallet from seed
    logger.info('Building fresh wallet from seed');
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
    logger.info('Wallet built successfully');
    return wallet;
  };
}

/**
 * Initialize services using WalletOrchestrator
 */
async function initializeServices() {
  logger.info("Initializing services with WalletOrchestrator...");

  // Load and validate configuration from environment
  const appConfig = loadConfig();
  logger.info(`Agent ID: ${appConfig.AGENT_ID}`);
  logger.info(`Network: ${appConfig.NETWORK_ID}`);

  // Initialize SeedManager for this agent
  SeedManager.initialize(appConfig.BASE_STORAGE_DIR);
  logger.info(`SeedManager initialized with storage: ${appConfig.BASE_STORAGE_DIR}`);

  // Set network ID globally
  const networkId = getNetworkId(appConfig);
  setNetworkId(networkId);
  logger.info(`Network ID set to: ${NetworkId[networkId]}`);

  // Create wallet factory
  const walletFactory = createWalletFactory(appConfig);

  // Create WalletOrchestrator configuration
  const walletBackupFolder = getWalletBackupFolder(appConfig);
  const walletPath = path.join(walletBackupFolder, `${appConfig.WALLET_FILENAME}.json`);

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
  logger.info("Creating WalletOrchestrator...");
  const orchestrator = new WalletOrchestrator(orchestratorConfig);

  // Start all services
  logger.info("Starting orchestrator...");
  await orchestrator.start();
  logger.info("Orchestrator started successfully");

  return orchestrator;
}

async function registerCommonTokens() {
  let orchestrator: WalletOrchestrator | null = null;

  try {
    // Initialize services
    orchestrator = await initializeServices();
    const tokenService = orchestrator.getTokenService();

    logger.info('Wallet is ready, registering common tokens...');

    // Example token configurations
    const commonTokens = [
      {
        name: 'DAO_VOTING',
        symbol: 'DVT',
        contractAddress: '0x1234567890abcdef1234567890abcdef12345678',
        domainSeparator: 'dega_dao_vote',
        description: 'DAO voting token for governance'
      },
      {
        name: 'FUNDING',
        symbol: 'FUND',
        contractAddress: '0xfedcba0987654321fedcba0987654321fedcba09',
        domainSeparator: 'dega_funding_token',
        description: 'Funding token for treasury management'
      },
      {
        name: 'REWARD',
        symbol: 'REW',
        contractAddress: '0x1111111111111111111111111111111111111111',
        domainSeparator: 'reward_token',
        description: 'Reward token for incentives'
      }
    ];

    // Register tokens in batch
    const result = tokenService.registerTokensBatch(commonTokens);

    if (result.success) {
      logger.info(`Successfully registered ${result.registeredCount} tokens:`);
      result.registeredTokens.forEach(tokenName => {
        logger.info(`  - ${tokenName}`);
      });
    } else {
      logger.error('Failed to register some tokens:');
      result.errors.forEach(error => {
        logger.error(`  - ${error.token}: ${error.error}`);
      });
    }

    // Get registry statistics
    const stats = tokenService.getTokenRegistryStats();
    logger.info(`Token registry statistics: ${stats.totalTokens} total tokens`);

    // List all tokens
    const tokens = tokenService.listTokens();
    logger.info('All registered tokens:');
    tokens.forEach(token => {
      logger.info(`  - ${token.tokenName} (${token.symbol}): ${token.balance} - ${token.description || 'No description'}`);
    });

  } catch (error) {
    logger.error('Error registering tokens:', error);
    process.exit(1);
  } finally {
    // Clean up
    if (orchestrator) {
      await orchestrator.stop();
      logger.info('Services stopped');
    }
  }
}

async function registerFromEnvironment() {
  let orchestrator: WalletOrchestrator | null = null;

  try {
    // Check for TOKENS environment variable
    const tokensEnv = process.env.TOKENS;
    if (!tokensEnv) {
      logger.info('No TOKENS environment variable found. Using common tokens instead.');
      await registerCommonTokens();
      return;
    }

    // Initialize services
    orchestrator = await initializeServices();
    const tokenService = orchestrator.getTokenService();

    logger.info('Registering tokens from TOKENS environment variable...');

    // Parse tokens from environment variable
    // Expected format: TOKEN1:SYMBOL1:ADDRESS1:DOMAIN1:DESC1;TOKEN2:SYMBOL2:ADDRESS2:DOMAIN2:DESC2
    const tokenEntries = tokensEnv.split(';').filter(entry => entry.trim());
    const tokens = tokenEntries.map(entry => {
      const [name, symbol, contractAddress, domainSeparator, description] = entry.split(':');
      return { name, symbol, contractAddress, domainSeparator, description: description || '' };
    });

    // Register tokens in batch
    const result = tokenService.registerTokensBatch(tokens);

    if (result.success) {
      logger.info(`Successfully registered ${result.registeredCount} tokens from environment:`);
      result.registeredTokens.forEach(tokenName => {
        logger.info(`  - ${tokenName}`);
      });
    } else {
      logger.error('Failed to register some tokens from environment:');
      result.errors.forEach(error => {
        logger.error(`  - ${error.token}: ${error.error}`);
      });
    }

    // Get registry statistics
    const stats = tokenService.getTokenRegistryStats();
    logger.info(`Token registry statistics: ${stats.totalTokens} total tokens`);

  } catch (error) {
    logger.error('Error registering tokens from environment:', error);
    process.exit(1);
  } finally {
    // Clean up
    if (orchestrator) {
      await orchestrator.stop();
      logger.info('Services stopped');
    }
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--env') || args.includes('-e')) {
    await registerFromEnvironment();
  } else {
    await registerCommonTokens();
  }

  process.exit(0);
}

// Run the script if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    logger.error('Script execution failed:', error);
    process.exit(1);
  });
}

export { registerCommonTokens, registerFromEnvironment };
