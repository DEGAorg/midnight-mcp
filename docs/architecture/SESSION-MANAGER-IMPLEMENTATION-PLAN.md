# Session Manager & HTTP Transport Implementation Plan

**Date**: 2025-01-21
**Status**: Design Phase
**Goal**: Implement SessionManager and HTTP transport for multi-agent support

---

## Executive Summary

This document outlines the implementation plan for adding SessionManager and HTTP transport to the Midnight MCP server, enabling multi-agent deployment while maintaining backward compatibility with STDIO transport.

**Key Patterns Identified**:
1. **Session Management** (from Midnight-Mcp): Per-session service isolation
2. **Tool Adapter Pattern** (from vechain-mcp-server): No switch statements, tools execute themselves
3. **Dual Transport** (from research): Support both STDIO (dev) and HTTP (production)

---

## Architecture Overview

### Current Architecture (STDIO Only)

```
stdio-server.ts
   ↓
initializeServices() → WalletOrchestrator.start()
   ↓
MCPServer(services) → handlers → switch statement → services
   ↓
StdioServerTransport
```

**Problems**:
- ❌ Single agent only (STDIO limitation)
- ❌ Massive switch statement for tool routing
- ❌ No session isolation
- ❌ Can't scale to multiple agents

### Target Architecture (Dual Transport + Sessions)

```
                    ┌─────────────────┐
                    │   Entry Point   │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │ Transport Layer │
                    │  STDIO │ HTTP   │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │ SessionManager  │
                    │ (per-agent svcs)│
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  ToolAdapter    │
                    │ (no switch stmt)│
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │     Tools       │
                    │ (self-executing)│
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │    Services     │
                    │ WalletOrch

estrator│
                    └─────────────────┘
```

**Benefits**:
- ✅ Multi-agent support (100+ concurrent)
- ✅ Session isolation (no data leaks)
- ✅ Clean tool routing (no switch statements)
- ✅ Dual transport (STDIO + HTTP)
- ✅ Horizontal scaling ready

---

## Research Findings

### 1. Session Management Pattern (from Midnight-Mcp)

**File**: `/Users/apple/dev/workstuff/MIDNIGHTAI-SIM/refactor-codebase/Midnight-Mcp/src/mcp/server/SessionManager.ts`

**Key Features**:
```typescript
class SessionManager {
  private sessions = new Map<string, ISessionServices>();
  private metadata = new Map<string, ISessionMetadata>();

  async getOrCreateSession(sessionId: string): Promise<ISessionServices> {
    // LRU eviction when maxSessions reached
    // Creates isolated services per session
    // Tracks metadata (created, lastAccessed, agentIds)
  }

  async cleanup(sessionId: string): Promise<void> {
    // Graceful shutdown of services
    // Cleanup callback for external resources
  }
}
```

**Services Created Per Session**:
- `walletService`: Wallet lifecycle management
- `transactionService`: Transaction tracking
- `tokenService`: Token operations
- `daoService`: DAO operations (optional)
- `marketplaceService`: Marketplace operations (optional)

**For Midnight MCP Old**:
```typescript
interface ServiceDependencies {
  walletService: WalletService;
  transactionService: TransactionService;
  tokenService: TokenService;
  daoService: DaoService;
  marketplaceService: MarketplaceService;
}
```

### 2. Tool Adapter Pattern (from vechain-mcp-server)

**File**: `/Users/apple/dev/hackathon/vchain/vechain-mcp-server/src/adapters/mcp/adapter.ts`

**Key Pattern**:
```typescript
export async function getOnChainTools({ wallet, plugins }) {
  const tools: ToolBase[] = await getTools({ wallet, plugins });

  return {
    // Returns array of tool definitions
    listOfTools: () => {
      return tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: zodToJsonSchema(tool.parameters)
      }));
    },

    // Executes tool by name
    toolHandler: async (name: string, parameters: unknown) => {
      const tool = tools.find((t) => t.name === name);
      const parsedParams = tool.parameters.parse(parameters);
      const result = await tool.execute(parsedParams);

      return {
        content: [{ type: 'text', text: JSON.stringify(result) }]
      };
    }
  };
}
```

