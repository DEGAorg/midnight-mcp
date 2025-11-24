/**
 * Mock Data Constants for MCP Tools
 *
 * This file provides realistic mock data for all MCP tools to enable
 * testing and development without requiring actual wallet/network connections.
 *
 * All data formats follow Midnight blockchain specifications from the
 * technical research conducted by the Explore and Technical Researcher agents.
 */

import type { TransactionRecord } from '@services/wallet/TransactionService.js';
import { TransactionState } from '@services/wallet/TransactionService.js';

/**
 * Mock Midnight Addresses (Bech32m format)
 */
export const MOCK_ADDRESSES = {
  /** Primary wallet address */
  WALLET: 'addr_test1qzx8m3qasx97l6lcrzfht5hc0g0v8l9lgs3yqgekkj5ru6nptlsaw',
  /** Secondary test address */
  RECIPIENT_1: 'addr_test1qmockaddress123456789abcdefghijklmnopqrstuvwxyz012345',
  /** Third test address */
  RECIPIENT_2: 'addr_test1qrecipient456789abcdefghijklmnopqrstuvwxyz987654321',
  /** Shielded address format */
  SHIELDED: 'mn_shield-addr_test19xcjsrp9qku2t7w59uelzfzgegey9ghtefapn9ga3ys5nq0qazksxqy9ej627ysrd0946qswt8feer7j86pvltk4p6m63zwavfkdqnj2zgqp93ev',
};

/**
 * Mock Wallet Status
 */
export const MOCK_WALLET_STATUS = {
  isReady: true,
  address: MOCK_ADDRESSES.WALLET,
  balance: '1000000000', // 1000 DUST (with 6 decimals)
  syncProgress: {
    synced: true,
    applyGap: '0',
    sourceGap: '0',
    syncPercentage: 100,
  },
  isSyncing: false,
};

/**
 * Mock Wallet Balance
 */
export const MOCK_WALLET_BALANCE = {
  balance: '1000000000', // 1000 DUST
  pendingBalance: '0',
};

/**
 * Mock Transaction Records
 */
export const MOCK_TRANSACTIONS: Record<string, TransactionRecord> = {
  'tx-initiated': {
    id: 'tx-initiated',
    state: TransactionState.INITIATED,
    from: MOCK_ADDRESSES.WALLET,
    to: MOCK_ADDRESSES.RECIPIENT_1,
    amount: '100000',
    timestamp: Date.now() - 60000, // 1 minute ago
    correlationId: 'corr-001',
  },
  'tx-sent': {
    id: 'tx-sent',
    state: TransactionState.SENT,
    from: MOCK_ADDRESSES.WALLET,
    to: MOCK_ADDRESSES.RECIPIENT_1,
    amount: '250000',
    timestamp: Date.now() - 300000, // 5 minutes ago
    txIdentifier: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    correlationId: 'corr-002',
  },
  'tx-completed': {
    id: 'tx-completed',
    state: TransactionState.COMPLETED,
    from: MOCK_ADDRESSES.WALLET,
    to: MOCK_ADDRESSES.RECIPIENT_2,
    amount: '500000',
    timestamp: Date.now() - 600000, // 10 minutes ago
    txIdentifier: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    correlationId: 'corr-003',
  },
  'tx-failed': {
    id: 'tx-failed',
    state: TransactionState.FAILED,
    from: MOCK_ADDRESSES.WALLET,
    to: MOCK_ADDRESSES.RECIPIENT_1,
    amount: '1000000',
    timestamp: Date.now() - 900000, // 15 minutes ago
    error: 'Insufficient funds',
    correlationId: 'corr-004',
  },
};

/**
 * Mock Token Configurations
 */
export const MOCK_TOKENS = {
  DAO_VOTING: {
    id: 'dega_dao_vote:0x1234567890abcdef1234567890abcdef12345678',
    name: 'DAO_VOTING',
    symbol: 'DVT',
    contractAddress: '0x1234567890abcdef1234567890abcdef12345678',
    domainSeparator: 'dega_dao_vote',
    decimals: 6,
    balance: '5000000', // 5 DVT
    description: 'DAO voting token for governance',
  },
  FUNDING: {
    id: 'dega_funding_token:0xfedcba0987654321fedcba0987654321fedcba09',
    name: 'FUNDING',
    symbol: 'FUND',
    contractAddress: '0xfedcba0987654321fedcba0987654321fedcba09',
    domainSeparator: 'dega_funding_token',
    decimals: 6,
    balance: '10000000', // 10 FUND
    description: 'Funding token for treasury management',
  },
  REWARD: {
    id: 'reward_token:0x1111111111111111111111111111111111111111',
    name: 'REWARD',
    symbol: 'REW',
    contractAddress: '0x1111111111111111111111111111111111111111',
    domainSeparator: 'reward_token',
    decimals: 8,
    balance: '100000000', // 1 REW (8 decimals)
    description: 'Reward token for incentives',
  },
};

