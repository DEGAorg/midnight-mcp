// Comprehensive mock for marketplace contract module
// This completely replaces the problematic ES module file

// Mock MarketplaceRegistry
export const MarketplaceRegistry = {
  deploy: jest.fn(() => Promise.resolve('mock-deployed-address')),
  call: jest.fn(() => Promise.resolve({ success: true })),
  getState: jest.fn(() => Promise.resolve({ state: 'active' })),
  create: jest.fn(() => ({ contract: 'mock-contract' })),
  load: jest.fn(() => ({ contract: 'mock-loaded-contract' })),
  ledger: jest.fn(() => ({ 
    registry: { 
      member: jest.fn(() => true), 
      lookup: jest.fn(() => 'mock-text') 
    } 
  })),
  Contract: jest.fn(() => ({ contract: 'mock-contract-instance' }))
};

// Mock witnesses
export const witnesses = {
  create: jest.fn(() => ({ witness: 'mock-witness' })),
  validate: jest.fn(() => true),
  generate: jest.fn(() => ({ proof: 'mock-proof' })),
  verify: jest.fn(() => true)
};

// Mock any other exports that might be used
export const DeployedMarketplaceRegistryContract = jest.fn();
export const MarketplaceRegistryContract = jest.fn();
export const MarketplaceRegistryProviders = jest.fn();
export const RegistryState = jest.fn();

// Default export for compatibility
export default {
  MarketplaceRegistry,
  witnesses,
  DeployedMarketplaceRegistryContract,
  MarketplaceRegistryContract,
  MarketplaceRegistryProviders,
  RegistryState
}; 