**Server Registration** (NO SWITCH STATEMENT):
```typescript
// List tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const { listOfTools } = await toolsPromise;
  return { tools: listOfTools() };
});

// Execute tools
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { toolHandler } = await toolsPromise;
  return await toolHandler(request.params.name, request.params.arguments);
});
```

### 3. Tool Structure (from Midnight-Mcp)

**File**: `/Users/apple/dev/workstuff/MIDNIGHTAI-SIM/refactor-codebase/Midnight-Mcp/src/modules/wallet/tools/wallet/get_wallet_address.ts`

**Pattern**:
```typescript
// 1. Define Zod schema
export const GET_WALLET_ADDRESS_SCHEMA = z.object({
  walletId: z.string().describe('Wallet identifier')
});

// 2. Infer types
export type IGetWalletAddressInput = z.infer<typeof GET_WALLET_ADDRESS_SCHEMA>;

// 3. Output interface
export interface IWalletAddress {
  address: string | null;
  walletId: string;
}

// 4. Tool definition
export const getWalletAddressTool = {
  name: 'wallet_getAddress',
  description: 'Get the wallet address',
  inputSchema: GET_WALLET_ADDRESS_SCHEMA.shape,
};

// 5. Handler with session context
export async function getWalletAddressHandler(
  input: IGetWalletAddressInput,
  context: ISessionServices  // ← Session services injected!
): Promise<Result<IWalletAddress, NotFoundError>> {
  const { walletService, logger } = context;

  const walletResult = await walletService.getWallet(input.walletId);
  // ...
  return { success: true, value: result };
}

// 6. Export combined
export default {
  ...getWalletAddressTool,
  handler: getWalletAddressHandler
};
```

### 4. Tool Registry (from Midnight-Mcp)

**File**: `/Users/apple/dev/workstuff/MIDNIGHTAI-SIM/refactor-codebase/Midnight-Mcp/src/mcp/server/ToolRegistry.ts`

**Pattern**:
```typescript
export class ToolRegistry {
  constructor(
    private readonly server: McpServer,
    private readonly sessionServices: ISessionServices  // ← Session context
  ) {
    this.collectTools();
    this.registerTools();
  }

  private collectTools(): void {
    const toolModules = [
      ...Object.values(walletTools),
      ...Object.values(tokenTools),
      ...Object.values(transactionTools),
    ];

    this.tools = toolModules
      .filter(hasToolStructure)
      .map((tool) => tool as IToolDefinition);
  }

  private registerTools(): void {
    for (const tool of this.tools) {
      this.server.registerTool(
        tool.name,
        {
          title: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema as ZodRawShape,
        },
        async (input: unknown) => {
          // Inject session services and execute handler
          const result = await tool.handler(input, this.sessionServices);
          // Handle Result<T, E> pattern and return MCP format
        }
      );
    }
  }
}
```

### 5. HTTP Transport (from research)

**Stateless Mode** (for serverless):
```typescript
app.post('/mcp', async (req, res) => {
  const sessionId = generateSessionId();

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,  // Stateless
    enableJsonResponse: true,
  });

  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});
```

**Stateful Mode** (for interactive agents):
```typescript
const sessionServers = new Map<string, McpServer>();
const sessionManager = new SessionManager(config, onSessionCleanup);

app.post('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string || generateSessionId();

  let mcpServer = sessionServers.get(sessionId);

  if (!mcpServer) {
    mcpServer = new McpServer({ name: 'midnight-mcp', version: '2.0.0' });
    const services = await sessionManager.getOrCreateSession(sessionId);
    new ToolRegistry(mcpServer, services);
    sessionServers.set(sessionId, mcpServer);
  }

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,  // Stateless mode (we manage sessions)
    enableJsonResponse: true,
  });

  await mcpServer.connect(transport);
  await transport.handleRequest(req, res, req.body);
});
```

---

## Implementation Plan

### Phase 1: Create Tool Adapter (8-12 hours)

**Goal**: Replace switch statement with adapter pattern

**Files to Create**:
1. `src/mcp/adapter/tool-adapter.ts` - Main adapter (vechain pattern)
2. `src/mcp/adapter/types.ts` - Type definitions

