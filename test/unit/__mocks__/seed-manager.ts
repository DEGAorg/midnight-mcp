export const SeedManager = {
  getAgentSeed: jest.fn(() => 'test-seed-for-test-agent'),
  initialize: jest.fn(),
  initializeAgentSeed: jest.fn(),
  hasAgentSeed: jest.fn(() => true),
  removeAgentSeed: jest.fn()
}; 