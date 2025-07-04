import { describe, it, beforeAll, afterAll, beforeEach, afterEach, jest, expect } from '@jest/globals';
import { NetworkId } from '@midnight-ntwrk/midnight-js-network-id';

// Mock path
jest.mock('path', () => ({
  resolve: jest.fn((a, b) => `${a}/${b}`),
  dirname: jest.fn((p: string) => p.replace('/file.js', '')),
  join: jest.fn((a, b) => `${a}/${b}`),
}));

// Mock url
jest.mock('url', () => ({
  fileURLToPath: jest.fn((url: string) => url.replace('file://', '')),
}));

// Mock dotenv
jest.mock('dotenv', () => ({
  config: jest.fn(),
}));

// Mock the NetworkId enum
jest.mock('@midnight-ntwrk/midnight-js-network-id', () => ({
  NetworkId: {
    TestNet: 'TestNet',
    MainNet: 'MainNet',
    Undeployed: 'Undeployed'
  }
}));

describe('Config Module', () => {
  const originalEnv = process.env;
  
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    process.env = { ...originalEnv };
    
    // Clear all relevant environment variables
    delete process.env.NETWORK_ID;
    delete process.env.WALLET_FILENAME;
    delete process.env.LOG_LEVEL;
    delete process.env.AGENT_ID;
    delete process.env.WALLET_BACKUP_FOLDER;
    delete process.env.USE_EXTERNAL_PROOF_SERVER;
    delete process.env.PROOF_SERVER;
    delete process.env.INDEXER;
    delete process.env.INDEXER_WS;
    delete process.env.MN_NODE;
    delete process.env.SERVER_PORT;
    delete process.env.WALLET_SERVER_HOST;
    delete process.env.WALLET_SERVER_PORT;
  });
  
  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  describe('loadConfig function', () => {
    it('should throw error if AGENT_ID is not provided', async () => {
      await expect(async () => {
        const { loadConfig } = await import('../../src/config.js');
        loadConfig();
      }).rejects.toThrow('AGENT_ID environment variable is required');
    });

    it('should use default values when minimal env is provided', async () => {
      // Set minimal environment
      process.env.AGENT_ID = 'test-agent';
      
      const { loadConfig } = await import('../../src/config.js');
      const config = loadConfig();
      
      expect(config.agentId).toBe('test-agent');
      expect(config.networkId).toBe(NetworkId.TestNet);
      expect(config.walletFilename).toBe('midnight-wallet');
      expect(config.logLevel).toBe('info');
      expect(config.walletBackupFolder).toBe('.storage/wallet-backups/test-agent');
      expect(config.useExternalProofServer).toBe(false);
      expect(config.walletServerHost).toBe('localhost');
      expect(config.walletServerPort).toBe(3000);
    });

    it('should use provided environment variables', async () => {
      // Set all environment variables
      process.env.AGENT_ID = 'test-agent';
      process.env.NETWORK_ID = 'MainNet';
      process.env.WALLET_FILENAME = 'custom-wallet';
      process.env.LOG_LEVEL = 'debug';
      process.env.WALLET_BACKUP_FOLDER = 'custom-backups';
      process.env.WALLET_SERVER_HOST = '0.0.0.0';
      process.env.WALLET_SERVER_PORT = '8080';
      
      const { loadConfig } = await import('../../src/config.js');
      const config = loadConfig();
      
      expect(config.agentId).toBe('test-agent');
      expect(config.networkId).toBe(NetworkId.MainNet);
      expect(config.walletFilename).toBe('custom-wallet');
      expect(config.logLevel).toBe('debug');
      expect(config.walletBackupFolder).toBe('custom-backups/test-agent');
      expect(config.walletServerHost).toBe('0.0.0.0');
      expect(config.walletServerPort).toBe(8080);
    });

    it('should handle invalid network ID gracefully', async () => {
      process.env.AGENT_ID = 'test-agent';
      process.env.NETWORK_ID = 'InvalidNetwork';
      
      const { loadConfig } = await import('../../src/config.js');
      const config = loadConfig();
      
      expect(config.networkId).toBe(NetworkId.TestNet);
    });

    it('should handle external proof server configuration when enabled', async () => {
      process.env.AGENT_ID = 'test-agent';
      process.env.USE_EXTERNAL_PROOF_SERVER = 'true';
      process.env.PROOF_SERVER = 'https://proof.example.com';
      process.env.INDEXER = 'https://indexer.example.com';
      process.env.INDEXER_WS = 'wss://indexer-ws.example.com';
      process.env.MN_NODE = 'https://node.example.com';
      
      const { loadConfig } = await import('../../src/config.js');
      const config = loadConfig();
      
      expect(config.useExternalProofServer).toBe(true);
      expect(config.proofServer).toBe('https://proof.example.com');
      expect(config.indexer).toBe('https://indexer.example.com');
      expect(config.indexerWS).toBe('wss://indexer-ws.example.com');
      expect(config.node).toBe('https://node.example.com');
    });

    it('should throw error when external proof server is enabled but required env vars are missing', async () => {
      process.env.AGENT_ID = 'test-agent';
      process.env.USE_EXTERNAL_PROOF_SERVER = 'true';
      // Missing PROOF_SERVER, INDEXER, INDEXER_WS, MN_NODE
      
      await expect(async () => {
        const { loadConfig } = await import('../../src/config.js');
        loadConfig();
      }).rejects.toThrow('Proof server, indexer, indexerWS, and node are required when USE_EXTERNAL_PROOF_SERVER is true');
    });

    it('should throw error when external proof server is enabled but PROOF_SERVER is missing', async () => {
      process.env.AGENT_ID = 'test-agent';
      process.env.USE_EXTERNAL_PROOF_SERVER = 'true';
      process.env.INDEXER = 'https://indexer.example.com';
      process.env.INDEXER_WS = 'wss://indexer-ws.example.com';
      process.env.MN_NODE = 'https://node.example.com';
      // Missing PROOF_SERVER
      
      await expect(async () => {
        const { loadConfig } = await import('../../src/config.js');
        loadConfig();
      }).rejects.toThrow('Proof server, indexer, indexerWS, and node are required when USE_EXTERNAL_PROOF_SERVER is true');
    });

    it('should throw error when external proof server is enabled but INDEXER is missing', async () => {
      process.env.AGENT_ID = 'test-agent';
      process.env.USE_EXTERNAL_PROOF_SERVER = 'true';
      process.env.PROOF_SERVER = 'https://proof.example.com';
      process.env.INDEXER_WS = 'wss://indexer-ws.example.com';
      process.env.MN_NODE = 'https://node.example.com';
      // Missing INDEXER
      
      await expect(async () => {
        const { loadConfig } = await import('../../src/config.js');
        loadConfig();
      }).rejects.toThrow('Proof server, indexer, indexerWS, and node are required when USE_EXTERNAL_PROOF_SERVER is true');
    });

    it('should throw error when external proof server is enabled but INDEXER_WS is missing', async () => {
      process.env.AGENT_ID = 'test-agent';
      process.env.USE_EXTERNAL_PROOF_SERVER = 'true';
      process.env.PROOF_SERVER = 'https://proof.example.com';
      process.env.INDEXER = 'https://indexer.example.com';
      process.env.MN_NODE = 'https://node.example.com';
      // Missing INDEXER_WS
      
      await expect(async () => {
        const { loadConfig } = await import('../../src/config.js');
        loadConfig();
      }).rejects.toThrow('Proof server, indexer, indexerWS, and node are required when USE_EXTERNAL_PROOF_SERVER is true');
    });

    it('should throw error when external proof server is enabled but MN_NODE is missing', async () => {
      process.env.AGENT_ID = 'test-agent';
      process.env.USE_EXTERNAL_PROOF_SERVER = 'true';
      process.env.PROOF_SERVER = 'https://proof.example.com';
      process.env.INDEXER = 'https://indexer.example.com';
      process.env.INDEXER_WS = 'wss://indexer-ws.example.com';
      // Missing MN_NODE
      
      await expect(async () => {
        const { loadConfig } = await import('../../src/config.js');
        loadConfig();
      }).rejects.toThrow('Proof server, indexer, indexerWS, and node are required when USE_EXTERNAL_PROOF_SERVER is true');
    });

    it('should handle server port configuration', async () => {
      process.env.AGENT_ID = 'test-agent';
      process.env.SERVER_PORT = '8080';
      
      const { loadConfig } = await import('../../src/config.js');
      const config = loadConfig();
      
      // Note: serverPort is not returned in the config object, but the parsing should work
      expect(config.walletServerPort).toBe(3000); // Default value
    });

    it('should handle wallet server port configuration', async () => {
      process.env.AGENT_ID = 'test-agent';
      process.env.WALLET_SERVER_PORT = '8080';
      
      const { loadConfig } = await import('../../src/config.js');
      const config = loadConfig();
      
      expect(config.walletServerPort).toBe(8080);
    });

    it('should handle wallet server host configuration', async () => {
      process.env.AGENT_ID = 'test-agent';
      process.env.WALLET_SERVER_HOST = '0.0.0.0';
      
      const { loadConfig } = await import('../../src/config.js');
      const config = loadConfig();
      
      expect(config.walletServerHost).toBe('0.0.0.0');
    });
  });

  describe('fileURLToPath error handling', () => {
    it('should handle fileURLToPath errors gracefully', async () => {
      const { fileURLToPath } = await import('url');
      (fileURLToPath as jest.MockedFunction<typeof fileURLToPath>).mockImplementation(() => {
        throw new Error('fileURLToPath error');
      });

      process.env.AGENT_ID = 'test-agent';
      
      const { loadConfig } = await import('../../src/config.js');
      const config = loadConfig();
      
      // Should still work by falling back to process.cwd()
      expect(config.agentId).toBe('test-agent');
      expect(config.networkId).toBe(NetworkId.TestNet);
    });
  });

  describe('config singleton', () => {
    it('should export config singleton', async () => {
      process.env.AGENT_ID = 'test-agent';
      
      const { config } = await import('../../src/config.js');
      
      expect(config).toBeDefined();
      expect(config.agentId).toBe('test-agent');
      expect(config.networkId).toBe(NetworkId.TestNet);
    });

    it('should throw error when AGENT_ID is missing in singleton', async () => {
      await expect(async () => {
        const { config } = await import('../../src/config.js');
        console.log(config); // Just to use the variable
      }).rejects.toThrow('AGENT_ID environment variable is required');
    });
  });
}); 