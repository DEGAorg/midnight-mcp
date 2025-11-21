# SessionManager Usage Guide

The SessionManager provides per-agent service isolation for multi-agent MCP deployments.

## Architecture

```
HTTP Request (sessionId: "agent-1")
    ↓
SessionManager.getOrCreateSession({ sessionId: "agent-1", seed: "..." })
    ↓
WalletOrchestrator (per session)
    ↓
ServiceDependencies (walletService, transactionService, tokenService, etc.)
    ↓
Tool Adapter → Tools → Services
```

## Basic Usage

### 1. Initialize SessionManager

```typescript
import { SessionManager } from './mcp/index.js';

const sessionManager = new SessionManager({
  maxSessions: 100,
  sessionTimeout: 30 * 60 * 1000, // 30 minutes
  evictionInterval: 5 * 60 * 1000, // 5 minutes
  baseConfig: {
    networkUrl: process.env.NETWORK_URL,
    indexerUrl: process.env.INDEXER_URL,
    provingServerUrl: process.env.PROVING_SERVER_URL,
    daoContractAddress: process.env.DAO_CONTRACT_ADDRESS,
    marketplaceContractAddress: process.env.MARKETPLACE_CONTRACT_ADDRESS
  }
});

// Start background eviction
sessionManager.start();
```

### 2. Get/Create Session

```typescript
// Each HTTP request provides a sessionId and seed
const services = await sessionManager.getOrCreateSession({
  sessionId: 'agent-123',
  seed: 'user-specific-seed-from-request',
  daoContractAddress: 'optional-override',
  marketplaceContractAddress: 'optional-override'
});

// Use services to execute tools
const toolAdapter = await createToolAdapter(services);
const result = await toolAdapter.toolHandler('walletBalance', {});
```

### 3. Session Lifecycle

```typescript
// Sessions are automatically evicted after sessionTimeout
// But you can manually close if needed:
await sessionManager.closeSession('agent-123');

// Get statistics
const stats = sessionManager.getStats();
console.log('Active sessions:', stats.activeSessions);
console.log('Total created:', stats.totalCreated);
console.log('Total evicted:', stats.totalEvicted);
```

### 4. Cleanup

```typescript
// On server shutdown
await sessionManager.stop(); // Closes all active sessions
```

## Features

### Per-Session Isolation

Each session gets its own:
- WalletOrchestrator
- WalletService (with unique seed)
- TransactionService
- TokenService
- DaoService
- MarketplaceService

Sessions are completely isolated from each other.

### LRU Cache with Auto-Eviction

- Maximum concurrent sessions: `maxSessions` (default: 100)
- Idle timeout: `sessionTimeout` (default: 30 minutes)
- Background eviction check: `evictionInterval` (default: 5 minutes)

When cache is full, least recently used session is evicted.

### Thread-Safe Access

- Concurrent access to same session is safe
- `lastAccessedAt` updated on every access
- LRU cache manages ordering

## HTTP Transport Integration (Phase 3)

```typescript
// HTTP Server with SessionManager
app.post('/mcp', async (req, res) => {
  const { sessionId, seed, method, params } = req.body;

  // Get or create session
  const services = await sessionManager.getOrCreateSession({
    sessionId,
    seed
  });

  // Create tool adapter for this session
  const toolAdapter = await createToolAdapter(services);

  // Execute tool
  if (method === 'tools/call') {
    const result = await toolAdapter.toolHandler(
      params.name,
      params.arguments
    );
    res.json(result);
  }
});
```

## STDIO Mode (No SessionManager)

For single-agent STDIO mode, SessionManager is NOT needed:

```typescript
// stdio-server.ts
const orchestrator = new WalletOrchestrator(config);
await orchestrator.start();

const services = orchestrator.getServices();
const server = new MCPServer(services, serverInfo);
```

## Statistics

```typescript
interface SessionStats {
  activeSessions: number;      // Current session count
  totalCreated: number;        // Total sessions created
  totalEvicted: number;        // Total evicted by LRU
  totalClosed: number;         // Total manually closed
  oldestSessionAge: number;    // Age of oldest session (ms)
  newestSessionAge: number;    // Age of newest session (ms)
}
```

## Configuration

```typescript
interface SessionManagerConfig {
  maxSessions: number;         // Max concurrent sessions
  sessionTimeout: number;      // Idle timeout (ms)
  evictionInterval: number;    // Eviction check interval (ms)
  baseConfig: {
    networkUrl: string;
    indexerUrl: string;
    provingServerUrl: string;
    daoContractAddress?: string;
    marketplaceContractAddress?: string;
  };
}
```

## Error Handling

```typescript
try {
  const services = await sessionManager.getOrCreateSession(options);
  // Use services...
} catch (error) {
  // Failed to create session (wallet init failed, etc.)
  console.error('Session creation failed:', error);
}
```

## Best Practices

1. **Always use unique sessionIds**: One per agent/user
2. **Use unique seeds per agent**: Never reuse seeds across agents
3. **Set appropriate timeouts**: Based on your use case
4. **Monitor statistics**: Track session counts and evictions
5. **Handle errors gracefully**: Session creation can fail
6. **Cleanup on shutdown**: Call `sessionManager.stop()`

## Next Steps

- **Phase 3**: Implement HTTP Transport with SessionManager integration
- **Phase 4**: Add session persistence (optional)
- **Phase 5**: Add session migration between servers (optional)
