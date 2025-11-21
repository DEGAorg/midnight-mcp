# Recovery Options & Docker Architecture Clarification

## Part 1: Recovery Mechanism Options

### Option 1: Full Exponential Backoff (Current Implementation)

**What It Is**:
Progressive retry with increasing wait times to avoid overwhelming the system.

**How It Works**:
```typescript
// src/wallet/index.ts lines 492-577
private recoveryAttempts: number = 0;
private maxRecoveryAttempts: number = 5;
private recoveryBackoffMs: number = 5000; // Start with 5 seconds
private isRecovering: boolean = false;

private async attemptWalletRecovery(reason: string): Promise<void> {
  // 1. Prevent concurrent recovery
  if (this.isRecovering) {
    this.logger.info('Recovery already in progress, skipping');
    return;
  }

  this.isRecovering = true;

  try {
    this.recoveryAttempts++;

    // 2. Check max attempts
    if (this.recoveryAttempts > this.maxRecoveryAttempts) {
      this.logger.error('Max recovery attempts exceeded');
      return;
    }

    // 3. Save current state
    if (this.wallet) {
      await this.saveWalletToFile(this.walletFilename);
      await this.wallet.close();
      this.wallet = null;
    }

    // 4. Calculate exponential backoff
    const backoffTime = Math.min(
      this.recoveryBackoffMs * Math.pow(1.5, this.recoveryAttempts - 1),
      60000  // Cap at 60 seconds
    );

    this.logger.info(`Waiting ${backoffTime}ms before recovery attempt ${this.recoveryAttempts}`);
    await new Promise(resolve => setTimeout(resolve, backoffTime));

    // 5. Rebuild wallet from seed
    this.wallet = await this.buildWalletFromSeed(this.walletSeed, this.walletFilename);

    if (this.wallet) {
      // Re-initialize dependent services
      this.daoService = new DaoService(this.wallet);
      this.setupWalletSubscription();

      // Reset recovery state on success
      this.recoveryAttempts = 0;
      this.recoveryBackoffMs = 5000;

      this.logger.info('Wallet recovered successfully');
    }
  } finally {
    this.isRecovering = false;
  }
}
```

**Backoff Timeline**:
```
Attempt 1: Wait  5 seconds  (5000 * 1.5^0 = 5000ms)
Attempt 2: Wait  7.5 seconds (5000 * 1.5^1 = 7500ms)
Attempt 3: Wait 11.25 seconds (5000 * 1.5^2 = 11250ms)
Attempt 4: Wait 16.87 seconds (5000 * 1.5^3 = 16875ms)
Attempt 5: Wait 25.31 seconds (5000 * 1.5^4 = 25312ms)
After 5 attempts: Give up (total ~66 seconds)
```

**Triggered By**:
- RxJS subscription error
- Subscription unexpected completion
- State processing error

**Pros**:
✅ Prevents thundering herd (many agents recovering simultaneously)
✅ Gives network/server time to recover
✅ Production-grade pattern
✅ Auto-resets on success

**Cons**:
❌ More complex code
❌ Longer recovery time if persistent issue
❌ May give up too early on transient issues

**Code Complexity**: ~150 lines

---

### Option 2: Simple Linear Retry

**What It Is**:
Fixed wait time between retries, simpler implementation.

**How It Works**:
```typescript
export class WalletService {
  private recoveryAttempts: number = 0;
  private readonly MAX_RECOVERY_ATTEMPTS = 3;
  private readonly RETRY_DELAY_MS = 10000; // 10 seconds fixed

  async attemptRecovery(reason: string): Promise<void> {
    this.recoveryAttempts++;

    if (this.recoveryAttempts > this.MAX_RECOVERY_ATTEMPTS) {
      throw new Error(`Recovery failed after ${this.MAX_RECOVERY_ATTEMPTS} attempts`);
    }

    this.logger.warn(`Recovery attempt ${this.recoveryAttempts}/${this.MAX_RECOVERY_ATTEMPTS}. Reason: ${reason}`);

    // Simple fixed delay
    await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY_MS));

    // Close and rebuild wallet
    if (this.wallet) {
      await this.wallet.close();
    }

    this.wallet = await this.buildWalletFromSeed();
    this.setupStateSubscription();

    // Reset on success
    this.recoveryAttempts = 0;
  }
}
```

