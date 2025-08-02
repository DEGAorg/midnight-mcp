// Mock for @midnight-ntwrk/zswap package
// This mock provides common zswap-related functionality that might be used in the application

// Mock contract address validation
export const assertIsContractAddress = jest.fn((address: string) => {
  if (!address || typeof address !== 'string') {
    throw new Error('Invalid contract address');
  }
  return address;
});

// Mock contract-related types and functions
export const ContractAddress = jest.fn((address: string) => {
  assertIsContractAddress(address);
  return address;
});

// Mock marketplace registry types
export const DeployedMarketplaceRegistryContract = jest.fn();
export const MarketplaceRegistryContract = jest.fn();
export const MarketplaceRegistryProviders = jest.fn();
export const RegistryState = jest.fn();

// Mock contract functions
export const findDeployedContract = jest.fn(() => ({
  address: 'mock-contract-address',
  state: 'deployed'
}));

export const FinalizedCallTxData = jest.fn();
export const FinalizedTxData = jest.fn();

// Mock marketplace registry
export const MarketplaceRegistry = {
  deploy: jest.fn(() => Promise.resolve('mock-deployed-address')),
  call: jest.fn(() => Promise.resolve({ success: true })),
  getState: jest.fn(() => Promise.resolve({ state: 'active' }))
};

// Mock witnesses
export const witnesses = {
  create: jest.fn(() => ({ witness: 'mock-witness' })),
  validate: jest.fn(() => true)
};

// Mock contract types
export type Contract = any;
export type DeployedContract = any;
export type ContractState = any;

// Export default for compatibility
export default {
  assertIsContractAddress,
  ContractAddress,
  DeployedMarketplaceRegistryContract,
  MarketplaceRegistryContract,
  MarketplaceRegistryProviders,
  RegistryState,
  findDeployedContract,
  FinalizedCallTxData,
  FinalizedTxData,
  MarketplaceRegistry,
  witnesses
}; 