**Pattern**:
```typescript
// src/mcp/adapter/tool-adapter.ts
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (args: unknown, services: ServiceDependencies) => Promise<unknown>;
}

export async function createToolAdapter(services: ServiceDependencies) {
  // Collect all tools from tool files
  const tools: ToolDefinition[] = [
    ...WALLET_TOOLS,
    ...TOKEN_TOOLS,
    ...DAO_TOOLS,
    ...MARKETPLACE_TOOLS
  ];

  return {
    listOfTools: () => {
      return tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema
      }));
    },

    toolHandler: async (name: string, args: unknown) => {
      const tool = tools.find((t) => t.name === name);
      if (!tool) {
        throw new Error(`Tool ${name} not found`);
      }

      // Execute tool with services injected
      const result = await tool.execute(args, services);

      return {
        content: [{ type: 'text', text: JSON.stringify(result) }]
      };
    }
  };
}
```

**Tool File Format** (update existing):
```typescript
// src/mcp/tools/wallet-tools.ts
export const walletStatusTool: ToolDefinition = {
  name: 'walletStatus',
  description: 'Get wallet synchronization status',
  inputSchema: {},
  execute: async (args: unknown, services: ServiceDependencies) => {
    return await services.walletService.getStatus();
  }
};

export const walletAddressTool: ToolDefinition = {
  name: 'walletAddress',
  description: 'Get wallet address',
  inputSchema: {},
  execute: async (args: unknown, services: ServiceDependencies) => {
    return await services.walletService.getAddress();
  }
};

export const WALLET_TOOLS = [
  walletStatusTool,
  walletAddressTool,
  // ... more tools
];
```

**Update Server** (remove switch statement):
```typescript
// src/mcp/server.ts
export class MCPServer {
  constructor(private services: ServiceDependencies, serverInfo: { name: string; version: string }) {
    this.server = new McpServer(serverInfo);
    this.setupHandlers();
  }

  private async setupHandlers(): Promise<void> {
    // Create tool adapter
    const adapter = await createToolAdapter(this.services);

    // List tools
    this.server.setRequestHandler(
      ListToolsRequestSchema,
      async (_request: ListToolsRequest) => {
        return { tools: adapter.listOfTools() };
      }
    );

    // Call tool
    this.server.setRequestHandler(
      CallToolRequestSchema,
      async (request: CallToolRequest) => {
        const { name, arguments: args } = request.params;
        return await adapter.toolHandler(name, args);
      }
    );

    // ... resources and prompts handlers
  }
}
```

**Testing**:
```bash
# Verify STDIO still works
pnpm run dev

# Verify all tools are listed
# Verify tool execution works
```

---

### Phase 2: Implement SessionManager (12-16 hours)

**Goal**: Add per-session service isolation

**Files to Create**:
1. `src/mcp/session/SessionManager.ts` - Session lifecycle management
2. `src/mcp/session/types.ts` - Session types