**Timeline**:
```
Attempt 1: Wait 10 seconds
Attempt 2: Wait 10 seconds
Attempt 3: Wait 10 seconds
After 3 attempts: Throw error (total ~30 seconds)
```

**Pros**:
✅ Simple to understand
✅ Faster recovery on transient issues
✅ Predictable behavior
✅ Less code (~50 lines)

**Cons**:
❌ Can overwhelm system if many agents fail simultaneously
❌ No adaptive behavior
❌ May retry too fast for persistent issues

**Code Complexity**: ~50 lines

---

### Option 3: Exponential Backoff with Jitter (Industry Best Practice)

**What It Is**:
Exponential backoff + random jitter to prevent synchronized retries.

**How It Works**:
```typescript
export class WalletService {
  private recoveryAttempts: number = 0;
  private readonly MAX_RECOVERY_ATTEMPTS = 5;
  private readonly BASE_BACKOFF_MS = 5000;
  private readonly MAX_BACKOFF_MS = 60000;
  private readonly JITTER_FACTOR = 0.3; // ±30% randomness

  async attemptRecovery(reason: string): Promise<void> {
    this.recoveryAttempts++;

    if (this.recoveryAttempts > this.MAX_RECOVERY_ATTEMPTS) {
      throw new Error(`Recovery failed after ${this.MAX_RECOVERY_ATTEMPTS} attempts`);
    }

    // Calculate exponential backoff: base * 2^(attempt-1)
    const exponentialDelay = this.BASE_BACKOFF_MS * Math.pow(2, this.recoveryAttempts - 1);

    // Cap at max
    const cappedDelay = Math.min(exponentialDelay, this.MAX_BACKOFF_MS);

    // Add jitter: ±30% randomness
    const jitter = cappedDelay * this.JITTER_FACTOR * (Math.random() * 2 - 1);
    const finalDelay = Math.max(1000, cappedDelay + jitter); // Min 1 second

    this.logger.warn(`Recovery attempt ${this.recoveryAttempts}/${this.MAX_RECOVERY_ATTEMPTS}`);
    this.logger.info(`Waiting ${Math.round(finalDelay)}ms (with jitter) before recovery`);

    await new Promise(resolve => setTimeout(resolve, finalDelay));

    // Rebuild wallet
    await this.rebuildWallet();

    // Reset on success
    this.recoveryAttempts = 0;
  }
}
```

**Timeline** (with jitter range):
```
Attempt 1: Wait  5s ± 1.5s  (3.5s - 6.5s)
Attempt 2: Wait 10s ± 3s    (7s - 13s)
Attempt 3: Wait 20s ± 6s    (14s - 26s)
Attempt 4: Wait 40s ± 12s   (28s - 52s)
Attempt 5: Wait 60s ± 18s   (42s - 60s, capped)
Total: ~30-90 seconds with randomization
```

**Pros**:
✅ Best for distributed systems (prevents synchronized retries)
✅ Production-grade (AWS, Google use this)
✅ Adaptive to load
✅ Good balance of speed and safety

**Cons**:
❌ Most complex implementation
❌ Non-deterministic timing (harder to debug)

**Code Complexity**: ~80 lines

---

### **RECOMMENDATION**

**For your multi-agent architecture (100-500 concurrent agents):**

🏆 **Option 3: Exponential Backoff with Jitter**

**Why?**
1. **Prevents Thundering Herd**: If 100 agents all fail at once (e.g., indexer goes down), they won't all retry at the exact same time
2. **Production-Ready**: This is what AWS SDK, Kubernetes, and other distributed systems use
3. **Better for Midnight Network**: Proof server and indexer won't get hammered by synchronized retries
4. **Minimal Overhead**: Only ~30 extra lines vs simple exponential backoff

**Configuration**:
```typescript
// src/lib/config/constants.ts
export const RECOVERY_CONFIG = {
  MAX_ATTEMPTS: 5,
  BASE_BACKOFF_MS: 5000,
  MAX_BACKOFF_MS: 60000,
  JITTER_FACTOR: 0.3,
  BACKOFF_MULTIPLIER: 2, // Double each time
};
```

---

## Part 2: Docker Architecture Confusion

### 🚨 Current Situation Analysis

**The Problem**: The codebase has **CONTRADICTORY** Docker configurations!

