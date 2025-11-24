/**
 * Tool Registry Unit Tests
 *
 * Tests for the central tool registry that aggregates all MCP tools.
 */

import { describe, it, expect } from '@jest/globals';

import {
  ALL_TOOLS,
  TOOL_MAP,
  getTool,
  hasTool,
  getAllToolNames,
  WALLET_TOOLS,
  TOKEN_TOOLS,
  DAO_TOOLS,
  MARKETPLACE_TOOLS,
} from '../../../../src/mcp/tools/index.js';

describe('Tool Registry', () => {
  describe('ALL_TOOLS', () => {
    it('should contain all tools from all domains', () => {
      const expectedCount =
        WALLET_TOOLS.length +
        TOKEN_TOOLS.length +
        DAO_TOOLS.length +
        MARKETPLACE_TOOLS.length;

      expect(ALL_TOOLS.length).toBe(expectedCount);
    });

    it('should include wallet tools', () => {
      const walletToolNames = WALLET_TOOLS.map((t) => t.name);
      walletToolNames.forEach((name) => {
        expect(ALL_TOOLS.some((t) => t.name === name)).toBe(true);
      });
    });

    it('should include token tools', () => {
      const tokenToolNames = TOKEN_TOOLS.map((t) => t.name);
      tokenToolNames.forEach((name) => {
        expect(ALL_TOOLS.some((t) => t.name === name)).toBe(true);
      });
    });

    it('should include DAO tools', () => {
      const daoToolNames = DAO_TOOLS.map((t) => t.name);
      daoToolNames.forEach((name) => {
        expect(ALL_TOOLS.some((t) => t.name === name)).toBe(true);
      });
    });

    it('should include marketplace tools', () => {
      const marketplaceToolNames = MARKETPLACE_TOOLS.map((t) => t.name);
      marketplaceToolNames.forEach((name) => {
        expect(ALL_TOOLS.some((t) => t.name === name)).toBe(true);
      });
    });

    it('should have unique tool names', () => {
      const names = ALL_TOOLS.map((t) => t.name);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });

    it('should have valid tool structure for all tools', () => {
      ALL_TOOLS.forEach((tool) => {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('inputSchema');
        expect(tool).toHaveProperty('execute');
        expect(typeof tool.name).toBe('string');
        expect(typeof tool.description).toBe('string');
        expect(typeof tool.execute).toBe('function');
      });
    });
  });

  describe('TOOL_MAP', () => {
    it('should be a Map', () => {
      expect(TOOL_MAP).toBeInstanceOf(Map);
    });

    it('should contain all tools by name', () => {
      expect(TOOL_MAP.size).toBe(ALL_TOOLS.length);
    });

    it('should map tool names to tool definitions', () => {
      ALL_TOOLS.forEach((tool) => {
        expect(TOOL_MAP.get(tool.name)).toBe(tool);
      });
    });
  });

  describe('getTool', () => {
    it('should return tool definition for existing tool', () => {
      const tool = getTool('walletStatus');
      expect(tool).toBeDefined();
      expect(tool?.name).toBe('walletStatus');
    });

    it('should return undefined for non-existent tool', () => {
      const tool = getTool('nonExistentTool');
      expect(tool).toBeUndefined();
    });

    it('should be case-sensitive', () => {
      const tool = getTool('WalletStatus'); // Wrong case
      expect(tool).toBeUndefined();
    });
  });

  describe('hasTool', () => {
    it('should return true for existing tool', () => {
      expect(hasTool('walletStatus')).toBe(true);
      expect(hasTool('getTokenBalance')).toBe(true);
      expect(hasTool('openDaoElection')).toBe(true);
      expect(hasTool('getUserInfo')).toBe(true);
    });

    it('should return false for non-existent tool', () => {
      expect(hasTool('nonExistentTool')).toBe(false);
      expect(hasTool('')).toBe(false);
    });

    it('should be case-sensitive', () => {
      expect(hasTool('WalletStatus')).toBe(false);
    });
  });

  describe('getAllToolNames', () => {
    it('should return array of all tool names', () => {
      const names = getAllToolNames();
      expect(Array.isArray(names)).toBe(true);
      expect(names.length).toBe(ALL_TOOLS.length);
    });

    it('should contain expected tool names', () => {
      const names = getAllToolNames();
      expect(names).toContain('walletStatus');
      expect(names).toContain('walletAddress');
      expect(names).toContain('walletBalance');
      expect(names).toContain('getTokenBalance');
      expect(names).toContain('openDaoElection');
      expect(names).toContain('getUserInfo');
    });

    it('should return strings only', () => {
      const names = getAllToolNames();
      names.forEach((name) => {
        expect(typeof name).toBe('string');
      });
    });
  });

  describe('Individual Tool Collections', () => {
    it('WALLET_TOOLS should be exported', () => {
      expect(Array.isArray(WALLET_TOOLS)).toBe(true);
      expect(WALLET_TOOLS.length).toBeGreaterThan(0);
    });

    it('TOKEN_TOOLS should be exported', () => {
      expect(Array.isArray(TOKEN_TOOLS)).toBe(true);
      expect(TOKEN_TOOLS.length).toBeGreaterThan(0);
    });

    it('DAO_TOOLS should be exported', () => {
      expect(Array.isArray(DAO_TOOLS)).toBe(true);
      expect(DAO_TOOLS.length).toBeGreaterThan(0);
    });

    it('MARKETPLACE_TOOLS should be exported', () => {
      expect(Array.isArray(MARKETPLACE_TOOLS)).toBe(true);
      expect(MARKETPLACE_TOOLS.length).toBeGreaterThan(0);
    });
  });
});