**SessionManager Implementation**:
```typescript
// src/mcp/session/SessionManager.ts
import type { ServiceDependencies } from '../types.js';
import { WalletOrchestrator, type WalletOrchestratorConfig } from '../../services/WalletOrchestrator.js';

export interface SessionMetadata {
  sessionId: string;
  createdAt: Date;
  lastAccessedAt: Date;
  agentIds: Set<string>;
}

export class SessionManager {
  private sessions = new Map<string, ServiceDependencies>();
  private orchestrators = new Map<string, WalletOrchestrator>();
  private metadata = new Map<string, SessionMetadata>();
  private maxSessions: number;
  private onCleanupCallback?: (sessionId: string) => void;

  constructor(
    private config: { maxSessions: number },
    onCleanupCallback?: (sessionId: string) => void
  ) {
    this.maxSessions = config.maxSessions;
    this.onCleanupCallback = onCleanupCallback;
  }

  async getOrCreateSession(sessionId: string): Promise<ServiceDependencies> {
    if (this.sessions.has(sessionId)) {
      this.updateLastAccessed(sessionId);
      return this.sessions.get(sessionId)!;
    }

    // Check max sessions limit
    if (this.sessions.size >= this.maxSessions) {
      await this.cleanupOldestSession();
    }

    // Create orchestrator config (from env.ts)
    const appConfig = loadConfig();
    const walletFactory = createWalletFactory(appConfig);
    const walletPath = path.join(getWalletBackupFolder(appConfig), `${appConfig.WALLET_FILENAME}.json`);

    const orchestratorConfig: WalletOrchestratorConfig = {
      walletConfig: {
        walletFactory,
        walletPath,
        agentId: sessionId,
      },
      agentId: sessionId,
      daoContractAddress: appConfig.DAO_CONTRACT_ADDRESS,
      marketplaceContractAddress: appConfig.MARKETPLACE_CONTRACT_ADDRESS,
    };

    // Initialize orchestrator
    const orchestrator = new WalletOrchestrator(orchestratorConfig);
    await orchestrator.start();

    // Get services
    const services: ServiceDependencies = {
      walletService: orchestrator.getWalletService(),
      transactionService: orchestrator.getTransactionService(),
      tokenService: orchestrator.getTokenService(),
      daoService: orchestrator.getDaoService()!,
      marketplaceService: orchestrator.getMarketplaceService()!,
    };

    this.sessions.set(sessionId, services);
    this.orchestrators.set(sessionId, orchestrator);
    this.metadata.set(sessionId, {
      sessionId,
      createdAt: new Date(),
      lastAccessedAt: new Date(),
      agentIds: new Set(),
    });

    return services;
  }

  async cleanup(sessionId: string): Promise<void> {
    const orchestrator = this.orchestrators.get(sessionId);
    if (orchestrator) {
      await orchestrator.stop();
    }

    this.sessions.delete(sessionId);
    this.orchestrators.delete(sessionId);
    this.metadata.delete(sessionId);

    if (this.onCleanupCallback) {
      this.onCleanupCallback(sessionId);
    }
  }

  private async cleanupOldestSession(): Promise<void> {
    let oldestSessionId: string | null = null;
    let oldestTime = Date.now();

    for (const [sessionId, meta] of this.metadata.entries()) {
      if (meta.lastAccessedAt.getTime() < oldestTime) {
        oldestTime = meta.lastAccessedAt.getTime();
        oldestSessionId = sessionId;
      }
    }

    if (oldestSessionId) {
      await this.cleanup(oldestSessionId);
    }
  }

  private updateLastAccessed(sessionId: string): void {
    const meta = this.metadata.get(sessionId);
    if (meta) {
      meta.lastAccessedAt = new Date();
    }
  }

  async cleanupAll(): Promise<void> {
    const cleanupPromises = Array.from(this.sessions.keys()).map((sessionId) =>
      this.cleanup(sessionId)
    );
    await Promise.all(cleanupPromises);
  }

  get size(): number {
    return this.sessions.size;
  }

  getMetrics() {
    return {
      activeSessions: this.sessions.size,
      maxSessions: this.maxSessions,
      utilizationPercent: (this.sessions.size / this.maxSessions) * 100,
      sessions: Array.from(this.metadata.values()).map((meta) => ({
        sessionId: meta.sessionId,
        createdAt: meta.createdAt.toISOString(),
        lastAccessedAt: meta.lastAccessedAt.toISOString(),
        ageMinutes: (Date.now() - meta.createdAt.getTime()) / 60000,
        agentCount: meta.agentIds.size,
      })),
    };
  }
}
```

**Update stdio-server.ts** (use SessionManager):
```typescript
// src/mcp/stdio-server.ts
import { SessionManager } from './session/SessionManager.js';

export async function createServer() {
  // Create session manager (for future HTTP transport)
  const sessionManager = new SessionManager({ maxSessions: 100 });

  // For STDIO, use a single session
  const sessionId = 'stdio-session';
  const services = await sessionManager.getOrCreateSession(sessionId);

  // Create MCP server
  const mcpServer = new MCPServer(services, {
    name: "midnight-mcp-server",
    version: "2.0.0"
  });

  // ...rest of server setup

  return {
    start: async () => {
      // ...
    },
    stop: async () => {
      await sessionManager.cleanupAll();
      // ...
    },
    services,
    sessionManager
  };
}
```

**Testing**:
```bash
# Verify STDIO still works with SessionManager
pnpm run dev

# Verify session creation and cleanup
# Verify services are isolated
```

---

### Phase 3: Add HTTP Transport (16-24 hours)

**Goal**: Support HTTP transport for multi-agent deployment

**Files to Create**:
1. `src/mcp/http-server.ts` - HTTP server entry point
2. `src/config/http-config.ts` - HTTP configuration