#### Evidence:

**1. WalletManager Code** (`src/wallet/index.ts` lines 310-352):
```typescript
// Tries to load proof-server-testnet.yml
const configDir = path.resolve(currentDir, './src/wallet/config');
const proofServerYml = path.resolve(configDir, 'proof-server-testnet.yml');

// ❌ This file DOES NOT EXIST!
if (!fs.existsSync(proofServerYml)) {
  throw new Error(`Proof server YAML file not found at ${proofServerYml}`);
}

// Tries to start proof server in Docker
const { DockerComposeEnvironment, Wait } = await import('testcontainers');
this.dockerEnv = new DockerComposeEnvironment(
  configDir,
  'proof-server-testnet.yml',
).withWaitStrategy(CONTAINER_NAME, Wait.forLogMessage('Actix runtime found'));
```

**2. Agents Docker Compose** (`agents/testing/docker-compose.yml`):
```yaml
services:
  wallet-server:
    environment:
      - USE_EXTERNAL_PROOF_SERVER=true  # ← Uses EXTERNAL proof server
      - PROOF_SERVER=http://proof-server:6300  # ← External service
```

**3. Root Docker Compose** (`docker-compose.yml`):
```yaml
# Same as agents/testing - no proof server defined!
services:
  wallet-server:
    environment:
      - USE_EXTERNAL_PROOF_SERVER=true
      - PROOF_SERVER=http://proof-server:6300
```

### 🔍 What's Actually Happening

#### Scenario 1: Development Mode (Local)
```typescript
// When running locally with NODE_ENV=development
if (!externalConfig?.useExternalProofServer && isDevelopment) {
  // Tries to start Docker proof server
  await this.setupDockerEnvironment();
  // ❌ FAILS because proof-server-testnet.yml doesn't exist!
}
```

**Result**: Code will crash unless you set `USE_EXTERNAL_PROOF_SERVER=true`

#### Scenario 2: Docker Compose Mode
```typescript
// When running in Docker with USE_EXTERNAL_PROOF_SERVER=true
if (externalConfig?.useExternalProofServer) {
  this.logger.info(`Using external proof server at ${this.config.proofServer}`);
  // ✅ Works - expects proof server at http://proof-server:6300
}
```

**Result**: Works, but **expects an external proof server service to exist**

#### Scenario 3: Production Mode
```typescript
if (!isDevelopment) {
  this.logger.info('Running in production mode, skipping Docker setup');
  // ✅ Works - must use external proof server
}
```

---

### 💡 The Truth About Proof Servers

**Q: Does each agent need its own proof server?**
**A: NO! One proof server can serve ALL agents.**

**Why?**
- Proof server is **stateless** - just generates ZK proofs
- No agent-specific data
- Can handle concurrent requests

**Architecture**:
```
┌──────────────────────────────────────────┐
│         Midnight Network                  │
│  ┌──────────┐  ┌──────────┐  ┌────────┐ │
│  │ Indexer  │  │   Node   │  │  ...   │ │
│  └──────────┘  └──────────┘  └────────┘ │
└──────────────────────────────────────────┘
           ▲           ▲           ▲
           │           │           │
           │           │           │
┌──────────┴───────────┴───────────┴────────┐
│         External Services                  │
│  ┌──────────────────────────────────────┐ │
│  │   Proof Server (ONE INSTANCE)        │ │
│  │   http://proof-server:6300           │ │
│  │   - Stateless                        │ │
│  │   - Handles concurrent requests      │ │
│  │   - Shared by all agents             │ │
│  └──────────────────────────────────────┘ │
└───────────────────────────────────────────┘
           ▲           ▲           ▲
           │           │           │
      HTTP │      HTTP │      HTTP │
           │           │           │
┌──────────┴─┐   ┌────┴─────┐  ┌─┴──────────┐
│  Agent 1   │   │ Agent 2  │  │  Agent N   │
│  Wallet    │   │ Wallet   │  │  Wallet    │
│  Service   │   │ Service  │  │  Service   │
└────────────┘   └──────────┘  └────────────┘
```

