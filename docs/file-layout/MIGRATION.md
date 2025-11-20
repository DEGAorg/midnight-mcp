# Migration Guide

How to migrate from the old structure to the new clean structure.

## Migration Strategy

We'll migrate incrementally, phase by phase, to minimize risk and ensure everything continues working.

---

## Old → New Mapping

### Quick Reference Table

| Old Location | New Location | Notes |
|-------------|-------------|-------|
| `src/server.ts` | `src/api/server.ts` | Split API and MCP |
| `src/mcp/index.ts` | `src/services/wallet/WalletService.ts` | Extract service logic |
| `src/wallet/index.ts` | `src/services/wallet/` | Split into multiple services |
| `src/config.ts` | `src/lib/config/env.ts` | Restructure config |
| `src/logger/` | `src/lib/logger/` | Move to lib |
| `src/utils/` | `src/lib/utils/` | Move to lib |
| `src/wallet/db/` | `src/lib/database/` | Consolidate databases |
| `src/tools.ts` | `src/mcp/tools/` | Split by domain |
| `src/controllers/` | `src/api/controllers/` | Move under api/ |
| `src/integrations/` | `src/contracts/` | Rename and restructure |
| `src/audit/` | `src/audit/` | Keep as-is |

---

## Detailed Migration Steps

### Phase 1: Simple Moves (Low Risk)

These are straightforward file moves without code changes.

#### 1.1 Move Logger

```bash
# Old: src/logger/
# New: src/lib/logger/

mkdir -p src/lib/logger
mv src/logger/* src/lib/logger/
rmdir src/logger
```

**Update imports:**
```typescript
// Before
import { createLogger } from './logger';

// After
import { createLogger } from './lib/logger';
```

#### 1.2 Move Utils

```bash
# Old: src/utils/
# New: src/lib/utils/

mkdir -p src/lib/utils
mv src/utils/http-client.ts src/lib/utils/
mv src/utils/seed-manager.ts src/lib/utils/
mv src/utils/file-manager.ts src/lib/utils/
rmdir src/utils
```

#### 1.3 Move Database Files

```bash
# Old: src/wallet/db/
# New: src/lib/database/

mkdir -p src/lib/database
mv src/wallet/db/TransactionDatabase.ts src/lib/database/transaction-db.ts
mv src/wallet/db/TokenRegistryDatabase.ts src/lib/database/token-registry-db.ts
```

**Note:** Rename files to kebab-case during move.

#### 1.4 Move Controllers

```bash
# Old: src/controllers/
# New: src/api/controllers/

mkdir -p src/api/controllers
mv src/controllers/* src/api/controllers/
rmdir src/controllers
```

#### 1.5 Rename Integrations to Contracts

```bash
# Old: src/integrations/
# New: src/contracts/

mv src/integrations src/contracts
```

---

### Phase 2: Extract Configuration (Medium Risk)

Create new configuration structure.

#### 2.1 Create Constants File

```typescript
// src/lib/config/constants.ts
export const DEFAULT_API_PORT = 3000;
export const DEFAULT_PROOF_SERVER_PORT = 6300;
export const DEFAULT_TIMEOUT_MS = 30000;
export const MAX_RETRY_ATTEMPTS = 3;
export const WALLET_SYNC_POLL_INTERVAL_MS = 1000;
export const TRANSACTION_CONFIRMATION_BLOCKS = 6;

export const PROOF_SERVER_CONTAINER_NAME = 'proof-server';
export const DEFAULT_STORAGE_DIR = '.storage';
export const DEFAULT_LOG_DIR = './logs';

// Add more constants as found in codebase
```

#### 2.2 Restructure Config

