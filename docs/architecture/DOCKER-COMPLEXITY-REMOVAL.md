# Docker Complexity - Can and Should Be Removed

## TL;DR

**YES - Delete ALL Docker management code from WalletManager.**

It's **completely unnecessary** and was never actually used for anything.

---

## Evidence from Codebase Analysis

### 1. Tests DON'T Use Docker Management

**Unit Tests** (`test/unit/__mocks__/wallet.ts`):
```typescript
// Tests use MOCKS - no real WalletManager instantiation!
class WalletManager {
  public isReady = jest.fn(() => true);
  public getAddress = jest.fn(() => 'mock_address');
  // ... all mocked
}
```

**Result**: Unit tests NEVER instantiate real WalletManager, so they never trigger Docker code.

---

**E2E Tests** (`test/e2e/E2E_OVERVIEW.md` lines 103-118):
```markdown
### Prerequisites

1. **Docker Backend**: Ensure the Docker backend is running
   ```bash
   docker-compose up -d
   ```

2. **Eliza AI Agents**: Make sure Eliza AI agents are running and accessible
   ...

3. **Wallet Server**: Verify the wallet server is accessible
   ...
```

**Result**: E2E tests expect Docker to **ALREADY BE RUNNING** as a prerequisite. They don't use WalletManager's Docker management code!

---

**Search Results**:
```bash
$ grep -r "setupDocker\|testcontainers\|isDevelopment" test/
# NO RESULTS - Tests don't reference Docker management code!
```

**Result**: Tests never use `setupDockerEnvironment()` or any Docker management features.

---

### 2. Docker Code References Non-Existent File

**WalletManager Code** (`src/wallet/index.ts` lines 319-330):
```typescript
private async setupDockerEnvironment(): Promise<void> {
  const configDir = path.resolve(currentDir, './src/wallet/config');
  const proofServerYml = path.resolve(configDir, 'proof-server-testnet.yml');

  if (!fs.existsSync(proofServerYml)) {
    throw new Error(`Proof server YAML file not found at ${proofServerYml}`);
  }
  // ...
}
```

**Verification**:
```bash
$ ls -la src/wallet/config/
ls: src/wallet/config/: No such directory exists

$ find . -name "proof-server*.yml" -o -name "proof-server*.yaml"
# NO RESULTS - The file doesn't exist!
```

**Result**: The Docker code would **CRASH** if ever executed because the config file is missing!

---

### 3. Current Deployments Use External Proof Server

**Docker Compose** (`docker-compose.yml` and `agents/testing/docker-compose.yml`):
```yaml
services:
  wallet-server:
    environment:
      - USE_EXTERNAL_PROOF_SERVER=true  # ← Always true!
      - PROOF_SERVER=http://proof-server:6300  # ← External service
      - INDEXER=https://indexer.testnet-02.midnight.network/...
```

**Result**: All actual deployments bypass the Docker management code entirely!

---

### 4. Code Flow Analysis

**Execution Path**:
```typescript
// src/wallet/index.ts constructor (lines 214-261)
constructor(networkId, seed, walletFilename, externalConfig) {
  // Line 232: Store external config
  this.config = externalConfig || new TestnetRemoteConfig();

  // Line 253: Initialize wallet asynchronously
  this.walletInitPromise = this.initWalletWithProperSetup(seed, walletFilename, externalConfig);
}

// Lines 267-305
private async initWalletWithProperSetup(seed, walletFilename, externalConfig) {
  // Line 270: Check if should use external proof server
  if (!externalConfig?.useExternalProofServer && isDevelopment) {
    // This branch tries to start Docker
    await this.setupDockerEnvironment(); // ← WOULD CRASH (file missing)
  } else if (externalConfig?.useExternalProofServer) {
    // This is the actual path used in production!
    this.logger.info(`Using external proof server at ${this.config.proofServer}`);
  }

  await this.initializeWallet(seed, walletFilename);
}
```

**Current Usage**:
- **Production/Docker**: `USE_EXTERNAL_PROOF_SERVER=true` → Skip Docker management
- **Development**: Would crash because `proof-server-testnet.yml` doesn't exist
- **Tests**: Use mocks, never execute this code

**Result**: The Docker management code is **DEAD CODE** - never successfully executed!

---

## Why Was It Added?

Based on code structure, it appears the original developer intended to:

1. **Auto-start a local proof server** for development convenience
2. **Make local development "one command"** without manual setup

But:
- ❌ Never finished the implementation (config file missing)
- ❌ Never tested it (tests use mocks)
- ❌ Production uses external proof server anyway
- ❌ Adds unnecessary dependency (`testcontainers`)

