// DAO Integration Module
// Provides DAO voting functionality for Midnight MCP

export * from './api.js';
export * from './common-types.js';

// Re-export key types and functions for easy access
export {
  configureProviders,
  joinDaoVotingContract,
  deployDaoVotingContract,
  openElection,
  closeElection,
  castVote,
  fundTreasury,
  payoutApprovedProposal,
  cancelPayout,
  getElectionStatus,
  getDaoVotingLedgerState,
  displayDaoVotingState,
  pad,
  VoteType
} from './api.js';

export type {
  DaoVotingProviders,
  DeployedDaoVotingContract,
  DaoVotingPrivateState,
  DaoVotingState,
  ElectionStatus
} from './common-types.js';