```typescript
// src/lib/config/env.ts
import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

const ConfigSchema = z.object({
  AGENT_ID: z.string().min(1),
  NETWORK_ID: z.enum(['TestNet', 'DevNet', 'MainNet']).default('TestNet'),
  WALLET_FILENAME: z.string().default('midnight-wallet'),
  USE_EXTERNAL_PROOF_SERVER: z.boolean().default(false),
  PROOF_SERVER: z.string().url().optional(),
  INDEXER: z.string().url().optional(),
  INDEXER_WS: z.string().url().optional(),
  MN_NODE: z.string().url().optional(),
  API_PORT: z.number().int().min(1).max(65535).default(3000),
  ENABLE_API: z.boolean().default(true),
  ENABLE_MCP: z.boolean().default(true),
});

export type AppConfig = z.infer<typeof ConfigSchema>;

export function loadConfig(envPath?: string): AppConfig {
  if (envPath) {
    dotenv.config({ path: envPath });
  } else {
    dotenv.config();
  }

  return ConfigSchema.parse({
    AGENT_ID: process.env.AGENT_ID,
    NETWORK_ID: process.env.NETWORK_ID,
    WALLET_FILENAME: process.env.WALLET_FILENAME,
    USE_EXTERNAL_PROOF_SERVER: process.env.USE_EXTERNAL_PROOF_SERVER === 'true',
    PROOF_SERVER: process.env.PROOF_SERVER,
    INDEXER: process.env.INDEXER,
    INDEXER_WS: process.env.INDEXER_WS,
    MN_NODE: process.env.MN_NODE,
    API_PORT: process.env.PORT ? parseInt(process.env.PORT) : 3000,
    ENABLE_API: process.env.ENABLE_API !== 'false',
    ENABLE_MCP: process.env.ENABLE_MCP !== 'false',
  });
}
```

#### 2.3 Migrate Old Config

**Old `src/config.ts`:**
```typescript
export const config = loadConfig(); // Singleton
```

**Keep temporarily for backward compatibility:**
```typescript
// src/config.ts (deprecated, for backward compatibility)
import { loadConfig } from './lib/config/env';

export const config = loadConfig();
```

**Add deprecation notice:**
```typescript
/**
 * @deprecated Use loadConfig() from './lib/config/env' instead
 */
export const config = loadConfig();
```

---

### Phase 3: Extract Services (High Risk, High Value)

This is the most complex phase - splitting god classes into focused services.

#### 3.1 Create Service Directory Structure

```bash
mkdir -p src/services/wallet
mkdir -p src/services/marketplace
mkdir -p src/services/dao

touch src/services/wallet/WalletService.ts
touch src/services/wallet/TransactionService.ts
touch src/services/wallet/TokenService.ts
touch src/services/wallet/types.ts
touch src/services/wallet/errors.ts
```

#### 3.2 Extract WalletService from WalletServiceMCP

**Current `src/mcp/index.ts` has:**
- `WalletServiceMCP` class (662 lines)
- Mixes wallet, transaction, token, dao, marketplace logic

**Strategy:**
1. Create new `WalletService` with core wallet operations
2. Extract transaction logic to `TransactionService`
3. Extract token logic to `TokenService`
4. Keep `WalletServiceMCP` as facade temporarily (backward compatibility)
5. Gradually migrate callers to new services
6. Remove facade

**Example Migration:**

```typescript
// src/services/wallet/WalletService.ts (NEW)
import { WalletManager } from '../../wallet'; // Keep old for now
import { Logger } from '../../lib/logger';

export class WalletService {
  constructor(
    private walletManager: WalletManager,
    private logger: Logger
  ) {}

  getAddress(): string {
    return this.walletManager.getAddress();
  }

  async getBalance(): Promise<WalletBalance> {
    const state = this.walletManager.getCurrentState();
    return {
      address: this.getAddress(),
      balance: state.balance.toString(),
      tokens: this.getTokenBalances(state),
    };
  }

  async sendFunds(params: SendFundsParams): Promise<SendResult> {
    this.logger.info({ params }, 'Sending funds');

    try {
      const result = await this.walletManager.sendFunds(
        params.to,
        params.amount,
        params.token
      );

      return {
        transactionId: result.id,
        status: result.state,
        message: result.message,
      };
    } catch (error) {
      this.logger.error({ error, params }, 'Send funds failed');
      throw new SendFundsError('Failed to send funds', { cause: error });
    }
  }
}
```

```typescript
// src/mcp/index.ts (MODIFIED - facade pattern)
import { WalletService } from '../services/wallet/WalletService';
import { TransactionService } from '../services/wallet/TransactionService';
import { TokenService } from '../services/wallet/TokenService';

/**
 * @deprecated This class will be removed. Use individual services instead.
 */
export class WalletServiceMCP {
  private walletService: WalletService;
  private transactionService: TransactionService;
  private tokenService: TokenService;

  constructor(/* ... */) {
    // Initialize services
    this.walletService = new WalletService(walletManager, logger);
    this.transactionService = new TransactionService(transactionDb, logger);
    this.tokenService = new TokenService(tokenManager, logger);
  }

  // Delegate to new services
  getAddress(): string {
    return this.walletService.getAddress();
  }

  async getBalance(): Promise<WalletBalance> {
    return this.walletService.getBalance();
  }

  async sendFunds(to: string, amount: string, token?: string): Promise<SendResult> {
    return this.walletService.sendFunds({ to, amount, token });
  }

  // Transaction methods delegate to TransactionService
  getTransactionStatus(id: string) {
    return this.transactionService.getStatus(id);
  }

  // Token methods delegate to TokenService
  registerToken(...) {
    return this.tokenService.register(...);
  }
}
```