**NOT THIS** (wasteful):
```
┌────────────┐   ┌────────────┐   ┌────────────┐
│  Agent 1   │   │  Agent 2   │   │  Agent N   │
│  + Proof   │   │  + Proof   │   │  + Proof   │
│    Server  │   │    Server  │   │    Server  │
└────────────┘   └────────────┘   └────────────┘
     ❌              ❌               ❌
  Unnecessary!   Unnecessary!    Unnecessary!
```

---

### 📋 Current Setup Analysis

**What the `agents/testing/` folder is for**:
```
agents/testing/
├── docker-compose.yml     # Runs wallet-server in Docker
├── .env                   # Agent-specific config (AGENT_ID=testing)
├── data/                  # Persistent storage (wallet backups, DB)
│   └── {AGENT_ID}/
│       ├── seeds/
│       ├── wallet-backups/
│       └── transaction-db/
└── logs/                  # Agent logs
```

**Purpose**: Deploy ONE agent as a Docker container for testing/production.

**Network Setup**:
```yaml
# docker-compose.yml
services:
  wallet-server:
    environment:
      - PROOF_SERVER=http://proof-server:6300  # ← Expects external service
      - INDEXER=https://indexer.testnet-02.midnight.network/...
```

**Expected Network**:
```
Docker Network: midnight-network
├── proof-server:6300           (External - NOT defined in agent compose)
├── wallet-server-testing:3000  (This agent)
├── wallet-server-agent2:3001   (Another agent)
└── wallet-server-agentN:300N   (More agents)
```

---

### 🎯 Recommended Architecture

#### Option A: All-In-One Development Compose

**Create**: `docker-compose.dev.yml`
```yaml
version: '3.8'

services:
  # Shared proof server (ONE for all agents)
  proof-server:
    image: midnight/proof-server:latest  # Or build your own
    container_name: proof-server
    ports:
      - "6300:6300"
    networks:
      - midnight-network

  # Agent 1
  wallet-server-agent1:
    build: .
    container_name: wallet-server-agent1
    environment:
      - AGENT_ID=agent1
      - USE_EXTERNAL_PROOF_SERVER=true
      - PROOF_SERVER=http://proof-server:6300
      - WALLET_SERVER_PORT=3001
    ports:
      - "3001:3000"
    volumes:
      - ./agents/agent1/data:/app/.storage
    networks:
      - midnight-network
    depends_on:
      - proof-server

  # Agent 2
  wallet-server-agent2:
    build: .
    container_name: wallet-server-agent2
    environment:
      - AGENT_ID=agent2
      - USE_EXTERNAL_PROOF_SERVER=true
      - PROOF_SERVER=http://proof-server:6300
      - WALLET_SERVER_PORT=3002
    ports:
      - "3002:3000"
    volumes:
      - ./agents/agent2/data:/app/.storage
    networks:
      - midnight-network
    depends_on:
      - proof-server

networks:
  midnight-network:
    driver: bridge
```

**Usage**:
```bash
# Start all agents + shared proof server
docker-compose -f docker-compose.dev.yml up

# Access:
# - Agent 1: http://localhost:3001
# - Agent 2: http://localhost:3002
# - Proof Server: http://localhost:6300
```

**Benefits**:
✅ One proof server for all agents
✅ Easy multi-agent testing
✅ Realistic production setup

---

#### Option B: Production (External Proof Server)

**Setup**: Separate proof server deployment

```yaml
# Production infrastructure (separate repo/service)
# proof-server-deployment.yml
services:
  proof-server:
    image: midnight/proof-server:production
    ports:
      - "6300:6300"
    restart: always
    # Deploy to: proof-server.yourdomain.com
```

**Agent Configuration**:
```yaml
# Each agent's docker-compose.yml
services:
  wallet-server:
    environment:
      - USE_EXTERNAL_PROOF_SERVER=true
      - PROOF_SERVER=https://proof-server.yourdomain.com:6300
      - INDEXER=https://indexer.testnet-02.midnight.network/...
```

**Benefits**:
✅ Scalable (proof server can be scaled independently)
✅ Agents are lightweight
✅ Production-grade separation of concerns

---

#### Option C: Local Development (No Docker)

**For local development testing**:
```bash
# Terminal 1: Start proof server locally
# (If you have proof-server binary)
./proof-server --port 6300

# Terminal 2: Start wallet service
export USE_EXTERNAL_PROOF_SERVER=true
export PROOF_SERVER=http://localhost:6300
export AGENT_ID=dev-agent
npm run dev
```

