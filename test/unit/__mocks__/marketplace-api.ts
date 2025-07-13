// Simple mock for marketplace API - just export the functions that are imported
// This avoids all the complex marketplace contract logic that's tested in integration tests

export const isPublicKeyRegistered = jest.fn(() => Promise.resolve(true));
export const verifyTextPure = jest.fn(() => Promise.resolve('mock-text'));
export const joinContract = jest.fn(() => Promise.resolve({
  deployTxData: {
    public: {
      contractAddress: 'mock-contract-address',
    },
  },
  callTx: {
    register: jest.fn(() => Promise.resolve({ public: { txId: 'mock-tx-id', blockHeight: 1 } })),
  },
}));
export const register = jest.fn(() => Promise.resolve({
  txId: 'mock-tx-id',
  blockHeight: 1,
}));
export const marketplaceRegistryContractInstance = {
  contract: 'mock-contract-instance',
  deploy: jest.fn(() => Promise.resolve('mock-deployed')),
  call: jest.fn(() => Promise.resolve({ success: true })),
};
export const configureProviders = jest.fn(() => Promise.resolve({
  privateStateProvider: { provider: 'mock-private' },
  publicDataProvider: { provider: 'mock-public' },
  zkConfigProvider: { provider: 'mock-zk' },
  proofProvider: { provider: 'mock-proof' },
  walletProvider: { provider: 'mock-wallet' },
  midnightProvider: { provider: 'mock-midnight' },
}));

// Also export the types that might be needed
export const MarketplaceRegistry = {
  Contract: jest.fn(() => ({ contract: 'mock-contract-instance' })),
  ledger: jest.fn(() => ({ 
    registry: { 
      member: jest.fn(() => true), 
      lookup: jest.fn(() => 'mock-text') 
    } 
  })),
};
export const witnesses = {
  create: jest.fn(() => ({ witness: 'mock-witness' })),
  validate: jest.fn(() => true),
  generate: jest.fn(() => ({ proof: 'mock-proof' })),
  verify: jest.fn(() => true)
};

// Default export
export default {
  isPublicKeyRegistered,
  verifyTextPure,
  joinContract,
  register,
  marketplaceRegistryContractInstance,
  configureProviders,
  MarketplaceRegistry,
  witnesses,
}; 