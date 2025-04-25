import * as pino from 'pino';
import { toHex } from '@midnight-ntwrk/midnight-js-utils';
import { randomBytes } from 'crypto';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as Rx from 'rxjs';
import { DockerComposeEnvironment, Wait, type StartedDockerComposeEnvironment } from 'testcontainers';
import { setNetworkId, NetworkId, getZswapNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { nativeToken } from '@midnight-ntwrk/ledger';
import { WalletBuilder } from '@midnight-ntwrk/wallet';
import { type Wallet } from '@midnight-ntwrk/wallet-api';
import { type Resource } from '@midnight-ntwrk/wallet';

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
  private logger: pino.Logger;
  private dockerEnv?: DockerComposeEnvironment;
  private startedEnv?: StartedDockerComposeEnvironment;
  private walletSyncSubscription?: Rx.Subscription;
  private walletInitPromise: Promise<void>;
  private walletAddress: string = '';
  private walletBalance: bigint = 0n;
  
  /**
   * Create a new WalletManager instance
   * @param networkId Optional network ID to connect to (defaults to TestNet)
   * @param seedHex Optional hex seed for the wallet
   * @param walletFilename Optional filename to restore wallet from
   */
  constructor(networkId?: NetworkId, seedHex?: string, walletFilename?: string) {
    // Set network ID if provided, default to TestNet
    this.config = new TestnetRemoteConfig();
    if (networkId) {
      setNetworkId(networkId);
    }
    
    // Initialize logger
    this.logger = pino.pino({ 
      level: process.env.LOG_LEVEL || 'info',
      transport: {
        target: 'pino-pretty'
      }
    });
    
    this.logger.info('Initializing WalletManager');
    
    // Create Docker environment
    this.setupDockerEnvironment();
    
    // Initialize wallet asynchronously to not block MCP server startup
    this.walletInitPromise = this.initializeWallet(seedHex, walletFilename);
  }
  
  /**
   * Configure Docker environment for proof server
   */
  private setupDockerEnvironment(): void {
    try {
      const currentDir = getCurrentDir();
      const configDir = path.resolve(currentDir, './src/wallet/config');
      console.log('configDir', configDir);
      // verify the file exists
      const proofServerYml = path.resolve(configDir, 'proof-server-testnet.yml');
      console.log('proofServerYml', proofServerYml);
      if (!fs.existsSync(proofServerYml)) {
        const filesInConfigDir = fs.readdirSync(configDir);
        console.error('Files inside configDir:', filesInConfigDir);
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
  private async initializeWallet(seedHex?: string, walletFilename?: string): Promise<void> {
    try {
      // Start Docker environment
      if (this.dockerEnv) {
        this.logger.info('Starting Docker environment');
        this.startedEnv = await this.dockerEnv.up();
        
         console.log('Containers inside startedEnv:', this.startedEnv.getContainer('proof-server'));

        // Update config with mapped ports
        this.config.proofServer = mapContainerPort(
          this.startedEnv, 
          this.config.proofServer, 
          CONTAINER_NAME
        );
        
        this.logger.info(`Docker environment started, proof server at ${this.config.proofServer}`);
      }
      
      // Generate a random seed if not provided
      const finalSeedHex = seedHex || toHex(randomBytes(32));
      const finalFilename = walletFilename || '';
      
      // Initialize wallet
      try {
        this.wallet = await this.buildWalletFromSeed(finalSeedHex, finalFilename);
        
        if (this.wallet) {
          // Subscribe to wallet state changes
          this.walletSyncSubscription = this.wallet.state().subscribe({
            next: (state) => {
              // Get indices sync status from the wallet state
              const synced = state.syncProgress?.synced ?? 0n;
              const total = state.syncProgress?.total ?? 0n;
              
              // Update wallet information
              this.walletAddress = state.address || '';
              this.walletBalance = state.balances[nativeToken()] ?? 0n;
              
              // Check if wallet is fully synced
              if (total > 0n && synced === total) {
                if (!this.ready) {
                  this.ready = true;
                  this.logger.info('Wallet is fully synced and ready!');
                  this.logger.info(`Wallet address: ${this.walletAddress}`);
                  this.logger.info(`Wallet balance: ${this.walletBalance}`);
                }
              } else {
                this.logger.info(`Wallet syncing: ${synced}/${total}`);
              }
            },
            error: (err) => {
              this.logger.error(`Wallet state subscription error: ${err}`);
            }
          });
          
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
   * Build wallet from seed and optionally restore from file
   */
  private async buildWalletFromSeed(seedHex: string, filename: string): Promise<Wallet & Resource> {
    const { indexer, indexerWS, node, proofServer } = this.config;
    let wallet: Wallet & Resource;
    
    // Try to restore wallet from file if filename is provided
    if (filename && fs.existsSync(`./files/${filename}`)) {
      this.logger.info(`Attempting to restore wallet from ./files/${filename}`);
      try {
        const serializedStream = fs.createReadStream(`./files/${filename}`, 'utf-8');
        const serialized = await streamToString(serializedStream);
        serializedStream.on('finish', () => {
          serializedStream.close();
        });
        
        const cleanSerialized = serialized.trim().startsWith('"') 
          ? JSON.parse(serialized) 
          : serialized;
        
        // Restore wallet from serialized state
        this.logger.info(`Restoring wallet with seed: ${seedHex}`);
        wallet = await WalletBuilder.restore(
          indexer, 
          indexerWS, 
          proofServer, 
          node, 
          seedHex, 
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
          seedHex,
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
        seedHex,
        getZswapNetworkId(),
        'info'
      );
      wallet.start();
    }
    
    return wallet;
  }
  
  /**
   * Check if the wallet is ready for operations
   * @returns true if wallet is synced and ready
   */
  public isReady(): boolean {
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
   * @returns Transaction result
   * @throws Error if wallet is not ready
   */
  public async sendFunds(to: string, amount: bigint): Promise<string> {
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
      return submittedTransaction;
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
      const directoryPath = path.resolve('./files');
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(directoryPath)) {
        fs.mkdirSync(directoryPath, { recursive: true, mode: 0o755 });
        this.logger.info(`Created directory: ${directoryPath}`);
      }
      
      // Use provided filename or generate a default one
      const walletFilename = filename || `wallet-${Date.now()}`;
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
      // Unsubscribe from wallet state updates
      if (this.walletSyncSubscription) {
        this.walletSyncSubscription.unsubscribe();
      }
      
      // Close wallet
      if (this.wallet) {
        await this.wallet.close();
        this.logger.info('Wallet closed successfully');
      }
      
      // Shut down Docker environment
      if (this.startedEnv) {
        await this.startedEnv.down();
        this.logger.info('Docker environment shut down');
      }
    } catch (error) {
      this.logger.error('Error closing wallet manager', error);
    }
  }
}

export default WalletManager;
  