// Re-export all exports from the managed contract as a namespace
export * as DaoVoting from './managed/dao-voting/contract/index.cjs';

// Export witnesses and private state type
export const witnesses = {};
export type DaoVotingPrivateState = {};
