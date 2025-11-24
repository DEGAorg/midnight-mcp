/**
 * Session Manager
 *
 * Manages per-agent sessions for multi-agent MCP deployments.
 * Provides:
 * - Per-session service isolation
 * - LRU cache with automatic eviction
 * - Session lifecycle management
 * - WalletOrchestrator integration
 *
 * Architecture:
 * - Each session gets its own WalletOrchestrator
 * - Each WalletOrchestrator manages its own service instances
 * - Sessions are automatically evicted when idle (LRU)
 * - Thread-safe session access with concurrent create protection
 *
 * CRITICAL FIXES:
 * - ✅ Uses agentId (not sessionId) throughout
 * - ✅ Loads seeds via SeedManager (no seed parameter)
 * - ✅ Uses FileManager for all paths
 * - ✅ Starts orchestrator BEFORE getting services
 * - ✅ Handles optional services (DAO/Marketplace)
 * - ✅ Protects against concurrent creates
 */

import { WalletBuilder } from '@midnight-ntwrk/wallet';
import type { Wallet } from '@midnight-ntwrk/wallet-api';
import type { Resource } from '@midnight-ntwrk/wallet';
import { getZswapNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import path from 'path';

import { createLogger } from '@lib/logger/index.js';
import { WalletOrchestrator } from '@services/WalletOrchestrator.js';
import { FileManager, FileType } from '@lib/utils/file-manager.js';
import { SeedManager } from '@lib/utils/seed-manager.js';
import type { Logger } from 'pino';
import type {
  Session,
  SessionManagerConfig,
  CreateSessionOptions,
  SessionStats
} from './types.js';
import type { ServiceDependencies } from '../types.js';

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Partial<SessionManagerConfig> = {
  maxSessions: 100,
  sessionTimeout: 30 * 60 * 1000, // 30 minutes
  evictionInterval: 5 * 60 * 1000  // 5 minutes
};

/**
 * Percentage multiplier
 */
const PERCENTAGE_MULTIPLIER = 100;

/**
 * SessionManager
 *
 * Manages multiple concurrent agent sessions with automatic cleanup.
 */
export class SessionManager {
  private logger: Logger;
  private config: SessionManagerConfig;
  private sessions: Map<string, Session>;
  private creationLocks: Map<string, Promise<ServiceDependencies>>;
  private evictionTimer?: NodeJS.Timeout;
  private fileManager: FileManager;
  private stats: {
    totalCreated: number;
    totalEvicted: number;
    totalClosed: number;
  };

  constructor(config: SessionManagerConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config } as SessionManagerConfig;
    this.logger = createLogger('session-manager');
    this.sessions = new Map();
    this.creationLocks = new Map();
    this.fileManager = FileManager.getInstance();
    this.stats = {
      totalCreated: 0,
      totalEvicted: 0,
      totalClosed: 0
    };

    this.logger.info('SessionManager initialized', {
      maxSessions: this.config.maxSessions,
      sessionTimeout: this.config.sessionTimeout,
      evictionInterval: this.config.evictionInterval
    });
  }

  /**
   * Start the session manager
   * Begins background eviction checks
   */
  start(): void {
    this.logger.info('Starting SessionManager...');

    // Start background eviction checker
    this.evictionTimer = setInterval(() => {
      this.checkStaleSessions();
    }, this.config.evictionInterval);

    this.logger.info('SessionManager started');
  }

  /**
   * Stop the session manager
   * Closes all active sessions
   */
  async stop(): Promise<void> {
    this.logger.info('Stopping SessionManager...');

    // Clear eviction timer
    if (this.evictionTimer) {
      clearInterval(this.evictionTimer);
      this.evictionTimer = undefined;
    }

    // Close all active sessions
    const agentIds = Array.from(this.sessions.keys());
    await Promise.all(
      agentIds.map(agentId => this.closeSession(agentId))
    );

    this.logger.info('SessionManager stopped', {
      totalCreated: this.stats.totalCreated,
      totalEvicted: this.stats.totalEvicted,
      totalClosed: this.stats.totalClosed
    });
  }

  /**
   * Get or create a session
   *
   * @param options - Session creation options
   * @returns Service dependencies for the session
   */
  async getOrCreateSession(options: CreateSessionOptions): Promise<ServiceDependencies> {
    const { agentId } = options;

    // Check if session exists
    const existingSession = this.sessions.get(agentId);
    if (existingSession) {
      // Validate session state
      if (existingSession.state === 'closing' || existingSession.state === 'closed') {
        this.logger.warn('Attempted to access closing/closed session', {
          agentId,
          state: existingSession.state
        });
        throw new Error(`Session ${agentId} is ${existingSession.state}`);
      }

      if (existingSession.state === 'initializing') {
        // Wait for initialization to complete
        const creationPromise = this.creationLocks.get(agentId);
        if (creationPromise) {
          this.logger.debug('Waiting for session initialization', { agentId });
          return await creationPromise;
        }
      }

      // Update last accessed time
      existingSession.lastAccessedAt = new Date();

      this.logger.debug('Session accessed', {
        agentId,
        state: existingSession.state
      });

      return existingSession.services;
    }

    // Check if creation is in progress
    const existingCreation = this.creationLocks.get(agentId);
    if (existingCreation) {
      this.logger.debug('Session creation already in progress', { agentId });
      return await existingCreation;
    }

    // Create new session
    const creationPromise = this.createSession(options);
    this.creationLocks.set(agentId, creationPromise);

    try {
      const services = await creationPromise;
      return services;
    } finally {
      // Remove creation lock
      this.creationLocks.delete(agentId);
    }
  }

  /**
   * Create a new session
   */
  private async createSession(options: CreateSessionOptions): Promise<ServiceDependencies> {
    const { agentId } = options;

    this.logger.info('Creating new session', { agentId });

    // Check max sessions limit
    if (this.sessions.size >= this.config.maxSessions) {
      this.logger.warn('Session limit reached, evicting oldest', {
        maxSessions: this.config.maxSessions
      });
      await this.evictOldestSession();
    }

    // Create wallet factory for this agent
    const walletFactory = this.createWalletFactory(agentId);

    // Resolve wallet file path for this agent
    // NOTE: Agent is already validated via SeedManager.hasAgentSeed() in request-validator.ts
    // This ensures the agent exists and has a valid seed before we reach this point
    const walletFilename = `${this.config.baseConfig.walletFilename}.json`;
    const walletPath = this.fileManager.getPath(FileType.WALLET_BACKUP, agentId, walletFilename);

    this.logger.debug('Wallet path configured', { agentId, walletPath });

    // Create WalletOrchestrator config (contract addresses from baseConfig)
    const orchestratorConfig = {
      walletConfig: {
        walletFactory,
        walletPath,
        agentId
      },
      agentId,
      daoContractAddress: this.config.baseConfig.daoContractAddress,
      marketplaceContractAddress: this.config.baseConfig.marketplaceContractAddress
    };

    // Create orchestrator
    const orchestrator = new WalletOrchestrator(orchestratorConfig);

    // Initialize session object (state: initializing)
    const session: Session = {
      agentId,
      services: {} as ServiceDependencies, // Will be populated after start
      orchestrator,
      createdAt: new Date(),
      lastAccessedAt: new Date(),
      state: 'initializing',
      agentIds: new Set([agentId])
    };

    // Store in map
    this.sessions.set(agentId, session);
    this.stats.totalCreated++;

    try {
      // CRITICAL: Start orchestrator FIRST
      // This initializes all services
      await orchestrator.start();

      // THEN get services (after start completes)
      const services: ServiceDependencies = {
        walletService: orchestrator.getWalletService(),
        transactionService: orchestrator.getTransactionService(),
        tokenService: orchestrator.getTokenService(),
        daoService: orchestrator.getDaoService() || undefined as any, // Handle optional
        marketplaceService: orchestrator.getMarketplaceService() || undefined as any // Handle optional
      };

      // Update session with services
      session.services = services;
      session.state = 'active';

      this.logger.info('Session created successfully', {
        agentId,
        totalSessions: this.sessions.size,
        hasDaoService: !!services.daoService,
        hasMarketplaceService: !!services.marketplaceService
      });

      return services;
    } catch (error) {
      // Failed to initialize, remove from map
      this.sessions.delete(agentId);
      session.state = 'closed';

      this.logger.error('Failed to create session', {
        agentId,
        error
      });

      throw error;
    }
  }

  /**
   * Create a wallet factory function for an agent
   *
   * Uses SeedManager to load agent seed from secure storage
   */
  private createWalletFactory(agentId: string): () => Promise<Wallet & Resource> {
    const { indexer, indexerWS, proofServer, node, walletFilename } = this.config.baseConfig;

    return async (): Promise<Wallet & Resource> => {
      this.logger.info('Building wallet for agent', { agentId });

      // Load seed from SeedManager (secure storage)
      // SAFE: Agent validated via SeedManager.hasAgentSeed() in request-validator.ts
      const seed = SeedManager.getAgentSeed(agentId);

      // Try to restore wallet from file if it exists
      const formattedFilename = `${walletFilename}.json`;
      if (this.fileManager.fileExists(FileType.WALLET_BACKUP, agentId, formattedFilename)) {
        this.logger.info('Restoring wallet from file', { agentId, filename: formattedFilename });

        try {
          const serialized = this.fileManager.readFile(FileType.WALLET_BACKUP, agentId, formattedFilename);

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
          this.logger.info('Wallet restored successfully', { agentId });
          return wallet;
        } catch (error) {
          this.logger.warn('Failed to restore wallet, building from seed', {
            agentId,
            error
          });
        }
      }

      //TOOD:IF THE FILE DOSENT EXIST, CREATE A AGENT SCRIPT ?

      // Build new wallet from seed
      this.logger.info('Building fresh wallet from seed', { agentId });
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
      this.logger.info('Wallet built successfully', { agentId });
      return wallet;
    };
  }

  /**
   * Close a session
   */
  async closeSession(agentId: string): Promise<void> {
    const session = this.sessions.get(agentId);
    if (!session) {
      this.logger.warn('Attempted to close non-existent session', { agentId });
      return;
    }

    this.logger.info('Closing session', { agentId });

    try {
      session.state = 'closing';

      // Stop orchestrator (this stops all services)
      await session.orchestrator.stop();

      session.state = 'closed';
      this.sessions.delete(agentId);
      this.stats.totalClosed++;

      this.logger.info('Session closed', { agentId });
    } catch (error) {
      this.logger.error('Error closing session', {
        agentId,
        error
      });
      throw error;
    }
  }

  /**
   * Evict oldest session (LRU)
   */
  private async evictOldestSession(): Promise<void> {
    let oldestAgentId: string | null = null;
    let oldestTime = Date.now();

    for (const [agentId, session] of this.sessions.entries()) {
      if (session.lastAccessedAt.getTime() < oldestTime) {
        oldestTime = session.lastAccessedAt.getTime();
        oldestAgentId = agentId;
      }
    }

    if (oldestAgentId) {
      this.logger.info('Evicting oldest session', {
        agentId: oldestAgentId,
        age: Date.now() - oldestTime,
        idleTime: Date.now() - oldestTime
      });

      this.stats.totalEvicted++;
      await this.closeSession(oldestAgentId);
    }
  }

  /**
   * Check for stale sessions and evict them
   */
  private checkStaleSessions(): void {
    const now = Date.now();
    const staleAgentIds: string[] = [];

    for (const [agentId, session] of this.sessions.entries()) {
      const idleTime = now - session.lastAccessedAt.getTime();

      if (idleTime > this.config.sessionTimeout) {
        staleAgentIds.push(agentId);
      }
    }

    if (staleAgentIds.length > 0) {
      this.logger.info('Evicting stale sessions', {
        count: staleAgentIds.length,
        agentIds: staleAgentIds
      });

      // Evict stale sessions
      Promise.all(
        staleAgentIds.map(agentId => {
          this.stats.totalEvicted++;
          return this.closeSession(agentId);
        })
      ).catch(error => {
        this.logger.error('Error evicting stale sessions', { error });
      });
    }
  }

  /**
   * Get session statistics
   */
  getStats(): SessionStats {
    const sessionAges: number[] = [];
    const now = Date.now();

    for (const session of this.sessions.values()) {
      sessionAges.push(now - session.lastAccessedAt.getTime());
    }

    return {
      activeSessions: this.sessions.size,
      totalCreated: this.stats.totalCreated,
      totalEvicted: this.stats.totalEvicted,
      totalClosed: this.stats.totalClosed,
      oldestSessionAge: sessionAges.length > 0 ? Math.max(...sessionAges) : 0,
      newestSessionAge: sessionAges.length > 0 ? Math.min(...sessionAges) : 0,
      maxSessions: this.config.maxSessions,
      utilizationPercent: (this.sessions.size / this.config.maxSessions) * PERCENTAGE_MULTIPLIER
    };
  }

  /**
   * Check if a session exists
   */
  hasSession(agentId: string): boolean {
    return this.sessions.has(agentId);
  }

  /**
   * Get active session count
   */
  getActiveSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Track additional agent ID for a session
   */
  trackAgent(agentId: string, additionalAgentId: string): void {
    const session = this.sessions.get(agentId);
    if (session) {
      session.agentIds.add(additionalAgentId);
      this.logger.debug('Agent tracked', {
        sessionAgentId: agentId,
        additionalAgentId,
        totalAgents: session.agentIds.size
      });
    }
  }
}