#### 3.3 Migration Checklist for Each Service

For each service being extracted:

- [ ] Create new service file
- [ ] Copy relevant methods from old god class
- [ ] Add proper constructor with dependencies
- [ ] Add error handling and logging
- [ ] Create types.ts with interfaces
- [ ] Create errors.ts with custom errors
- [ ] Write unit tests
- [ ] Update old class to delegate to new service (facade)
- [ ] Update direct callers to use new service
- [ ] Remove old class when no longer used

---

### Phase 4: Split API and MCP (Medium Risk)

Separate the API server from MCP server.

#### 4.1 Create MCP Server Structure

```bash
mkdir -p src/mcp/tools
mkdir -p src/mcp/handlers

touch src/mcp/stdio-server.ts
touch src/mcp/tools/index.ts
touch src/mcp/tools/wallet-tools.ts
touch src/mcp/handlers/wallet-handler.ts
```

#### 4.2 Extract MCP Tools from `src/tools.ts`

**Old `src/tools.ts`:**
- Giant switch statement
- Calls HTTP endpoints (unnecessary proxy)

**New structure:**

```typescript
// src/mcp/tools/wallet-tools.ts
import { z } from 'zod';

export const walletTools = [
  {
    name: 'wallet_status',
    description: 'Get wallet status and balance',
    inputSchema: z.object({}),
  },
  {
    name: 'wallet_address',
    description: 'Get wallet address',
    inputSchema: z.object({}),
  },
  // ... more tools
];
```

```typescript
// src/mcp/handlers/wallet-handler.ts
import { WalletService } from '../../services/wallet/WalletService';

export class WalletHandler {
  constructor(private walletService: WalletService) {}

  async handleWalletStatus(): Promise<McpResponse> {
    const status = await this.walletService.getBalance();
    return {
      content: [{ type: 'text', text: JSON.stringify(status, null, 2) }]
    };
  }
}
```

```typescript
// src/mcp/stdio-server.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { walletTools } from './tools/wallet-tools';
import { WalletHandler } from './handlers/wallet-handler';

export async function createMcpServer(services: Services) {
  const server = new Server(
    { name: 'midnight-wallet', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  const walletHandler = new WalletHandler(services.walletService);

  // Register tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [...walletTools, /* other tools */],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    switch (name) {
      case 'wallet_status':
        return walletHandler.handleWalletStatus();
      case 'wallet_address':
        return walletHandler.handleWalletAddress();
      // ... more cases
    }
  });

  return server;
}
```

#### 4.3 Update API Server

**Old `src/server.ts`:**
- Mixed API and service initialization

**New `src/api/server.ts`:**

```typescript
// src/api/server.ts
import express from 'express';
import { createRoutes } from './routes';
import { errorHandler } from './middleware/error-handler';
import { requestLogger } from './middleware/logging';
import { Services } from '../types/services';

export function createApiServer(services: Services) {
  const app = express();

  app.use(express.json());
  app.use(requestLogger);

  // Register routes
  app.use('/api', createRoutes(services));

  // Error handling
  app.use(errorHandler);

  return app;
}
```

#### 4.4 Create Main Entry Point

```typescript
// src/index.ts
import { loadConfig } from './lib/config/env';
import { createLogger } from './lib/logger';
import { initializeServices } from './services';
import { createApiServer } from './api/server';
import { createMcpServer } from './mcp/stdio-server';

async function main() {
  const config = loadConfig();
  const logger = createLogger('main');

  logger.info({ config }, 'Starting application');

  // Initialize services (shared between API and MCP)
  const services = await initializeServices(config, logger);

  // Start API server (if enabled)
  if (config.ENABLE_API) {
    const apiServer = createApiServer(services);
    apiServer.listen(config.API_PORT, () => {
      logger.info(`API server listening on port ${config.API_PORT}`);
    });
  }

  // Start MCP server (if enabled)
  if (config.ENABLE_MCP) {
    const mcpServer = await createMcpServer(services);
    const transport = new StdioServerTransport();
    await mcpServer.connect(transport);
    logger.info('MCP server started on STDIO');
  }
}

main().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});
```

