/**
 * Marketplace Tools - MCP Tool Definitions for NFT Marketplace
 *
 * Defines all marketplace-related MCP tools with Zod validation.
 *
 * NEW: Each tool now has an execute function that receives services.
 * MOCK MODE: Returns hardcoded mock data for testing without actual marketplace contract connections.
 *
 * NOTE: Marketplace tools updated to match actual MarketplaceService API
 */

import { z } from 'zod';
import type { ServiceDependencies } from '../types.js';
import type { ToolDefinition } from '../adapter/types.js';
import {
  getMockUserInfo,
  isMockUserRegistered,
  isMockUserVerified,
} from './mock-data.js';

/**
 * Schemas
 */
export const GetUserInfoSchema = z.object({
  userId: z.string()
    .min(1)
    .describe("User identifier")
});

export const IsUserRegisteredSchema = z.object({
  userId: z.string()
    .min(1)
    .describe("User identifier to check")
});

export const IsUserVerifiedSchema = z.object({
  userId: z.string()
    .min(1)
    .describe("User identifier to check")
});

/**
 * Type Inference
 */
export type GetUserInfoInput = z.infer<typeof GetUserInfoSchema>;
export type IsUserRegisteredInput = z.infer<typeof IsUserRegisteredSchema>;
export type IsUserVerifiedInput = z.infer<typeof IsUserVerifiedSchema>;

/**
 * Tool Definitions with Execute Functions
 */
export const getUserInfoTool: ToolDefinition = {
  name: "getUserInfo",
  description: "Get information about a marketplace user",
  inputSchema: GetUserInfoSchema.shape,
  execute: async (args: unknown, services: ServiceDependencies) => {
    const { userId } = GetUserInfoSchema.parse(args);
    // MOCK: Return hardcoded user info
    const userInfo = getMockUserInfo(userId);
    if (!userInfo) {
      throw new Error(`User not found: ${userId}`);
    }
    return userInfo;
  }
};

export const isUserRegisteredTool: ToolDefinition = {
  name: "isUserRegistered",
  description: "Check if a user is registered in the marketplace",
  inputSchema: IsUserRegisteredSchema.shape,
  execute: async (args: unknown, services: ServiceDependencies) => {
    const { userId } = IsUserRegisteredSchema.parse(args);
    // MOCK: Return hardcoded registration status
    return {
      userId,
      isRegistered: isMockUserRegistered(userId)
    };
  }
};

export const isUserVerifiedTool: ToolDefinition = {
  name: "isUserVerified",
  description: "Check if a user is verified in the marketplace",
  inputSchema: IsUserVerifiedSchema.shape,
  execute: async (args: unknown, services: ServiceDependencies) => {
    const { userId } = IsUserVerifiedSchema.parse(args);
    // MOCK: Return hardcoded verification status
    return {
      userId,
      isVerified: isMockUserVerified(userId)
    };
  }
};

/**
 * All marketplace tools (ToolDefinition format)
 *
 * NOTE: Reduced to read-only operations for now.
 * TODO: Add registerUser, verifyUser when needed (requires complex input data structures)
 */
export const MARKETPLACE_TOOLS: ToolDefinition[] = [
  getUserInfoTool,
  isUserRegisteredTool,
  isUserVerifiedTool
];
