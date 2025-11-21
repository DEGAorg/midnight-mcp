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
 * - Thread-safe session access
 */

import { LRUCache } from 'lru-cache';
import { createLogger } from '../../lib/logger/index.js';
import { WalletOrchestrator } from '../../services/WalletOrchestrator.js';
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
 * SessionManager
 *
 * Manages multiple concurrent agent sessions with automatic cleanup.
 */
export class SessionManager {
  private logger: Logger;
  private config: SessionManagerConfig;
  private sessions: LRUCache<string, Session>;
  private evictionTimer?: NodeJS.Timeout;
  private stats: {
    totalCreated: number;
    totalEvicted: number;
    totalClosed: number;
  };

  constructor(config: SessionManagerConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config } as SessionManagerConfig;
    this.logger = createLogger('session-manager');
    this.stats = {
      totalCreated: 0,
      totalEvicted: 0,
      totalClosed: 0
    };

    // Initialize LRU cache with eviction callback
    this.sessions = new LRUCache<string, Session>({
      max: this.config.maxSessions,
      ttl: this.config.sessionTimeout,
      dispose: async (session: Session, key: string) => {
        await this.handleSessionEviction(session, key);
      },
      updateAgeOnGet: true, // Update lastAccessedAt on access
      noDisposeOnSet: false
    });

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
    const sessionIds = Array.from(this.sessions.keys());
    await Promise.all(
      sessionIds.map(sessionId => this.closeSession(sessionId))
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
    const { sessionId } = options;

    // Check if session exists
    const existingSession = this.sessions.get(sessionId);
    if (existingSession) {
      // Update last accessed time
      existingSession.lastAccessedAt = new Date();

      this.logger.debug('Session accessed', {
        sessionId,
        state: existingSession.state
      });

      return existingSession.services;
    }

    // Create new session
    return await this.createSession(options);
  }

  /**
   * Create a new session
   */
  private async createSession(options: CreateSessionOptions): Promise<ServiceDependencies> {
    const { sessionId, seed, daoContractAddress, marketplaceContractAddress } = options;

    this.logger.info('Creating new session', { sessionId });

    // Create wallet factory for this session
    const walletFactory = this.createWalletFactory(sessionId, seed);

    // Create wallet path for this session
    const walletPath = `${sessionId}-wallet.json`; // TODO: Use proper path with FileManager

    // Create WalletOrchestrator config
    const orchestratorConfig = {
      walletConfig: {
        walletFactory,
        walletPath,
        agentId: sessionId
      },
      agentId: sessionId,
      daoContractAddress: daoContractAddress || this.config.baseConfig.daoContractAddress,
      marketplaceContractAddress: marketplaceContractAddress || this.config.baseConfig.marketplaceContractAddress
    };

    // Create orchestrator
    const orchestrator = new WalletOrchestrator(orchestratorConfig);

    // Collect services (orchestrator methods return them)
    const services: ServiceDependencies = {
      walletService: orchestrator.getWalletService(),
      transactionService: orchestrator.getTransactionService(),
      tokenService: orchestrator.getTokenService(),
      daoService: orchestrator.getDaoService()!,
      marketplaceService: orchestrator.getMarketplaceService()!
    };

    // Initialize session object (state: initializing)
    const session: Session = {
      sessionId,
      services,
      orchestrator,
      createdAt: new Date(),
      lastAccessedAt: new Date(),
      state: 'initializing'
    };

    // Store in cache
    this.sessions.set(sessionId, session);
    this.stats.totalCreated++;

    try {
      // Start orchestrator (this initializes all services)
      await orchestrator.start();

      // Mark as active
      session.state = 'active';

      this.logger.info('Session created successfully', {
        sessionId,
        totalSessions: this.sessions.size
      });

      return services;
    } catch (error) {
      // Failed to initialize, remove from cache
      this.sessions.delete(sessionId);
      session.state = 'closed';

      this.logger.error('Failed to create session', {
        sessionId,
        error
      });

      throw error;
    }
  }

  /**
   * Create a wallet factory function for a session
   */
  private createWalletFactory(sessionId: string, seed: string): () => Promise<any> {
    const { networkUrl, indexerUrl, provingServerUrl } = this.config.baseConfig;

    return async () => {
      // TODO: Implement actual wallet building with WalletBuilder
      // For now, this is a placeholder that matches the interface
      this.logger.info('Building wallet for session', { sessionId });

      // This will need to import WalletBuilder and create wallet
      // Similar to stdio-server.ts createWalletFactory()
      throw new Error('Wallet factory not yet implemented - needs WalletBuilder integration');
    };
  }

  /**
   * Close a session
   */
  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      this.logger.warn('Attempted to close non-existent session', { sessionId });
      return;
    }

    this.logger.info('Closing session', { sessionId });

    try {
      session.state = 'closing';

      // Stop orchestrator (this stops all services)
      await session.orchestrator.stop();

      session.state = 'closed';
      this.sessions.delete(sessionId);
      this.stats.totalClosed++;

      this.logger.info('Session closed', { sessionId });
    } catch (error) {
      this.logger.error('Error closing session', {
        sessionId,
        error
      });
      throw error;
    }
  }

  /**
   * Handle session eviction (called by LRU cache)
   */
  private async handleSessionEviction(session: Session, key: string): Promise<void> {
    this.logger.info('Session evicted from cache', {
      sessionId: key,
      age: Date.now() - session.createdAt.getTime(),
      idleTime: Date.now() - session.lastAccessedAt.getTime()
    });

    this.stats.totalEvicted++;

    // Close the session
    if (session.state !== 'closed') {
      try {
        session.state = 'closing';
        await session.orchestrator.stop();
        session.state = 'closed';
      } catch (error) {
        this.logger.error('Error stopping evicted session', {
          sessionId: key,
          error
        });
      }
    }
  }

  /**
   * Check for stale sessions and evict them
   */
  private checkStaleSessions(): void {
    const now = Date.now();
    const staleSessionIds: string[] = [];

    for (const [sessionId, session] of this.sessions.entries()) {
      const idleTime = now - session.lastAccessedAt.getTime();

      if (idleTime > this.config.sessionTimeout) {
        staleSessionIds.push(sessionId);
      }
    }

    if (staleSessionIds.length > 0) {
      this.logger.info('Evicting stale sessions', {
        count: staleSessionIds.length,
        sessionIds: staleSessionIds
      });

      // LRU cache will call dispose callback
      staleSessionIds.forEach(sessionId => {
        this.sessions.delete(sessionId);
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
      newestSessionAge: sessionAges.length > 0 ? Math.min(...sessionAges) : 0
    };
  }

  /**
   * Check if a session exists
   */
  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  /**
   * Get active session count
   */
  getActiveSessionCount(): number {
    return this.sessions.size;
  }
}
