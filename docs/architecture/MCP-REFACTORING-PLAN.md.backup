# MCP Refactoring Plan

**Date**: 2025-01-21
**Status**: Planning Phase
**Priority**: HIGH - Current structure follows "old pattern"

---

## Executive Summary

The current MCP server implementation follows an outdated architecture pattern with:
- God class (662 lines)
- Unnecessary HTTP layer between MCP and services
- Giant switch statement (200+ lines)
- No domain separation
- Still using old `WalletManager` instead of refactored services

**Goal**: Refactor to modern MCP architecture using the new service layer directly.

---

## Current Architecture Problems

### Architecture Flow (OLD)

```
MCP Client
   ↓ (JSON-RPC over STDIO)
MCP Server (src/mcp/stdio-server.ts)
   ↓
Tool Handlers (src/mcp/tools.ts - giant switch)
   ↓ (HTTP requests via httpClient)
HTTP Client (src/lib/utils/http-client.ts)
   ↓ (REST API calls)
Express API Server (src/api/server.ts)
   ↓
Controller (src/api/controllers/wallet.controller.ts)
   ↓
WalletServiceMCP (src/mcp/index.ts - GOD CLASS 662 lines)
   ↓
WalletManager (OLD god class - src/wallet/index.ts)
```

### Identified Problems

1. **God Class Anti-Pattern**
   - `src/mcp/index.ts`: 662 lines with ALL operations
   - Wallet, Token, DAO, and Marketplace operations mixed together
   - Violates Single Responsibility Principle

2. **Unnecessary HTTP Layer**
   - MCP tools make HTTP requests to Express server
   - Express server calls `WalletServiceMCP`
   - Adds latency, complexity, and failure points
   - Can't test MCP layer without starting HTTP server

3. **Giant Switch Statement**
   - `src/mcp/tools.ts` `handleToolCall()`: 200+ lines
   - All 18+ tools in one switch statement
   - Hard to maintain and extend

4. **No Domain Separation**
   - All tools defined in single file
   - No grouping by domain (wallet/token/dao/marketplace)
   - Hard to find and modify specific functionality

5. **Not Using Refactored Services**
   - Still wraps old `WalletManager` god class
   - Doesn't leverage new service architecture:
     - `WalletService`
     - `TokenService`
     - `DaoService`
     - `MarketplaceService`

6. **Empty Directories**
   - `src/mcp/handlers/` - only .gitkeep
   - `src/mcp/tools/` - only .gitkeep
   - Indicates incomplete refactoring

---

## New Architecture Design

### Architecture Flow (NEW)

```
MCP Client
   ↓ (JSON-RPC over STDIO)
MCP Server (src/mcp/stdio-server.ts)
   ↓
Tool Registry (src/mcp/tools/registry.ts)
   ↓
Domain Handlers (separate files)
   ├── src/mcp/handlers/wallet-handler.ts → WalletService
   ├── src/mcp/handlers/token-handler.ts → TokenService
   ├── src/mcp/handlers/dao-handler.ts → DaoService
   └── src/mcp/handlers/marketplace-handler.ts → MarketplaceService
   ↓ (direct calls)
Refactored Services (src/services/)
   ├── WalletService (src/services/wallet/WalletService.ts)
   ├── TokenService (src/services/wallet/TokenService.ts)
   ├── DaoService (src/services/dao/DaoService.ts)
   └── MarketplaceService (src/services/marketplace/MarketplaceService.ts)
```

### Benefits

✅ **Remove HTTP Layer** - Direct service calls (faster, simpler)
✅ **Domain Separation** - Each handler focuses on one area
✅ **Testable** - Can test MCP layer independently
✅ **Uses Refactored Services** - Leverages clean architecture
✅ **Maintainable** - Smaller files (~150 lines each)
✅ **Extensible** - Easy to add new domains
✅ **Type-Safe** - Direct TypeScript interfaces, no HTTP JSON parsing

---

## New File Structure

