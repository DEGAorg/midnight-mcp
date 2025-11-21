/**
 * DAO Tools - MCP Tool Definitions for DAO Operations
 *
 * Defines all DAO-related MCP tools with Zod validation.
 */

import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

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
 * Tool Definitions
 */
export const GET_DAO_CONFIG_TOOL: Tool = {
  name: "getDaoConfig",
  description: "Get the current DAO configuration and settings",
  inputSchema: GetDaoConfigSchema.shape
};

export const OPEN_DAO_ELECTION_TOOL: Tool = {
  name: "openDaoElection",
  description: "Open a new DAO election/proposal for voting",
  inputSchema: OpenDaoElectionSchema.shape
};

export const CAST_DAO_VOTE_TOOL: Tool = {
  name: "castDaoVote",
  description: "Cast a vote on an active DAO election",
  inputSchema: CastDaoVoteSchema.shape
};

export const GET_DAO_ELECTION_TOOL: Tool = {
  name: "getDaoElection",
  description: "Get details of a specific DAO election including vote counts",
  inputSchema: GetDaoElectionSchema.shape
};

export const LIST_DAO_ELECTIONS_TOOL: Tool = {
  name: "listDaoElections",
  description: "List all DAO elections with optional status filter",
  inputSchema: ListDaoElectionsSchema.shape
};

export const GET_VOTING_POWER_TOOL: Tool = {
  name: "getVotingPower",
  description: "Get the wallet's voting power (token balance for governance)",
  inputSchema: GetVotingPowerSchema.shape
};

export const CLOSE_DAO_ELECTION_TOOL: Tool = {
  name: "closeDaoElection",
  description: "Close a DAO election and finalize results",
  inputSchema: CloseDaoElectionSchema.shape
};

/**
 * All DAO tools
 */
export const DAO_TOOLS: Tool[] = [
  GET_DAO_CONFIG_TOOL,
  OPEN_DAO_ELECTION_TOOL,
  CAST_DAO_VOTE_TOOL,
  GET_DAO_ELECTION_TOOL,
  LIST_DAO_ELECTIONS_TOOL,
  GET_VOTING_POWER_TOOL,
  CLOSE_DAO_ELECTION_TOOL
];
