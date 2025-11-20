# File Organization Guidelines

Practical guidelines for where to place code when developing new features.

## Quick Decision Tree

```
Is it business logic?
├─ Yes → src/services/[domain]/
└─ No → Is it a database operation?
    ├─ Yes → src/lib/database/
    └─ No → Is it an HTTP endpoint?
        ├─ Yes → src/api/routes/
        └─ No → Is it an MCP tool?
            ├─ Yes → src/mcp/tools/
            └─ No → Is it a type definition?
                ├─ Yes → src/types/
                └─ No → src/lib/utils/
```

---

## Adding New Features

### 1. Adding a New Service

**When:** You're implementing a new domain or major feature area.

**Example:** Adding a "Staking" feature

**Steps:**

```bash
# 1. Create service directory
mkdir -p src/services/staking

# 2. Create service files
touch src/services/staking/StakingService.ts
touch src/services/staking/types.ts
touch src/services/staking/errors.ts

# 3. Create tests
mkdir -p test/unit/services/staking
touch test/unit/services/staking/StakingService.spec.ts
```

**Service Template:**

```typescript
// src/services/staking/StakingService.ts
import { Logger } from '../../lib/logger';
import { StakingConfig } from './types';
import { StakingError } from './errors';

export class StakingService {
  constructor(
    private config: StakingConfig,
    private logger: Logger
  ) {}

  async stake(amount: string, duration: number): Promise<StakeResult> {
    this.logger.info({ amount, duration }, 'Staking tokens');

    try {
      // Business logic here
      const result = await this.performStake(amount, duration);
      return result;
    } catch (error) {
      this.logger.error({ error }, 'Staking failed');
      throw new StakingError('Failed to stake tokens', { cause: error });
    }
  }

  private async performStake(amount: string, duration: number): Promise<StakeResult> {
    // Implementation
  }
}
```

**Types Template:**

```typescript
// src/services/staking/types.ts
export interface StakingConfig {
  minStakeAmount: string;
  maxDuration: number;
}

export interface StakeParams {
  amount: string;
  duration: number;
}

export interface StakeResult {
  stakeId: string;
  amount: string;
  startTime: number;
  endTime: number;
}
```

**Errors Template:**

```typescript
// src/services/staking/errors.ts
export class StakingError extends Error {
  constructor(
    message: string,
    public readonly context?: { cause?: unknown; [key: string]: unknown }
  ) {
    super(message);
    this.name = 'StakingError';
  }
}

export class InsufficientStakeError extends StakingError {
  constructor(required: string, available: string) {
    super(`Insufficient balance. Required: ${required}, Available: ${available}`);
    this.name = 'InsufficientStakeError';
  }
}
```

---

### 2. Adding an API Endpoint

**When:** You need to expose service functionality via HTTP REST API.

**Example:** Adding `/staking/stake` endpoint

**Steps:**

```bash
# 1. Create route file
touch src/api/routes/staking.ts

# 2. Create controller (if needed)
touch src/api/controllers/StakingController.ts

# 3. Add to route index
# Edit src/api/routes/index.ts to include new routes

# 4. Create integration test
mkdir -p test/integration/api
touch test/integration/api/staking-routes.spec.ts
```

**Route Template:**

```typescript
// src/api/routes/staking.ts
import { Router } from 'express';
import { StakingController } from '../controllers/StakingController';

export function createStakingRoutes(controller: StakingController): Router {
  const router = Router();

  router.post('/stake', controller.stake.bind(controller));
  router.get('/stakes', controller.getStakes.bind(controller));
  router.get('/stakes/:id', controller.getStake.bind(controller));

  return router;
}
```

**Controller Template:**

```typescript
// src/api/controllers/StakingController.ts
import { Request, Response, NextFunction } from 'express';
import { StakingService } from '../../services/staking/StakingService';
import { Logger } from '../../lib/logger';

export class StakingController {
  constructor(
    private stakingService: StakingService,
    private logger: Logger
  ) {}

  async stake(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { amount, duration } = req.body;

      // Validation
      if (!amount || !duration) {
        res.status(400).json({ error: 'Missing required parameters' });
        return;
      }

      // Call service
      const result = await this.stakingService.stake(amount, duration);

      // Return response
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error); // Pass to error handler middleware
    }
  }

  async getStakes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stakes = await this.stakingService.getAllStakes();
      res.json({ success: true, data: stakes });
    } catch (error) {
      next(error);
    }
  }
}
```

**Register Routes:**

