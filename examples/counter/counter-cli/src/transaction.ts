import { type Resource } from '@midnight-ntwrk/wallet';
import { type Wallet } from '@midnight-ntwrk/wallet-api';
import { stdin as input, stdout as output } from 'node:process';
import { createInterface, type Interface } from 'node:readline/promises';
import { type Logger } from 'pino';
import { type StartedDockerComposeEnvironment, type DockerComposeEnvironment } from 'testcontainers';
import { type Config, StandaloneConfig } from './config.js';
import * as api from './api.js';
import { randomBytes } from 'crypto';
import { toHex } from '@midnight-ntwrk/midnight-js-utils';
import { nativeToken } from '@midnight-ntwrk/ledger';
import * as Rx from 'rxjs';
import path from 'node:path';
import * as fs from 'node:fs';

let logger: Logger;

/**
 * This seed gives access to tokens minted in the genesis block of a local development node - only
 * used in standalone networks to build a wallet with initial funds.
 */
const GENESIS_MINT_WALLET_SEED = '0000000000000000000000000000000000000000000000000000000000000001';

/**
 * Mock function to transfer native assets
 * This will be replaced with the actual implementation
 */
const transferNativeAsset = async (wallet: Wallet, recipientAddress: string, amount: bigint): Promise<void> => {
  // This is a placeholder - you should implement the actual transaction logic here
  logger.info(`Initiating transfer of ${amount} native tokens to ${recipientAddress}`);
  
  // Mock delay to simulate transaction processing
//   await new Promise(resolve => setTimeout(resolve, 2000));
 const transferRecipe = await wallet.transferTransaction([
    {
      amount: amount,
      type: nativeToken(),
      receiverAddress: recipientAddress
    }
  ])
  const provenTransaction = await wallet.proveTransaction(transferRecipe);
  const submittedTransaction = await wallet.submitTransaction(provenTransaction);

  console.log('Transaction submitted:', submittedTransaction);
  logger.info(`Transfer complete! Transaction ID: ${submittedTransaction}`);
};

/**
 * Get wallet balance
 */
const getWalletBalance = async (wallet: Wallet): Promise<bigint> => {
  const state = await Rx.firstValueFrom(wallet.state());
  return state.balances[nativeToken()] ?? 0n;
};

/**
 * Display wallet information
 */
const displayWalletInfo = async (wallet: Wallet): Promise<void> => {
  const state = await Rx.firstValueFrom(wallet.state());
  logger.info(`Wallet address: ${state.address}`);
  const balance = state.balances[nativeToken()] ?? 0n;
  logger.info(`Wallet balance: ${balance} tokens`);
};

/**
 * Main transaction loop
 */
const transactionLoop = async (wallet: Wallet & Resource, rli: Interface): Promise<void> => {
  while (true) {
    const TRANSACTION_OPTIONS = `
You can do one of the following:
  1. Make a native asset transfer
  2. Display wallet information
  3. Save wallet to file
  4. Exit
Which would you like to do? `;

    const choice = await rli.question(TRANSACTION_OPTIONS);
    
    switch (choice) {
      case '1': {
        const balance = await getWalletBalance(wallet);
        if (balance <= 0n) {
          logger.error('Insufficient balance for transfer');
          break;
        }
        
        const recipientAddress = await rli.question('Enter recipient address: ');
        if (!recipientAddress) {
          logger.error('Invalid recipient address');
          break;
        }
        
        const amountStr = await rli.question(`Enter amount to transfer (available: ${balance}): `);
        try {
          const amount = BigInt(amountStr);
          if (amount <= 0n) {
            logger.error('Amount must be greater than 0');
            break;
          }
          if (amount > balance) {
            logger.error('Amount exceeds available balance');
            break;
          }
          
          await transferNativeAsset(wallet, recipientAddress, amount);
        } catch (error) {
          logger.error(`Invalid amount: ${error instanceof Error ? error.message : String(error)}`);
        }
        break;
      }
      case '2':
        await displayWalletInfo(wallet);
        break;
      case '3': {
        const customFilename = await rli.question('Enter filename for this save (leave empty to use previous name): ');
        // If custom filename provided, use it instead of the original one
        await saveWalletToFile(wallet, customFilename || '');
        break;
      }
      case '4':
        logger.info('Exiting transaction loop...');
        return;
      default:
        logger.error(`Invalid choice: ${choice}`);
    }
  }
};

