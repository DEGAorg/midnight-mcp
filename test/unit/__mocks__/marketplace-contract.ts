// Mock for marketplace contract module
// This replaces the problematic ES module file that Jest can't parse

// Mock MarketplaceRegistry
export const MarketplaceRegistry = {
  deploy: jest.fn(() => Promise.resolve('mock-deployed-address')),
  call: jest.fn(() => Promise.resolve({ success: true })),
  getState: jest.fn(() => Promise.resolve({ state: 'active' })),
  // Add any other methods that might be used
  create: jest.fn(() => ({ contract: 'mock-contract' })),
  load: jest.fn(() => ({ contract: 'mock-loaded-contract' }))
};

// Mock witnesses
export const witnesses = {
  create: jest.fn(() => ({ witness: 'mock-witness' })),
  validate: jest.fn(() => true),
  // Add any other witness-related functions
  generate: jest.fn(() => ({ proof: 'mock-proof' })),
  verify: jest.fn(() => true)
};

// Export as namespace for compatibility with the original export * as syntax
export default {
  MarketplaceRegistry,
  witnesses
}; 