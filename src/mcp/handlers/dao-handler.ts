/**
 * DAO Handler - Handles DAO governance operations
 *
 * Direct service integration - no HTTP layer.
 */

import type { Handler, ToolResponse, ServiceDependencies } from '../types.js';
import {
  GetDaoConfigSchema,
  OpenDaoElectionSchema,
  CastDaoVoteSchema,
  GetDaoElectionSchema,
  ListDaoElectionsSchema,
  GetVotingPowerSchema,
  CloseDaoElectionSchema,
  type OpenDaoElectionInput,
  type CastDaoVoteInput,
  type GetDaoElectionInput,
  type ListDaoElectionsInput,
  type GetVotingPowerInput,
  type CloseDaoElectionInput
} from '../tools/dao-tools.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

/**
 * DaoHandler
 *
 * Handles all DAO-related operations:
 * - Election management
 * - Voting
 * - Configuration queries
 * - Voting power checks
 */
export class DaoHandler implements Handler {
  constructor(private services: ServiceDependencies) {}

  async handle(toolName: string, args: unknown): Promise<ToolResponse> {
    switch (toolName) {
      case 'getDaoConfig':
        return this.handleGetDaoConfig();
      case 'openDaoElection':
        return this.handleOpenDaoElection(args);
      case 'castDaoVote':
        return this.handleCastDaoVote(args);
      case 'getDaoElection':
        return this.handleGetDaoElection(args);
      case 'listDaoElections':
        return this.handleListDaoElections(args);
      case 'getVotingPower':
        return this.handleGetVotingPower(args);
      case 'closeDaoElection':
        return this.handleCloseDaoElection(args);
      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown DAO tool: ${toolName}`
        );
    }
  }

  private async handleGetDaoConfig(): Promise<ToolResponse> {
    try {
      GetDaoConfigSchema.parse({});

      const daoService = this.services.daoService;
      const config = await daoService.getConfig?.();

      if (!config) {
        throw new McpError(
          ErrorCode.InternalError,
          'DAO configuration not available'
        );
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(config, null, 2)
        }],
        structuredContent: config
      };
    } catch (error) {
      return this.errorResponse(error, 'Failed to get DAO configuration');
    }
  }

  private async handleOpenDaoElection(args: unknown): Promise<ToolResponse> {
    try {
      const validated = OpenDaoElectionSchema.parse(args);
      const { topic, endTimestamp } = validated as OpenDaoElectionInput;

      // Check if wallet is ready
      const isReady = await this.services.walletService.isReady?.() ?? false;
      if (!isReady) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          'Wallet is not ready. Please wait for synchronization to complete.'
        );
      }

      const daoService = this.services.daoService;
      const result = await daoService.openElection?.(topic, endTimestamp);

      if (!result || !result.electionId) {
        throw new McpError(
          ErrorCode.InternalError,
          'Failed to open DAO election'
        );
      }

      const response = {
        electionId: result.electionId,
        topic,
        endTimestamp,
        status: 'active',
        message: 'DAO election opened successfully'
      };

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }],
        structuredContent: response
      };
    } catch (error) {
      return this.errorResponse(error, 'Failed to open DAO election');
    }
  }

  private async handleCastDaoVote(args: unknown): Promise<ToolResponse> {
    try {
      const validated = CastDaoVoteSchema.parse(args);
      const { electionId, voteType } = validated as CastDaoVoteInput;

      // Check if wallet is ready
      const isReady = await this.services.walletService.isReady?.() ?? false;
      if (!isReady) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          'Wallet is not ready. Please wait for synchronization to complete.'
        );
      }

      const daoService = this.services.daoService;
      const result = await daoService.castVote?.(electionId, voteType);

      if (!result) {
        throw new McpError(
          ErrorCode.InternalError,
          'Failed to cast vote'
        );
      }

      const response = {
        electionId,
        voteType,
        status: 'recorded',
        message: `Vote '${voteType}' cast successfully`
      };

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }],
        structuredContent: response
      };
    } catch (error) {
      return this.errorResponse(error, 'Failed to cast DAO vote');
    }
  }

  private async handleGetDaoElection(args: unknown): Promise<ToolResponse> {
    try {
      const validated = GetDaoElectionSchema.parse(args);
      const { electionId } = validated as GetDaoElectionInput;

      const daoService = this.services.daoService;
      const election = await daoService.getElection?.(electionId);

      if (!election) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Election not found: ${electionId}`
        );
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(election, null, 2)
        }],
        structuredContent: election
      };
    } catch (error) {
      return this.errorResponse(error, 'Failed to get DAO election');
    }
  }

  private async handleListDaoElections(args: unknown): Promise<ToolResponse> {
    try {
      const validated = ListDaoElectionsSchema.parse(args);
      const { status } = validated as ListDaoElectionsInput;

      const daoService = this.services.daoService;
      const elections = await daoService.listElections?.(status) ?? [];

      const response = {
        elections,
        count: elections.length,
        filter: status
      };

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }],
        structuredContent: response
      };
    } catch (error) {
      return this.errorResponse(error, 'Failed to list DAO elections');
    }
  }

  private async handleGetVotingPower(args: unknown): Promise<ToolResponse> {
    try {
      const validated = GetVotingPowerSchema.parse(args);
      const { electionId } = validated as GetVotingPowerInput;

      const daoService = this.services.daoService;
      const votingPower = await daoService.getVotingPower?.(electionId);

      if (votingPower === undefined || votingPower === null) {
        throw new McpError(
          ErrorCode.InternalError,
          'Failed to get voting power'
        );
      }

      const response = {
        votingPower: votingPower.toString(),
        electionId: electionId ?? 'general',
        message: 'Voting power based on token balance'
      };

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }],
        structuredContent: response
      };
    } catch (error) {
      return this.errorResponse(error, 'Failed to get voting power');
    }
  }

  private async handleCloseDaoElection(args: unknown): Promise<ToolResponse> {
    try {
      const validated = CloseDaoElectionSchema.parse(args);
      const { electionId } = validated as CloseDaoElectionInput;

      // Check if wallet is ready
      const isReady = await this.services.walletService.isReady?.() ?? false;
      if (!isReady) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          'Wallet is not ready. Please wait for synchronization to complete.'
        );
      }

      const daoService = this.services.daoService;
      const result = await daoService.closeElection?.(electionId);

      if (!result) {
        throw new McpError(
          ErrorCode.InternalError,
          'Failed to close DAO election'
        );
      }

      const response = {
        electionId,
        status: 'closed',
        results: result.results ?? {},
        message: 'DAO election closed successfully'
      };

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }],
        structuredContent: response
      };
    } catch (error) {
      return this.errorResponse(error, 'Failed to close DAO election');
    }
  }

  private errorResponse(error: unknown, message: string): ToolResponse {
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: true,
          message,
          details: errorMessage
        }, null, 2)
      }],
      isError: true
    };
  }
}