/**
 * Mock Token List Response
 */
export const MOCK_TOKEN_LIST = Object.values(MOCK_TOKENS).map(token => ({
  tokenName: token.name,
  symbol: token.symbol,
  balance: token.balance,
  contractAddress: token.contractAddress,
  description: token.description,
  decimals: token.decimals,
}));

/**
 * Mock DAO Data
 */
export const MOCK_DAO = {
  ELECTIONS: {
    'election-2024': {
      electionId: 'election-2024',
      isOpen: true,
      startTime: Date.now() - 86400000, // Started 1 day ago
      endTime: Date.now() + 86400000, // Ends in 1 day
      yesVotes: '10',
      noVotes: '5',
      absentVotes: '2',
    },
    'governance-vote-001': {
      electionId: 'governance-vote-001',
      isOpen: false,
      startTime: Date.now() - 172800000, // Started 2 days ago
      endTime: Date.now() - 86400000, // Ended 1 day ago
      yesVotes: '25',
      noVotes: '8',
      absentVotes: '3',
    },
  },
  TREASURY_BALANCE: '50000000', // 50 FUND tokens
  VOTE_COIN_COLOR: new Uint8Array(32).fill(1),
  FUNDING_COIN_COLOR: new Uint8Array(32).fill(2),
};

/**
 * Mock DAO Operation Results
 */
export const MOCK_DAO_RESULTS = {
  OPEN_ELECTION: {
    success: true,
    transactionId: 'tx-dao-open-election',
    message: 'Election opened successfully',
  },
  CAST_VOTE: {
    success: true,
    transactionId: 'tx-dao-cast-vote',
    message: 'Vote cast successfully',
  },
  CLOSE_ELECTION: {
    success: true,
    transactionId: 'tx-dao-close-election',
    message: 'Election closed successfully',
  },
  FUND_TREASURY: {
    success: true,
    transactionId: 'tx-dao-fund-treasury',
    message: 'Treasury funded successfully',
  },
};

/**
 * Mock Marketplace Users
 */
export const MOCK_MARKETPLACE_USERS = {
  'user-123': {
    userId: 'user-123',
    displayName: 'Test User',
    email: 'test@example.com',
    registeredAt: '2024-01-01T00:00:00Z',
    verified: true,
    metadata: {
      role: 'buyer',
      reputation: 95,
    },
  },
  'registered-user-1': {
    userId: 'registered-user-1',
    displayName: 'Registered User',
    email: 'registered@example.com',
    registeredAt: '2024-01-15T00:00:00Z',
    verified: false,
    metadata: {
      role: 'seller',
      reputation: 0,
    },
  },
  'verified-user-1': {
    userId: 'verified-user-1',
    displayName: 'Verified User',
    email: 'verified@example.com',
    registeredAt: '2024-02-01T00:00:00Z',
    verified: true,
    metadata: {
      role: 'both',
      reputation: 100,
    },
  },
};

/**
 * Mock Marketplace Operation Results
 */
export const MOCK_MARKETPLACE_RESULTS = {
  REGISTER_USER: {
    success: true,
    userId: 'new-user-001',
    transactionId: 'tx-marketplace-register',
    message: 'User registered successfully',
  },
  VERIFY_USER: {
    success: true,
    transactionId: 'tx-marketplace-verify',
    message: 'User verified successfully',
  },
};

/**
 * Helper function to get mock transaction by ID
 */
export function getMockTransaction(id: string): TransactionRecord | undefined {
  return MOCK_TRANSACTIONS[id];
}

/**
 * Helper function to get mock token balance
 */
export function getMockTokenBalance(tokenName: string) {
  const token = Object.values(MOCK_TOKENS).find(t => t.name === tokenName);
  if (!token) {
    throw new Error(`Token not found: ${tokenName}`);
  }
  return {
    tokenName: token.name,
    symbol: token.symbol,
    balance: token.balance,
    balanceDecimal: (parseInt(token.balance) / Math.pow(10, token.decimals)).toString(),
    decimals: token.decimals,
  };
}

/**
 * Helper function to get mock user info
 */
export function getMockUserInfo(userId: string) {
  return MOCK_MARKETPLACE_USERS[userId as keyof typeof MOCK_MARKETPLACE_USERS];
}

/**
 * Helper function to check if user is registered
 */
export function isMockUserRegistered(userId: string): boolean {
  const user = MOCK_MARKETPLACE_USERS[userId as keyof typeof MOCK_MARKETPLACE_USERS];
  return !!user;
}

/**
 * Helper function to check if user is verified
 */
export function isMockUserVerified(userId: string): boolean {
  const user = MOCK_MARKETPLACE_USERS[userId as keyof typeof MOCK_MARKETPLACE_USERS];
  return user?.verified ?? false;
}

/**
 * Helper function to generate mock transaction ID
 */
export function generateMockTransactionId(): string {
  return `tx-mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
