#!/usr/bin/env node

/**
 * Token Registration Script
 * 
 * This script demonstrates how to register tokens via API calls.
 * It can be used to batch register common tokens for development or testing.
 */

import { WalletServiceMCP } from '../src/mcp/index.js';
import { createLogger } from '../src/logger/index.js';

const logger = createLogger('register-tokens');

async function registerCommonTokens() {
  try {
    const walletService = WalletServiceMCP.getInstance();
    
    // Wait for wallet to be ready
    logger.info('Waiting for wallet to be ready...');
    let attempts = 0;
    while (!walletService.isReady() && attempts < 30) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }
    
    if (!walletService.isReady()) {
      logger.error('Wallet is not ready after 30 seconds');
      process.exit(1);
    }
    
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
    const result = walletService.registerTokensBatch(commonTokens);
    
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
    const stats = walletService.getTokenRegistryStats();
    logger.info(`Token registry statistics: ${stats.totalTokens} total tokens`);
    
    // List all tokens
    const tokens = walletService.listWalletTokens();
    logger.info('All registered tokens:');
    tokens.forEach(token => {
      logger.info(`  - ${token.tokenName} (${token.symbol}): ${token.balance} - ${token.description || 'No description'}`);
    });
    
  } catch (error) {
    logger.error('Error registering tokens:', error);
    process.exit(1);
  }
}

async function registerFromEnvironment() {
  try {
    const walletService = WalletServiceMCP.getInstance();
    
    // Wait for wallet to be ready
    logger.info('Waiting for wallet to be ready...');
    let attempts = 0;
    while (!walletService.isReady() && attempts < 30) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }
    
    if (!walletService.isReady()) {
      logger.error('Wallet is not ready after 30 seconds');
      process.exit(1);
    }
    
    // Check for TOKENS environment variable
    const tokensEnv = process.env.TOKENS;
    if (!tokensEnv) {
      logger.info('No TOKENS environment variable found. Using common tokens instead.');
      await registerCommonTokens();
      return;
    }
    
    logger.info('Registering tokens from TOKENS environment variable...');
    
    // Register tokens from environment variable
    const result = walletService.registerTokensFromEnvString(tokensEnv);
    
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
    const stats = walletService.getTokenRegistryStats();
    logger.info(`Token registry statistics: ${stats.totalTokens} total tokens`);
    
  } catch (error) {
    logger.error('Error registering tokens from environment:', error);
    process.exit(1);
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

// Handle script execution
if (require.main === module) {
  main().catch(error => {
    logger.error('Script execution failed:', error);
    process.exit(1);
  });
}

export { registerCommonTokens, registerFromEnvironment };
