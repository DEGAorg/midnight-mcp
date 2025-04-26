import { NetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Calculate root directory path for finding .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Load environment variables from .env file if present
// In production, these will be provided by Docker or the host environment
dotenv.config({ path: path.join(rootDir, '.env') });

interface Config {
  seed: string;
  networkId: NetworkId;
  walletBackupFolder: string;
  walletFilename: string;
  logLevel: string;
}

/**
 * Load and validate configuration from environment variables
 */
export function loadConfig(): Config {
  // Required configurations
  const seed = process.env.SEED;
  if (!seed) {
    throw new Error('SEED environment variable is required');
  }

  // Optional configurations with defaults
  const configuredNetworkId = process.env.NETWORK_ID;
  const foundNetworkId = configuredNetworkId 
    ? NetworkId[configuredNetworkId as keyof typeof NetworkId] 
    : undefined;
  const networkId = foundNetworkId || NetworkId.TestNet;

  // Default wallet filename
  const walletFilename = process.env.WALLET_FILENAME || 'midnight-wallet';

  // Logging configuration
  const logLevel = process.env.LOG_LEVEL || 'info';

  // Default wallet backup folder
  const walletBackupFolder = process.env.WALLET_BACKUP_FOLDER || 'wallet-backups';

  return {
    seed,
    networkId,
    walletBackupFolder,
    walletFilename,
    logLevel
  };
}

// Export a singleton configuration instance
export const config = loadConfig(); 