```
src/mcp/
├── stdio-server.ts              # Entry point (KEEP - minimal changes)
├── server.ts                    # MCP Server setup (NEW)
├── types.ts                     # Shared MCP types (NEW)
│
├── tools/
│   ├── registry.ts              # Tool registration central registry (NEW)
│   ├── wallet-tools.ts          # Wallet tool definitions (NEW)
│   ├── token-tools.ts           # Token tool definitions (NEW)
│   ├── dao-tools.ts             # DAO tool definitions (NEW)
│   └── marketplace-tools.ts     # Marketplace tool definitions (NEW)
│
├── handlers/
│   ├── wallet-handler.ts        # Wallet tool handlers (NEW)
│   ├── token-handler.ts         # Token tool handlers (NEW)
│   ├── dao-handler.ts           # DAO tool handlers (NEW)
│   └── marketplace-handler.ts   # Marketplace tool handlers (NEW)
│
└── resources/
    ├── registry.ts              # Resource registration (NEW)
    └── wallet-resources.ts      # Wallet resource definitions (NEW)

# Files to DELETE/REFACTOR:
src/mcp/index.ts          # DELETE - God class (replace with handlers)
src/mcp/tools.ts          # DELETE - Giant switch (replace with handlers)
src/mcp/resources.ts      # REFACTOR - Move to resources/
```

---

## Implementation Pattern

### Tool Definition Pattern

**File**: `src/mcp/tools/wallet-tools.ts`

```typescript
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

export const WALLET_TOOLS: Tool[] = [
  {
    name: "walletStatus",
    description: "Get the current status of the wallet",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "walletAddress",
    description: "Get the wallet address",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "walletBalance",
    description: "Get the current balance of the wallet",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "send",
    description: "Send native tokens to another address",
    inputSchema: {
      type: "object",
      properties: {
        destinationAddress: { type: "string" },
        amount: { type: "string" }
      },
      required: ["destinationAddress", "amount"]
    }
  }
];
```

### Handler Pattern

**File**: `src/mcp/handlers/wallet-handler.ts`

```typescript
import type { WalletService } from '../../services/wallet/WalletService.js';
import type { TransactionService } from '../../services/wallet/TransactionService.js';
import { createLogger } from '../../lib/logger/index.js';
import type { Logger } from 'pino';

export interface WalletHandlerConfig {
  walletService: WalletService;
  transactionService: TransactionService;
}

export class WalletHandler {
  private logger: Logger;
  private config: WalletHandlerConfig;

  constructor(config: WalletHandlerConfig) {
    this.config = config;
    this.logger = createLogger('mcp:wallet-handler');
  }

  /**
   * Handle walletStatus tool call
   */
  async handleWalletStatus() {
    this.logger.debug('Handling walletStatus');

    const status = await this.config.walletService.getStatus();

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify(status, null, 2)
      }]
    };
  }

  /**
   * Handle walletAddress tool call
   */
  async handleWalletAddress() {
    this.logger.debug('Handling walletAddress');

    const address = this.config.walletService.getAddress();

    return {
      content: [{
        type: "text" as const,
        text: address
      }]
    };
  }

  /**
   * Handle walletBalance tool call
   */
  async handleWalletBalance() {
    this.logger.debug('Handling walletBalance');

    const balance = await this.config.walletService.getBalance();

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify(balance, null, 2)
      }]
    };
  }

  /**
   * Handle send tool call
   */
  async handleSend(args: { destinationAddress: string; amount: string }) {
    this.logger.debug('Handling send', args);

    const { destinationAddress, amount } = args;

    // Validate inputs
    if (!destinationAddress || !amount) {
      throw new Error('Missing required parameters: destinationAddress and amount');
    }

    // Send funds via WalletService
    const txId = await this.config.walletService.sendFunds(
      destinationAddress,
      amount
    );

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ transactionId: txId }, null, 2)
      }]
    };
  }
}
```

### Tool Registry Pattern

**File**: `src/mcp/tools/registry.ts`

