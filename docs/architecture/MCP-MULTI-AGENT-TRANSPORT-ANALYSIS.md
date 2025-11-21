# MCP Multi-Agent Transport Analysis

**Date**: 2025-11-21
**Status**: Research & Recommendations
**Related**: midnight-ai-core-sim.md, MCP-RESEARCH-FINDINGS-2025.md

---

## Executive Summary

This document analyzes adding **HTTP/StreamableHTTP transport with session management** ALONGSIDE the existing STDIO transport to support 100+ concurrent agents in the Midnight AI Core Sim project.

### Current Architecture ✅
- **STDIO transport** - One MCP server process per agent
- **Per-agent isolation** - Each agent has its own seed, wallet, services
- **File structure**: `.storage/seeds/{agentId}/seed`, `.storage/wallet-backups/{agentId}/`
- **Agent setup**: `yarn setup-agent --agent-id {name}` creates isolated agent

### Proposed Addition 🔄
- **ADD** HTTP/StreamableHTTP transport for shared tool server
- **KEEP** STDIO transport for local agent operations
- **Hybrid architecture** - Local STDIO + Remote HTTP for scale

---

## 1. Transport Architecture Comparison

### STDIO Transport (Current - ✅ Correct)

**MCP SDK Documentation**:
> "STDIO is the recommended transport. The server is spawned by another process (host) for communication via standard input/output streams."

```typescript
// One server process per agent
const transport = new StdioServerTransport();
await server.connect(transport);
```

**Characteristics**:
- ✅ **Recommended by MCP spec** for local integrations
- ✅ **1:1 client-server relationship** - Perfect isolation
- ✅ **Microsecond latency** (IPC, no network stack)
- ✅ **Secure by default** (no network exposure)
- ✅ **Simple** - No session management complexity
- ❌ **One client only** - Cannot serve multiple agents
- ❌ **Resource overhead** - N processes for N agents

**Use Cases**:
- Claude Desktop integration
- IDE integrations
- Local agent deployments
- Development/testing
- **Your current midnight-mcp-old codebase** ✅

### StreamableHTTP Transport (For Multi-Agent)

**MCP SDK Documentation**:
> "StreamableHTTP replaces the deprecated HTTP+SSE transport. Use when network access is required."

```typescript
// One server handling multiple agents via sessions
const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: () => randomUUID(),
  onsessioninitialized: (sessionId) => {
    transports.set(sessionId, transport);
  }
});
```

**Characteristics**:
- ✅ **Multiple concurrent clients** via session management
- ✅ **Shared resources** (connection pools, caches)
- ✅ **Centralized monitoring** (metrics, health checks)
- ✅ **Horizontal scaling** (load balancers, Redis sessions)
- ❌ **Millisecond latency** (network overhead)
- ❌ **Complex** - Session isolation, cleanup, security
- ❌ **Security surface** - Requires auth, rate limiting

**Use Cases**:
- Remote agent access
- 100+ concurrent agents
- Cloud/serverless deployments
- Shared tool repositories
- **Your midnight-ai-core-sim 100-agent simulation** 🎯

---

## 2. SessionManager Architecture Analysis

### Midnight-Mcp Implementation (Reference)

The `/Users/apple/dev/workstuff/MIDNIGHTAI-SIM/refactor-codebase/Midnight-Mcp` codebase shows a **production-grade HTTP session approach**:

```typescript
export class SessionManager {
  private sessions = new Map<string, ISessionServices>();
  private metadata = new Map<string, ISessionMetadata>();

  async getOrCreateSession(sessionId: string): Promise<ISessionServices> {
    if (this.sessions.has(sessionId)) {
      this.updateLastAccessed(sessionId);
      return this.sessions.get(sessionId)!;
    }

    // LRU eviction if at max sessions
    if (this.sessions.size >= this.config.mcp.maxSessions) {
      await this.cleanupOldestSession();
    }

    // Create isolated services for this session
    const walletService = new MidnightWalletService(...);
    const seedService = new SeedService(...);
    const tokenService = new TokenService(...);

    this.sessions.set(sessionId, services);
    return services;
  }
}
```

**Key Features**:
1. **Map<sessionId, Services>** - Isolated service instances per session
2. **LRU Eviction** - Removes oldest session when limit reached
3. **Metadata Tracking** - Created time, last accessed, agent IDs
4. **Graceful Cleanup** - Persists state before eviction
5. **Metrics** - Session count, utilization %, age

**HTTP Server Integration**:

