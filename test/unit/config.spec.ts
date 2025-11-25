import { describe, it, beforeEach, afterEach, jest, expect } from '@jest/globals';
import { NetworkId } from '@midnight-ntwrk/midnight-js-network-id';

// Mock path
jest.mock('path', () => ({
  default: {
    resolve: jest.fn((a, b) => `${a}/${b}`),
    dirname: jest.fn((p: string) => p.replace('/file.js', '')),
    join: jest.fn((...args) => args.join('/')),
    isAbsolute: jest.fn((p: string) => p.startsWith('/')),
  },
  resolve: jest.fn((a, b) => `${a}/${b}`),
  dirname: jest.fn((p: string) => p.replace('/file.js', '')),
  join: jest.fn((...args) => args.join('/')),
  isAbsolute: jest.fn((p: string) => p.startsWith('/')),
}));

// Mock url
jest.mock('url', () => ({
  default: {
    fileURLToPath: jest.fn((url: string) => url.replace('file://', '')),
  },
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
    DevNet: 'DevNet',
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
    delete process.env.API_PORT;
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  describe('loadConfig function', () => {
    it('should throw error if AGENT_ID is not provided', async () => {
      await expect(async () => {
        const { loadConfig } = await import('@lib/config/env.js');
        loadConfig();
      }).rejects.toThrow('Configuration validation failed');
    });

    it('should use default values when minimal env is provided', async () => {
      // Set minimal environment
      process.env.AGENT_ID = 'test-agent';

      const { loadConfig } = await import('@lib/config/env.js');
      const config = loadConfig();

      expect(config.AGENT_ID).toBe('test-agent');
      expect(config.NETWORK_ID).toBe('TestNet');
      expect(config.WALLET_FILENAME).toBe('midnight-wallet');
      expect(config.LOG_LEVEL).toBe('info');
      expect(config.USE_EXTERNAL_PROOF_SERVER).toBe(false);
      expect(config.WALLET_SERVER_HOST).toBe('localhost');
    });

    it('should use provided environment variables', async () => {
      // Set all environment variables
      process.env.AGENT_ID = 'test-agent';
      process.env.NETWORK_ID = 'MainNet';
      process.env.WALLET_FILENAME = 'custom-wallet';
      process.env.LOG_LEVEL = 'debug';
      process.env.WALLET_SERVER_HOST = '0.0.0.0';
      process.env.WALLET_SERVER_PORT = '8080';

      const { loadConfig } = await import('@lib/config/env.js');
      const config = loadConfig();

      expect(config.AGENT_ID).toBe('test-agent');
      expect(config.NETWORK_ID).toBe('MainNet');
      expect(config.WALLET_FILENAME).toBe('custom-wallet');
      expect(config.LOG_LEVEL).toBe('debug');
      expect(config.WALLET_SERVER_HOST).toBe('0.0.0.0');
      expect(config.WALLET_SERVER_PORT).toBe(8080);
    });

    it('should reject invalid network ID', async () => {
      process.env.AGENT_ID = 'test-agent';
      process.env.NETWORK_ID = 'InvalidNetwork';

      await expect(async () => {
        const { loadConfig } = await import('@lib/config/env.js');
        loadConfig();
      }).rejects.toThrow('Configuration validation failed');
    });

    it('should handle external proof server configuration when enabled', async () => {
      process.env.AGENT_ID = 'test-agent';
      process.env.USE_EXTERNAL_PROOF_SERVER = 'true';
      process.env.PROOF_SERVER = 'https://proof.example.com';
      process.env.INDEXER = 'https://indexer.example.com';
      process.env.INDEXER_WS = 'wss://indexer-ws.example.com';
      process.env.MN_NODE = 'https://node.example.com';

      const { loadConfig } = await import('@lib/config/env.js');
      const config = loadConfig();

      expect(config.USE_EXTERNAL_PROOF_SERVER).toBe(true);
      expect(config.PROOF_SERVER).toBe('https://proof.example.com');
      expect(config.INDEXER).toBe('https://indexer.example.com');
      expect(config.INDEXER_WS).toBe('wss://indexer-ws.example.com');
      expect(config.MN_NODE).toBe('https://node.example.com');
    });

    it('should use defaults when external proof server is enabled but env vars are missing', async () => {
      process.env.AGENT_ID = 'test-agent';
      process.env.USE_EXTERNAL_PROOF_SERVER = 'true';
      // Missing PROOF_SERVER, INDEXER, INDEXER_WS, MN_NODE - should use defaults

      const { loadConfig } = await import('@lib/config/env.js');
      const config = loadConfig();

      expect(config.USE_EXTERNAL_PROOF_SERVER).toBe(true);
      // Defaults should be applied
      expect(config.PROOF_SERVER).toBeDefined();
      expect(config.INDEXER).toBeDefined();
      expect(config.INDEXER_WS).toBeDefined();
      expect(config.MN_NODE).toBeDefined();
    });

    it('should handle API port configuration', async () => {
      process.env.AGENT_ID = 'test-agent';
      process.env.API_PORT = '8080';

      const { loadConfig } = await import('@lib/config/env.js');
      const config = loadConfig();

      expect(config.API_PORT).toBe(8080);
    });

    it('should handle wallet server port configuration', async () => {
      process.env.AGENT_ID = 'test-agent';
      process.env.WALLET_SERVER_PORT = '9090';

      const { loadConfig } = await import('@lib/config/env.js');
      const config = loadConfig();

      expect(config.WALLET_SERVER_PORT).toBe(9090);
    });

    it('should handle wallet server host configuration', async () => {
      process.env.AGENT_ID = 'test-agent';
      process.env.WALLET_SERVER_HOST = '0.0.0.0';

      const { loadConfig } = await import('@lib/config/env.js');
      const config = loadConfig();

      expect(config.WALLET_SERVER_HOST).toBe('0.0.0.0');
    });

    it('should handle DAO contract address', async () => {
      process.env.AGENT_ID = 'test-agent';
      process.env.DAO_CONTRACT_ADDRESS = '0xdao123';

      const { loadConfig } = await import('@lib/config/env.js');
      const config = loadConfig();

      expect(config.DAO_CONTRACT_ADDRESS).toBe('0xdao123');
    });

    it('should handle marketplace contract address', async () => {
      process.env.AGENT_ID = 'test-agent';
      process.env.MARKETPLACE_CONTRACT_ADDRESS = '0xmarket123';

      const { loadConfig } = await import('@lib/config/env.js');
      const config = loadConfig();

      expect(config.MARKETPLACE_CONTRACT_ADDRESS).toBe('0xmarket123');
    });
  });

  describe('getNetworkId helper', () => {
    it('should convert config NETWORK_ID to NetworkId enum', async () => {
      process.env.AGENT_ID = 'test-agent';
      process.env.NETWORK_ID = 'TestNet';

      const { loadConfig, getNetworkId } = await import('@lib/config/env.js');
      const config = loadConfig();
      const networkId = getNetworkId(config);

      expect(networkId).toBe(NetworkId.TestNet);
    });
  });

  describe('getWalletBackupFolder helper', () => {
    it('should return agent-specific wallet backup folder', async () => {
      process.env.AGENT_ID = 'test-agent';
      process.env.WALLET_BACKUP_FOLDER = 'custom-backups';

      const { loadConfig, getWalletBackupFolder } = await import('@lib/config/env.js');
      const config = loadConfig();
      const backupFolder = getWalletBackupFolder(config);

      expect(backupFolder).toContain('test-agent');
      expect(backupFolder).toContain('custom-backups');
    });
  });

  describe('feature flags', () => {
    it('should enable API by default', async () => {
      process.env.AGENT_ID = 'test-agent';

      const { loadConfig } = await import('@lib/config/env.js');
      const config = loadConfig();

      expect(config.ENABLE_API).toBe(true);
    });

    it('should enable MCP by default', async () => {
      process.env.AGENT_ID = 'test-agent';

      const { loadConfig } = await import('@lib/config/env.js');
      const config = loadConfig();

      expect(config.ENABLE_MCP).toBe(true);
    });

    it('should disable API when ENABLE_API is false', async () => {
      process.env.AGENT_ID = 'test-agent';
      process.env.ENABLE_API = 'false';

      const { loadConfig } = await import('@lib/config/env.js');
      const config = loadConfig();

      expect(config.ENABLE_API).toBe(false);
    });

    it('should disable MCP when ENABLE_MCP is false', async () => {
      process.env.AGENT_ID = 'test-agent';
      process.env.ENABLE_MCP = 'false';

      const { loadConfig } = await import('@lib/config/env.js');
      const config = loadConfig();

      expect(config.ENABLE_MCP).toBe(false);
    });
  });

  describe('fileURLToPath error handling', () => {
    it('should handle fileURLToPath errors gracefully', async () => {
      const { fileURLToPath } = await import('url');
      (fileURLToPath as jest.MockedFunction<typeof fileURLToPath>).mockImplementation(() => {
        throw new Error('fileURLToPath error');
      });

      process.env.AGENT_ID = 'test-agent';

      const { loadConfig } = await import('@lib/config/env.js');
      const config = loadConfig();

      // Should still work by falling back to process.cwd()
      expect(config.AGENT_ID).toBe('test-agent');
      expect(config.NETWORK_ID).toBe('TestNet');
    });
  });
});
