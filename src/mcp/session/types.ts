/**
 * Session Manager Types
 *
 * Type definitions for multi-agent session management.
 * Supports per-session service isolation with LRU eviction.
 *
 * ARCHITECTURE:
 * - sessionId from HTTP header = agentId for system
 * - Seeds loaded via SeedManager.getAgentSeed(agentId)
 * - Files stored via FileManager with agentId
 */

import type { ServiceDependencies } from '../types.js';
import type { WalletOrchestrator } from '../../services/WalletOrchestrator.js';

/**
 * Session data stored per agent
 */
export interface Session {
  /** Agent ID (same as sessionId from HTTP header) */
  agentId: string;

  /** Service dependencies for this session */
  services: ServiceDependencies;

  /** Wallet orchestrator managing this session's services */
  orchestrator: WalletOrchestrator;

  /** When this session was created */
  createdAt: Date;

  /** Last access time (for LRU eviction) */
  lastAccessedAt: Date;

  /** Session state */
  state: 'initializing' | 'active' | 'closing' | 'closed';

  /** Set of agent IDs tracked in this session */
  agentIds: Set<string>;
}

/**
 * Session Manager Configuration
 */
export interface SessionManagerConfig {
  /** Maximum number of concurrent sessions (default: 100) */
  maxSessions: number;

  /** Session idle timeout in milliseconds (default: 30 minutes) */
  sessionTimeout: number;

  /** Eviction check interval in milliseconds (default: 5 minutes) */
  evictionInterval: number;

  /** Base configuration for wallet orchestrators */
  baseConfig: {
    /** Indexer GraphQL endpoint */
    indexer: string;

    /** Indexer WebSocket endpoint */
    indexerWS: string;

    /** ZKP proof server endpoint */
    proofServer: string;

    /** Midnight node RPC endpoint */
    node: string;

    /** Wallet filename pattern (default: 'wallet') */
    walletFilename: string;

    /** DAO contract address (optional) */
    daoContractAddress?: string;

    /** Marketplace contract address (optional) */
    marketplaceContractAddress?: string;
  };
}

/**
 * Session creation options
 *
 * NOTE: No seed parameter - seeds are loaded from SeedManager
 */
export interface CreateSessionOptions {
  /**
   * Agent ID (typically from Mcp-Session-Id HTTP header)
   * This is used to:
   * - Load seed via SeedManager.getAgentSeed(agentId)
   * - Create wallet path via FileManager
   * - Initialize orchestrator with agentId
   */
  agentId: string;

  /** Override DAO contract address for this session */
  daoContractAddress?: string;

  /** Override marketplace contract address for this session */
  marketplaceContractAddress?: string;
}

/**
 * Session statistics
 */
export interface SessionStats {
  /** Total number of active sessions */
  activeSessions: number;

  /** Total sessions created since start */
  totalCreated: number;

  /** Total sessions evicted */
  totalEvicted: number;

  /** Total sessions closed */
  totalClosed: number;

  /** Oldest session age in milliseconds */
  oldestSessionAge: number;

  /** Most recently accessed session age */
  newestSessionAge: number;

  /** Maximum sessions allowed */
  maxSessions: number;

  /** Utilization percentage */
  utilizationPercent: number;
}
