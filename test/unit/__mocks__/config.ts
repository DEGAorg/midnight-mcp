export const config = {
  agentId: 'test-agent',
  walletBackupFolder: '/tmp/test-wallet',
  logDir: '/tmp/test-logs',
  proofServer: 'http://test-proof.com',
  indexer: 'https://test-indexer.com',
  indexerWS: 'wss://test-indexer.com/ws',
  node: 'https://test-node.com',
  useExternalProofServer: true,
  networkId: 'test-network',
  walletFilename: 'test-wallet.json',
};

export const WalletBuilder = {
  buildFromSeed: jest.fn(),
  restore: jest.fn(),
};

export const WalletManager = jest.fn().mockImplementation(() => ({
  getAddress: jest.fn(),
  getBalance: jest.fn(),
  close: jest.fn(),
}));

export const TestnetRemoteConfig = jest.fn().mockImplementation(() => ({}));