**HTTP Server Implementation**:
```typescript
// src/mcp/http-server.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import { randomUUID } from 'crypto';
import { SessionManager } from './session/SessionManager.js';
import { createToolAdapter } from './adapter/tool-adapter.js';

function generateSessionId(): string {
  return `session-${randomUUID()}`;
}

export async function startHttpServer(port: number = 3000) {
  const app = express();
  app.use(express.json());

  // Store per-session MCP servers
  const sessionServers = new Map<string, McpServer>();

  // Cleanup callback
  const onSessionCleanup = (sessionId: string): void => {
    sessionServers.delete(sessionId);
  };

  // Create session manager
  const sessionManager = new SessionManager(
    { maxSessions: 100 },
    onSessionCleanup
  );

  // MCP endpoint
  app.post('/mcp', async (req, res) => {
    // Validate request
    if (!req.body || typeof req.body !== 'object') {
      res.status(400).json({
        jsonrpc: '2.0',
        error: { code: -32600, message: 'Invalid Request' },
        id: null,
      });
      return;
    }

    const body = req.body as Record<string, unknown>;

    if (body['jsonrpc'] !== '2.0') {
      res.status(400).json({
        jsonrpc: '2.0',
        error: { code: -32600, message: 'Invalid JSON-RPC version' },
        id: null,
      });
      return;
    }

    // Extract or generate session ID
    const sessionId =
      (req.headers['mcp-session-id'] as string) || generateSessionId();

    try {
      // Get or create MCP server for this session
      let mcpServer = sessionServers.get(sessionId);

      if (!mcpServer) {
        // Create MCP server
        mcpServer = new McpServer({
          name: 'midnight-mcp-server',
          version: '2.0.0',
        });

        // Get or create session services
        const services = await sessionManager.getOrCreateSession(sessionId);

        // Create tool adapter
        const adapter = await createToolAdapter(services);

        // Register handlers
        mcpServer.setRequestHandler(
          ListToolsRequestSchema,
          async () => ({ tools: adapter.listOfTools() })
        );

        mcpServer.setRequestHandler(
          CallToolRequestSchema,
          async (request) => {
            const { name, arguments: args } = request.params;
            return await adapter.toolHandler(name, args);
          }
        );

        sessionServers.set(sessionId, mcpServer);
      }

      // Create transport for this request
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,  // Stateless mode
        enableJsonResponse: true,
      });

      res.on('close', () => {
        void transport.close();
      });

      // Handle request
      await mcpServer.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        });
      }
    }
  });

  // Health check
  app.get('/health', (_req, res) => {
    const metrics = sessionManager.getMetrics();
    res.json({
      status: 'healthy',
      ...metrics,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  // Cleanup endpoint
  app.post('/cleanup/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    try {
      await sessionManager.cleanup(sessionId);
      res.json({ success: true, sessionId });
    } catch (error) {
      res.status(500).json({
        error: 'Cleanup failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Metrics endpoint
  app.get('/metrics', (_req, res) => {
    const metrics = sessionManager.getMetrics();
    res.set('Content-Type', 'text/plain');
    res.send(`
# HELP mcp_sessions_active Current number of active sessions
# TYPE mcp_sessions_active gauge
mcp_sessions_active ${metrics.activeSessions}

# HELP mcp_sessions_max Maximum allowed sessions
# TYPE mcp_sessions_max gauge
mcp_sessions_max ${metrics.maxSessions}

# HELP mcp_sessions_utilization_percent Session utilization percentage
# TYPE mcp_sessions_utilization_percent gauge
mcp_sessions_utilization_percent ${metrics.utilizationPercent.toFixed(2)}

