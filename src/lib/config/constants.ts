/**
 * Application Constants
 *
 * Centralized constants to replace magic numbers throughout the codebase.
 * All hardcoded values should be defined here for easy configuration and maintenance.
 */

// ===== Server Configuration =====
export const DEFAULT_API_PORT = 3000;
export const DEFAULT_SERVER_PORT = 3000;

// ===== Proof Server Configuration =====
export const DEFAULT_PROOF_SERVER_PORT = 6300;
// NOTE: Docker management removed - always use external proof server

// ===== Timeout Configuration (milliseconds) =====
export const DEFAULT_REQUEST_TIMEOUT_MS = 30000;        // 30 seconds
export const DEFAULT_HTTP_TIMEOUT_MS = 5000;            // 5 seconds
export const LONG_RUNNING_OPERATION_TIMEOUT_MS = 15000; // 15 seconds
export const WALLET_SYNC_POLL_INTERVAL_MS = 1000;       // 1 second

// ===== Retry Configuration =====
export const MAX_RETRY_ATTEMPTS = 3;
export const RETRY_DELAY_MS = 1000;

// ===== Transaction Configuration =====
export const TRANSACTION_CONFIRMATION_BLOCKS = 6;
export const TRANSACTION_POLL_INTERVAL_MS = 1000;

// ===== Storage Configuration =====
export const DEFAULT_STORAGE_DIR = '.storage';
export const DEFAULT_WALLET_BACKUP_FOLDER = '.storage/wallet-backups';
export const DEFAULT_LOG_DIR = './logs';
export const DEFAULT_DB_DIR = '.storage/db';

// ===== Wallet Configuration =====
export const DEFAULT_WALLET_FILENAME = 'midnight-wallet';

// ===== Network Configuration =====
export const SUPPORTED_NETWORK_IDS = ['TestNet', 'DevNet', 'MainNet'] as const;
export type SupportedNetworkId = typeof SUPPORTED_NETWORK_IDS[number];

// ===== Logging Configuration =====
export const LOG_LEVELS = ['error', 'warn', 'info', 'debug', 'trace'] as const;
export type LogLevel = typeof LOG_LEVELS[number];
export const DEFAULT_LOG_LEVEL: LogLevel = 'info';

// ===== API Configuration =====
export const API_RATE_LIMIT_WINDOW_MS = 60000;  // 1 minute
export const API_RATE_LIMIT_MAX_REQUESTS = 100;
export const API_REQUEST_SIZE_LIMIT = '10mb';

// ===== MCP Configuration =====
export const MCP_TOOL_TIMEOUT_MS = 30000;
export const MCP_MAX_CONCURRENT_REQUESTS = 10;

// ===== Audit Configuration =====
export const AUDIT_LOG_RETENTION_DAYS = 90;
export const AUDIT_BATCH_SIZE = 100;
export const AUDIT_ENABLED = true;
export const AUDIT_MAX_EVENTS_IN_MEMORY = 1000;
export const AUDIT_FLUSH_INTERVAL_MS = 30000;

// ===== Recovery Configuration =====
/**
 * Wallet recovery configuration using exponential backoff with jitter
 * Prevents thundering herd problem in multi-agent deployments
 */
export const RECOVERY_CONFIG = {
  /** Maximum number of recovery attempts before giving up */
  MAX_ATTEMPTS: 5,

  /** Base backoff time in milliseconds */
  BASE_BACKOFF_MS: 5000,

  /** Maximum backoff time in milliseconds (capped to prevent excessive waits) */
  MAX_BACKOFF_MS: 60000,

  /** Backoff multiplier for exponential growth (2 = double each time) */
  BACKOFF_MULTIPLIER: 2,

  /** Jitter factor for randomization (0.3 = ±30% random variance) */
  JITTER_FACTOR: 0.3,
} as const;

// ===== Transaction Polling Configuration =====
/**
 * Transaction status polling configuration
 * Checks for SENT → COMPLETED transitions
 */
export const TRANSACTION_POLLING_CONFIG = {
  /** Default polling interval in milliseconds */
  DEFAULT_INTERVAL_MS: 15000,

  /** Minimum allowed polling interval */
  MIN_INTERVAL_MS: 5000,

  /** Maximum allowed polling interval */
  MAX_INTERVAL_MS: 60000,
} as const;

// ===== Wallet Sync Configuration =====
/**
 * Wallet state saving configuration
 * Throttles wallet saves to prevent excessive I/O
 */
export const WALLET_SYNC_CONFIG = {
  /** Minimum time between wallet saves during sync */
  SAVE_INTERVAL_MS: 5000,

  /** Polling interval for checking wallet sync status */
  POLL_INTERVAL_MS: 1000,
} as const;

// ===== Token Configuration =====
/**
 * Token-related constants
 */
export const TOKEN_CONFIG = {
  /** Default decimal places for tokens */
  DEFAULT_DECIMALS: 6,

  /** Domain separator for custom tokens */
  DEFAULT_DOMAIN_SEPARATOR: 'custom_token',

  /** DAO voting token domain separator */
  DAO_VOTE_DOMAIN_SEPARATOR: 'dega_dao_vote',

  /** DAO funding token domain separator */
  DAO_FUNDING_DOMAIN_SEPARATOR: 'dega_funding_token',

  /** Default vote coin value (500 tokens) */
  DEFAULT_VOTE_COIN_VALUE: 500n,

  /** Default treasury funding amount (100 tokens) */
  DEFAULT_TREASURY_FUNDING_VALUE: 100n,
} as const;

// ===== DAO Configuration =====
/**
 * DAO contract configuration
 */
export const DAO_CONFIG = {
  /** Private state store name for DAO contracts */
  PRIVATE_STATE_STORE_NAME: 'dao-voting-private-state',

  /** ZK config path for DAO contracts */
  ZK_CONFIG_PATH: 'src/contracts/dao/contract/managed/dao-voting',
} as const;

// ===== Marketplace Configuration =====
/**
 * Marketplace contract configuration
 */
export const MARKETPLACE_CONFIG = {
  /** Private state store name for marketplace contracts */
  PRIVATE_STATE_STORE_NAME: 'marketplace-private-state',

  /** ZK config path for marketplace contracts */
  ZK_CONFIG_PATH: 'src/contracts/marketplace/contract/managed/marketplace',
} as const;

// ===== File Storage Configuration =====
/**
 * File storage configuration for FileManager
 */
export const FILE_STORAGE_CONFIG = {
  /** Base directory for all file storage */
  BASE_DIR: '.storage',

  /** Directory permissions for general directories */
  DIR_MODE: 0o755,

  /** File permissions for general files */
  FILE_MODE: 0o644,

  /** Directory permissions for sensitive data (seeds) */
  SENSITIVE_DIR_MODE: 0o700,

  /** File permissions for sensitive data (seeds) */
  SENSITIVE_FILE_MODE: 0o600,

  /** Use agent-specific subdirectories */
  USE_AGENT_SUBDIRS: true,
} as const;

// ===== Testnet Configuration =====
/**
 * Testnet endpoints (defaults)
 */
export const TESTNET_CONFIG = {
  INDEXER: 'https://indexer.testnet-02.midnight.network/api/v1/graphql',
  INDEXER_WS: 'wss://indexer.testnet-02.midnight.network/api/v1/graphql/ws',
  MN_NODE: 'https://rpc.testnet-02.midnight.network',
} as const;