```typescript
// src/api/routes/index.ts
import { Router } from 'express';
import { createWalletRoutes } from './wallet';
import { createTokenRoutes } from './tokens';
import { createStakingRoutes } from './staking'; // Add this

export function createRoutes(services: Services): Router {
  const router = Router();

  const walletController = new WalletController(services.walletService);
  const tokenController = new TokenController(services.tokenService);
  const stakingController = new StakingController(services.stakingService); // Add this

  router.use('/wallet', createWalletRoutes(walletController));
  router.use('/tokens', createTokenRoutes(tokenController));
  router.use('/staking', createStakingRoutes(stakingController)); // Add this

  return router;
}
```

---

### 3. Adding an MCP Tool

**When:** You need to expose functionality to AI agents via MCP.

**Example:** Adding staking tools for MCP

**Steps:**

```bash
# 1. Create tool definition
touch src/mcp/tools/staking-tools.ts

# 2. Create handler
touch src/mcp/handlers/staking-handler.ts

# 3. Register in tool index
# Edit src/mcp/tools/index.ts

# 4. Create integration test
mkdir -p test/integration/mcp
touch test/integration/mcp/staking-tools.spec.ts
```

**Tool Definition Template:**

```typescript
// src/mcp/tools/staking-tools.ts
import { z } from 'zod';

export const stakingTools = [
  {
    name: 'staking_stake',
    description: 'Stake tokens for a specific duration',
    inputSchema: z.object({
      amount: z.string().describe('Amount to stake'),
      duration: z.number().int().min(1).describe('Staking duration in days'),
    }),
  },
  {
    name: 'staking_get_stakes',
    description: 'Get all active stakes',
    inputSchema: z.object({}),
  },
  {
    name: 'staking_unstake',
    description: 'Unstake tokens',
    inputSchema: z.object({
      stakeId: z.string().describe('ID of the stake to unstake'),
    }),
  },
];
```

**Handler Template:**

```typescript
// src/mcp/handlers/staking-handler.ts
import { StakingService } from '../../services/staking/StakingService';
import { Logger } from '../../lib/logger';

interface McpResponse {
  content: Array<{ type: 'text'; text: string }>;
}

export class StakingHandler {
  constructor(
    private stakingService: StakingService,
    private logger: Logger
  ) {}

  async handleStake(args: { amount: string; duration: number }): Promise<McpResponse> {
    this.logger.info({ args }, 'MCP: staking_stake called');

    try {
      const result = await this.stakingService.stake(args.amount, args.duration);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }]
      };
    }
  }

  async handleGetStakes(): Promise<McpResponse> {
    this.logger.info('MCP: staking_get_stakes called');

    const stakes = await this.stakingService.getAllStakes();

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(stakes, null, 2)
      }]
    };
  }
}
```

**Register Tools:**

```typescript
// src/mcp/tools/index.ts
import { walletTools } from './wallet-tools';
import { tokenTools } from './token-tools';
import { stakingTools } from './staking-tools'; // Add this

export const allTools = [
  ...walletTools,
  ...tokenTools,
  ...stakingTools, // Add this
];
```

---

### 4. Adding Database Operations

**When:** You need to persist or query data.

**Example:** Adding a stakes database

**Steps:**

```bash
# Create database file
touch src/lib/database/stakes-db.ts

# Create migration (if needed)
touch scripts/migrations/001-create-stakes-table.ts
```

**Database Template:**

