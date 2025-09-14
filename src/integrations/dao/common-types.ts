import { type ContractAddress } from '@midnight-ntwrk/compact-runtime';
import { type MidnightProvider, type WalletProvider } from '@midnight-ntwrk/midnight-js-types';
import { type FinalizedTxData } from '@midnight-ntwrk/midnight-js-types';

/**
 * DAO Voting Private State ID
 */
export type DaoVotingPrivateStateId = 'daoVotingPrivateState';

/**
 * DAO Voting Private State
 */
export interface DaoVotingPrivateState {
  // Add any private state fields as needed
}

/**
 * DAO Voting Contract Providers
 */
export interface DaoVotingProviders {
  privateStateProvider: any;
  publicDataProvider: any;
  zkConfigProvider: any;
  proofProvider: any;
  walletProvider: WalletProvider;
  midnightProvider: MidnightProvider;
}

/**
 * Deployed DAO Voting Contract
 */
export interface DeployedDaoVotingContract {
  deployTxData: {
    public: {
      contractAddress: string;
      txId: string;
      blockHeight: number;
    };
  };
  callTx: {
    open_election: (electionId: Uint8Array) => Promise<{ public: FinalizedTxData }>;
    close_election: () => Promise<{ public: FinalizedTxData }>;
    cast_vote: (voteType: bigint, voteCoin: any) => Promise<{ public: FinalizedTxData }>;
    fund_treasury: (fundCoin: any) => Promise<{ public: FinalizedTxData }>;
    payout_approved_proposal: () => Promise<{ public: FinalizedTxData }>;
    cancel_payout: () => Promise<{ public: FinalizedTxData }>;
  };
}

/**
 * Vote Types
 */
export enum VoteType {
  YES = 0,
  NO = 1,
  ABSENT = 2,
}

/**
 * Election Status
 */
export interface ElectionStatus {
  isOpen: boolean;
  electionId: string;
  yesVotes: bigint;
  noVotes: bigint;
  absentVotes: bigint;
  totalVotes: bigint;
}

/**
 * DAO Voting State (Ledger)
 */
export interface DaoVotingState {
  election_open: boolean;
  election_id: Uint8Array;
  yes_votes: bigint;
  no_votes: bigint;
  absent_votes: bigint;
  total_votes: bigint;
  treasury: {
    color: Uint8Array;
    value: bigint;
    nonce: Uint8Array;
    mt_index: bigint;
  };
  dao_vote_coin_color: Uint8Array;
}
