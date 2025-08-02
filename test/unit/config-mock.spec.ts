// Mock dependencies - must be at the very top
jest.mock('@midnight-ntwrk/wallet');
jest.mock('@midnight-ntwrk/ledger');
jest.mock('@midnight-ntwrk/midnight-js-network-id');
jest.mock('../../../src/utils/file-manager');

import { describe, it, beforeAll, afterAll, beforeEach, afterEach, jest, expect } from '@jest/globals';
import { NetworkId } from '@midnight-ntwrk/midnight-js-network-id';

// Mock configuration for testing
const mockConfig = {
  seed: 'test seed phrase',
  networkId: NetworkId.TestNet,
  walletFilename: 'midnight-wallet',
  logLevel: 'info',
  walletBackupFolder: 'wallet-backups',
  useExternalProofServer: false,
  proofServer: undefined,
  indexer: undefined,
  indexerWS: undefined,
  node: undefined
};

// Mock config loader function
const mockLoadConfig = jest.fn().mockReturnValue(mockConfig);

// Create a mock file for config at the correct location
jest.mock('../../../src/config.ts', () => ({
  loadConfig: mockLoadConfig,
  config: mockConfig,
}), { virtual: true });

describe('Config Mock', () => {
  it('should provide a mock config object', () => {
    const { config } = require('../../../src/config.ts');
    expect(config).toBeDefined();
    expect(config.seed).toBe('test seed phrase');
    expect(config.networkId).toBe(NetworkId.TestNet);
  });
  
  it('should provide a mock loadConfig function', () => {
    const { loadConfig } = require('../../../src/config.ts');
    expect(loadConfig).toBeDefined();
    expect(loadConfig()).toBe(mockConfig);
  });
});

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  jest.clearAllMocks();
}); 