# HELP mcp_uptime_seconds Server uptime in seconds
# TYPE mcp_uptime_seconds counter
mcp_uptime_seconds ${process.uptime().toFixed(2)}
    `.trim());
  });

  // Graceful shutdown
  const shutdown = async (): Promise<void> => {
    console.error('Shutting down gracefully');
    await sessionManager.cleanupAll();
    sessionServers.clear();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown());
  process.on('SIGINT', () => void shutdown());

  // Start server
  app.listen(port, () => {
    console.error(`MCP HTTP Server listening on port ${port}`);
    console.error(`Endpoints:`);
    console.error(`  - MCP: http://localhost:${port}/mcp`);
    console.error(`  - Health: http://localhost:${port}/health`);
    console.error(`  - Metrics: http://localhost:${port}/metrics`);
  });
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = parseInt(process.env.PORT || '3000', 10);
  startHttpServer(port).catch((error) => {
    console.error('Failed to start HTTP server:', error);
    process.exit(1);
  });
}
```

**Update package.json scripts**:
```json
{
  "scripts": {
    "dev": "tsx src/index.ts",
    "dev:http": "PORT=3000 tsx src/mcp/http-server.ts",
    "build": "tsup",
    "start": "node dist/index.js",
    "start:http": "PORT=3000 node dist/mcp/http-server.js"
  }
}
```

**Testing**:
```bash
# Start HTTP server
pnpm run dev:http

# Test with curl
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "mcp-session-id: test-session-1" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'

# Check health
curl http://localhost:3000/health

# Check metrics
curl http://localhost:3000/metrics
```

---

### Phase 4: Update Tool Definitions (8-12 hours)

**Goal**: Migrate all 18 tools to new adapter pattern

**Tool Migration Pattern**:
```typescript
// BEFORE (current)
export const SEND_TOOL: Tool = {
  name: "send",
  description: "Send native tokens",
  inputSchema: { /* JSON Schema */ }
};

// Server routes with switch statement

// AFTER (new)
export const sendTool: ToolDefinition = {
  name: 'send',
  description: 'Send native tokens to another address',
  inputSchema: SendSchema.shape,
  execute: async (args: unknown, services: ServiceDependencies) => {
    const { recipient, amount } = SendSchema.parse(args);
    return await services.transactionService.send(
      recipient,
      BigInt(amount)
    );
  }
};
```

**Files to Update**:
1. `src/mcp/tools/wallet-tools.ts` (6 tools)
2. `src/mcp/tools/token-tools.ts` (4 tools)
3. `src/mcp/tools/dao-tools.ts` (7 tools)
4. `src/mcp/tools/marketplace-tools.ts` (2 tools)

**Testing**:
```bash
# Run tool-by-tool tests
pnpm test src/mcp/tools

# Integration test
pnpm run dev
# Test each tool via MCP client
```

---

### Phase 5: Clean Up & Documentation (4-6 hours)

**Files to Delete**:
- `src/mcp/handlers/` (entire directory)
- Old switch statement code in `server.ts`

**Documentation to Update**:
1. Update README.md with HTTP transport instructions
2. Document SessionManager API
3. Add deployment guide
4. Create tool development guide

---

## Implementation Timeline

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1: Tool Adapter | 8-12 hours | None |
| Phase 2: SessionManager | 12-16 hours | Phase 1 |
| Phase 3: HTTP Transport | 16-24 hours | Phase 2 |
| Phase 4: Tool Migration | 8-12 hours | Phase 1 |
| Phase 5: Cleanup | 4-6 hours | All phases |
| **Total** | **48-70 hours** | (6-9 days) |

---

## Testing Strategy

### Unit Tests
```typescript
// test/unit/mcp/adapter/tool-adapter.test.ts
describe('ToolAdapter', () => {
  it('should list all tools', async () => {
    const services = createMockServices();
    const adapter = await createToolAdapter(services);
    const tools = adapter.listOfTools();
    expect(tools.length).toBe(18);
  });

  it('should execute tool with services', async () => {
    const services = createMockServices();
    const adapter = await createToolAdapter(services);
    const result = await adapter.toolHandler('walletStatus', {});
    expect(result.content[0].text).toContain('ready');
  });
});

// test/unit/mcp/session/SessionManager.test.ts
describe('SessionManager', () => {
  it('should create isolated sessions', async () => {
    const manager = new SessionManager({ maxSessions: 10 });
    const services1 = await manager.getOrCreateSession('session-1');
    const services2 = await manager.getOrCreateSession('session-2');
    expect(services1).not.toBe(services2);
  });

  it('should cleanup oldest session when limit reached', async () => {
    const manager = new SessionManager({ maxSessions: 2 });
    await manager.getOrCreateSession('session-1');
    await manager.getOrCreateSession('session-2');
    await manager.getOrCreateSession('session-3');  // Evicts session-1
    expect(manager.size).toBe(2);
  });
});
```

### Integration Tests
```typescript
// test/integration/mcp/http-server.test.ts
describe('HTTP Server', () => {
  it('should handle multiple concurrent sessions', async () => {
    // Start HTTP server
    // Create 5 concurrent sessions
    // Verify each session has isolated services
    // Verify tools work independently
  });
});
```

---

## Deployment

### Development (STDIO)
```bash
# Start STDIO server
pnpm run dev

