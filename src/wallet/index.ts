import { createLogger } from '../logger/index.js';
import type { Logger } from 'pino';
import { toHex } from '@midnight-ntwrk/midnight-js-utils';
import { webcrypto } from 'crypto';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as Rx from 'rxjs';
import { DockerComposeEnvironment, Wait, type StartedDockerComposeEnvironment } from 'testcontainers';
import { setNetworkId, NetworkId, getZswapNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { nativeToken } from '@midnight-ntwrk/ledger';
import { WalletBuilder } from '@midnight-ntwrk/wallet';
import { type Wallet } from '@midnight-ntwrk/wallet-api';
import { type Resource } from '@midnight-ntwrk/wallet';
import { config } from '../config.js';

// Set up crypto for Scala.js
// @ts-expect-error: It's needed to make Scala.js and WASM code able to use cryptography
globalThis.crypto = webcrypto;

/**
 * Configuration for wallet connection to Midnight network
 */
export interface WalletConfig {
  indexer: string;
  indexerWS: string;
  node: string;
  proofServer: string;
  logDir?: string;
  networkId?: NetworkId;
  useExternalProofServer?: boolean; // Flag to indicate if we should use an external proof server
}

/**
 * Transaction history entry as available in the wallet state
 */
interface TransactionHistoryEntry {
  applyStage: string;
  deltas: Record<string, bigint>;
  identifiers: string[];
  transactionHash: string;
  transaction: { __wbg_ptr: number }; // WebAssembly pointer, not directly usable
}

const CONTAINER_NAME = 'proof-server';

/**
 * Testnet remote configuration
 */
export class TestnetRemoteConfig implements WalletConfig {
  public indexer = 'https://indexer.testnet-02.midnight.network/api/v1/graphql';
  public indexerWS = 'wss://indexer.testnet-02.midnight.network/api/v1/graphql/ws';
  public node = 'https://rpc.testnet-02.midnight.network';
  public proofServer = 'http://127.0.0.1:6300';
  public logDir: string;
  
  constructor() {
    this.logDir = path.resolve('./logs', `${new Date().toISOString()}.log`);
    setNetworkId(NetworkId.TestNet);
  }
}

/**
 * Helper function to get the current directory
 */
export const getCurrentDir = (): string => {
  return path.resolve(process.cwd());
};

/**
 * Maps container ports for Docker environment
 */
const mapContainerPort = (env: StartedDockerComposeEnvironment, url: string, containerName: string): string => {
  const mappedUrl = new URL(url);
  const container = env.getContainer(containerName);

  mappedUrl.port = String(container.getFirstMappedPort());

  return mappedUrl.toString().replace(/\/+$/, '');
};

/**
 * Helper to convert stream to string
 */
const streamToString = async (stream: NodeJS.ReadableStream): Promise<string> => {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('error', (err) => reject(err));
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
};

/**
 * WalletManager that handles wallet operations, initialization, and Docker containers
 */
export class WalletManager {
  private wallet: (Wallet & Resource) | null = null;
  private ready: boolean = false;
  private config: WalletConfig;
  private logger: Logger;
  private dockerEnv?: DockerComposeEnvironment;
  private startedEnv?: StartedDockerComposeEnvironment;
  private walletSyncSubscription?: Rx.Subscription;
  private walletInitPromise: Promise<void>;
  private walletAddress: string = '';
  private walletBalance: bigint = 0n;
  private walletFilename: string = '';
  private lastSaveTime: number = 0;
  private saveInterval: number = 5000; // Save at most every 5 seconds
  private recoveryAttempts: number = 0;
  private maxRecoveryAttempts: number = 5;
  private recoveryBackoffMs: number = 5000; // Start with 5 seconds backoff
  private walletSeed: string = '';
  private isRecovering: boolean = false;
  private syncedIndices: bigint = 0n;
  private totalIndices: bigint = 0n;
  private walletState: any = null;
  
  /**
   * Create a new WalletManager instance
   * @param networkId Optional network ID to connect to (defaults to TestNet)
   * @param seed Optional hex seed for the wallet
   * @param walletFilename Optional filename to restore wallet from
   * @param externalConfig Optional external configuration for connecting to a proof server
   */
  constructor(networkId: NetworkId, seed: string, walletFilename: string, externalConfig?: WalletConfig) {
    // Set network ID if provided, default to TestNet
    this.config = externalConfig || new TestnetRemoteConfig();
    if (networkId) {
      setNetworkId(networkId);
    }
    
    // Initialize logger
    this.logger = createLogger('wallet-manager');
    
    this.logger.info('Initializing WalletManager');
    
    // Store wallet filename and seed for recovery
    this.walletFilename = walletFilename;
    this.walletSeed = seed;
    
    // Create Docker environment only if we're not using an external proof server
    if (!externalConfig?.useExternalProofServer) {
      this.setupDockerEnvironment();
    } else {
      this.logger.info(`Using external proof server at ${this.config.proofServer}`);
    }
    
    // Initialize wallet asynchronously to not block MCP server startup
    this.walletInitPromise = this.initializeWallet(seed, this.walletFilename);
  }
  
  /**
   * Configure Docker environment for proof server
   */
  private setupDockerEnvironment(): void {
    try {
      const currentDir = getCurrentDir();
      const configDir = path.resolve(currentDir, './src/wallet/config');
      this.logger.debug('Config directory: %s', configDir);
      
      // verify the file exists
      const proofServerYml = path.resolve(configDir, 'proof-server-testnet.yml');
      this.logger.debug('Proof server YAML path: %s', proofServerYml);
      
      if (!fs.existsSync(proofServerYml)) {
        const filesInConfigDir = fs.readdirSync(configDir);
        this.logger.error('Files inside configDir:', filesInConfigDir);
        throw new Error(`Proof server YAML file not found at ${proofServerYml}`);
      }
      
      this.dockerEnv = new DockerComposeEnvironment(
        configDir,
        'proof-server-testnet.yml',
      ).withWaitStrategy(
        CONTAINER_NAME, 
        Wait.forLogMessage('Actix runtime found; starting in Actix runtime', 1)
      );
      
      this.logger.info('Docker environment configured');
    } catch (error) {
      this.logger.error('Failed to configure Docker environment', error);
    }
  }
  
  /**
   * Initialize wallet by starting Docker and configuring wallet
   */
  private async initializeWallet(seed: string, walletFilename?: string): Promise<void> {
    try {
      // Start Docker environment if not using external proof server
      if (this.dockerEnv && !this.config.useExternalProofServer) {
        this.logger.info('Starting Docker environment');
        this.startedEnv = await this.dockerEnv.up();
        
        // Update config with mapped ports
        this.config.proofServer = mapContainerPort(
          this.startedEnv, 
          this.config.proofServer, 
          CONTAINER_NAME
        );
        
        this.logger.info(`Docker environment started, proof server at ${this.config.proofServer}`);
      } else if (this.config.useExternalProofServer) {
        this.logger.info(`Using external proof server at ${this.config.proofServer}`);
      }
      
      // Generate a random seed if not provided
      const finalFilename = walletFilename || '';
      
      // Initialize wallet
      try {
        this.wallet = await this.buildWalletFromSeed(seed, finalFilename);
        
        if (this.wallet) {
          // Subscribe to wallet state changes with error recovery
          this.setupWalletSubscription();
          
          this.logger.info('Wallet initialized successfully, syncing in progress');
        } else {
          this.logger.error('Failed to initialize wallet, wallet instance is null');
        }
      } catch (error) {
        this.logger.error('Failed to initialize wallet', error);
      }
    } catch (error) {
      this.logger.error('Error during wallet initialization process', error);
    }
  }
  
  /**
   * Sets up the wallet subscription with error handling and recovery
   */
  private setupWalletSubscription(): void {
    if (!this.wallet) {
      this.logger.error('Cannot setup subscription: wallet is null');
      return;
    }
    
    // Clean up existing subscription if it exists
    if (this.walletSyncSubscription) {
      this.walletSyncSubscription.unsubscribe();
    }
    
    this.walletSyncSubscription = this.wallet.state().subscribe({
      next: async (state) => {
        try {
          // Store the entire wallet state for later use
          this.walletState = state;
          
          // Reset recovery attempts on successful state update
          this.recoveryAttempts = 0;
          this.recoveryBackoffMs = 5000; // Reset backoff time
          
          // Get indices sync status from the wallet state
          const synced = state.syncProgress?.synced ?? 0n;
          const total = state.syncProgress?.total ?? 0n;
          
          // Update wallet information
          this.walletAddress = state.address || '';
          this.walletBalance = state.balances[nativeToken()] ?? 0n;
          this.syncedIndices = synced;
          this.totalIndices = total;
          
          // Check if wallet is fully synced
          if (total > 0n && synced === total) {
            if (!this.ready) {
              this.ready = true;
              this.logger.info('Wallet is fully synced and ready!');
              this.logger.info(`Wallet address: ${this.walletAddress}`);
              this.logger.info(`Wallet balance: ${this.walletBalance}`);
              
              // Save the fully synced wallet state
              await this.saveWalletToFile(this.walletFilename);
            }
          } else {
            this.logger.info(`Wallet syncing: ${synced}/${total}`);
            
            // Throttle save operations to avoid excessive file writes
            const now = Date.now();
            if (now - this.lastSaveTime >= this.saveInterval) {
              this.lastSaveTime = now;
              // Save wallet state during sync with incremental progress
              await this.saveWalletToFile(this.walletFilename);
            }
          }
        } catch (error) {
          this.logger.error('Error processing wallet state update', error);
          this.attemptWalletRecovery('State processing error');
        }
      },
      error: (err) => {
        this.logger.error(`Wallet state subscription error: ${err}`);
        this.attemptWalletRecovery('Subscription error');
      },
      complete: () => {
        this.logger.warn('Wallet state subscription completed unexpectedly');
        this.attemptWalletRecovery('Subscription completed');
      }
    });
  }
  
  /**
   * Attempts to recover the wallet after an error
   * @param reason Reason for recovery attempt
   */
  private async attemptWalletRecovery(reason: string): Promise<void> {
    // Prevent multiple recovery attempts running concurrently
    if (this.isRecovering) {
      this.logger.info('Recovery already in progress, skipping new attempt');
      return;
    }
    
    this.isRecovering = true;
    
    try {
      this.recoveryAttempts++;
      this.ready = false; // Mark wallet as not ready during recovery
      
      // Reset synchronization metrics during recovery
      this.syncedIndices = 0n;
      this.totalIndices = 0n;
      
      this.logger.warn(`Attempting wallet recovery (${this.recoveryAttempts}/${this.maxRecoveryAttempts}). Reason: ${reason}`);
      
      // Check if we've exceeded max recovery attempts
      if (this.recoveryAttempts > this.maxRecoveryAttempts) {
        this.logger.error(`Max recovery attempts (${this.maxRecoveryAttempts}) exceeded. Wallet may need manual intervention.`);
        return;
      }
      
      // Unsubscribe from current subscription
      if (this.walletSyncSubscription) {
        this.walletSyncSubscription.unsubscribe();
        this.walletSyncSubscription = undefined;
      }
      
      // Try to save current wallet state if possible
      if (this.wallet) {
        try {
          await this.saveWalletToFile(this.walletFilename);
          this.logger.info('Successfully saved wallet state before recovery');
        } catch (saveError) {
          this.logger.warn('Failed to save wallet state before recovery', saveError);
        }
        
        // Close the current wallet
        try {
          await this.wallet.close();
          this.logger.info('Successfully closed wallet for recovery');
        } catch (closeError) {
          this.logger.warn('Error closing wallet during recovery', closeError);
        }
        
        this.wallet = null;
      }
      
      // Apply exponential backoff before reconnecting
      const backoffTime = Math.min(this.recoveryBackoffMs * Math.pow(1.5, this.recoveryAttempts - 1), 60000); // Max 1 minute
      this.logger.info(`Waiting ${backoffTime}ms before attempting recovery`);
      
      await new Promise(resolve => setTimeout(resolve, backoffTime));
      
      // Attempt to rebuild the wallet
      try {
        this.wallet = await this.buildWalletFromSeed(this.walletSeed, this.walletFilename);
        
        if (this.wallet) {
          this.setupWalletSubscription();
          this.logger.info('Wallet recovered successfully');
        } else {
          this.logger.error('Failed to rebuild wallet during recovery');
        }
      } catch (rebuildError) {
        this.logger.error('Error rebuilding wallet during recovery', rebuildError);
        
        // Schedule another recovery attempt with backoff if we haven't exceeded max attempts
        if (this.recoveryAttempts < this.maxRecoveryAttempts) {
          this.recoveryBackoffMs = Math.min(this.recoveryBackoffMs * 2, 60000); // Double backoff time, max 1 minute
          this.logger.info(`Scheduling another recovery attempt in ${this.recoveryBackoffMs}ms`);
          
          setTimeout(() => {
            this.isRecovering = false;
            this.attemptWalletRecovery('Previous recovery failed');
          }, this.recoveryBackoffMs);
        }
      }
    } finally {
      this.isRecovering = false;
    }
  }
  
  /**
   * Build wallet from seed and optionally restore from file
   */
  private async buildWalletFromSeed(seed: string, filename: string): Promise<Wallet & Resource> {
    const { indexer, indexerWS, node, proofServer } = this.config;
    let wallet: Wallet & Resource;

    // Store the filename for future saves
    if (filename) {
      this.walletFilename = filename;
    }

    const formattedFilename = `${filename}.json`;
    
    // Try to restore wallet from file if filename is provided
    if (filename && fs.existsSync(`${config.walletBackupFolder}/${formattedFilename}`)) {
      this.logger.info(`Attempting to restore wallet from ${config.walletBackupFolder}/${formattedFilename}`);
      try {
        const serializedStream = fs.createReadStream(`${config.walletBackupFolder}/${formattedFilename}`, 'utf-8');
        const serialized = await streamToString(serializedStream);
        serializedStream.on('finish', () => {
          serializedStream.close();
        });
        
        const cleanSerialized = serialized.trim().startsWith('"') 
          ? JSON.parse(serialized) 
          : serialized;
        
        // Restore wallet from serialized state
        this.logger.info(`Restoring wallet with seed: ${seed}`);
        wallet = await WalletBuilder.restore(
          indexer, 
          indexerWS, 
          proofServer, 
          node, 
          seed, 
          cleanSerialized, 
          'info'
        );
        
        wallet.start();
        this.logger.info('Wallet restored from file and started');
      } catch (error) {
        this.logger.warn('Failed to restore wallet, building from seed', error);
        wallet = await WalletBuilder.buildFromSeed(
          indexer,
          indexerWS,
          proofServer,
          node,
          seed,
          getZswapNetworkId(),
          'info'
        );
        wallet.start();
      }
    } else {
      // Build new wallet from seed
      this.logger.info('Building fresh wallet from seed');
      wallet = await WalletBuilder.buildFromSeed(
        indexer,
        indexerWS,
        proofServer,
        node,
        seed,
        getZswapNetworkId(),
        'info'
      );
      wallet.start();
    }
    
    return wallet;
  }
  
  /**
   * Check if the wallet is ready for operations
   * @param withDetails Whether to return detailed status information
   * @returns true if wallet is synced and ready, or status object if withDetails is true
   */
  public isReady(withDetails: boolean = false): boolean | { 
    ready: boolean; 
    recovering: boolean; 
    recoveryAttempts: number;
    synced?: bigint;
    total?: bigint; 
  } {
    if (withDetails) {
      return {
        ready: this.ready,
        recovering: this.isRecovering,
        recoveryAttempts: this.recoveryAttempts,
        synced: this.syncedIndices,
        total: this.totalIndices
      };
    }
    
    return this.ready;
  }
  
  /**
   * Get the wallet's address
   * @returns The wallet address as a string
   * @throws Error if wallet is not ready
   */
  public getAddress(): string {
    if (!this.ready) throw new Error('Wallet not ready');
    return this.walletAddress;
  }
  
  /**
   * Get the wallet's current balance
   * @returns The wallet balance as a bigint
   * @throws Error if wallet is not ready
   */
  public getBalance(): bigint {
    if (!this.ready) throw new Error('Wallet not ready');
    return this.walletBalance;
  }
  
  /**
   * Send funds to the specified destination address
   * @param to Address to send the funds to
   * @param amount Amount of funds to send
   * @returns Transaction result with hash and sync status
   * @throws Error if wallet is not ready
   */
  public async sendFunds(to: string, amount: bigint): Promise<{
    txHash: string;
    syncedIndices: bigint;
    totalIndices: bigint;
    isFullySynced: boolean;
  }> {
    if (!this.ready) throw new Error('Wallet not ready');
    if (!this.wallet) throw new Error('Wallet instance not available');
    
    try {
      // Create a transfer transaction
      const transferRecipe = await this.wallet.transferTransaction([
        {
          amount: amount,
          type: nativeToken(),
          receiverAddress: to
        }
      ]);
      
      // Prove and submit the transaction
      const provenTransaction = await this.wallet.proveTransaction(transferRecipe);
      const submittedTransaction = await this.wallet.submitTransaction(provenTransaction);
      
      this.logger.info(`Transaction submitted: ${submittedTransaction}`);
      
      return {
        txHash: submittedTransaction,
        syncedIndices: this.syncedIndices,
        totalIndices: this.totalIndices,
        isFullySynced: this.totalIndices > 0n && this.syncedIndices === this.totalIndices
      };
    } catch (error) {
      this.logger.error('Failed to send funds', error);
      throw error;
    }
  }
  
  /**
   * Save wallet state to file
   * @param filename Optional filename to save to
   * @returns path to saved file
   */
  public async saveWalletToFile(filename?: string): Promise<string | null> {
    if (!this.wallet) {
      this.logger.error('Cannot save wallet: wallet not initialized');
      return null;
    }
    
    try {
      const directoryPath = path.resolve(config.walletBackupFolder);
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(directoryPath)) {
        fs.mkdirSync(directoryPath, { recursive: true, mode: 0o755 });
        this.logger.info(`Created directory: ${directoryPath}`);
      }
      
      // Use provided filename or use the one stored in the class
      const walletFilename = filename || this.walletFilename || `wallet-${Date.now()}`;
      const filePath = path.join(directoryPath, `${walletFilename}.json`);
      
      this.logger.info(`Saving wallet to file ${filePath}`);
      const walletJson = await this.wallet.serializeState();
      fs.writeFileSync(filePath, walletJson, { mode: 0o644 });
      this.logger.info(`Wallet saved to ${filePath}`);
      return filePath;
    } catch (error) {
      this.logger.error(`Failed to save wallet: ${error}`);
      return null;
    }
  }
  
  /**
   * Close the wallet manager, shutting down wallet and Docker
   */
  public async close(): Promise<void> {
    try {
      // Save wallet state before closing
      if (this.wallet) {
        try {
          await this.saveWalletToFile(this.walletFilename);
          this.logger.info('Wallet state saved before shutdown');
        } catch (saveError) {
          this.logger.warn('Could not save wallet before shutdown', saveError);
        }
      }
      
      // Unsubscribe from wallet state updates
      if (this.walletSyncSubscription) {
        this.walletSyncSubscription.unsubscribe();
      }
      
      // Close wallet
      if (this.wallet) {
        await this.wallet.close();
        this.logger.info('Wallet closed successfully');
      }
      
      // Shutdown Docker environment only if we started it
      if (this.startedEnv && !this.config.useExternalProofServer) {
        await this.startedEnv.down();
        this.logger.info('Docker environment shut down successfully');
      }
    } catch (error) {
      this.logger.error('Error during shutdown', error);
      throw error;
    }
  }

  /**
   * Manually triggers wallet recovery
   * Useful when external systems detect issues with the wallet
   * @returns Promise that resolves when recovery attempt is complete
   */
  public async recoverWallet(): Promise<void> {
    this.logger.info('Manual wallet recovery triggered');
    await this.attemptWalletRecovery('Manual recovery request');
    
    // Wait a bit to let the recovery process start
    return new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Verifies if the wallet has received a transaction with the specified identifier
   * 
   * @param identifier The transaction identifier to look for
   * @returns Object containing verification result and current sync status
   * @throws Error if wallet is not ready or not initialized
   */
  public hasReceivedTransactionByIdentifier(identifier: string): { 
    exists: boolean; 
    syncedIndices: bigint; 
    totalIndices: bigint;
    isFullySynced: boolean;
  } {
    if (!this.ready) throw new Error('Wallet not ready');
    if (!this.wallet) throw new Error('Wallet instance not available');
    
    try {
      // Use the stored wallet state to check transaction history
      if (!this.walletState || !this.walletState.transactionHistory || !Array.isArray(this.walletState.transactionHistory)) {
        this.logger.warn('Transaction history not available in stored wallet state');
        return {
          exists: false, 
          syncedIndices: this.syncedIndices, 
          totalIndices: this.totalIndices,
          isFullySynced: this.totalIndices > 0n && this.syncedIndices === this.totalIndices
        };
      }
      
      // Check if any transaction contains the identifier
      const exists = this.walletState.transactionHistory.some((tx: TransactionHistoryEntry) => 
        Array.isArray(tx.identifiers) && tx.identifiers.includes(identifier)
      );
      
      return {
        exists,
        syncedIndices: this.syncedIndices,
        totalIndices: this.totalIndices,
        isFullySynced: this.totalIndices > 0n && this.syncedIndices === this.totalIndices
      };
    } catch (error) {
      this.logger.error(`Error verifying transaction receipt: ${error}`);
      throw error;
    }
  }
}

export default WalletManager;
  