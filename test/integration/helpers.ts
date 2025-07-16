import { NetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import type { WalletConfig } from '../../src/wallet/index.js';
import { generateMnemonic } from 'bip39';

/**
 * Helper to generate a random seed phrase for testing
 * @returns A random BIP39 mnemonic
 */
export function generateTestSeed(): string {
  return generateMnemonic();
}

/**
 * Creates a test wallet configuration for a local network
 * @returns WalletConfig suitable for local network testing
 */
export function createLocalNetworkConfig(): WalletConfig {
  return {
    indexer: 'http://localhost:8088/api/v1/graphql',
    indexerWS: 'ws://localhost:8088/api/v1/graphql/ws',
    node: 'http://localhost:9944',
    proofServer: 'http://localhost:6300',
    useExternalProofServer: true
  };
}

/**
 * Function to wait for a wallet to be ready
 * @param isReadyFn Function that returns the ready status
 * @param timeoutMs Maximum time to wait in milliseconds
 * @param intervalMs Interval between checks in milliseconds
 * @returns Promise that resolves when ready, or rejects on timeout
 */
export async function waitForWalletReady(
  isReadyFn: () => boolean,
  timeoutMs = 30000,
  intervalMs = 100
): Promise<void> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const checkReady = () => {
      if (isReadyFn()) {
        return resolve();
      }
      
      if (Date.now() - startTime > timeoutMs) {
        return reject(new Error(`Timed out waiting for wallet to be ready after ${timeoutMs}ms`));
      }
      
      setTimeout(checkReady, intervalMs);
    };
    
    checkReady();
  });
}

/**
 * Get the network ID based on environment variables or default to Undeployed
 * @returns The appropriate NetworkId for testing
 */
export function getTestNetworkId(): NetworkId {
  const envNetwork = process.env.TEST_NETWORK_ID;
  
  if (envNetwork) {
    return envNetwork as NetworkId;
  }
  
  return NetworkId.Undeployed;
}

/**
 * Converts an amount string from micro units (e.g., '1000000') to decimal units (e.g., '1')
 * by dividing by 1,000,000. Both input and output are strings.
 * 
 * @param microAmount String representing amount in micro units (e.g., "1000000")
 * @returns String representing amount in decimal units (e.g., "1")
 */
export function convertMicroToDecimal(microAmount: string): string {
  if (!microAmount) {
    throw new Error('Amount must be provided');
  }

  // Check if the string represents a valid integer
  if (!/^\d+$/.test(microAmount)) {
    throw new Error('Amount must be a valid integer string');
  }

  // Convert to BigInt for precise division
  const amountBigInt = BigInt(microAmount);
  const divisor = BigInt(1_000_000);
  
  // Perform division
  const quotient = amountBigInt / divisor;
  const remainder = amountBigInt % divisor;
  
  // Convert quotient to string
  let result = quotient.toString();
  
  // If there's a remainder, add decimal part
  if (remainder > 0) {
    const remainderStr = remainder.toString().padStart(6, '0');
    // Remove trailing zeros from remainder
    const trimmedRemainder = remainderStr.replace(/0+$/, '');
    if (trimmedRemainder) {
      result += `.${trimmedRemainder}`;
    }
  }
  
  return result;
} 