/**
 * Build a wallet from a seed
 */
const buildWalletFromSeed = async (config: Config, rli: Interface): Promise<Wallet & Resource> => {
  const seed = await rli.question('Enter your wallet seed: ');
  const finalSeed = seed.trim() === '' ? "6206f1dea1553e6551755ba9341e366c94e9d1dbe5d705e9af4a05d3cb322a3b" : seed;
  return await api.buildWalletAndWaitForFunds(config, finalSeed, '');
};

// build wallet from file
const buildWalletFromFile = async (config: Config, rli: Interface): Promise<Wallet & Resource> => {
  const seed = await rli.question('Enter your wallet seed: ');
  const finalSeed = seed.trim() === '' ? "6206f1dea1553e6551755ba9341e366c94e9d1dbe5d705e9af4a05d3cb322a3b" : seed;
  const filename = await rli.question('Enter your wallet filename: ');
  const finalFilename = filename.trim() === '' ? "second.json" : filename;
  return await api.buildWalletAndWaitForFunds(config, finalSeed, finalFilename);
};

/**
 * Build wallet menu
 */
const WALLET_OPTIONS = `
You can do one of the following:
  1. Build a fresh wallet
  2. Build wallet from a seed
  3. Build wallet from a file
  4. Exit
Which would you like to do? `;

/**
 * Wallet initialization function
 */
const initializeWallet = async (config: Config, rli: Interface): Promise<(Wallet & Resource) | null> => {
  if (config instanceof StandaloneConfig) {
    return await api.buildWalletAndWaitForFunds(config, GENESIS_MINT_WALLET_SEED, '');
  }
  
  while (true) {
    const choice = await rli.question(WALLET_OPTIONS);
    switch (choice) {
      case '1':
        return await api.buildFreshWallet(config);
      case '2':
        return await buildWalletFromSeed(config, rli);
      case '3':
        return await buildWalletFromFile(config, rli);
      case '4':
        logger.info('Exiting...');
        return null;
      default:
        logger.error(`Invalid choice: ${choice}`);
    }
  }
};

/**
 * Maps container ports for Docker environment
 */
const mapContainerPort = (env: StartedDockerComposeEnvironment, url: string, containerName: string) => {
  const mappedUrl = new URL(url);
  const container = env.getContainer(containerName);

  mappedUrl.port = String(container.getFirstMappedPort());

  return mappedUrl.toString().replace(/\/+$/, '');
};

// Track the last used filename to allow reusing it
let lastUsedFilename = '';