```typescript
app.post('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string || generateSessionId();

  // Get or create MCP server for this session
  let mcpServer = sessionServers.get(sessionId);
  if (!mcpServer) {
    mcpServer = new McpServer({ name: 'midnight-wallet-mcp', version: '2.0.0' });
    const services = await sessionManager.getOrCreateSession(sessionId);
    new ToolRegistry(mcpServer, services); // Register tools with session context
    sessionServers.set(sessionId, mcpServer);
  }

  // Stateless transport (session managed at app layer)
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // Stateless mode
    enableJsonResponse: true
  });

  await mcpServer.connect(transport);
  await transport.handleRequest(req, res, req.body);
});
```

**Critical Design Decision**:
> "Using STATELESS mode (sessionIdGenerator: undefined) because:
> 1. We manage sessions at the application layer via SessionManager
> 2. We need the session ID upfront to create services (chicken-and-egg with stateful)
> 3. SessionManager provides custom logic (LRU eviction, cleanup callbacks, metrics)
> 4. Easier to scale horizontally (can move to Redis/database for sessions)"

### Opinion: Is SessionManager Overkill?

**Your concern**: "it does uses a session manager but i think that is an architecture kill"

**Analysis**:

**❌ SessionManager is OVERKILL if:**
- You only have 2-10 agents
- Agents don't share state or tools
- You prefer simple 1:1 STDIO isolation
- Resource overhead is acceptable (< 500MB per agent)