```typescript
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { WALLET_TOOLS } from './wallet-tools.js';
import { TOKEN_TOOLS } from './token-tools.js';
import { DAO_TOOLS } from './dao-tools.js';
import { MARKETPLACE_TOOLS } from './marketplace-tools.js';

/**
 * Central registry of all MCP tools
 */
export const ALL_TOOLS: Tool[] = [
  ...WALLET_TOOLS,
  ...TOKEN_TOOLS,
  ...DAO_TOOLS,
  ...MARKETPLACE_TOOLS
];

/**
 * Get tools by category
 */
export function getToolsByCategory(category: string): Tool[] {
  switch (category) {
    case 'wallet':
      return WALLET_TOOLS;
    case 'token':
      return TOKEN_TOOLS;
    case 'dao':
      return DAO_TOOLS;
    case 'marketplace':
      return MARKETPLACE_TOOLS;
    default:
      return [];
  }
}
```

### Server Setup Pattern

**File**: `src/mcp/server.ts`

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { ALL_TOOLS } from './tools/registry.js';
import { WalletHandler } from './handlers/wallet-handler.ts';
import { TokenHandler } from './handlers/token-handler.ts';
import { DaoHandler } from './handlers/dao-handler.ts';
import { MarketplaceHandler } from './handlers/marketplace-handler.ts';
import type { WalletService } from '../services/wallet/WalletService.js';
import type { TokenService } from '../services/wallet/TokenService.js';
import type { DaoService } from '../services/dao/DaoService.js';
import type { MarketplaceService } from '../services/marketplace/MarketplaceService.js';
import type { TransactionService } from '../services/wallet/TransactionService.js';

export interface MCPServerConfig {
  walletService: WalletService;
  tokenService: TokenService;
  daoService: DaoService;
  marketplaceService: MarketplaceService;
  transactionService: TransactionService;
}

export class MCPServer {
  private server: Server;
  private walletHandler: WalletHandler;
  private tokenHandler: TokenHandler;
  private daoHandler: DaoHandler;
  private marketplaceHandler: MarketplaceHandler;

  constructor(config: MCPServerConfig) {
    // Initialize server
    this.server = new Server({
      name: "midnight-mcp-server",
      version: "2.0.0"
    }, {
      capabilities: {
        resources: {},
        tools: {}
      }
    });

    // Initialize handlers
    this.walletHandler = new WalletHandler({
      walletService: config.walletService,
      transactionService: config.transactionService
    });

    this.tokenHandler = new TokenHandler({
      tokenService: config.tokenService,
      transactionService: config.transactionService
    });

    this.daoHandler = new DaoHandler({
      daoService: config.daoService
    });

    this.marketplaceHandler = new MarketplaceHandler({
      marketplaceService: config.marketplaceService
    });

    // Setup request handlers
    this.setupHandlers();
  }