// save wallet to file
const saveWalletToFile = async (wallet: Wallet & Resource, filename: string): Promise<string> => {
  try {
    const directoryPath = path.resolve('./files');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(directoryPath)) {
      fs.mkdirSync(directoryPath, { recursive: true, mode: 0o755 });
      logger.info(`Created directory: ${directoryPath}`);
    }
    
    // Use provided filename, or last used filename, or generate a default one
    const walletFilename = filename.trim() || lastUsedFilename || `wallet-new`;
    lastUsedFilename = walletFilename;
    
    const filePath = path.join(directoryPath, `${walletFilename}.json`);
    
    logger.info(`Saving wallet to file ${walletFilename}`);
    const walletJson = await wallet.serializeState();
    // The walletJson is already a string, so write it directly to the file
    fs.writeFileSync(filePath, walletJson, { mode: 0o644 });
    logger.info(`Wallet saved to ${filePath}`);
    return filePath;
  } catch (error) {
    logger.error(`Failed to save wallet: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
};

/**
 * Auto-save wallet when state changes
 */
const setupAutoSave = (wallet: Wallet & Resource, filename: string): () => void => {
  let lastSaveTime = 0;
  const SAVE_THROTTLE_MS = 10000; // Throttle saves to once per 10 seconds
  let previousSynced = 0n;
  let previousTotal = 0n;
  
  // Subscribe to wallet state changes
  const subscription = wallet.state().subscribe({
    next: async (state) => {
      const now = Date.now();
      // Get indices sync status from the wallet state
      const synced = state.syncProgress?.synced ?? 0n;
      const total = state.syncProgress?.total ?? 0n;
      
      // Log sync progress if changed
      if (synced !== previousSynced || total !== previousTotal) {
        logger.info(`Wallet processed ${synced} indices out of ${total}, transactions=${state.transactionHistory?.length || 0}`);
        previousSynced = synced;
        previousTotal = total;
      }
      
      // Save wallet if it's been a while since the last save or if sync is complete
      const isFullySynced = total > 0n && synced === total;
      const shouldSaveNow = isFullySynced || (now - lastSaveTime > SAVE_THROTTLE_MS);
      
      if (shouldSaveNow) {
        try {
          await saveWalletToFile(wallet, filename);
          lastSaveTime = now;
          
          if (isFullySynced) {
            logger.info('Wallet is fully synced!');
            const balance = state.balances[nativeToken()] ?? 0n;
            logger.info(`Your wallet balance is: ${balance}`);
          }
        } catch (error) {
          logger.error(`Auto-save failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    },
    error: (err) => {
      logger.error(`Wallet state subscription error: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  
  // Return a function to unsubscribe
  return () => subscription.unsubscribe();
};

/**
 * Main entry point function
 */
export const run = async (config: Config, _logger: Logger, dockerEnv?: DockerComposeEnvironment): Promise<void> => {
  logger = _logger;
  api.setLogger(_logger);
  
  const rli = createInterface({ input, output, terminal: true });
  let env;
  let walletFilename = '';
  let unsubscribeAutoSave: (() => void) | undefined;
  let wallet: (Wallet & Resource) | null = null;
  
  try {
    // Ask for wallet filename at the start
    walletFilename = await rli.question('Enter your wallet filename (leave empty for auto-generated name): ');
    
    if (dockerEnv !== undefined) {
      env = await dockerEnv.up();

      if (config instanceof StandaloneConfig) {
        config.indexer = mapContainerPort(env, config.indexer, 'counter-indexer');
        config.indexerWS = mapContainerPort(env, config.indexerWS, 'counter-indexer');
        config.node = mapContainerPort(env, config.node, 'counter-node');
        config.proofServer = mapContainerPort(env, config.proofServer, 'counter-proof-server');
      }
    }
    
    logger.info('Initializing wallet...');
    wallet = await initializeWallet(config, rli);
    
    if (wallet !== null) {
      logger.info('Wallet initialized successfully!');
      
      // Set up auto-save when wallet state changes
      unsubscribeAutoSave = setupAutoSave(wallet, walletFilename);
      
      // Initial save
      await saveWalletToFile(wallet, walletFilename);
      
      await transactionLoop(wallet, rli);
    }
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`Error: ${error.message}`);
      logger.debug(`${error.stack}`);
    } else {
      throw error;
    }
  } finally {
    // Clean up subscription if it exists
    if (unsubscribeAutoSave) {
      unsubscribeAutoSave();
    }
    
    // Close wallet resources
    if (wallet) {
      try {
        await wallet.close();
        logger.info('Wallet closed successfully');
      } catch (e) {
        logger.error(`Error closing wallet: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    
    try {
      rli.close();
      rli.removeAllListeners();
    } catch (e) {
      // Ignore errors on readline interface cleanup
    } finally {
      try {
        if (env !== undefined) {
          await env.down();
          logger.info('Goodbye');
        }
      } catch (e) {
        // Ignore errors on Docker environment cleanup
      }
    }
  }
};