**✅ SessionManager is NECESSARY for:**
- **100+ agents** (your midnight-ai-core-sim goal)
- **Shared tool repositories** (all agents use same DAO/marketplace tools)
- **Resource limits** (can't spawn 100 full service stacks)
- **Centralized monitoring** (track all agent activity)
- **Horizontal scaling** (multiple server nodes)

**Verdict for Your Use Case**:
🎯 **SessionManager is APPROPRIATE** because:
1. You plan to run 100+ concurrent agents (per docs/midnight-ai-core-sim.md)
2. All agents use the same tools (wallet, DAO, marketplace)
3. You need metrics/monitoring for the simulation
4. Cloud deployment is mentioned (Phase 2)

---

## 3. Recommended Hybrid Architecture

### Phase 1: Current STDIO (Keep As-Is) ✅

**For**: Development, testing, small deployments (< 10 agents)

```
ElizaOS Agent "testing"
    ↓ spawns (STDIO)
MCP Server Process (AGENT_ID=testing)
    ↓ loads seed
.storage/seeds/testing/seed
    ↓ initializes
WalletOrchestrator → Services → Handlers → Tools
```

**Characteristics**:
- Simple, battle-tested
- Perfect isolation
- No session complexity
- Current setup works great

### Phase 2: Add HTTP Transport (For Scale)

**For**: Production, 100+ agents, cloud deployment

```
┌─────────────────────────────────────────────────────┐
│  HTTP MCP Server (Shared Tool Repository)          │
│  - Port: 3000                                        │
│  - Transport: StreamableHTTPServerTransport         │
│  - Sessions: Map<sessionId, SessionServices>        │
│  - Max Sessions: 150                                 │
└─────────────────────────────────────────────────────┘
           ↑              ↑              ↑
           │              │              │
   Session-1        Session-2        Session-N
   Agent "citizen-1" Agent "business-1" Agent "cop-1"

   Each session gets:
   - Isolated WalletService (from seed)
   - Isolated TokenService
   - Isolated DaoService
   - Shared connection pool
   - LRU cleanup when full
```

**Configuration**:

```typescript
// config/session-config.ts
export const SESSION_CONFIG = {
  MAX_SESSIONS: 150,                 // 100 agents + 50% buffer
  SESSION_TIMEOUT_MS: 3600000,       // 1 hour idle
  LRU_CLEANUP: true,
  METRICS_ENABLED: true,
  STORAGE_TYPE: 'filesystem',        // or 's3' for cloud
};
```

**File Structure Stays Same**:

```
.storage/
├── seeds/
│   ├── citizen-1/seed    # 64-char hex seed
│   ├── business-1/seed
│   └── cop-1/seed
├── wallet-backups/
│   ├── citizen-1/
│   │   ├── midnight-wallet.json
│   │   └── token-registry.db
│   └── ...
└── logs/
    ├── citizen-1/
    └── ...
```

**Each session loads its agent's seed**:

```typescript
// In SessionManager.getOrCreateSession(sessionId)
const agentId = req.headers['agent-id'] as string; // Or derive from sessionId
const seed = SeedManager.getAgentSeed(agentId);    // Load from .storage/seeds/{agentId}/seed

const walletService = new MidnightWalletService(seed, ...);
const services = { walletService, tokenService, daoService };
this.sessions.set(sessionId, services);
```

### Phase 3: Hybrid (Best of Both)

**For**: Maximum flexibility

```
┌──────────────────────────────────────────────────────┐
│  HTTP MCP Server (Shared Tools)                     │
│  - Common tools: send, walletBalance, openDaoElection│
│  - 100+ sessions                                      │
│  - Metrics/monitoring                                 │
└──────────────────────────────────────────────────────┘
           ↑                         ↑
           │ (network)               │ (network)
     Agent "citizen-1"          Agent "business-1"
     (also runs STDIO           (also runs STDIO
      for local tools)           for local tools)
```

**Benefits**:
- Agents can have **local STDIO MCP** for custom tools
- Agents connect to **shared HTTP MCP** for common tools
- Best resource utilization
- Maximum flexibility

---

## 4. Implementation Recommendations

### Option A: Keep STDIO Only (Recommended for Now) ✅

**Rationale**:
- Current implementation is correct and follows MCP best practices
- Works great for development and testing
- No premature optimization
- Can scale to 10-15 agents without issues

**When to Migrate**: Only if you observe:
1. Resource exhaustion (> 500MB per agent × N agents)
2. Need for centralized monitoring
3. Scaling beyond 10-15 concurrent agents
4. Cloud deployment requirements

### Option B: Add HTTP Transport (When Needed)

**Steps**:

1. **Create `src/mcp/http-server.ts`**:
   ```typescript
   import express from 'express';
   import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
   import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
   import { SessionManager } from './session-manager.js';

   export async function startHttpServer() {
     const app = express();
     app.use(express.json());

     const sessionManager = new SessionManager({
       maxSessions: 150,
       sessionTimeoutMs: 3600000
     });

     app.post('/mcp', async (req, res) => {
       const sessionId = req.headers['mcp-session-id'] || randomUUID();
       const agentId = req.headers['agent-id'] || sessionId;

       // Get or create session (loads agent seed, creates services)
       const services = await sessionManager.getOrCreateSession(sessionId, agentId);

       // Create MCP server for this session
       const mcpServer = new McpServer({ name: 'midnight-mcp', version: '2.0.0' });

       // Register handlers with session-isolated services
       const walletHandler = new WalletHandler(services);
       const tokenHandler = new TokenHandler(services);
       // ... register all handlers

       // Stateless transport (session managed at app layer)
       const transport = new StreamableHTTPServerTransport({
         sessionIdGenerator: undefined,
         enableJsonResponse: true
       });

       await mcpServer.connect(transport);
       await transport.handleRequest(req, res, req.body);
     });

     app.get('/health', (req, res) => {
       res.json(sessionManager.getMetrics());
     });

     app.listen(3000, () => {
       console.log('HTTP MCP Server listening on port 3000');
     });
   }
   ```

2. **Create `src/mcp/session-manager.ts`** (based on Midnight-Mcp reference)

3. **Update `package.json`**:
   ```json
   {
     "scripts": {
       "start:stdio": "node dist/mcp/stdio-server.js",
       "start:http": "node dist/mcp/http-server.js"
     }
   }
   ```

4. **Keep Both Transports**:
   - STDIO for local development/testing
   - HTTP for production multi-agent deployment

---

## 5. Tool Naming Convention Fix

### Current Tools (Need Renaming)

```typescript
// ❌ BAD: Ambiguous names
"walletStatus"       // What status? Is it a query or action?
"walletAddress"      // Just returns address?
"walletBalance"      // Query balance?
"send"              // Send what? Where?
"sendAndWait"       // Deprecated - remove
"getTransaction"     // Get or fetch?
```

### Recommended Names (Action-Oriented)

```typescript
// ✅ GOOD: Clear, action-oriented names

// === Wallet Tools ===
"getWalletStatus"     // Query: get wallet status
"getWalletAddress"    // Query: get wallet address
"getWalletBalance"    // Query: get wallet balance
"sendFunds"           // Action: send funds
"getTransaction"      // Query: get transaction (keep)

// === Token Tools ===
"getTokenBalance"     // Query: get token balance (keep)
"registerToken"       // Action: register token (keep)
"sendToken"           // Action: send token (keep)
"listTokens"          // Query: list tokens (keep)

// === DAO Tools ===
"getDaoConfig"        // Query: get DAO config (keep)
"openDaoElection"     // Action: open election (keep)
"castDaoVote"         // Action: cast vote (keep)
"getDaoElection"      // Query: get election (keep)
"listDaoElections"    // Query: list elections (keep)
"getVotingPower"      // Query: get voting power (keep)
"closeDaoElection"    // Action: close election (keep)

// === Marketplace Tools ===
"getMarketplaceConfig"  // Query: get config (keep)
"listMarketplaceItems"  // Query: list items (keep)
```

**Naming Convention**:
- **Queries**: `get`, `list`, `check`
- **Actions**: `send`, `create`, `update`, `delete`, `open`, `close`, `cast`
- **Be specific**: "sendFunds" not "send", "getWalletBalance" not "balance"

---

## 6. Current Architecture Status

### ✅ What's Working

1. **STDIO Transport** - Correctly implemented per MCP spec
2. **Per-Agent Isolation** - Each agent has own seed, services, wallet
3. **File Structure** - Correct `.storage/` structure with agent subdirectories
4. **Setup Script** - `yarn setup-agent` creates isolated agents properly
5. **Service Architecture** - Clean handler → service → wallet pattern
6. **Bug Fixed** - WALLET_SEED removed from env, seeds loaded via SeedManager

### ❌ What Was Wrong (Fixed)

1. **WALLET_SEED in env.ts** - Seeds are per-agent, not global ✅ Fixed
2. **stdio-server.ts using appConfig.WALLET_SEED** - Now uses SeedManager ✅ Fixed
3. **SeedManager not passing baseDir** - Fixed initialization ✅ Fixed

### 📋 Remaining Tasks

1. **Optional**: Rename tools for clarity (getWalletStatus, sendFunds, etc.)
2. **Optional**: Add HTTP transport when scaling to 100+ agents
3. **Required**: Test current STDIO implementation end-to-end
4. **Required**: Remove deprecated `sendAndWait` tool

---

## 7. Migration Path

### Now (Development - Phase 1)
- ✅ Keep STDIO transport
- ✅ Use current per-agent architecture
- ✅ Test with 2-10 agents locally
- ✅ Fix any remaining bugs

### Later (Production - Phase 2)
- 🔄 Add HTTP transport when needed (> 10 agents)
- 🔄 Implement SessionManager for multi-agent scale
- 🔄 Add metrics/monitoring endpoints
- 🔄 Deploy to cloud infrastructure

### Never
- ❌ Don't replace STDIO (keep for development)
- ❌ Don't add HTTP prematurely (YAGNI)
- ❌ Don't use SSE transport (deprecated)
- ❌ Don't share seeds between agents (security)

---

## 8. Conclusion

### Current Assessment

Your architecture is **correct and well-designed**. The STDIO transport with per-agent isolation follows MCP best practices. The bug fixes (WALLET_SEED, SeedManager) resolve the critical issues.

### Recommendations

1. **Short Term** (Now):
   - ✅ Keep STDIO transport
   - ✅ Test with multiple agents locally
   - ✅ Optionally rename tools for clarity
   - ✅ Remove deprecated sendAndWait

2. **Medium Term** (When Scaling):
   - 🔄 Add HTTP transport server (src/mcp/http-server.ts)
   - 🔄 Implement SessionManager (based on Midnight-Mcp)
   - 🔄 Keep STDIO for development
   - 🔄 Use hybrid approach (local + remote)

3. **Long Term** (Production):
   - 🔄 Horizontal scaling with load balancer
   - 🔄 Redis for distributed session storage
   - 🔄 Metrics/monitoring dashboard
   - 🔄 100+ agent deployment on cloud

### Next Steps

1. ✅ **DONE**: Fix WALLET_SEED and SeedManager bugs
2. 📝 **TODO**: Test STDIO transport end-to-end with 2 agents
3. 📝 **TODO**: Document agent setup process
4. 📝 **OPTIONAL**: Implement HTTP transport (when needed)

---

## References

1. MCP TypeScript SDK: https://github.com/modelcontextprotocol/typescript-sdk
2. MCP Specification: https://modelcontextprotocol.io/specification
3. Midnight-Mcp Reference: `/Users/apple/dev/workstuff/MIDNIGHTAI-SIM/refactor-codebase/Midnight-Mcp`
4. Midnight AI Core Sim: `docs/midnight-ai-core-sim.md`
