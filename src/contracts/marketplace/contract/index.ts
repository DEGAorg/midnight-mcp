// Re-export all exports from the managed contract as a namespace
export * as MarketplaceRegistry from './managed/marketplace-registry/contract/index.cjs';

// Export witnesses and private state type
export const witnesses = {};
export type MarketplaceRegistryPrivateState = {};
