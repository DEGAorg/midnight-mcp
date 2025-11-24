/**
 * DaoService Unit Tests
 *
 * Tests for DAO voting operations:
 * - Service initialization
 * - Election operations
 * - Vote parsing
 * - Coin type generation
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock dependencies
jest.mock('../../../../../src/lib/logger/index.js', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

jest.mock('../../../../../src/lib/config/constants.js', () => ({
  DAO_CONFIG: {},
  TOKEN_CONFIG: {
    DEFAULT_DECIMALS: 6,
    DAO_VOTE_DOMAIN_SEPARATOR: 'dega_dao_vote',
    DAO_FUNDING_DOMAIN_SEPARATOR: 'dega_funding_token',
  },
}));

jest.mock('../../../../../src/services/providers/ProviderFactory.js', () => ({
  ProviderFactory: {
    createDaoProviders: jest.fn().mockResolvedValue({
      publicDataProvider: {
        queryContractState: jest.fn().mockResolvedValue({
          data: {
            dao_vote_coin_color: new Uint8Array(64).fill(1),
          },
        }),
      },
    }),
  },
}));

jest.mock('../../../../../src/contracts/dao/index.js', () => ({
  joinDaoVotingContract: jest.fn().mockResolvedValue({
    deployTxData: {
      public: {
        contractAddress: '0xDaoContractAddress',
      },
    },
    callTx: {
      open_election: jest.fn().mockResolvedValue({
        public: { txId: 'tx-open-123', blockHeight: 1000 },
      }),
      close_election: jest.fn().mockResolvedValue({
        public: { txId: 'tx-close-123', blockHeight: 1001 },
      }),
      cast_vote: jest.fn().mockResolvedValue({
        public: { txId: 'tx-vote-123', blockHeight: 1002 },
      }),
      fund_treasury: jest.fn().mockResolvedValue({
        public: { txId: 'tx-fund-123', blockHeight: 1003 },
      }),
    },
  }),
  pad: jest.fn((str: string, len: number) => new Uint8Array(len)),
  VoteType: {
    YES: 0,
    NO: 1,
    ABSENT: 2,
  },
}));

import { DaoService, DaoServiceConfig } from '../../../../../src/services/contract/dao/DaoService.js';

describe('DaoService', () => {
  let daoService: DaoService;
  let mockWalletService: any;
  let mockAuditService: any;
  let mockConfig: DaoServiceConfig;

  beforeEach(() => {
    jest.clearAllMocks();

    mockWalletService = {
      getWallet: jest.fn(() => ({ mock: 'wallet' })),
      getWalletState: jest.fn(() => ({
        balances: {},
      })),
    };

    mockAuditService = {
      generateCorrelationId: jest.fn(() => 'corr-dao-001'),
      startTransactionTrace: jest.fn(),
      completeTransactionTrace: jest.fn(),
      logTransactionFailure: jest.fn(),
    };

    mockConfig = {
      walletService: mockWalletService,
      auditService: mockAuditService,
      contractAddress: '0xDaoContract123',
      agentId: 'test-agent-dao',
    };

    daoService = new DaoService(mockConfig);
  });

  describe('constructor', () => {
    it('should initialize with provided config', () => {
      expect(daoService).toBeDefined();
    });
  });

  describe('start', () => {
    it('should start and join DAO contract', async () => {
      await daoService.start();

      const { ProviderFactory } = jest.requireMock('../../../../../src/services/providers/ProviderFactory.js');
      const { joinDaoVotingContract } = jest.requireMock('../../../../../src/contracts/dao/index.js');

      expect(ProviderFactory.createDaoProviders).toHaveBeenCalled();
      expect(joinDaoVotingContract).toHaveBeenCalled();
    });

    it('should throw if provider creation fails', async () => {
      const { ProviderFactory } = jest.requireMock('../../../../../src/services/providers/ProviderFactory.js');
      ProviderFactory.createDaoProviders.mockRejectedValueOnce(new Error('Provider error'));

      await expect(daoService.start()).rejects.toThrow('Provider error');
    });
  });

  describe('stop', () => {
    it('should stop without error', () => {
      daoService.stop();
    });
  });

  describe('openElection', () => {
    it('should throw if service not started', async () => {
      await expect(daoService.openElection('election-1'))
        .rejects.toThrow('DAO service not started');
    });

    it('should open election and return transaction ID', async () => {
      await daoService.start();

      const txId = await daoService.openElection('election-1');

      expect(txId).toBe('tx-open-123');
      expect(mockAuditService.startTransactionTrace).toHaveBeenCalled();
      expect(mockAuditService.completeTransactionTrace).toHaveBeenCalled();
    });

    it('should log failure on error', async () => {
      await daoService.start();

      const { joinDaoVotingContract } = jest.requireMock('../../../../../src/contracts/dao/index.js');
      joinDaoVotingContract.mockResolvedValueOnce({
        deployTxData: { public: { contractAddress: '0x123' } },
        callTx: {
          open_election: jest.fn().mockRejectedValue(new Error('Election error')),
        },
      });

      // Reinitialize to use new mock
      const newService = new DaoService(mockConfig);
      await newService.start();

      await expect(newService.openElection('election-fail'))
        .rejects.toThrow('Election error');
    });
  });

  describe('closeElection', () => {
    it('should throw if service not started', async () => {
      await expect(daoService.closeElection('election-1'))
        .rejects.toThrow('DAO service not started');
    });

    it('should close election and return transaction ID', async () => {
      await daoService.start();

      const txId = await daoService.closeElection('election-1');

      expect(txId).toBe('tx-close-123');
    });
  });

  describe('castVote', () => {
    it('should throw if service not started', async () => {
      await expect(daoService.castVote('yes'))
        .rejects.toThrow('DAO service not started');
    });

    it('should throw for invalid vote choice', async () => {
      await daoService.start();

      await expect(daoService.castVote('invalid'))
        .rejects.toThrow('Invalid vote choice');
    });

    it('should parse yes/y/0 as YES vote', async () => {
      await daoService.start();

      // castVote will throw because no vote coin found in wallet
      // but we can verify it gets to that point (past vote choice parsing)
      await expect(daoService.castVote('yes')).rejects.toThrow('No vote coin found in wallet');
      await expect(daoService.castVote('y')).rejects.toThrow('No vote coin found in wallet');
      await expect(daoService.castVote('0')).rejects.toThrow('No vote coin found in wallet');
    });

    it('should parse no/n/1 as NO vote', async () => {
      await daoService.start();

      await expect(daoService.castVote('no')).rejects.toThrow('No vote coin found in wallet');
      await expect(daoService.castVote('n')).rejects.toThrow('No vote coin found in wallet');
      await expect(daoService.castVote('1')).rejects.toThrow('No vote coin found in wallet');
    });

    it('should parse absent/abstain/a/2 as ABSENT vote', async () => {
      await daoService.start();

      await expect(daoService.castVote('absent')).rejects.toThrow('No vote coin found in wallet');
      await expect(daoService.castVote('abstain')).rejects.toThrow('No vote coin found in wallet');
      await expect(daoService.castVote('a')).rejects.toThrow('No vote coin found in wallet');
      await expect(daoService.castVote('2')).rejects.toThrow('No vote coin found in wallet');
    });
  });

  describe('fundTreasury', () => {
    it('should throw if service not started', async () => {
      await expect(daoService.fundTreasury('100'))
        .rejects.toThrow('DAO service not started');
    });

    it('should throw for invalid amount', async () => {
      await daoService.start();

      await expect(daoService.fundTreasury('invalid'))
        .rejects.toThrow('Amount must be a valid decimal number');
    });

    it('should convert amount and attempt funding', async () => {
      await daoService.start();

      // Will throw because no funding coin found in wallet
      await expect(daoService.fundTreasury('100.5'))
        .rejects.toThrow('No funding coin found in wallet');
    });
  });
});
