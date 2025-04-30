import { createLogger } from '../logger/index.js';
import type { Logger } from 'pino';
import { toHex } from '@midnight-ntwrk/midnight-js-utils';
import { webcrypto } from 'crypto';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as Rx from 'rxjs';
// Remove direct import of testcontainers
// import { DockerComposeEnvironment, Wait, type StartedDockerComposeEnvironment } from 'testcontainers';
import { setNetworkId, NetworkId, getZswapNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { nativeToken } from '@midnight-ntwrk/ledger';
import { WalletBuilder } from '@midnight-ntwrk/wallet';
import { type Wallet } from '@midnight-ntwrk/wallet-api';
import { type Resource } from '@midnight-ntwrk/wallet';
import { config } from '../config.js';
import { convertBigIntToDecimal, convertDecimalToBigInt } from './utils.js';
import { 
  WalletStatus, 
  WalletBalances, 
  SendFundsResult, 
  TransactionVerificationResult,
  TransactionState,
  TransactionRecord,
  InitiateTransactionResult, 
  TransactionStatusResult
} from '../types/wallet.js';
import { TransactionDatabase } from './db/TransactionDatabase.js';

// Set up crypto for Scala.js
// @ts-expect-error: It's needed to make Scala.js and WASM code able to use cryptography
globalThis.crypto = webcrypto;

// Define necessary types for testcontainers to keep TypeScript happy
// These will be used only for type annotations, not in runtime
interface DockerContainer {
  getFirstMappedPort(): number;
}

interface StartedDockerComposeEnvironment {
  getContainer(containerName: string): DockerContainer;
  down(): Promise<void>;
}

interface DockerComposeEnvironment {
  withWaitStrategy(containerName: string, waitStrategy: any): DockerComposeEnvironment;
  up(): Promise<StartedDockerComposeEnvironment>;
}

// Flag to check if we're in development or production
const isDevelopment = process.env.NODE_ENV !== 'production';

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

// Internal wallet balances interface for type safety (using bigint for calculations)
interface InternalWalletBalances {
  // The total spendable balance in the wallet
  balance: bigint;
  // Coins that are pending and not yet available for spending
  pendingBalance: bigint;
}

/**
 * WalletManager that handles wallet operations, initialization, and Docker containers
 */
export class WalletManager {
  private wallet: (Wallet & Resource) | null = null;
  private ready: boolean = false;
  private config: WalletConfig;
  private logger: Logger;
  private dockerEnv?: any; // Use any for now, will be assigned proper type at runtime
  private startedEnv?: StartedDockerComposeEnvironment;
  private walletSyncSubscription?: Rx.Subscription;
  private walletInitPromise: Promise<void>;
  private walletAddress: string = '';
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
  
  // Transaction tracking
  private transactionDb: TransactionDatabase;
  private transactionPoller?: NodeJS.Timeout;
  private pollingInterval: number = 15000; // Poll for completed transactions every 15 seconds
  
  // Track different balance types for the wallet (using bigint internally)
  private walletBalances: InternalWalletBalances = {
    balance: 0n,
    pendingBalance: 0n
  };
  
  /**
   * Create a new WalletManager instance
   * @param networkId Optional network ID to connect to (defaults to TestNet)
   * @param seed Optional hex seed for the wallet
   * @param walletFilename Optional filename to restore wallet from
   * @param externalConfig Optional external configuration for connecting to a proof server
   */
  constructor(networkId: NetworkId, seed: string, walletFilename: string, externalConfig?: WalletConfig) {
    this.logger = createLogger('wallet-manager');
    // Set network ID if provided, default to TestNet
    this.logger.info('Initializing WalletManager with networkId: %s, walletFilename: %s, externalConfig: %s', networkId, walletFilename, externalConfig?.useExternalProofServer);
    this.config = externalConfig || new TestnetRemoteConfig();
    if (networkId) {
      setNetworkId(networkId);
    }
    
    // Initialize logger
    
    this.logger.info('Initializing WalletManager');
    
    // Store wallet filename and seed for recovery
    this.walletFilename = walletFilename;
    this.walletSeed = seed;
    
    // Initialize the transaction database
    const dbPath = path.join(config.walletBackupFolder, `${walletFilename}-transactions.db`);
    this.transactionDb = new TransactionDatabase(dbPath);
    this.logger.info(`Transaction database initialized at ${dbPath}`);
    
    // Initialize wallet asynchronously to not block MCP server startup
    // Properly chain the async operations
    this.walletInitPromise = this.initWalletWithProperSetup(seed, walletFilename, externalConfig);
    
    // Start transaction status poller when wallet is ready
    this.walletInitPromise.then(() => {
      this.startTransactionPoller();
    }).catch(err => {
      this.logger.error('Failed to start transaction poller due to wallet init error', err);
    });
  }
  
  /**
   * Private method to handle the proper setup sequence
   * This ensures Docker environment is fully set up before wallet initialization
   */
  private async initWalletWithProperSetup(seed: string, walletFilename: string, externalConfig?: WalletConfig): Promise<void> {
    try {
      // Handle Docker environment setup first if needed
      if (!externalConfig?.useExternalProofServer && isDevelopment) {
        this.logger.info('Setting up Docker environment, using internal proof server');
        try {
          await this.setupDockerEnvironment();
          this.logger.info('Docker environment setup completed successfully');
        } catch (dockerSetupError) {
          this.logger.error('Failed to set up Docker environment', dockerSetupError);
          throw new Error('Docker environment setup failed. Wallet initialization cannot proceed.');
        }
      } else if (externalConfig?.useExternalProofServer) {
        this.logger.info(`Using external proof server at ${this.config.proofServer}`);
      } else if (!isDevelopment) {
        this.logger.info('Running in production mode, skipping Docker environment setup. External proof server must be configured.');
        // In production, ensure we have an external proof server if Docker can't be used
        if (!externalConfig?.useExternalProofServer) {
          this.logger.warn('WARNING: Running in production without external proof server configuration.');
        }
      }
      
      // Now that environment is properly set up, initialize the wallet
      try {
        await this.initializeWallet(seed, walletFilename);
        this.logger.info('Wallet initialization sequence completed');
      } catch (walletInitError: unknown) {
        this.logger.error('Failed to initialize wallet', walletInitError);
        // Rethrow with a clearer message
        throw new Error(`Wallet initialization failed: ${walletInitError instanceof Error ? walletInitError.message : 'Unknown error'}`);
      }
    } catch (error) {
      this.logger.error('Critical error during wallet setup process', error);
      // Keep track of the setup failure to allow checking the state later
      this.isRecovering = true;
      this.recoveryAttempts += 1;
      throw error; // Propagate error for higher-level handling
    }
  }
  
  /**
   * Configure Docker environment for proof server
   */
  private async setupDockerEnvironment(): Promise<void> {
    try {
      // Skip setup in production
      if (!isDevelopment) {
        this.logger.info('Skipping Docker environment setup in production mode');
        return;
      }
      
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
      
      try {
        // Dynamically import testcontainers only in development mode
        const { DockerComposeEnvironment, Wait } = await import('testcontainers');
        
        this.dockerEnv = new DockerComposeEnvironment(
          configDir,
          'proof-server-testnet.yml',
        ).withWaitStrategy(
          CONTAINER_NAME, 
          Wait.forLogMessage('Actix runtime found; starting in Actix runtime', 1)
        );
        
        this.logger.info('Docker environment configured');
      } catch (importError) {
        this.logger.error('Failed to import testcontainers', importError);
        throw new Error('Failed to import testcontainers. Make sure it is installed as a development dependency.');
      }
    } catch (error) {
      this.logger.error('Failed to configure Docker environment', error);
    }
  }
  
  /**
   * Initialize wallet by starting Docker and configuring wallet
   */
  private async initializeWallet(seed: string, walletFilename?: string): Promise<void> {
    try {
      // Start Docker environment if not using external proof server and in development mode
      if (this.dockerEnv && !this.config.useExternalProofServer && isDevelopment) {
        this.logger.info('Starting Docker environment');
        try {
          this.startedEnv = await this.dockerEnv.up();
          
          // Update config with mapped ports
          if (this.startedEnv) {
            this.config.proofServer = mapContainerPort(
              this.startedEnv, 
              this.config.proofServer, 
              CONTAINER_NAME
            );
            
            this.logger.info(`Docker environment started, proof server at ${this.config.proofServer}`);
          } else {
            this.logger.error('Docker environment started but startedEnv is undefined');
          }
        } catch (dockerError) {
          this.logger.error('Failed to start Docker environment', dockerError);
          throw new Error('Failed to start Docker environment. If running in production, configure an external proof server.');
        }
      } else if (this.config.useExternalProofServer) {
        this.logger.info(`Using external proof server at ${this.config.proofServer}`);
      } else if (!isDevelopment) {
        this.logger.info('Running in production mode without Docker, using configured proof server');
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
          
          // Update wallet balances with detailed information - keep these as bigint internally
          const nativeBalance = state.balances[nativeToken()] ?? 0n;
          const pendingBalance = state.pendingCoins.filter(coin => coin.type === nativeToken()).reduce((acc, coin) => acc + coin.value, 0n);
          
          // Store all balance types as bigint internally for calculations
          this.walletBalances = {
            balance: nativeBalance,
            pendingBalance: pendingBalance
          };
          
          // Log balances in human-readable format
          // this.logger.info(`Native balance: ${convertBigIntToDecimal(nativeBalance)}`);
          // this.logger.info(`Pending balance: ${convertBigIntToDecimal(pendingBalance)}`);
          
          this.syncedIndices = synced;
          this.totalIndices = total;
          
          // Check if wallet is fully synced
          if (total > 0n && synced === total) {
            if (!this.ready) {
              this.ready = true;
              this.logger.info('Wallet is fully synced and ready!');
              this.logger.info(`Wallet address: ${this.walletAddress}`);
              this.logger.info(`Wallet balance: ${convertBigIntToDecimal(this.walletBalances.balance)}`);
              
              // Save the fully synced wallet state
              await this.saveWalletToFile(this.walletFilename);
            }
          } else {
            // this.logger.info(`Wallet syncing: ${synced}/${total}`);
            
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
    synced?: string;
    total?: string; 
  } {
    if (withDetails) {
      return {
        ready: this.ready,
        recovering: this.isRecovering,
        recoveryAttempts: this.recoveryAttempts,
        synced: this.syncedIndices.toString(),
        total: this.totalIndices.toString()
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
    return this.walletAddress;
  }
  
  /**
   * Get the wallet's current balance with detailed breakdown
   * @returns An object containing different balance types with dust amounts as strings
   * @throws Error if wallet is not ready
   */
  public getBalance(): WalletBalances {
    if (!this.ready) throw new Error('Wallet not ready');
    
    return {
      balance: convertBigIntToDecimal(this.walletBalances.balance),
      pendingBalance: convertBigIntToDecimal(this.walletBalances.pendingBalance)
    };
  }
  
  /**
   * Send funds to the specified destination address
   * @param to Address to send the funds to
   * @param amount Amount of funds to send (as a string with decimal value in dust)
   * @returns Transaction result with hash, sync status, and the amount as a dust string
   * @throws Error if wallet is not ready or if there are insufficient funds
   */
  public async sendFunds(to: string, amount: string): Promise<SendFundsResult> {
    if (!this.ready) throw new Error('Wallet not ready');
    if (!this.wallet) throw new Error('Wallet instance not available');
    
    try {
      // Convert decimal amount string to BigInt for internal calculations
      const amountBigInt = convertDecimalToBigInt(amount);
      
      // First check if there are enough available funds
      if (this.walletBalances.balance < amountBigInt) {
        // If available balance is insufficient, check if pending funds would be enough
        if (this.walletBalances.balance >= amountBigInt) {
          const pendingAmount = this.walletBalances.pendingBalance;
          const formattedAvailableBalance = convertBigIntToDecimal(this.walletBalances.balance);
          const formattedPendingAmount = convertBigIntToDecimal(pendingAmount);
          throw new Error(
            `Insufficient available funds for transaction. You have ${formattedAvailableBalance} available, ` +
            `but ${formattedPendingAmount} is still pending. Please wait for pending transactions to complete.`
          );
        }
        // If total balance is also insufficient
        const formattedTotalBalance = convertBigIntToDecimal(this.walletBalances.balance);
        throw new Error(`Insufficient funds for transaction. You have ${formattedTotalBalance} total, but need ${amount}.`);
      }
      
      // Create a transfer transaction - still using bigint for SDK interface
      const transferRecipe = await this.wallet.transferTransaction([
        {
          amount: amountBigInt,
          type: nativeToken(),
          receiverAddress: to
        }
      ]);
      
      // Prove and submit the transaction
      const provenTransaction = await this.wallet.proveTransaction(transferRecipe);
      const submittedTransaction = await this.wallet.submitTransaction(provenTransaction);
      
      this.logger.info(`Transaction submitted: ${submittedTransaction}`);
      
      const isFullySynced = this.totalIndices > 0n && this.syncedIndices === this.totalIndices;
      
      // Create a transaction record in the database
      const transaction = this.transactionDb.createTransaction(
        this.walletAddress,
        to,
        amount
      );
      
      // Update the transaction to SENT state with the identifier
      this.transactionDb.markTransactionAsSent(transaction.id, submittedTransaction);
      
      return {
        txIdentifier: submittedTransaction,
        syncStatus: {
          syncedIndices: this.syncedIndices.toString(),
          totalIndices: this.totalIndices.toString(),
          isFullySynced
        },
        amount // Return the original dust string input
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
      
      // this.logger.info(`Saving wallet to file ${filePath}`);
      const walletJson = await this.wallet.serializeState();
      fs.writeFileSync(filePath, walletJson, { mode: 0o644 });
      // this.logger.info(`Wallet saved to ${filePath}`);
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
      // Stop transaction poller
      if (this.transactionPoller) {
        clearInterval(this.transactionPoller);
        this.transactionPoller = undefined;
      }
      
      // Close transaction database
      try {
        this.transactionDb.close();
        this.logger.info('Transaction database closed');
      } catch (dbError) {
        this.logger.warn('Error closing transaction database', dbError);
      }
      
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
      
      // Shutdown Docker environment only if we started it and we're in development mode
      if (this.startedEnv && !this.config.useExternalProofServer && isDevelopment) {
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
  public hasReceivedTransactionByIdentifier(identifier: string): TransactionVerificationResult {
    if (!this.ready) throw new Error('Wallet not ready');
    if (!this.wallet) throw new Error('Wallet instance not available');
    
    try {
      // Use the stored wallet state to check transaction history
      if (!this.walletState || !this.walletState.transactionHistory || !Array.isArray(this.walletState.transactionHistory)) {
        this.logger.warn('Transaction history not available in stored wallet state');
        return {
          exists: false, 
          syncStatus: {
            syncedIndices: this.syncedIndices.toString(), 
            totalIndices: this.totalIndices.toString(),
            isFullySynced: this.totalIndices > 0n && this.syncedIndices === this.totalIndices
          }
        };
      }
      
      // Check if any transaction contains the identifier
      const exists = this.walletState.transactionHistory.some((tx: TransactionHistoryEntry) => 
        Array.isArray(tx.identifiers) && tx.identifiers.includes(identifier)
      );
      
      return {
        exists,
        syncStatus: {
          syncedIndices: this.syncedIndices.toString(),
          totalIndices: this.totalIndices.toString(),
          isFullySynced: this.totalIndices > 0n && this.syncedIndices === this.totalIndices
        }
      };
    } catch (error) {
      this.logger.error(`Error verifying transaction receipt: ${error}`);
      throw error;
    }
  }

  /**
   * Get detailed wallet status including sync progress, readiness, and recovery state
   * @returns Detailed wallet status object with balances as dust strings
   */
  public getWalletStatus(): WalletStatus {
    // Calculate sync percentage for better UI representation
    const syncPercentage = this.totalIndices > 0n
      ? Number((this.syncedIndices * 100n) / this.totalIndices)
      : 0;
      
    const isFullySynced = this.totalIndices > 0n && this.syncedIndices === this.totalIndices;
    
    return {
      ready: this.ready,
      syncing: this.totalIndices > 0n && this.syncedIndices < this.totalIndices,
      syncProgress: {
        synced: this.syncedIndices.toString(),
        total: this.totalIndices.toString(),
        percentage: syncPercentage
      },
      address: this.walletAddress,
      balances: {
        balance: convertBigIntToDecimal(this.walletBalances.balance),
        pendingBalance: convertBigIntToDecimal(this.walletBalances.pendingBalance)
      },
      recovering: this.isRecovering,
      recoveryAttempts: this.recoveryAttempts,
      maxRecoveryAttempts: this.maxRecoveryAttempts,
      isFullySynced
    };
  }

  /**
   * Start the transaction poller to check for completed transactions
   */
  private startTransactionPoller(): void {
    if (this.transactionPoller) {
      clearInterval(this.transactionPoller);
    }

    this.logger.info(`Starting transaction poller with interval of ${this.pollingInterval}ms`);
    
    // Check for any pending sent transactions that might have completed during downtime
    this.checkPendingTransactions();

    this.transactionPoller = setInterval(() => {
      this.checkPendingTransactions();
    }, this.pollingInterval);
  }

  /**
   * Check for pending transactions that might have been completed
   */
  private async checkPendingTransactions(): Promise<void> {
    if (!this.ready || !this.wallet) {
      return;
    }

    try {
      // Get all transactions in SENT state that need to be checked
      const sentTransactions = this.transactionDb.getTransactionsByState(TransactionState.SENT);
      
      if (sentTransactions.length === 0) {
        return;
      }

      this.logger.info(`Checking ${sentTransactions.length} sent transactions for completion`);

      for (const tx of sentTransactions) {
        if (!tx.txIdentifier) continue;

        // Check if transaction appears in wallet history
        const verificationResult = this.hasReceivedTransactionByIdentifier(tx.txIdentifier);
        
        if (verificationResult.exists) {
          this.logger.info(`Transaction ${tx.id} with txIdentifier ${tx.txIdentifier} found in blockchain history, marking as completed`);
          this.transactionDb.markTransactionAsCompleted(tx.txIdentifier);
        } else {
          this.logger.debug(`Transaction ${tx.id} with txIdentifier ${tx.txIdentifier} not yet found in blockchain history`);
        }
      }
    } catch (error) {
      this.logger.error('Error checking pending transactions', error);
    }
  }

  /**
   * Initiate a transaction to send funds, but don't wait for completion
   * @param to Address to send the funds to
   * @param amount Amount of funds to send (as a string with decimal value in dust)
   * @returns Object containing the initiated transaction details
   * @throws Error if wallet is not ready or if there are insufficient funds
   */
  public async initiateSendFunds(to: string, amount: string): Promise<InitiateTransactionResult> {
    if (!this.ready) throw new Error('Wallet not ready');
    if (!this.wallet) throw new Error('Wallet instance not available');

    try {
      // Convert decimal amount string to BigInt for internal calculations
      const amountBigInt = convertDecimalToBigInt(amount);
      
      // First check if there are enough available funds
      if (this.walletBalances.balance < amountBigInt) {
        // If available balance is insufficient, check if pending funds would be enough
        if (this.walletBalances.balance >= amountBigInt) {
          const pendingAmount = this.walletBalances.pendingBalance;
          const formattedAvailableBalance = convertBigIntToDecimal(this.walletBalances.balance);
          const formattedPendingAmount = convertBigIntToDecimal(pendingAmount);
          throw new Error(
            `Insufficient available funds for transaction. You have ${formattedAvailableBalance} available, ` +
            `but ${formattedPendingAmount} is still pending. Please wait for pending transactions to complete.`
          );
        }
        // If total balance is also insufficient
        const formattedTotalBalance = convertBigIntToDecimal(this.walletBalances.balance);
        throw new Error(`Insufficient funds for transaction. You have ${formattedTotalBalance} total, but need ${amount}.`);
      }

      // Create transaction record in database
      const transaction = this.transactionDb.createTransaction(
        this.walletAddress,
        to,
        amount
      );

      this.logger.info(`Initiated transaction ${transaction.id} to ${to} for ${amount}`);

      // Start the async process to send funds, but don't await it
      this.processSendFundsAsync(transaction.id, to, amount).catch(err => {
        this.logger.error(`Async transaction processing error for ${transaction.id}`, err);
        this.transactionDb.markTransactionAsFailed(transaction.id, err.message || 'Unknown error processing transaction');
      });

      return {
        id: transaction.id,
        state: TransactionState.INITIATED,
        toAddress: to,
        amount,
        createdAt: transaction.createdAt
      };
    } catch (error) {
      this.logger.error('Failed to initiate funds transfer', error);
      throw error;
    }
  }

  /**
   * Async process to send funds after initiation (doesn't block the caller)
   * @param transactionId UUID of the transaction record
   * @param to Recipient address
   * @param amount Amount to send in dust string format
   */
  private async processSendFundsAsync(transactionId: string, to: string, amount: string): Promise<void> {
    if (!this.wallet) throw new Error('Wallet instance not available');

    try {
      // Convert decimal amount string to BigInt for internal calculations
      const amountBigInt = convertDecimalToBigInt(amount);

      // Create a transfer transaction
      const transferRecipe = await this.wallet.transferTransaction([
        {
          amount: amountBigInt,
          type: nativeToken(),
          receiverAddress: to
        }
      ]);
      
      // Prove and submit the transaction
      const provenTransaction = await this.wallet.proveTransaction(transferRecipe);
      const submittedTransaction = await this.wallet.submitTransaction(provenTransaction);
      
      this.logger.info(`Transaction submitted for ${transactionId}: ${submittedTransaction}`);
      
      // Update transaction record with txIdentifier and set state to SENT
      this.transactionDb.markTransactionAsSent(transactionId, submittedTransaction);
    } catch (error) {
      this.logger.error(`Failed to process send funds for transaction ${transactionId}`, error);
      // Mark the transaction as failed in the database
      this.transactionDb.markTransactionAsFailed(transactionId, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Get transaction status by ID
   * @param id Transaction ID
   * @returns Transaction status including blockchain verification
   */
  public getTransactionStatus(id: string): TransactionStatusResult | null {
    try {
      const transaction = this.transactionDb.getTransactionById(id);
      
      if (!transaction) {
        return null;
      }
      
      // If we have a txIdentifier and transaction is in SENT state, check blockchain status
      if (transaction.txIdentifier && transaction.state === TransactionState.SENT) {
        const blockchainStatus = this.hasReceivedTransactionByIdentifier(transaction.txIdentifier);
        
        // Convert BigInt values to strings for safe JSON serialization
        return {
          transaction,
          blockchainStatus: {
            exists: blockchainStatus.exists,
            syncStatus: {
              syncedIndices: blockchainStatus.syncStatus.syncedIndices.toString(),
              totalIndices: blockchainStatus.syncStatus.totalIndices.toString(),
              isFullySynced: blockchainStatus.syncStatus.isFullySynced
            }
          }
        };
      }
      
      return { transaction };
    } catch (error) {
      this.logger.error(`Failed to get transaction status for ${id}`, error);
      throw error;
    }
  }

  /**
   * Get all transactions with a specific state
   * @param state Optional transaction state to filter by
   * @returns Array of transaction records
   */
  public getTransactions(state?: TransactionState): TransactionRecord[] {
    try {
      if (state) {
        return this.transactionDb.getTransactionsByState(state);
      }
      
      return this.transactionDb.getAllTransactions();
    } catch (error) {
      this.logger.error('Failed to get transactions', error);
      throw error;
    }
  }

  /**
   * Get pending transactions (INITIATED or SENT)
   * @returns Array of pending transaction records
   */
  public getPendingTransactions(): TransactionRecord[] {
    try {
      return this.transactionDb.getPendingTransactions();
    } catch (error) {
      this.logger.error('Failed to get pending transactions', error);
      throw error;
    }
  }
}

export default WalletManager;
  