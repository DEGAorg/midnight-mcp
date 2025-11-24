/**
 * Wallet Orchestrator
 *
 * Coordinates all wallet services:
 * - WalletService - Core wallet state and recovery
 * - TransactionService - Transaction lifecycle and polling
 * - TokenService - Token registration and operations
 * - DaoService - DAO voting operations
 * - MarketplaceService - Marketplace operations
 * - AuditService - Transaction tracing and audit trail
 * - RecoveryService - Exponential backoff recovery
 *
 * Handles:
 * - Service initialization in correct order
 * - Dependency injection between services
 * - Unified lifecycle management (start/stop)
 * - Graceful shutdown
 *
 * This replaces the god-class WalletManager pattern with clean service coordination.
 */

import { createLogger } from '@lib/logger/index.js';
import { WalletService, type WalletConfig } from '@services/wallet/WalletService.js';
import { TransactionService } from '@services/wallet/TransactionService.js';
import { TokenService } from '@services/wallet/TokenService.js';
import { DaoService, type DaoServiceConfig } from '@services/contract/dao/DaoService.js';
import { MarketplaceService, type MarketplaceServiceConfig } from '@services/contract/marketplace/MarketplaceService.js';
import { AuditService } from '@services/audit/AuditService.js';
import { RecoveryService, type RecoveryOptions } from '@services/recovery/RecoveryService.js';
import { TokenRegistryDatabase } from '@lib/database/token-registry-db.js';
import { FileManager, FileType } from '@lib/utils/file-manager.js';
import type { Logger } from 'pino';

/**
 * Wallet orchestrator configuration
 */
export interface WalletOrchestratorConfig {
  /** Wallet configuration */
  walletConfig: WalletConfig;

  /** Agent ID for this orchestrator */
  agentId: string;

  /** Optional DAO contract address */
  daoContractAddress?: string;

  /** Optional marketplace contract address */
  marketplaceContractAddress?: string;

  /** Optional recovery options */
  recoveryOptions?: RecoveryOptions;

  /** Optional transaction polling interval (ms) */
  transactionPollingIntervalMs?: number;
}

/**
 * WalletOrchestrator coordinates all wallet services
 */
export class WalletOrchestrator {
  private logger: Logger;
  private config: WalletOrchestratorConfig;

  // Core services (always initialized)
  private walletService!: WalletService;
  private transactionService!: TransactionService;
  private tokenService!: TokenService;
  private auditService!: AuditService;
  private recoveryService!: RecoveryService;

  // Optional services (initialized if contract addresses provided)
  private daoService?: DaoService;
  private marketplaceService?: MarketplaceService;

  // Lifecycle state
  private isStarted = false;
  private isShuttingDown = false;

  constructor(config: WalletOrchestratorConfig) {
    this.config = config;
    this.logger = createLogger(`wallet-orchestrator:${config.agentId}`);

    this.logger.info('Wallet orchestrator initialized', {
      agentId: config.agentId,
      hasDaoContract: !!config.daoContractAddress,
      hasMarketplaceContract: !!config.marketplaceContractAddress,
    });

    // Initialize services
    this.initializeServices();
  }

  // ==================== INITIALIZATION ====================

  /**
   * Initialize all services with dependency injection
   */
  private initializeServices(): void {
    this.logger.info('Initializing services...');

    // 1. Create independent services first
    this.auditService = new AuditService();
    this.recoveryService = new RecoveryService(this.config.recoveryOptions);

    // 2. Create WalletService (depends on RecoveryService)
    this.walletService = new WalletService({
      ...this.config.walletConfig,
      recoveryService: this.recoveryService,
    });

    // 3. Create TransactionService (depends on WalletService, AuditService)
    this.transactionService = new TransactionService({
      walletService: this.walletService,
      auditService: this.auditService,
      agentId: this.config.agentId,
      pollingIntervalMs: this.config.transactionPollingIntervalMs,
    });

    // 4. Create TokenRegistryDatabase
    const fileManager = FileManager.getInstance();
    const tokenDbPath = fileManager.getPath(FileType.TRANSACTION_DB, this.config.agentId, 'token-registry.db');
    const tokenDb = new TokenRegistryDatabase(tokenDbPath);

    // 5. Create TokenService (depends on WalletService, TransactionService, TokenDB)
    this.tokenService = new TokenService({
      walletService: this.walletService,
      transactionService: this.transactionService,
      tokenDb,
      agentId: this.config.agentId,
    });

    // 6. Create optional services if contract addresses provided
    if (this.config.daoContractAddress) {
      this.daoService = new DaoService({
        walletService: this.walletService,
        auditService: this.auditService,
        contractAddress: this.config.daoContractAddress,
        agentId: this.config.agentId,
      });
    }

    if (this.config.marketplaceContractAddress) {
      this.marketplaceService = new MarketplaceService({
        walletService: this.walletService,
        auditService: this.auditService,
        contractAddress: this.config.marketplaceContractAddress,
        agentId: this.config.agentId,
      });
    }

    this.logger.info('Services initialized', {
      coreServices: 5,
      optionalServices: [this.daoService, this.marketplaceService].filter(Boolean).length,
    });
  }

  // ==================== LIFECYCLE ====================

