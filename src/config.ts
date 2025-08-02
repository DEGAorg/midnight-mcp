import { NetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Calculate root directory path for finding .env file
let rootDir;

try {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  rootDir = path.resolve(__dirname, '..');
} catch (err) {
  rootDir = process.cwd();
}

// Load environment variables from .env file if present
dotenv.config({ path: path.join(rootDir, '.env') });

interface Config {
  networkId: NetworkId;
  walletBackupFolder: string;
  walletFilename: string;
  logLevel: string;
  useExternalProofServer: boolean;
  proofServer: string;
  indexer: string;
  indexerWS: string;
  node: string;
  agentId: string;
  walletServerHost: string;
  walletServerPort: number;
}

/**
 * Load and validate configuration from environment variables
 */
export function loadConfig(): Config {

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

  // Get agent ID from environment or generate a unique one
  const agentId = process.env.AGENT_ID;
  if (!agentId) {
    throw new Error('AGENT_ID environment variable is required');
  }

  // Default wallet backup folder - now includes agent ID
  const baseWalletBackupFolder = process.env.WALLET_BACKUP_FOLDER || '.storage/wallet-backups';
  const walletBackupFolder = path.join(baseWalletBackupFolder, agentId);

  // External proof server configuration
  const useExternalProofServer = process.env.USE_EXTERNAL_PROOF_SERVER === 'true';
  const proofServer = process.env.PROOF_SERVER;
  const indexer = process.env.INDEXER;
  const indexerWS = process.env.INDEXER_WS;
  const mnNode = process.env.MN_NODE;

  if (useExternalProofServer && (!proofServer || !indexer || !indexerWS || !mnNode)) {
    throw new Error('Proof server, indexer, indexerWS, and node are required when USE_EXTERNAL_PROOF_SERVER is true');
  }

  // Server port configuration
  const serverPort = parseInt(process.env.SERVER_PORT || '3000', 10);

  // Wallet server configuration
  const walletServerHost = process.env.WALLET_SERVER_HOST || 'localhost';
  const walletServerPort = parseInt(process.env.WALLET_SERVER_PORT || '3000', 10);

  return {
    networkId,
    walletBackupFolder,
    walletFilename,
    logLevel,
    useExternalProofServer,
    proofServer: proofServer || '',
    indexer: indexer || '',
    indexerWS: indexerWS || '',
    node: mnNode || '',
    agentId,
    walletServerHost,
    walletServerPort
  };
}

// Export a singleton configuration instance
export const config = loadConfig(); 