**Conclusion**: Good intention, incomplete execution, unnecessary complexity.

---

## What Should Be Removed

### Delete These Files/Code:

#### 1. Docker Management Code (~200 lines)
```typescript
// src/wallet/index.ts

// DELETE: Lines 100, 166-167
const CONTAINER_NAME = 'proof-server';
private dockerEnv?: any;
private startedEnv?: StartedDockerComposeEnvironment;

// DELETE: Lines 73-74, 310-352 (entire setupDockerEnvironment method)
const isDevelopment = process.env.NODE_ENV !== 'production';
private async setupDockerEnvironment(): Promise<void> {
  // ... entire method ...
}

// DELETE: Lines 270-288 (Docker setup in initWalletWithProperSetup)
if (!externalConfig?.useExternalProofServer && isDevelopment) {
  this.logger.info('Setting up Docker environment, using internal proof server');
  // ... delete this entire branch ...
}

// DELETE: Lines 360-385 (Docker startup in initializeWallet)
if (this.dockerEnv && !this.config.useExternalProofServer && isDevelopment) {
  this.logger.info('Starting Docker environment');
  // ... delete this entire branch ...
}

// DELETE: Lines 954-957 (Docker shutdown in close)
if (this.startedEnv && !this.config.useExternalProofServer && isDevelopment) {
  await this.startedEnv.down();
  this.logger.info('Docker environment shut down successfully');
}
```

#### 2. Remove Testcontainers Dependency
```bash
# Remove from package.json
npm uninstall testcontainers

# Or
pnpm remove testcontainers
```

#### 3. Remove Docker-Related Imports
```typescript
// DELETE: Lines 11 (commented), 58-71
// import { DockerComposeEnvironment, Wait, type StartedDockerComposeEnvironment } from 'testcontainers';

// DELETE: Type definitions for Docker (no longer needed)
interface DockerContainer { ... }
interface StartedDockerComposeEnvironment { ... }
interface DockerComposeEnvironment { ... }
```

#### 4. Simplify Configuration
```typescript
// src/wallet/index.ts lines 79-87

// BEFORE (complex):
export interface WalletConfig {
  indexer: string;
  indexerWS: string;
  node: string;
  proofServer: string;
  logDir?: string;
  networkId?: NetworkId;
  useExternalProofServer?: boolean; // ← DELETE THIS
}

// AFTER (simple):
export interface WalletConfig {
  indexer: string;
  indexerWS: string;
  node: string;
  proofServer: string;  // Always required!
  logDir?: string;
  networkId?: NetworkId;
}
```

---

## Simplified Code After Removal

### New WalletManager Constructor
```typescript
// src/services/wallet/WalletService.ts

export class WalletService {
  private wallet: Wallet | null = null;
  private config: WalletConfig;

  constructor(config: WalletConfig) {
    // Validate required proof server
    if (!config.proofServer) {
      throw new Error('PROOF_SERVER must be configured. Please provide an external proof server URL.');
    }

    this.config = config;
  }

  async start(): Promise<void> {
    this.logger.info(`Connecting to proof server at ${this.config.proofServer}`);

    // Build or restore wallet
    this.wallet = await this.buildOrRestoreWallet();
    await this.wallet.start();

    // Setup state subscription
    this.setupStateSubscription();
  }

  private async buildOrRestoreWallet(): Promise<Wallet & Resource> {
    const { indexer, indexerWS, node, proofServer } = this.config;

    // Try to restore from file
    if (this.walletFilename && this.fileExists()) {
      const serialized = this.readWalletFile();
      return await WalletBuilder.restore(
        indexer,
        indexerWS,
        proofServer,
        node,
        this.seed,
        serialized,
        'info'
      );
    }

    // Build new wallet
    return await WalletBuilder.buildFromSeed(
      indexer,
      indexerWS,
      proofServer,  // ← Always external
      node,
      this.seed,
      getZswapNetworkId(),
      'info'
    );
  }
}
```

**Changes**:
- ✅ No Docker management
- ✅ Always requires external proof server
- ✅ Simpler, clearer code
- ✅ ~200 lines removed

---

### Updated Configuration

```typescript
// src/lib/config/env.ts

const ConfigSchema = z.object({
  // Network endpoints (all required)
  PROOF_SERVER: z.string().url('PROOF_SERVER must be a valid URL'),
  INDEXER: z.string().url('INDEXER must be a valid URL'),
  INDEXER_WS: z.string().url('INDEXER_WS must be a valid WebSocket URL'),
  MN_NODE: z.string().url('MN_NODE must be a valid URL'),

  // Agent configuration
  AGENT_ID: z.string().min(1),
  NETWORK_ID: z.enum(['TestNet', 'DevNet', 'MainNet']).default('TestNet'),

  // Wallet configuration
  WALLET_FILENAME: z.string().default('midnight-wallet'),
  WALLET_BACKUP_FOLDER: z.string().default('.storage/wallet-backups'),

  // Server configuration
  API_PORT: z.number().int().min(1).max(65535).default(3000),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),

  // Transaction polling
  TX_POLLING_INTERVAL_MS: z.number().int().min(5000).max(60000).default(15000),

  // REMOVED: USE_EXTERNAL_PROOF_SERVER (always true now)
});
```

