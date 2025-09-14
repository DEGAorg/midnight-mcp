# DAO Integration

This module provides DAO (Decentralized Autonomous Organization) voting functionality for the Midnight MCP system.

## Features

- **Election Management**: Open and close elections
- **Voting**: Cast votes (YES, NO, ABSENT) using DAO voting tokens
- **Treasury Management**: Fund treasury and payout approved proposals
- **Contract Integration**: Deploy and interact with DAO voting contracts

## Usage

### Basic Setup

```typescript
import { 
  configureProviders, 
  joinDaoVotingContract,
  VoteType 
} from '../integrations/dao/index.js';

// Configure providers
const providers = await configureProviders(wallet);

// Join existing DAO voting contract
const daoContract = await joinDaoVotingContract(providers, contractAddress);
```

### Election Operations

```typescript
// Open an election
const electionResult = await openElection(daoContract, "election-001");

// Cast a vote
const voteResult = await castVote(daoContract, VoteType.YES, voteCoin);

// Close the election
const closeResult = await closeElection(daoContract);
```

### Treasury Operations

```typescript
// Fund the treasury
const fundResult = await fundTreasury(daoContract, fundCoin);

// Payout approved proposal
const payoutResult = await payoutApprovedProposal(daoContract);
```

### State Queries

```typescript
// Get election status
const status = await getElectionStatus(providers, contractAddress);

// Get full DAO state
const state = await getDaoVotingLedgerState(providers, contractAddress);
```

## API Reference

### Core Functions

- `configureProviders(wallet)` - Configure DAO contract providers
- `joinDaoVotingContract(providers, contractAddress)` - Join existing DAO contract
- `deployDaoVotingContract(providers, privateState, fundingTokenAddress, daoVoteTokenAddress)` - Deploy new DAO contract

### Election Functions

- `openElection(contract, electionId)` - Start new election
- `closeElection(contract)` - End current election
- `castVote(contract, voteType, voteCoin)` - Cast vote

### Treasury Functions

- `fundTreasury(contract, fundCoin)` - Add funds to treasury
- `payoutApprovedProposal(contract)` - Payout to contract owner
- `cancelPayout(contract)` - Cancel pending payout

### Query Functions

- `getElectionStatus(providers, contractAddress)` - Get current election status
- `getDaoVotingLedgerState(providers, contractAddress)` - Get full contract state
- `displayDaoVotingState(providers, contract)` - Display formatted state

## Types

- `VoteType` - Enum for vote types (YES, NO, ABSENT)
- `ElectionStatus` - Current election information
- `DaoVotingState` - Full contract state
- `DeployedDaoVotingContract` - Deployed contract instance

## Dependencies

- Midnight contract runtime
- Wallet API integration
- Provider configuration for network access
