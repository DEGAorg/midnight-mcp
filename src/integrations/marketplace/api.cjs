// CommonJS version of marketplace API for Jest compatibility
// This provides the same exports as the TypeScript version but in CommonJS format

const isPublicKeyRegistered = jest.fn(() => Promise.resolve(true));
const verifyTextPure = jest.fn(() => Promise.resolve('mock-text'));
const joinContract = jest.fn(() => Promise.resolve({
  deployTxData: {
    public: {
      contractAddress: 'mock-contract-address',
    },
  },
  callTx: {
    register: jest.fn(() => Promise.resolve({ public: { txId: 'mock-tx-id', blockHeight: 1 } })),
  },
}));
const register = jest.fn(() => Promise.resolve({
  txId: 'mock-tx-id',
  blockHeight: 1,
}));
const marketplaceRegistryContractInstance = {
  contract: 'mock-contract-instance',
  deploy: jest.fn(() => Promise.resolve('mock-deployed')),
  call: jest.fn(() => Promise.resolve({ success: true })),
};
const configureProviders = jest.fn(() => Promise.resolve({
  privateStateProvider: { provider: 'mock-private' },
  publicDataProvider: { provider: 'mock-public' },
  zkConfigProvider: { provider: 'mock-zk' },
  proofProvider: { provider: 'mock-proof' },
  walletProvider: { provider: 'mock-wallet' },
  midnightProvider: { provider: 'mock-midnight' },
}));

const MarketplaceRegistry = {
  Contract: jest.fn(() => ({ contract: 'mock-contract-instance' })),
  ledger: jest.fn(() => ({ 
    registry: { 
      member: jest.fn(() => true), 
      lookup: jest.fn(() => 'mock-text') 
    } 
  })),
};

const witnesses = {
  create: jest.fn(() => ({ witness: 'mock-witness' })),
  validate: jest.fn(() => true),
  generate: jest.fn(() => ({ proof: 'mock-proof' })),
  verify: jest.fn(() => true)
};

module.exports = {
  isPublicKeyRegistered,
  verifyTextPure,
  joinContract,
  register,
  marketplaceRegistryContractInstance,
  configureProviders,
  MarketplaceRegistry,
  witnesses,
}; 