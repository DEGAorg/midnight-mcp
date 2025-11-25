/**
 * Environment Configuration with Zod Validation
 *
 * Loads and validates environment variables with type safety.
 * Replaces the old config.ts with a more robust approach.
 */

import { NetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';
import {
  DEFAULT_API_PORT,
  DEFAULT_WALLET_FILENAME,
  DEFAULT_WALLET_BACKUP_FOLDER,
  DEFAULT_LOG_LEVEL,
  DEFAULT_PROOF_SERVER_PORT,
  DEFAULT_STORAGE_DIR,
  LOG_LEVELS,
  SUPPORTED_NETWORK_IDS,
  TESTNET_CONFIG,
} from './constants.js';

// Calculate root directory path (project root, not process.cwd())
// This ensures relative paths resolve correctly regardless of where the process is started
let rootDir: string;

try {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  rootDir = path.resolve(__dirname, '../../..');
} catch (err) {
  rootDir = process.cwd();
}

// Export rootDir for use by other modules
export { rootDir };

/**
 * Resolve a path relative to the project root
 * If the path is absolute, return it as-is
 * If the path is relative, resolve it from rootDir
 */
export function resolveProjectPath(relativePath: string): string {
  return path.isAbsolute(relativePath)
    ? relativePath
    : path.resolve(rootDir, relativePath);
}

// ===== Zod Schema Definitions =====

const NetworkIdSchema = z.enum(SUPPORTED_NETWORK_IDS);

const LogLevelSchema = z.enum(LOG_LEVELS);

const ConfigSchema = z.object({
  // Agent Configuration
  AGENT_ID: z.string().min(1, 'AGENT_ID is required'),

  // Network Configuration
  NETWORK_ID: NetworkIdSchema.default('TestNet'),

  // Storage Configuration
  BASE_STORAGE_DIR: z.string().default(DEFAULT_STORAGE_DIR),

  // Wallet Configuration
  WALLET_FILENAME: z.string().default(DEFAULT_WALLET_FILENAME),
  WALLET_BACKUP_FOLDER: z.string().default(DEFAULT_WALLET_BACKUP_FOLDER),
  // NOTE: WALLET_SEED is NOT in env - it's loaded per-agent from {BASE_STORAGE_DIR}/seeds/{agentId}/seed via SeedManager

  // Network Endpoints - defaults from TESTNET_CONFIG
  PROOF_SERVER: z.string().url().default(`http://127.0.0.1:${DEFAULT_PROOF_SERVER_PORT}`),
  INDEXER: z.string().url().default(TESTNET_CONFIG.INDEXER),
  INDEXER_WS: z.string().url().default(TESTNET_CONFIG.INDEXER_WS),
  MN_NODE: z.string().url().default(TESTNET_CONFIG.MN_NODE),

  // External Proof Server Configuration (legacy flag, endpoints now have defaults)
  USE_EXTERNAL_PROOF_SERVER: z.boolean().default(false),

  // Contract Configuration
  DAO_CONTRACT_ADDRESS: z.string().optional(),
  MARKETPLACE_CONTRACT_ADDRESS: z.string().optional(),

  // Server Configuration
  API_PORT: z.number().int().min(1).max(65535).default(DEFAULT_API_PORT),
  SERVER_PORT: z.number().int().min(1).max(65535).default(DEFAULT_API_PORT),
  WALLET_SERVER_HOST: z.string().default('localhost'),
  WALLET_SERVER_PORT: z.number().int().min(1).max(65535).default(DEFAULT_API_PORT),

  // Feature Flags
  ENABLE_API: z.boolean().default(true),
  ENABLE_MCP: z.boolean().default(true),

  // Logging Configuration
  LOG_LEVEL: LogLevelSchema.default(DEFAULT_LOG_LEVEL),
});

export type AppConfig = z.infer<typeof ConfigSchema>;

// ===== Configuration Loader =====

/**
 * Load and validate environment configuration
 *
 * @param envPath - Optional path to .env file
 * @returns Validated configuration object
 * @throws Error if validation fails or required variables are missing
 */
export function loadConfig(envPath?: string): AppConfig {
  // Load environment variables
  if (envPath) {
    dotenv.config({ path: envPath });
  } else {
    dotenv.config({ path: path.join(rootDir, '.env') });
  }

  // Parse and validate environment variables
  const rawConfig = {
    AGENT_ID: process.env.AGENT_ID,
    NETWORK_ID: process.env.NETWORK_ID as typeof SUPPORTED_NETWORK_IDS[number] | undefined,
    BASE_STORAGE_DIR: process.env.BASE_STORAGE_DIR,
    WALLET_FILENAME: process.env.WALLET_FILENAME,
    WALLET_BACKUP_FOLDER: process.env.WALLET_BACKUP_FOLDER,
    USE_EXTERNAL_PROOF_SERVER: process.env.USE_EXTERNAL_PROOF_SERVER === 'true',
    PROOF_SERVER: process.env.PROOF_SERVER,
    INDEXER: process.env.INDEXER,
    INDEXER_WS: process.env.INDEXER_WS,
    MN_NODE: process.env.MN_NODE,
    DAO_CONTRACT_ADDRESS: process.env.DAO_CONTRACT_ADDRESS,
    MARKETPLACE_CONTRACT_ADDRESS: process.env.MARKETPLACE_CONTRACT_ADDRESS,
    API_PORT: process.env.API_PORT ? parseInt(process.env.API_PORT, 10) : undefined,
    SERVER_PORT: process.env.SERVER_PORT ? parseInt(process.env.SERVER_PORT, 10) : undefined,
    WALLET_SERVER_HOST: process.env.WALLET_SERVER_HOST,
    WALLET_SERVER_PORT: process.env.WALLET_SERVER_PORT
      ? parseInt(process.env.WALLET_SERVER_PORT, 10)
      : undefined,
    ENABLE_API: process.env.ENABLE_API !== 'false',
    ENABLE_MCP: process.env.ENABLE_MCP !== 'false',
    LOG_LEVEL: process.env.LOG_LEVEL && process.env.LOG_LEVEL !== ''
      ? process.env.LOG_LEVEL as typeof LOG_LEVELS[number]
      : undefined,
  };

  try {
    const config = ConfigSchema.parse(rawConfig);

    // Resolve relative paths from project root (not process.cwd())
    // This ensures paths work correctly regardless of where the process is started
    config.BASE_STORAGE_DIR = resolveProjectPath(config.BASE_STORAGE_DIR);
    config.WALLET_BACKUP_FOLDER = resolveProjectPath(config.WALLET_BACKUP_FOLDER);

    // All network endpoints now have defaults from TESTNET_CONFIG
    // No additional validation needed - Zod defaults handle everything

    return config;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors
        .map((err) => `  - ${err.path.join('.')}: ${err.message}`)
        .join('\n');
      throw new Error(`Configuration validation failed:\n${errorMessages}`);
    }
    throw error;
  }
}

/**
 * Convert AppConfig to NetworkId type
 */
export function getNetworkId(config: AppConfig): NetworkId {
  return NetworkId[config.NETWORK_ID as keyof typeof NetworkId];
}

/**
 * Get agent-specific wallet backup folder
 */
export function getWalletBackupFolder(config: AppConfig): string {
  return path.join(config.WALLET_BACKUP_FOLDER, config.AGENT_ID);
}

/**
 * Singleton configuration instance
 * Loaded once at module initialization
 */
export const config = loadConfig();
