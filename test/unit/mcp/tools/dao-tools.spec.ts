/**
 * DAO Tools Unit Tests
 *
 * Tests for DAO-related MCP tools and their execute functions.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

import {
  DAO_TOOLS,
  openDaoElectionTool,
  castDaoVoteTool,
  closeDaoElectionTool,
  fundDaoTreasuryTool,
  OpenElectionSimpleSchema,
  CastVoteSimpleSchema,
  CloseDaoElectionSchema,
  FundTreasurySchema,
} from '../../../../src/mcp/tools/dao-tools.js';
import type { ServiceDependencies } from '../../../../src/mcp/types.js';

// Mock services
function createMockServices(): ServiceDependencies {
  return {
    walletService: {} as any,
    transactionService: {} as any,
    tokenService: {} as any,
    daoService: {
      openElection: jest.fn((electionId: string) => ({
        success: true,
        electionId,
        status: 'open',
        transactionId: 'tx-election-open',
      })),
      castVote: jest.fn((voteChoice: string) => ({
        success: true,
        voteChoice,
        transactionId: 'tx-vote-cast',
      })),
      closeElection: jest.fn((electionId: string) => ({
        success: true,
        electionId,
        status: 'closed',
        results: { yes: 10, no: 5, absent: 2 },
        transactionId: 'tx-election-close',
      })),
      fundTreasury: jest.fn((amountDecimal: string) => ({
        success: true,
        amount: amountDecimal,
        transactionId: 'tx-fund-treasury',
      })),
    } as any,
    marketplaceService: {} as any,
  };
}

describe('DAO Tools', () => {
  let mockServices: ServiceDependencies;

  beforeEach(() => {
    mockServices = createMockServices();
  });

  describe('DAO_TOOLS collection', () => {
    it('should export array of DAO tools', () => {
      expect(Array.isArray(DAO_TOOLS)).toBe(true);
      expect(DAO_TOOLS.length).toBe(4);
    });

    it('should contain expected tools', () => {
      const toolNames = DAO_TOOLS.map((t) => t.name);
      expect(toolNames).toContain('openDaoElection');
      expect(toolNames).toContain('castDaoVote');
      expect(toolNames).toContain('closeDaoElection');
      expect(toolNames).toContain('fundDaoTreasury');
    });
  });

  describe('openDaoElectionTool', () => {
    it('should have correct metadata', () => {
      expect(openDaoElectionTool.name).toBe('openDaoElection');
      expect(openDaoElectionTool.description).toContain('election');
      expect(typeof openDaoElectionTool.execute).toBe('function');
    });

    it('should execute and open election', async () => {
      const result = await openDaoElectionTool.execute(
        { electionId: 'election-2024' },
        mockServices
      );

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('electionId', 'election-2024');
      expect(result).toHaveProperty('status', 'open');
    });

    it('should call openElection with correct ID', async () => {
      await openDaoElectionTool.execute({ electionId: 'test-election' }, mockServices);

      expect(mockServices.daoService.openElection).toHaveBeenCalledWith('test-election');
    });
  });

  describe('castDaoVoteTool', () => {
    it('should have correct metadata', () => {
      expect(castDaoVoteTool.name).toBe('castDaoVote');
      expect(castDaoVoteTool.description).toContain('vote');
      expect(typeof castDaoVoteTool.execute).toBe('function');
    });

    it('should execute and cast vote', async () => {
      const result = await castDaoVoteTool.execute(
        { voteChoice: 'yes' },
        mockServices
      );

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('voteChoice', 'yes');
    });

    it('should call castVote with correct choice', async () => {
      await castDaoVoteTool.execute({ voteChoice: 'no' }, mockServices);

      expect(mockServices.daoService.castVote).toHaveBeenCalledWith('no');
    });

    it('should handle all vote types', async () => {
      for (const voteChoice of ['yes', 'no', 'absent']) {
        await castDaoVoteTool.execute({ voteChoice }, mockServices);
        expect(mockServices.daoService.castVote).toHaveBeenCalledWith(voteChoice);
      }
    });
  });

  describe('closeDaoElectionTool', () => {
    it('should have correct metadata', () => {
      expect(closeDaoElectionTool.name).toBe('closeDaoElection');
      expect(closeDaoElectionTool.description).toContain('Close');
      expect(typeof closeDaoElectionTool.execute).toBe('function');
    });

    it('should execute and close election', async () => {
      const result = await closeDaoElectionTool.execute(
        { electionId: 'election-2024' },
        mockServices
      );

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('status', 'closed');
      expect(result).toHaveProperty('results');
    });

    it('should call closeElection with correct ID', async () => {
      await closeDaoElectionTool.execute({ electionId: 'finished-election' }, mockServices);

      expect(mockServices.daoService.closeElection).toHaveBeenCalledWith('finished-election');
    });
  });

  describe('fundDaoTreasuryTool', () => {
    it('should have correct metadata', () => {
      expect(fundDaoTreasuryTool.name).toBe('fundDaoTreasury');
      expect(fundDaoTreasuryTool.description).toContain('Fund');
      expect(typeof fundDaoTreasuryTool.execute).toBe('function');
    });

    it('should execute and fund treasury', async () => {
      const result = await fundDaoTreasuryTool.execute(
        { amountDecimal: '100.5' },
        mockServices
      );

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('amount', '100.5');
    });

    it('should call fundTreasury with correct amount', async () => {
      await fundDaoTreasuryTool.execute({ amountDecimal: '250.75' }, mockServices);

      expect(mockServices.daoService.fundTreasury).toHaveBeenCalledWith('250.75');
    });
  });

  describe('Schema Validation', () => {
    describe('OpenElectionSimpleSchema', () => {
      it('should accept valid election ID', () => {
        expect(() => OpenElectionSimpleSchema.parse({ electionId: 'election-2024' })).not.toThrow();
      });

      it('should reject empty election ID', () => {
        expect(() => OpenElectionSimpleSchema.parse({ electionId: '' })).toThrow();
      });

      it('should reject election ID longer than 32 characters', () => {
        const longId = 'a'.repeat(33);
        expect(() => OpenElectionSimpleSchema.parse({ electionId: longId })).toThrow();
      });

      it('should accept election ID with exactly 32 characters', () => {
        const maxId = 'a'.repeat(32);
        expect(() => OpenElectionSimpleSchema.parse({ electionId: maxId })).not.toThrow();
      });
    });

    describe('CastVoteSimpleSchema', () => {
      it('should accept "yes" vote', () => {
        expect(() => CastVoteSimpleSchema.parse({ voteChoice: 'yes' })).not.toThrow();
      });

      it('should accept "no" vote', () => {
        expect(() => CastVoteSimpleSchema.parse({ voteChoice: 'no' })).not.toThrow();
      });

      it('should accept "absent" vote', () => {
        expect(() => CastVoteSimpleSchema.parse({ voteChoice: 'absent' })).not.toThrow();
      });

      it('should reject invalid vote choice', () => {
        expect(() => CastVoteSimpleSchema.parse({ voteChoice: 'maybe' })).toThrow();
      });

      it('should reject empty vote choice', () => {
        expect(() => CastVoteSimpleSchema.parse({ voteChoice: '' })).toThrow();
      });
    });

    describe('CloseDaoElectionSchema', () => {
      it('should accept valid election ID', () => {
        expect(() => CloseDaoElectionSchema.parse({ electionId: 'election-123' })).not.toThrow();
      });

      it('should reject empty election ID', () => {
        expect(() => CloseDaoElectionSchema.parse({ electionId: '' })).toThrow();
      });
    });

    describe('FundTreasurySchema', () => {
      it('should accept valid decimal amount', () => {
        expect(() => FundTreasurySchema.parse({ amountDecimal: '100.5' })).not.toThrow();
      });

      it('should accept whole number amount', () => {
        expect(() => FundTreasurySchema.parse({ amountDecimal: '100' })).not.toThrow();
      });

      it('should accept amount with many decimal places', () => {
        expect(() => FundTreasurySchema.parse({ amountDecimal: '100.123456' })).not.toThrow();
      });

      it('should reject non-numeric amount', () => {
        expect(() => FundTreasurySchema.parse({ amountDecimal: 'abc' })).toThrow();
      });

      it('should reject negative amount', () => {
        expect(() => FundTreasurySchema.parse({ amountDecimal: '-100' })).toThrow();
      });

      it('should reject empty amount', () => {
        expect(() => FundTreasurySchema.parse({ amountDecimal: '' })).toThrow();
      });
    });
  });
});