  private setupHandlers() {
    // List tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return { tools: ALL_TOOLS };
    });

    // Call tool
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      // Route to appropriate handler
      if (name.startsWith('wallet')) {
        return this.routeWalletTool(name, args);
      } else if (name.startsWith('token') || name.includes('Token')) {
        return this.routeTokenTool(name, args);
      } else if (name.startsWith('dao') || name.includes('Dao')) {
        return this.routeDaoTool(name, args);
      } else if (name.includes('Marketplace')) {
        return this.routeMarketplaceTool(name, args);
      } else if (name === 'send') {
        return this.walletHandler.handleSend(args);
      }

      throw new Error(`Unknown tool: ${name}`);
    });
  }

  private async routeWalletTool(name: string, args: any) {
    switch (name) {
      case 'walletStatus':
        return this.walletHandler.handleWalletStatus();
      case 'walletAddress':
        return this.walletHandler.handleWalletAddress();
      case 'walletBalance':
        return this.walletHandler.handleWalletBalance();
      case 'send':
        return this.walletHandler.handleSend(args);
      case 'getTransactionStatus':
        return this.walletHandler.handleGetTransactionStatus(args);
      case 'getTransactions':
        return this.walletHandler.handleGetTransactions();
      default:
        throw new Error(`Unknown wallet tool: ${name}`);
    }
  }

  private async routeTokenTool(name: string, args: any) {
    switch (name) {
      case 'getTokenBalance':
        return this.tokenHandler.handleGetTokenBalance(args);
      case 'sendToken':
        return this.tokenHandler.handleSendToken(args);
      case 'registerToken':
        return this.tokenHandler.handleRegisterToken(args);
      default:
        throw new Error(`Unknown token tool: ${name}`);
    }
  }

  private async routeDaoTool(name: string, args: any) {
    switch (name) {
      case 'openDaoElection':
        return this.daoHandler.handleOpenElection(args);
      case 'closeDaoElection':
        return this.daoHandler.handleCloseElection();
      case 'castDaoVote':
        return this.daoHandler.handleCastVote(args);
      case 'fundDaoTreasury':
        return this.daoHandler.handleFundTreasury(args);
      default:
        throw new Error(`Unknown DAO tool: ${name}`);
    }
  }

  private async routeMarketplaceTool(name: string, args: any) {
    switch (name) {
      case 'registerInMarketplace':
        return this.marketplaceHandler.handleRegister(args);
      case 'verifyUserInMarketplace':
        return this.marketplaceHandler.handleVerify(args);
      default:
        throw new Error(`Unknown marketplace tool: ${name}`);
    }
  }

  getServer(): Server {
    return this.server;
  }
}
```

---

## Migration Strategy

### Phase 1: Setup New Structure (No Breaking Changes)

**Tasks**:
1. Create new directory structure (handlers/, tools/, resources/)
2. Create type definitions (`src/mcp/types.ts`)
3. Create tool definition files (wallet-tools.ts, token-tools.ts, etc.)
4. Create tool registry (`src/mcp/tools/registry.ts`)

**Files Created**:
- `src/mcp/types.ts`
- `src/mcp/tools/registry.ts`
- `src/mcp/tools/wallet-tools.ts`
- `src/mcp/tools/token-tools.ts`
- `src/mcp/tools/dao-tools.ts`
- `src/mcp/tools/marketplace-tools.ts`

**Status**: No breaking changes - old code still works

---

### Phase 2: Implement Handlers (Parallel Development)

**Tasks**:
1. Implement `WalletHandler` using `WalletService` directly
2. Implement `TokenHandler` using `TokenService` directly
3. Implement `DaoHandler` using `DaoService` directly
4. Implement `MarketplaceHandler` using `MarketplaceService` directly

**Files Created**:
- `src/mcp/handlers/wallet-handler.ts` (~150 lines)
- `src/mcp/handlers/token-handler.ts` (~150 lines)
- `src/mcp/handlers/dao-handler.ts` (~150 lines)
- `src/mcp/handlers/marketplace-handler.ts` (~100 lines)

**Status**: No breaking changes - new handlers exist alongside old code

---

### Phase 3: Create New MCP Server

**Tasks**:
1. Create `src/mcp/server.ts` with `MCPServer` class
2. Wire up handlers to MCP Server
3. Implement tool routing logic
4. Add error handling and logging

**Files Created**:
- `src/mcp/server.ts` (~300 lines)

**Status**: New server exists, old server still used

---

### Phase 4: Update Entry Point (BREAKING CHANGE)

**Tasks**:
1. Update `src/mcp/stdio-server.ts` to use new `MCPServer`
2. Initialize services directly (no HTTP layer)
3. Remove dependency on `src/api/server.ts`
4. Update environment variable handling

**Files Modified**:
- `src/mcp/stdio-server.ts` - Major refactor

**Status**: BREAKING - switches to new architecture

---

### Phase 5: Cleanup (Delete Old Code)

**Tasks**:
1. Delete `src/mcp/index.ts` (god class)
2. Delete `src/mcp/tools.ts` (giant switch)
3. Refactor `src/mcp/resources.ts` to new structure
4. Delete `src/lib/utils/http-client.ts` (no longer needed)
5. Consider deprecating `src/api/server.ts` (if MCP is primary interface)

**Files Deleted**:
- `src/mcp/index.ts` (662 lines)
- `src/mcp/tools.ts` (558 lines)
- `src/lib/utils/http-client.ts` (68 lines)

**Files Refactored**:
- `src/mcp/resources.ts` → `src/mcp/resources/wallet-resources.ts`

**Status**: Clean codebase with ~1,300 lines removed

---

## Service Dependencies

The new MCP handlers will use these refactored services:

### WalletService
**Location**: `src/services/wallet/WalletService.ts`
**Methods Used**:
- `getStatus()` - wallet status
- `getAddress()` - wallet address
- `getBalance()` - wallet balance
- `sendFunds(to, amount)` - send native tokens
- `getWalletState()` - full wallet state

### TokenService
**Location**: `src/services/wallet/TokenService.ts`
**Methods Used**:
- `registerToken(...)` - register token
- `getTokenBalance(tokenName)` - get token balance
- `sendToken(tokenName, to, amount)` - send tokens
- `listTokens()` - list all registered tokens
- `autoRegisterTokens()` - auto-register from wallet state

### DaoService
**Location**: `src/services/dao/DaoService.ts`
**Methods Used**:
- `openElection(electionId)` - open DAO election
- `closeElection()` - close DAO election
- `castVote(voteChoice)` - cast vote
- `fundTreasury(amount)` - fund treasury
- `getElectionStatus()` - get election status
- `getDaoState()` - get full DAO state

### MarketplaceService
**Location**: `src/services/marketplace/MarketplaceService.ts`
**Methods Used** (pending implementation):
- `registerUser(userId, userData)` - register user
- `verifyUser(userId, verificationData)` - verify user
- `isUserRegistered(userId)` - check if registered
- `isUserVerified(userId)` - check if verified
- `getUserInfo(userId)` - get user info

### TransactionService
**Location**: `src/services/wallet/TransactionService.ts`
**Methods Used**:
- `getTransaction(txId)` - get transaction by ID
- `getAllTransactions()` - get all transactions
- `getPendingTransactions()` - get pending transactions

---

## Testing Strategy

### Unit Tests

**Test Files to Create**:
- `test/unit/mcp/handlers/wallet-handler.test.ts`
- `test/unit/mcp/handlers/token-handler.test.ts`
- `test/unit/mcp/handlers/dao-handler.test.ts`
- `test/unit/mcp/handlers/marketplace-handler.test.ts`
- `test/unit/mcp/server.test.ts`

**Pattern**: Mock services, test handler logic

### Integration Tests

**Test Files to Create**:
- `test/integration/mcp/mcp-server.test.ts` - Test MCP server with real services

**Pattern**: Test full request/response flow

### End-to-End Tests

**Test Files to Update**:
- `test/e2e/mcp-client.test.ts` - Test MCP client against refactored server

---

## Rollback Plan

If issues arise during migration:

1. **Phase 1-3**: No rollback needed - old code still works
2. **Phase 4**: Revert `src/mcp/stdio-server.ts` to use old structure
3. **Phase 5**: Restore deleted files from git history

---

## Success Metrics

✅ **Code Reduction**: Remove ~1,300 lines of old code
✅ **Performance**: No HTTP layer = faster tool calls
✅ **Maintainability**: Files < 200 lines each
✅ **Testability**: All handlers unit testable
✅ **Architecture**: Clean service integration

---

## Timeline Estimate

- **Phase 1**: 2-3 hours (setup structure + tool definitions)
- **Phase 2**: 4-5 hours (implement handlers)
- **Phase 3**: 2-3 hours (create MCPServer class)
- **Phase 4**: 1-2 hours (update entry point)
- **Phase 5**: 1 hour (cleanup)

**Total**: 10-14 hours

---

## Next Steps

1. **Review this plan** with team
2. **Approve migration approach**
3. **Start with Phase 1** (non-breaking)
4. **Implement handlers incrementally**
5. **Test thoroughly before Phase 4**
6. **Execute Phase 4 during maintenance window**

---

**Document Version**: 1.0
**Date**: 2025-01-21
**Author**: Implementation Team
**Status**: Planning - Awaiting Approval
