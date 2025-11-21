# SessionManager Code Review

## 🚨 CRITICAL ISSUES FOUND

### 1. **Agent ID vs Session ID Confusion** ⚠️ BLOCKING

**Problem**: Using `sessionId` everywhere, but the system is built around `agentId`.

**Current Code**:
```typescript
async getOrCreateSession(options: CreateSessionOptions): Promise<ServiceDependencies> {
  const { sessionId } = options;
  // ...
  const orchestrator = new WalletOrchestrator({
    walletConfig: { agentId: sessionId },  // ❌ WRONG
    agentId: sessionId
  });
}
```

**What's Wrong**:
- The entire codebase uses `agentId` for:
  - SeedManager.getAgentSeed(agentId)
  - FileManager.getPath(FileType.WALLET_BACKUP, agentId, filename)
  - Logger context: createLogger(`service:${agentId}`)
  - Database paths: tokenDb path uses agentId
- `sessionId` should map to `agentId`, not replace it
- In HTTP mode: sessionId from request → agentId for system
- In STDIO mode: agentId from config (no sessionId)

**Impact**: 🔴 **BLOCKING** - Cannot access wallets, seeds, or files without proper agentId

---

### 2. **Seed Management is WRONG** ⚠️ SECURITY RISK

**Problem**: Accepting seed as HTTP request parameter.

**Current Code**:
```typescript
export interface CreateSessionOptions {
  sessionId: string;
  seed: string;  // ❌ SECURITY RISK!
}
```

**What's Wrong**:
- Seeds should NEVER be transmitted over HTTP
- Seeds are stored securely on disk via SeedManager
- SeedManager.getAgentSeed(agentId) loads seed from `.storage/seeds/{agentId}/seed`
- Passing seeds in HTTP requests exposes them to:
  - Network interception
  - Logging
  - Request replay attacks
  - Memory dumps

**Correct Pattern** (from stdio-server.ts):
```typescript
// Load seed from agent-specific storage (not from env!)
const seed = SeedManager.getAgentSeed(agentId);
```

**Impact**: 🔴 **BLOCKING** - Major security vulnerability

---

### 3. **Mock Wallet Factory** ⚠️ NOT IMPLEMENTED

**Problem**: Wallet factory just throws an error.

**Current Code**:
```typescript
private createWalletFactory(sessionId: string, seed: string): () => Promise<any> {
  return async () => {
    throw new Error('Wallet factory not yet implemented - needs WalletBuilder integration');
  };
}
```

**What's Needed**:
- Import WalletBuilder from `@midnight-ntwrk/wallet`
- Implement proper wallet restoration/building like stdio-server.ts
- Handle file restoration from FileManager
- Proper error handling and logging

**Impact**: 🔴 **BLOCKING** - Sessions cannot be created

---

### 4. **Network Configuration Mismatch** ⚠️ API MISMATCH

**Problem**: baseConfig structure doesn't match WalletBuilder API.

**Current Config**:
```typescript
baseConfig: {
  networkUrl: string;      // ❌ WalletBuilder doesn't use this
  indexerUrl: string;      // ❌ Called 'indexer' in WalletBuilder
  provingServerUrl: string; // ❌ Called 'proofServer' in WalletBuilder
}
```

**Correct API** (from WalletBuilder):
```typescript
WalletBuilder.build(
  indexer,      // GraphQL endpoint
  indexerWS,    // WebSocket endpoint
  proofServer,  // ZKP proving server
  node,         // Midnight node RPC
  seed,
  getZswapNetworkId(),
  'info'
);
```

**Missing**:
- `indexerWS` (WebSocket endpoint)
- `node` (Midnight RPC node)
- Network ID handling

**Impact**: 🟡 **HIGH** - Configuration won't work with WalletBuilder

---

### 5. **FileManager Not Used** ⚠️ FILE PATHS BROKEN

**Problem**: Hardcoded wallet paths instead of using FileManager.

**Current Code**:
```typescript
const walletPath = `${sessionId}-wallet.json`; // ❌ WRONG
```

**Correct Pattern** (from stdio-server.ts):
```typescript
const fileManager = FileManager.getInstance();
const walletPath = fileManager.getPath(
  FileType.WALLET_BACKUP,
  agentId,
  `${walletFilename}.json`
);
```

**Also Missing**:
- Token registry database path via FileManager
- Transaction database path via FileManager
- Proper agent-specific directory structure

**Impact**: 🟡 **HIGH** - Files will be saved in wrong locations

---

### 6. **Service Dependency Issues** ⚠️ RUNTIME ERROR

**Problem**: Accessing services before orchestrator.start() is called.

**Current Code**:
```typescript
const orchestrator = new WalletOrchestrator(orchestratorConfig);

// ❌ Getting services BEFORE start()
const services: ServiceDependencies = {
  walletService: orchestrator.getWalletService(),
  transactionService: orchestrator.getTransactionService(),
  // ...
};

// Start orchestrator AFTER getting services
await orchestrator.start();
```

**What's Wrong**:
- Services are initialized in `orchestrator.start()`
- Calling `getWalletService()` before `start()` returns uninitialized services
- Services need to be retrieved AFTER `orchestrator.start()`

**Correct Pattern** (from stdio-server.ts):
```typescript
const orchestrator = new WalletOrchestrator(orchestratorConfig);

// Start first
await orchestrator.start();

// Then get services
const services: ServiceDependencies = {
  walletService: orchestrator.getWalletService(),
  transactionService: orchestrator.getTransactionService(),
  // ...
};
```

