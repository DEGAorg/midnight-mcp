/**
 * Session Manager Types
 *
 * Type definitions for multi-agent session management.
 * Supports per-session service isolation with LRU eviction.
 */

import type { ServiceDependencies } from '../types.js';
import type { WalletOrchestrator } from '../../services/WalletOrchestrator.js';

/**
 * Session data stored per agent
 */
export interface Session {
  /** Unique session identifier */
  sessionId: string;

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
    /** Network URL */
    networkUrl: string;

    /** Indexer URL */
    indexerUrl: string;

    /** Proving server URL */
    provingServerUrl: string;

    /** DAO contract address (optional) */
    daoContractAddress?: string;

    /** Marketplace contract address (optional) */
    marketplaceContractAddress?: string;
  };
}

/**
 * Session creation options
 */
export interface CreateSessionOptions {
  /** Session ID */
  sessionId: string;

  /** Agent-specific seed for wallet */
  seed: string;

  /** Override DAO contract address */
  daoContractAddress?: string;

  /** Override marketplace contract address */
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
}