```typescript
// src/lib/database/stakes-db.ts
import Database from 'better-sqlite3';
import { Logger } from '../logger';

export interface StakeRecord {
  id: string;
  agentId: string;
  amount: string;
  startTime: number;
  endTime: number;
  status: 'active' | 'completed' | 'withdrawn';
  createdAt: number;
}

export class StakesDatabase {
  private db: Database.Database;

  constructor(
    private dbPath: string,
    private logger: Logger
  ) {
    this.db = new Database(dbPath);
    this.initializeSchema();
  }

  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS stakes (
        id TEXT PRIMARY KEY,
        agentId TEXT NOT NULL,
        amount TEXT NOT NULL,
        startTime INTEGER NOT NULL,
        endTime INTEGER NOT NULL,
        status TEXT NOT NULL,
        createdAt INTEGER NOT NULL
      )
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_stakes_agentId
      ON stakes(agentId)
    `);

    this.logger.info('Stakes database initialized');
  }

  createStake(stake: StakeRecord): void {
    const stmt = this.db.prepare(`
      INSERT INTO stakes (id, agentId, amount, startTime, endTime, status, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      stake.id,
      stake.agentId,
      stake.amount,
      stake.startTime,
      stake.endTime,
      stake.status,
      stake.createdAt
    );
  }

  getStake(id: string): StakeRecord | null {
    const stmt = this.db.prepare('SELECT * FROM stakes WHERE id = ?');
    return stmt.get(id) as StakeRecord | null;
  }

  getStakesByAgent(agentId: string): StakeRecord[] {
    const stmt = this.db.prepare('SELECT * FROM stakes WHERE agentId = ?');
    return stmt.all(agentId) as StakeRecord[];
  }

  updateStakeStatus(id: string, status: StakeRecord['status']): void {
    const stmt = this.db.prepare('UPDATE stakes SET status = ? WHERE id = ?');
    stmt.run(status, id);
  }
}
```

---

### 5. Adding Utilities

**When:** You have reusable helper functions.

**Example:** Adding a date formatting utility

```typescript
// src/lib/utils/date-formatter.ts

/**
 * Format timestamp to ISO string
 */
export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

/**
 * Get current timestamp in milliseconds
 */
export function now(): number {
  return Date.now();
}

/**
 * Add days to a timestamp
 */
export function addDays(timestamp: number, days: number): number {
  return timestamp + (days * 24 * 60 * 60 * 1000);
}
```

**Guidelines:**
- ✅ Pure functions (no side effects)
- ✅ Well-documented
- ✅ Unit tested
- ✅ No external dependencies if possible

---

### 6. Adding Type Definitions

**When:** You have types shared across multiple modules.

**Example:** Adding staking types

```typescript
// src/types/staking.ts

export interface Stake {
  id: string;
  agentId: string;
  amount: string;
  startTime: number;
  endTime: number;
  status: StakeStatus;
}

export type StakeStatus = 'active' | 'completed' | 'withdrawn';

export interface StakingRewards {
  stakeId: string;
  earned: string;
  claimed: string;
  pending: string;
}
```

---

## Naming Conventions

### Files

- **Services:** `PascalCase.ts` (e.g., `WalletService.ts`)
- **Types:** `kebab-case.ts` (e.g., `wallet-types.ts`) OR match service name `types.ts`
- **Tests:** `[FileName].spec.ts` (e.g., `WalletService.spec.ts`)
- **Routes:** `kebab-case.ts` (e.g., `wallet-routes.ts`)
- **Utilities:** `kebab-case.ts` (e.g., `date-formatter.ts`)

### Classes

```typescript
// Services: [Domain]Service
export class WalletService {}
export class StakingService {}

// Controllers: [Domain]Controller
export class WalletController {}
export class StakingController {}

// Handlers: [Domain]Handler
export class WalletHandler {}
export class StakingHandler {}

// Errors: [Description]Error
export class WalletNotReadyError {}
export class InsufficientFundsError {}
```

### Interfaces/Types

```typescript
// Use descriptive names without "I" prefix
export interface WalletBalance {}
export interface StakeParams {}
export type StakeStatus = 'active' | 'completed';

// OR use "I" prefix (pick one style and stick to it)
export interface IWalletBalance {}
export interface IStakeParams {}
```

### Functions

```typescript
// Verb-first naming
export async function createStake() {}
export function getStakeById() {}
export function validateAmount() {}
export function formatStakeResult() {}
```

---

## Code Organization Patterns

### 1. Constructor Injection

**Always use constructor injection for dependencies:**

```typescript
export class StakingService {
  constructor(
    private config: StakingConfig,
    private stakesDb: StakesDatabase,
    private logger: Logger
  ) {}
}
```

### 2. Single Responsibility

**Each service should have one clear purpose:**

```typescript
// Good: Focused service
export class TransactionService {
  async createTransaction() {}
  async getTransaction() {}
  async updateTransaction() {}
}

// Bad: God class doing too much
export class WalletService {
  async sendFunds() {}
  async getBalance() {}
  async registerToken() {} // Should be TokenService
  async createDaoVote() {} // Should be DaoService
}
```

### 3. Error Handling

**Throw errors with context:**

```typescript
try {
  const result = await this.performOperation();
  return result;
} catch (error) {
  this.logger.error({ error, context }, 'Operation failed');
  throw new OperationError('Failed to perform operation', {
    cause: error
  });
}
```

### 4. Validation

**Validate at boundaries (API/MCP), not in services:**

```typescript
// API Controller - validates input
async stake(req: Request, res: Response) {
  const { amount, duration } = req.body;

  // Validate here
  if (!amount || isNaN(Number(amount))) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  // Pass validated data to service
  const result = await this.stakingService.stake(amount, duration);
  res.json(result);
}

// Service - assumes valid input
async stake(amount: string, duration: number) {
  // No validation needed, trusted input
  return this.performStake(amount, duration);
}
```

---

## Testing Guidelines

### Unit Tests

**Location:** `test/unit/[mirror-src-structure]`

**Example:**
```
src/services/staking/StakingService.ts
→ test/unit/services/staking/StakingService.spec.ts
```

**Template:**

```typescript
// test/unit/services/staking/StakingService.spec.ts
import { StakingService } from '../../../src/services/staking/StakingService';
import { StakesDatabase } from '../../../src/lib/database/stakes-db';
import { Logger } from '../../../src/lib/logger';

describe('StakingService', () => {
  let service: StakingService;
  let mockDb: jest.Mocked<StakesDatabase>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    mockDb = {
      createStake: jest.fn(),
      getStake: jest.fn(),
    } as any;

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
    } as any;

    service = new StakingService(
      { minStakeAmount: '100' },
      mockDb,
      mockLogger
    );
  });

  describe('stake', () => {
    it('should create a stake successfully', async () => {
      const result = await service.stake('1000', 30);

      expect(mockDb.createStake).toHaveBeenCalled();
      expect(result.amount).toBe('1000');
    });

    it('should throw error for insufficient amount', async () => {
      await expect(service.stake('50', 30))
        .rejects
        .toThrow('Insufficient stake amount');
    });
  });
});
```

### Integration Tests

**Location:** `test/integration/[api|mcp]/`

**Test actual HTTP/MCP interactions:**

```typescript
// test/integration/api/staking-routes.spec.ts
import request from 'supertest';
import { app } from '../../../src/api/server';

describe('Staking API', () => {
  describe('POST /staking/stake', () => {
    it('should create a stake', async () => {
      const response = await request(app)
        .post('/staking/stake')
        .send({ amount: '1000', duration: 30 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.amount).toBe('1000');
    });
  });
});
```

---

## Common Patterns

### Async Operations

```typescript
// Always use async/await
async function performOperation(): Promise<Result> {
  const data = await fetchData();
  const processed = await processData(data);
  return processed;
}
```

### Logging

```typescript
// Log at service boundaries
async function importantOperation(params: Params): Promise<Result> {
  this.logger.info({ params }, 'Starting important operation');

  try {
    const result = await doWork(params);
    this.logger.info({ result }, 'Operation completed');
    return result;
  } catch (error) {
    this.logger.error({ error, params }, 'Operation failed');
    throw error;
  }
}
```

### Configuration

```typescript
// Use constants, not magic numbers
import { DEFAULT_TIMEOUT_MS, MAX_RETRIES } from '../../lib/config/constants';

async function fetchWithRetry() {
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      return await fetch(url, { timeout: DEFAULT_TIMEOUT_MS });
    } catch (error) {
      if (i === MAX_RETRIES - 1) throw error;
    }
  }
}
```

---

## Anti-Patterns to Avoid

### ❌ Business Logic in Controllers

```typescript
// BAD
class WalletController {
  async send(req: Request, res: Response) {
    // Don't do business logic here!
    const balance = await getBalance();
    if (balance < amount) {
      throw new Error('Insufficient funds');
    }
    const tx = await createTransaction();
    await sendToBlockchain(tx);
  }
}

// GOOD
class WalletController {
  async send(req: Request, res: Response) {
    // Just delegate to service
    const result = await this.walletService.send(req.body);
    res.json(result);
  }
}
```

### ❌ Direct Database Access from Controllers

```typescript
// BAD
class WalletController {
  async getTransactions(req: Request, res: Response) {
    const tx = await database.query('SELECT * FROM transactions');
    res.json(tx);
  }
}

// GOOD
class WalletController {
  async getTransactions(req: Request, res: Response) {
    const tx = await this.transactionService.getAll();
    res.json(tx);
  }
}
```

### ❌ God Classes

```typescript
// BAD - one class doing everything
class WalletService {
  sendFunds() {}
  getBalance() {}
  registerToken() {}
  sendToken() {}
  createDaoVote() {}
  registerInMarketplace() {}
  // ... 50 more methods
}

// GOOD - focused classes
class WalletService { /* wallet ops */ }
class TokenService { /* token ops */ }
class DaoService { /* dao ops */ }
```

---

## Checklist for New Features

Before committing new code, verify:

- [ ] Code is in the correct directory
- [ ] Service has single responsibility
- [ ] Dependencies injected via constructor
- [ ] Error handling with proper logging
- [ ] Input validation at boundaries (API/MCP)
- [ ] Unit tests written
- [ ] Integration tests (if applicable)
- [ ] Types defined in appropriate location
- [ ] No magic numbers (use constants)
- [ ] No duplicate business logic
- [ ] Follows existing naming conventions
- [ ] Documentation updated (if public API)

---

## Getting Help

**If you're unsure where code should go:**

1. Check existing similar features
2. Review this guide and STRUCTURE.md
3. Ask in team chat
4. When in doubt, prefer `src/services/` for business logic

**Remember:** It's easier to move code later than to fix tangled dependencies!
