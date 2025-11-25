/**
 * DAO Tools - MCP Tool Definitions for DAO Operations
 *
 * Defines all DAO-related MCP tools with Zod validation.
 *
 * NEW: Each tool now has an execute function that receives services.
 */

import { z } from 'zod';
import type { ServiceDependencies } from '../types.js';
import type { ToolDefinition } from '../adapter/types.js';

/**
 * Schemas
 */
export const GetDaoConfigSchema = z.object({});

export const OpenDaoElectionSchema = z.object({
  topic: z.string()
    .min(1)
    .max(256)
    .describe("Election topic/question"),
  endTimestamp: z.number()
    .int()
    .positive()
    .describe("Unix timestamp when election ends")
});

export const CastDaoVoteSchema = z.object({
  electionId: z.string()
    .min(1)
    .describe("Election identifier"),
  voteType: z.enum(['yes', 'no', 'absence'], {
    errorMap: () => ({ message: "Vote type must be 'yes', 'no', or 'absence'" })
  })
    .describe("Vote choice: yes, no, or absence")
});

export const GetDaoElectionSchema = z.object({
  electionId: z.string()
    .min(1)
    .describe("Election identifier")
});

export const ListDaoElectionsSchema = z.object({
  status: z.enum(['active', 'closed', 'all'])
    .default('all')
    .describe("Filter by election status")
});

export const GetVotingPowerSchema = z.object({
  electionId: z.string()
    .min(1)
    .optional()
    .describe("Optional election ID to check voting power for specific election")
});

export const CloseDaoElectionSchema = z.object({
  electionId: z.string()
    .min(1)
    .describe("Election identifier to close")
});

/**
 * Type Inference
 */
export type GetDaoConfigInput = z.infer<typeof GetDaoConfigSchema>;
export type OpenDaoElectionInput = z.infer<typeof OpenDaoElectionSchema>;
export type CastDaoVoteInput = z.infer<typeof CastDaoVoteSchema>;
export type GetDaoElectionInput = z.infer<typeof GetDaoElectionSchema>;
export type ListDaoElectionsInput = z.infer<typeof ListDaoElectionsSchema>;
export type GetVotingPowerInput = z.infer<typeof GetVotingPowerSchema>;
export type CloseDaoElectionInput = z.infer<typeof CloseDaoElectionSchema>;

/**
 * Tool Definitions with Execute Functions
 */

// Simplified schema for openElection - just takes electionId
export const OpenElectionSimpleSchema = z.object({
  electionId: z.string()
    .min(1)
    .max(32)
    .describe("Election identifier (max 32 chars)")
});

// Simplified schema for castVote - just takes voteChoice
export const CastVoteSimpleSchema = z.object({
  voteChoice: z.enum(['yes', 'no', 'absent'], {
    errorMap: () => ({ message: "Vote choice must be 'yes', 'no', or 'absent'" })
  })
    .describe("Vote choice: yes, no, or absent")
});

// Schema for fundTreasury
export const FundTreasurySchema = z.object({
  amountDecimal: z.string()
    .regex(/^\d+(\.\d+)?$/, {
      message: "Amount must be a valid decimal number"
    })
    .describe("Amount to fund in decimal format (e.g., '100.5')")
});

export const openDaoElectionTool: ToolDefinition = {
  name: "openDaoElection",
  description: "Open a new DAO election for voting",
  inputSchema: OpenElectionSimpleSchema.shape,
  execute: async (args: unknown, services: ServiceDependencies) => {
    if (!services.daoService) {
      throw new Error('DAO service not configured. Set DAO_CONTRACT_ADDRESS environment variable to enable DAO functionality.');
    }
    const { electionId } = OpenElectionSimpleSchema.parse(args);
    // DaoService.openElection only takes electionId
    return await services.daoService.openElection(electionId);
  }
};

export const castDaoVoteTool: ToolDefinition = {
  name: "castDaoVote",
  description: "Cast a vote on the active DAO election",
  inputSchema: CastVoteSimpleSchema.shape,
  execute: async (args: unknown, services: ServiceDependencies) => {
    if (!services.daoService) {
      throw new Error('DAO service not configured. Set DAO_CONTRACT_ADDRESS environment variable to enable DAO functionality.');
    }
    const { voteChoice } = CastVoteSimpleSchema.parse(args);
    // DaoService.castVote only takes voteChoice string
    return await services.daoService.castVote(voteChoice);
  }
};

export const closeDaoElectionTool: ToolDefinition = {
  name: "closeDaoElection",
  description: "Close a DAO election and finalize results",
  inputSchema: CloseDaoElectionSchema.shape,
  execute: async (args: unknown, services: ServiceDependencies) => {
    if (!services.daoService) {
      throw new Error('DAO service not configured. Set DAO_CONTRACT_ADDRESS environment variable to enable DAO functionality.');
    }
    const { electionId } = CloseDaoElectionSchema.parse(args);
    return await services.daoService.closeElection(electionId);
  }
};

export const fundDaoTreasuryTool: ToolDefinition = {
  name: "fundDaoTreasury",
  description: "Fund the DAO treasury with tokens",
  inputSchema: FundTreasurySchema.shape,
  execute: async (args: unknown, services: ServiceDependencies) => {
    if (!services.daoService) {
      throw new Error('DAO service not configured. Set DAO_CONTRACT_ADDRESS environment variable to enable DAO functionality.');
    }
    const { amountDecimal } = FundTreasurySchema.parse(args);
    return await services.daoService.fundTreasury(amountDecimal);
  }
};

/**
 * All DAO tools (ToolDefinition format)
 *
 * NOTE: Reduced to only implemented methods.
 * TODO: Add getConfig, getElection, listElections, getVotingPower when implemented in DaoService
 */
export const DAO_TOOLS: ToolDefinition[] = [
  openDaoElectionTool,
  castDaoVoteTool,
  closeDaoElectionTool,
  fundDaoTreasuryTool
];
