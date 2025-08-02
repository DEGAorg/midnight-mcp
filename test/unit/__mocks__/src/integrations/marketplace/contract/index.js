// Mock for marketplace contract index.js
// This replaces the problematic ES module file that Jest can't parse

// Mock MarketplaceRegistry
const MarketplaceRegistry = {
  deploy: jest.fn(() => Promise.resolve('mock-deployed-address')),
  call: jest.fn(() => Promise.resolve({ success: true })),
  getState: jest.fn(() => Promise.resolve({ state: 'active' })),
  // Add any other methods that might be used
  create: jest.fn(() => ({ contract: 'mock-contract' })),
  load: jest.fn(() => ({ contract: 'mock-loaded-contract' })),
  ledger: jest.fn(() => ({ registry: { member: jest.fn(() => true), lookup: jest.fn(() => 'mock-text') } })),
  Contract: jest.fn(() => ({ contract: 'mock-contract-instance' }))
};

// Mock witnesses
const witnesses = {
  create: jest.fn(() => ({ witness: 'mock-witness' })),
  validate: jest.fn(() => true),
  // Add any other witness-related functions
  generate: jest.fn(() => ({ proof: 'mock-proof' })),
  verify: jest.fn(() => true)
};

// Export using ES module syntax to match the original file
export { MarketplaceRegistry, witnesses }; 