**Benefits**:
✅ Fast iteration
✅ Easy debugging
✅ No Docker overhead

**Drawbacks**:
❌ Need proof server binary
❌ Manual setup
❌ Not realistic for multi-agent testing

---

### 🔧 What to Fix in Refactor

#### 1. Remove Broken Docker Management
```typescript
// ❌ DELETE THIS from WalletService:
private dockerEnv?: any;
private startedEnv?: StartedDockerComposeEnvironment;

private async setupDockerEnvironment(): Promise<void> {
  // This references non-existent proof-server-testnet.yml
  // DELETE ENTIRE METHOD
}
```

#### 2. Simplify to External-Only
```typescript
// ✅ NEW WalletService approach:
export class WalletService {
  constructor(config: WalletConfig) {
    // Always require external proof server
    if (!config.proofServer) {
      throw new Error('PROOF_SERVER must be configured');
    }

    this.config = config;
  }

  async start(): Promise<void> {
    // Build wallet with external proof server
    this.wallet = await WalletBuilder.buildFromSeed(
      config.indexer,
      config.indexerWS,
      config.proofServer,  // ← Always external
      config.node,
      this.seed,
      getZswapNetworkId(),
      'info'
    );

    await this.wallet.start();
    this.setupStateSubscription();
  }
}
```

#### 3. Update Configuration
```typescript
// src/lib/config/env.ts
const ConfigSchema = z.object({
  // Make proof server required
  PROOF_SERVER: z.string().url('PROOF_SERVER must be a valid URL'),
  INDEXER: z.string().url(),
  INDEXER_WS: z.string().url(),
  MN_NODE: z.string().url(),

  // Remove USE_EXTERNAL_PROOF_SERVER flag (always external now)
  // USE_EXTERNAL_PROOF_SERVER: z.boolean().default(true),
});
```

#### 4. Provide Docker Compose Examples
```
docs/deployment/
├── docker-compose.dev.yml          # Multi-agent + proof server
├── docker-compose.production.yml   # Agent-only (external proof server)
└── README.md                       # Setup instructions
```

---

### 📊 Summary Table

| Aspect | Current (Broken) | Recommended |
|--------|-----------------|-------------|
| **Proof Server** | Tries to start per-agent | One shared instance |
| **Docker Management** | Embedded in WalletManager | External configuration |
| **Config File** | `proof-server-testnet.yml` (missing!) | docker-compose.yml |
| **Complexity** | High (150 lines Docker code) | Low (config-driven) |
| **Multi-Agent** | Would start N proof servers | Share one proof server |
| **Production** | Doesn't work | Simple external setup |

---

## Final Recommendations

### For Recovery: **Option 3 (Exponential Backoff with Jitter)**
```typescript
// src/services/wallet/RecoveryService.ts
export class RecoveryService {
  private readonly MAX_ATTEMPTS = 5;
  private readonly BASE_BACKOFF_MS = 5000;
  private readonly MAX_BACKOFF_MS = 60000;
  private readonly JITTER_FACTOR = 0.3;

  async attemptRecovery(walletService: WalletService, reason: string): Promise<void> {
    // Exponential backoff with jitter implementation
  }
}
```

### For Docker: **Remove Embedded Docker Management**
```typescript
// ❌ Remove from services:
- setupDockerEnvironment()
- dockerEnv management
- testcontainers dependency

// ✅ Keep simple:
- Always use external proof server
- Document deployment in docker-compose examples
- One proof server serves all agents
```

### Configuration
```typescript
// src/lib/config/constants.ts
export const RECOVERY_CONFIG = {
  MAX_ATTEMPTS: 5,
  BASE_BACKOFF_MS: 5000,
  MAX_BACKOFF_MS: 60000,
  JITTER_FACTOR: 0.3,
  BACKOFF_MULTIPLIER: 2,
};

export const TRANSACTION_POLLING_CONFIG = {
  INTERVAL_MS: 15000,  // Configurable via env var
  MIN_INTERVAL_MS: 5000,
  MAX_INTERVAL_MS: 60000,
};
```

---

**Questions?**
1. Agree with exponential backoff + jitter for recovery?
2. Should we delete all Docker management code from services?
3. Should we create deployment examples in `docs/deployment/`?
