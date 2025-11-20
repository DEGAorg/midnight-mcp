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
export const PROOF_SERVER_CONTAINER_NAME = 'proof-server';

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