---

## Migration Progress Tracking

### Phase 1: Simple Moves ✅
- [ ] Move logger to lib/
- [ ] Move utils to lib/
- [ ] Move database files to lib/database/
- [ ] Move controllers to api/controllers/
- [ ] Rename integrations to contracts/
- [ ] Update all imports
- [ ] Run tests - ensure nothing broke

### Phase 2: Configuration ✅
- [ ] Create constants.ts
- [ ] Replace magic numbers with constants
- [ ] Create new config structure with Zod
- [ ] Keep old config for backward compatibility
- [ ] Update references gradually
- [ ] Remove old config when safe

### Phase 3: Extract Services ⚠️
- [ ] Create service directory structure
- [ ] Extract WalletService
- [ ] Extract TransactionService
- [ ] Extract TokenService
- [ ] Extract MarketplaceService
- [ ] Extract DaoService
- [ ] Write tests for each service
- [ ] Update WalletServiceMCP to use new services (facade)
- [ ] Migrate callers to new services
- [ ] Remove WalletServiceMCP facade

### Phase 4: API/MCP Split ⚠️
- [ ] Create MCP server structure
- [ ] Extract tools from tools.ts
- [ ] Create handlers (no HTTP calls)
- [ ] Create stdio-server.ts
- [ ] Restructure API server
- [ ] Create main entry point (index.ts)
- [ ] Update scripts in package.json
- [ ] Test API independently
- [ ] Test MCP independently
- [ ] Test both together

### Phase 5: Cleanup 🧹
- [ ] Remove deprecated files
- [ ] Remove facade classes
- [ ] Update all documentation
- [ ] Run full test suite
- [ ] Performance testing
- [ ] Code review
- [ ] Merge to main

---

## Testing During Migration

### After Each Phase

1. **Run Unit Tests:**
   ```bash
   pnpm test:unit
   ```

2. **Run Integration Tests:**
   ```bash
   pnpm test:integration
   ```

3. **Manual Testing:**
   - Start API server
   - Test key endpoints
   - Start MCP server
   - Test key tools

4. **Check for Regressions:**
   - Compare behavior with previous version
   - Check logs for errors
   - Verify performance hasn't degraded

---

## Rollback Plan

If something breaks during migration:

1. **Immediate:** Revert last commit
   ```bash
   git revert HEAD
   ```

2. **If Multiple Commits:** Reset to last known good state
   ```bash
   git reset --hard <commit-hash>
   ```

3. **Preserve Work:** Create backup branch first
   ```bash
   git branch migration-backup
   git reset --hard <last-good-commit>
   ```

---

## Communication During Migration

### Branch Naming

```
refactor/phase-1-simple-moves
refactor/phase-2-config
refactor/phase-3-extract-services
refactor/phase-4-api-mcp-split
```

### Commit Messages

```
refactor(phase-1): move logger to lib/

- Moved src/logger/ → src/lib/logger/
- Updated import paths
- Tests passing

refactor(phase-3): extract WalletService

- Created src/services/wallet/WalletService.ts
- Extracted core wallet operations
- Added unit tests
- WalletServiceMCP now delegates to WalletService
```

---

## Post-Migration Validation

### Checklist

- [ ] All tests passing
- [ ] No performance degradation
- [ ] API endpoints work as before
- [ ] MCP tools work as before
- [ ] Docker deployment works
- [ ] Documentation updated
- [ ] No deprecated code warnings
- [ ] Code review completed
- [ ] Team approval received

---

## Timeline Estimate

| Phase | Estimated Time | Risk Level |
|-------|---------------|------------|
| Phase 1: Simple Moves | 2-3 days | Low |
| Phase 2: Configuration | 2-3 days | Low |
| Phase 3: Extract Services | 7-10 days | High |
| Phase 4: API/MCP Split | 5-7 days | Medium |
| Phase 5: Cleanup | 2-3 days | Low |
| **Total** | **3-4 weeks** | |

**Note:** Timeline assumes working ~6 hours per day with testing.

---

## Need Help?

If you get stuck during migration:

1. Check this guide
2. Review [STRUCTURE.md](./STRUCTURE.md) and [GUIDELINES.md](./GUIDELINES.md)
3. Look at similar code in Midnight-Mcp codebase (new one) for patterns
4. Ask for code review before major changes

**Remember:** Take it slow, test frequently, commit often!