# Use with Claude Desktop or MCP Inspector
```

### Production (HTTP)
```bash
# Build
pnpm run build

# Start HTTP server
PORT=3000 pnpm start:http

# Or with Docker
docker build -t midnight-mcp .
docker run -p 3000:3000 midnight-mcp
```

### Environment Variables
```bash
# Network configuration
NETWORK_ID=testnet-02
INDEXER=https://indexer.testnet-02.midnight.network/api/v1/graphql
MN_NODE=https://rpc.testnet-02.midnight.network
PROOF_SERVER=http://127.0.0.1:6300

# Server configuration
PORT=3000
MAX_SESSIONS=100

# Contract addresses (optional)
DAO_CONTRACT_ADDRESS=0x...
MARKETPLACE_CONTRACT_ADDRESS=0x...
```

---

## Migration Path

### Step 1: No Breaking Changes
- Phase 1-2 can be done without breaking STDIO
- Existing `stdio-server.ts` continues to work
- SessionManager is backward compatible

### Step 2: Gradual Adoption
- Deploy HTTP server alongside STDIO
- Test HTTP with subset of agents
- Monitor metrics and performance

### Step 3: Full Migration
- Switch production to HTTP
- Keep STDIO for development
- Phase out old patterns

---

## Success Criteria

- [ ] STDIO transport works unchanged
- [ ] HTTP transport supports 100+ concurrent agents
- [ ] No switch statements in routing code
- [ ] All 18 tools migrated to adapter pattern
- [ ] SessionManager provides isolation
- [ ] Unit test coverage > 80%
- [ ] Integration tests pass
- [ ] Documentation complete
- [ ] Performance benchmarks met:
  - Tool execution < 100ms overhead
  - Session creation < 200ms
  - Memory per session < 50MB

---

## Questions to Address

1. **Service Initialization**: How does WalletOrchestrator handle errors?
   - Answer: It throws and we should catch in SessionManager.getOrCreateSession()

2. **Session Cleanup**: When to cleanup sessions?
   - Answer: LRU eviction when limit reached + explicit cleanup endpoint

3. **Tool Errors**: How to handle service errors in tools?
   - Answer: Wrap in try/catch, return MCP error format

4. **Backward Compatibility**: Keep STDIO working?
   - Answer: Yes, SessionManager works with both transports

5. **Testing**: How to test multi-agent scenarios?
   - Answer: Integration tests with multiple HTTP clients

---

## References

1. **Midnight-Mcp Codebase**:
   - `/Users/apple/dev/workstuff/MIDNIGHTAI-SIM/refactor-codebase/Midnight-Mcp/src/mcp/server/SessionManager.ts`
   - `/Users/apple/dev/workstuff/MIDNIGHTAI-SIM/refactor-codebase/Midnight-Mcp/src/mcp/server/index.ts`
   - `/Users/apple/dev/workstuff/MIDNIGHTAI-SIM/refactor-codebase/Midnight-Mcp/src/mcp/server/ToolRegistry.ts`

2. **vechain-mcp-server**:
   - `/Users/apple/dev/hackathon/vchain/vechain-mcp-server/src/adapters/mcp/adapter.ts`
   - `/Users/apple/dev/hackathon/vchain/vechain-mcp-server/src/plugins/token/token.service.ts`

3. **Architecture Docs**:
   - `docs/architecture/MCP-MODERN-PATTERNS.md`
   - `docs/architecture/MCP-MULTI-AGENT-TRANSPORT-ANALYSIS.md`

4. **HTTP Transport Research**:
   - `docs/research/streamable-http-transport-research.json`
   - `docs/research/STREAMABLE-HTTP-RESEARCH-SUMMARY.md`

---

**Status**: Ready for Implementation
**Next Step**: Phase 1 - Create Tool Adapter
**Approval Needed**: Yes - review with team before starting