**Impact**: 🟡 **HIGH** - Services may be uninitialized or broken

---

### 7. **Optional Services Handled Incorrectly** ⚠️ NULL POINTER

**Problem**: Force-unwrapping optional DAO/Marketplace services.

**Current Code**:
```typescript
const services: ServiceDependencies = {
  walletService: orchestrator.getWalletService(),
  transactionService: orchestrator.getTransactionService(),
  tokenService: orchestrator.getTokenService(),
  daoService: orchestrator.getDaoService()!,  // ❌ Force unwrap!
  marketplaceService: orchestrator.getMarketplaceService()!  // ❌ Force unwrap!
};
```

**What's Wrong**:
- `getDaoService()` returns `DaoService | undefined`
- `getMarketplaceService()` returns `MarketplaceService | undefined`
- These are only initialized if contract addresses are provided
- Force unwrapping will cause runtime errors if contracts not configured

**Impact**: 🟡 **MEDIUM** - Null pointer errors if contracts not configured

---

### 8. **LRU Cache Async Dispose Issue** ⚠️ RACE CONDITION

**Problem**: dispose callback is async but LRU cache doesn't await it.

**Current Code**:
```typescript
this.sessions = new LRUCache<string, Session>({
  max: this.config.maxSessions,
  ttl: this.config.sessionTimeout,
  dispose: async (session: Session, key: string) => {
    await this.handleSessionEviction(session, key);  // ❌ Not awaited!
  }
});
```

**What's Wrong**:
- LRU cache calls dispose synchronously
- Async cleanup may not complete before session is removed
- Can cause resource leaks (unclosed wallets, DB connections)

**Correct Pattern**:
- Don't rely on dispose for critical cleanup
- Use manual eviction with proper awaiting
- Track sessions separately for cleanup

**Impact**: 🟡 **MEDIUM** - Resource leaks on eviction

---

## 📋 ARCHITECTURAL ISSUES

### 9. **Missing Session State Validation**

**Problem**: No validation of session state transitions.

```typescript
async getOrCreateSession(options: CreateSessionOptions): Promise<ServiceDependencies> {
  const existingSession = this.sessions.get(sessionId);
  if (existingSession) {
    // ❌ No check if session is 'initializing' or 'closing'
    return existingSession.services;
  }
}
```

**Issue**: Can return services from session that's still initializing or shutting down.

---

### 10. **No Concurrent Create Protection**

**Problem**: Multiple simultaneous requests for same session can create duplicates.

**Scenario**:
1. Request A calls getOrCreateSession('agent-1')
2. Session doesn't exist, starts creating
3. Request B calls getOrCreateSession('agent-1') before A finishes
4. Request B doesn't find session (A hasn't added it yet)
5. Request B also starts creating 'agent-1'
6. Result: Two orchestrators for same agent!

**Impact**: 🟡 **MEDIUM** - Race condition in session creation

---

## ✅ REQUIRED FIXES

### Priority 1 (BLOCKING):
1. ✅ Fix agentId vs sessionId - use agentId everywhere
2. ✅ Remove seed from CreateSessionOptions - use SeedManager
3. ✅ Implement real wallet factory with WalletBuilder
4. ✅ Fix service initialization order (start before getting services)

### Priority 2 (HIGH):
5. ✅ Fix network config to match WalletBuilder API
6. ✅ Use FileManager for all file paths
7. ✅ Handle optional services properly (no force unwrap)
8. ✅ Add session state validation

### Priority 3 (MEDIUM):
9. ✅ Fix LRU dispose race condition
10. ✅ Add concurrent create protection (mutex/semaphore)

---

## 🎯 CORRECT ARCHITECTURE

### How It Should Work:

```typescript
// HTTP Request arrives with sessionId
POST /mcp/tools/call
Headers: { "Mcp-Session-Id": "agent-123" }
Body: { method: "tools/call", params: { name: "walletBalance", arguments: {} } }

↓

// Extract sessionId from header (this becomes agentId)
const agentId = req.headers['mcp-session-id'];

↓

// SessionManager gets or creates session
const services = await sessionManager.getOrCreateSession({
  agentId: agentId  // NOT sessionId!
});

↓

// SessionManager internally:
1. Load seed: SeedManager.getAgentSeed(agentId)
2. Get wallet path: FileManager.getPath(FileType.WALLET_BACKUP, agentId, filename)
3. Create WalletFactory with WalletBuilder
4. Create WalletOrchestrator with agentId
5. Start orchestrator: await orchestrator.start()
6. Get services: orchestrator.getWalletService(), etc.
7. Return services

↓

// Tool adapter executes tool with session's services
const toolAdapter = await createToolAdapter(services);
const result = await toolAdapter.toolHandler('walletBalance', {});
```

---

## 📖 REFERENCE IMPLEMENTATION

See `stdio-server.ts` lines 36-180 for correct patterns:
- SeedManager usage
- FileManager usage
- WalletFactory creation
- WalletOrchestrator initialization
- Service retrieval

---

## 🔧 NEXT STEPS

1. **Rewrite SessionManager** with all fixes
2. **Add middleware layer** (CORS, error handling, session extraction)
3. **Implement HTTP server** with Express + StreamableHTTPServerTransport
4. **Test multi-agent scenarios** (100+ concurrent sessions)
5. **Add session persistence** (optional - Phase 4)