---

## Developer Experience

### Before (Complex):
```bash
# Developer tries to run locally
$ npm run dev

# ERROR: proof-server-testnet.yml not found
# Developer confused: "Where is this file?"
# Developer has to set USE_EXTERNAL_PROOF_SERVER=true manually
# Or set up Docker themselves
```

### After (Simple):
```bash
# Developer sets up once
$ export PROOF_SERVER=http://localhost:6300
$ export INDEXER=https://indexer.testnet-02.midnight.network/...
$ export INDEXER_WS=wss://indexer.testnet-02.midnight.network/...
$ export MN_NODE=https://rpc.testnet-02.midnight.network

# Or use .env file
$ cat > .env << EOF
PROOF_SERVER=http://localhost:6300
INDEXER=https://indexer.testnet-02.midnight.network/api/v1/graphql
INDEXER_WS=wss://indexer.testnet-02.midnight.network/api/v1/graphql/ws
MN_NODE=https://rpc.testnet-02.midnight.network
AGENT_ID=dev-agent
EOF

# Run
$ npm run dev
# ✅ Works - clear error if proof server not configured
```

**Benefits**:
- ✅ Explicit configuration (no magic)
- ✅ Clear error messages
- ✅ Works same way in dev/prod
- ✅ No confusion about Docker

---

## Migration Guide

### For Existing Deployments

**No changes needed!** Existing docker-compose.yml files already use external proof server:

```yaml
# This already works and will continue working
services:
  wallet-server:
    environment:
      - USE_EXTERNAL_PROOF_SERVER=true  # Can remove this line (no longer checked)
      - PROOF_SERVER=http://proof-server:6300
      - INDEXER=https://indexer.testnet-02.midnight.network/...
```

### For Local Development

**Before**:
```bash
# Didn't work (file missing)
$ NODE_ENV=development npm run dev
# ERROR: proof-server-testnet.yml not found
```

**After**:
```bash
# Clear and simple
$ export PROOF_SERVER=http://localhost:6300
$ npm run dev
# ✅ Works if proof server is running
# ❌ Clear error if proof server not configured
```

---

## Summary

| Aspect | Before | After |
|--------|--------|-------|
| **Lines of Code** | +200 Docker management | 0 Docker management |
| **Dependencies** | testcontainers (~50MB) | None |
| **Complexity** | High (Docker lifecycle) | Low (config-driven) |
| **Working State** | Broken (file missing) | Will work |
| **Test Coverage** | 0% (never executed) | N/A (removed) |
| **Production Usage** | 0% (bypassed) | N/A (removed) |
| **Developer Setup** | Confusing (why error?) | Clear (explicit config) |

---

## Recommendation

✅ **DELETE ALL DOCKER MANAGEMENT CODE**

**Reasoning**:
1. Never successfully executed (file missing)
2. Never used by tests (mocked)
3. Never used in production (external proof server)
4. Adds unnecessary complexity (~200 lines)
5. Adds unnecessary dependency (testcontainers)
6. Confusing for developers (broken feature)

**Alternative**: Keep it simple
- Always require external proof server (via config)
- Document deployment examples in `docs/deployment/`
- Provide docker-compose examples for complete setup
- Clear separation: infrastructure (Docker) vs application (wallet service)

---

## Questions?

**Q: What if a developer wants to run everything locally?**

**A**: Provide a complete `docker-compose.dev.yml` that includes proof server + wallet service:
```yaml
services:
  proof-server:
    image: midnight/proof-server
    ports: ["6300:6300"]

  wallet-server:
    build: .
    environment:
      - PROOF_SERVER=http://proof-server:6300
    depends_on: [proof-server]
```

**Q: Won't this make local development harder?**

**A**: No! Current code is broken anyway. New approach is:
- More explicit (clear what's needed)
- More flexible (use any proof server)
- Less surprising (no hidden Docker magic)

**Q: Should we keep USE_EXTERNAL_PROOF_SERVER flag for backward compatibility?**

**A**: No need! It's always `true` in every deployment. Just remove the flag and always use external proof server.

---

**Status**: Ready to delete Docker management code in refactor ✅