  /**
   * Start all services
   * Services are started in dependency order
   */
  async start(): Promise<void> {
    if (this.isStarted) {
      this.logger.warn('Orchestrator already started');
      return;
    }

    this.logger.info('Starting wallet orchestrator...');

    try {
      // Start services in dependency order

      // 1. Start WalletService (establishes wallet state subscription)
      await this.walletService.start();

      // 2. Start TransactionService (begins transaction polling)
      this.transactionService.start();

      // 3. Start optional services if available
      if (this.daoService) {
        await this.daoService.start();
      }

      if (this.marketplaceService) {
        await this.marketplaceService.start();
      }

      // 4. Auto-register tokens from wallet state
      await this.tokenService.autoRegisterTokens();

      this.isStarted = true;
      this.logger.info('Wallet orchestrator started successfully');
    } catch (error) {
      this.logger.error('Failed to start wallet orchestrator', error);
      // Attempt cleanup
      await this.stop();
      throw error;
    }
  }

  /**
   * Stop all services
   * Services are stopped in reverse dependency order
   */
  async stop(): Promise<void> {
    if (this.isShuttingDown) {
      this.logger.warn('Orchestrator already shutting down');
      return;
    }

    this.isShuttingDown = true;
    this.logger.info('Stopping wallet orchestrator...');

    try {
      // Stop services in reverse dependency order

      // 1. Stop optional services first
      if (this.marketplaceService) {
        this.marketplaceService.stop();
      }

      if (this.daoService) {
        this.daoService.stop();
      }

      // 2. Stop TransactionService (stops polling)
      this.transactionService.stop();

      // 3. Stop WalletService (closes wallet, saves state)
      await this.walletService.close();

      this.isStarted = false;
      this.logger.info('Wallet orchestrator stopped successfully');
    } catch (error) {
      this.logger.error('Error stopping wallet orchestrator', error);
      throw error;
    } finally {
      this.isShuttingDown = false;
    }
  }

  // ==================== SERVICE ACCESS ====================

  /**
   * Get WalletService
   */
  getWalletService(): WalletService {
    return this.walletService;
  }

  /**
   * Get TransactionService
   */
  getTransactionService(): TransactionService {
    return this.transactionService;
  }

  /**
   * Get TokenService
   */
  getTokenService(): TokenService {
    return this.tokenService;
  }

  /**
   * Get AuditService
   */
  getAuditService(): AuditService {
    return this.auditService;
  }

  /**
   * Get RecoveryService
   */
  getRecoveryService(): RecoveryService {
    return this.recoveryService;
  }

  /**
   * Get DaoService (if available)
   */
  getDaoService(): DaoService | undefined {
    return this.daoService;
  }

  /**
   * Get MarketplaceService (if available)
   */
  getMarketplaceService(): MarketplaceService | undefined {
    return this.marketplaceService;
  }

  // ==================== UNIFIED API ====================

  /**
   * Check if orchestrator is started
   */
  isReady(): boolean {
    return this.isStarted && this.walletService.isReady();
  }

  /**
   * Get wallet address
   */
  getAddress(): string {
    return this.walletService.getAddress();
  }

  /**
   * Get wallet balance
   */
  getBalance(): bigint {
    return this.walletService.getBalance();
  }

  /**
   * Get sync progress
   */
  getSyncProgress() {
    return this.walletService.getSyncProgress();
  }

  /**
   * Wait for wallet sync
   */
  async waitForSync(timeoutMs?: number): Promise<void> {
    return this.walletService.waitForSync(timeoutMs);
  }

  /**
   * Get agent ID
   */
  getAgentId(): string {
    return this.config.agentId;
  }

  // ==================== HEALTH & MONITORING ====================

  /**
   * Get orchestrator health status
   */
  getHealthStatus(): {
    isStarted: boolean;
    isReady: boolean;
    isShuttingDown: boolean;
    walletReady: boolean;
    walletSynced: boolean;
    transactionPollingActive: boolean;
    servicesInitialized: {
      wallet: boolean;
      transaction: boolean;
      token: boolean;
      audit: boolean;
      recovery: boolean;
      dao: boolean;
      marketplace: boolean;
    };
  } {
    return {
      isStarted: this.isStarted,
      isReady: this.isReady(),
      isShuttingDown: this.isShuttingDown,
      walletReady: this.walletService.isReady(),
      walletSynced: this.walletService.getSyncProgress().synced,
      transactionPollingActive: this.transactionService.isPollingActive(),
      servicesInitialized: {
        wallet: !!this.walletService,
        transaction: !!this.transactionService,
        token: !!this.tokenService,
        audit: !!this.auditService,
        recovery: !!this.recoveryService,
        dao: !!this.daoService,
        marketplace: !!this.marketplaceService,
      },
    };
  }

  /**
   * Get service statistics
   */
  getStatistics(): {
    transactions: {
      total: number;
      pending: number;
      pollingInterval: number;
    };
    tokens: {
      registered: number;
      withBalance: number;
    };
    recovery: {
      isRecovering: boolean;
      attempts: number;
    };
  } {
    return {
      transactions: {
        total: this.transactionService.getTransactionCount(),
        pending: this.transactionService.getPendingTransactionCount(),
        pollingInterval: this.transactionService.getPollingInterval(),
      },
      tokens: {
        registered: this.tokenService.getTokenCount(),
        withBalance: this.tokenService.getNonZeroTokenBalances().length,
      },
      recovery: {
        isRecovering: this.recoveryService.isRecovering(),
        attempts: this.recoveryService.getAttempts(),
      },
    };
  }
}
