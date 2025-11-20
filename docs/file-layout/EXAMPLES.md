# Real-World Examples

Practical examples showing how the file structure is used in real scenarios.

## Example 1: Adding Staking Feature

Let's walk through adding a complete staking feature to the application.

### Step 1: Create Service Layer

```typescript
// src/services/staking/types.ts
export interface StakingConfig {
  minStakeAmount: string;
  minStakeDuration: number; // days
  maxStakeDuration: number; // days
  rewardRate: number; // APY percentage
}

export interface StakeParams {
  amount: string;
  duration: number; // days
}

export interface Stake {
  id: string;
  agentId: string;
  amount: string;
  startTime: number;
  endTime: number;
  status: StakeStatus;
  rewards: string;
  createdAt: number;
}

export type StakeStatus = 'active' | 'completed' | 'withdrawn';

export interface StakeResult {
  stakeId: string;
  amount: string;
  duration: number;
  estimatedRewards: string;
  startTime: number;
  endTime: number;
}
```

```typescript
// src/services/staking/errors.ts
export class StakingError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'StakingError';
  }
}

export class InsufficientStakeAmountError extends StakingError {
  constructor(required: string, provided: string) {
    super(
      `Stake amount too low. Required: ${required}, Provided: ${provided}`,
      'INSUFFICIENT_STAKE_AMOUNT',
      { required, provided }
    );
  }
}

export class InvalidStakeDurationError extends StakingError {
  constructor(min: number, max: number, provided: number) {
    super(
      `Invalid duration. Must be between ${min} and ${max} days. Provided: ${provided}`,
      'INVALID_STAKE_DURATION',
      { min, max, provided }
    );
  }
}
```

```typescript
// src/services/staking/StakingService.ts
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../../lib/logger';
import { WalletService } from '../wallet/WalletService';
import { StakesDatabase } from '../../lib/database/stakes-db';
import {
  StakingConfig,
  StakeParams,
  Stake,
  StakeResult,
  StakeStatus,
} from './types';
import {
  InsufficientStakeAmountError,
  InvalidStakeDurationError,
} from './errors';

export class StakingService {
  constructor(
    private config: StakingConfig,
    private walletService: WalletService,
    private stakesDb: StakesDatabase,
    private logger: Logger
  ) {}

  async createStake(
    agentId: string,
    params: StakeParams
  ): Promise<StakeResult> {
    this.logger.info({ agentId, params }, 'Creating stake');

    // Validate amount
    const amountBigInt = BigInt(params.amount);
    const minAmount = BigInt(this.config.minStakeAmount);

    if (amountBigInt < minAmount) {
      throw new InsufficientStakeAmountError(
        this.config.minStakeAmount,
        params.amount
      );
    }

    // Validate duration
    if (
      params.duration < this.config.minStakeDuration ||
      params.duration > this.config.maxStakeDuration
    ) {
      throw new InvalidStakeDurationError(
        this.config.minStakeDuration,
        this.config.maxStakeDuration,
        params.duration
      );
    }

    // Check wallet balance
    const balance = await this.walletService.getBalance();
    if (BigInt(balance.balance) < amountBigInt) {
      throw new InsufficientStakeAmountError(balance.balance, params.amount);
    }

    // Create stake record
    const now = Date.now();
    const endTime = now + params.duration * 24 * 60 * 60 * 1000;
    const estimatedRewards = this.calculateRewards(
      params.amount,
      params.duration
    );

    const stake: Stake = {
      id: uuidv4(),
      agentId,
      amount: params.amount,
      startTime: now,
      endTime,
      status: 'active',
      rewards: estimatedRewards,
      createdAt: now,
    };

    // Save to database
    this.stakesDb.createStake(stake);

    // TODO: Lock funds on blockchain

    this.logger.info({ stakeId: stake.id }, 'Stake created successfully');

    return {
      stakeId: stake.id,
      amount: stake.amount,
      duration: params.duration,
      estimatedRewards,
      startTime: stake.startTime,
      endTime: stake.endTime,
    };
  }

  async getStake(stakeId: string): Promise<Stake | null> {
    return this.stakesDb.getStake(stakeId);
  }

  async getAgentStakes(agentId: string): Promise<Stake[]> {
    return this.stakesDb.getStakesByAgent(agentId);
  }

  async withdrawStake(stakeId: string): Promise<void> {
    const stake = await this.getStake(stakeId);

    if (!stake) {
      throw new Error('Stake not found');
    }

    if (stake.status !== 'active') {
      throw new Error('Stake is not active');
    }

    const now = Date.now();
    if (now < stake.endTime) {
      throw new Error('Stake period not completed');
    }

    // Update status
    this.stakesDb.updateStakeStatus(stakeId, 'withdrawn');

    // TODO: Unlock funds on blockchain + send rewards

    this.logger.info({ stakeId }, 'Stake withdrawn successfully');
  }

  private calculateRewards(amount: string, durationDays: number): string {
    const principal = BigInt(amount);
    const rate = this.config.rewardRate / 100; // Convert percentage
    const yearDays = 365;

    // Simple interest: P * R * T
    const rewards =
      (Number(principal) * rate * durationDays) / yearDays;

    return BigInt(Math.floor(rewards)).toString();
  }
}
```

### Step 2: Create Database Layer

```typescript
// src/lib/database/stakes-db.ts
import Database from 'better-sqlite3';
import { Logger } from '../logger';
import { Stake, StakeStatus } from '../../services/staking/types';

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
        rewards TEXT NOT NULL,
        createdAt INTEGER NOT NULL
      )
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_stakes_agentId
      ON stakes(agentId)
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_stakes_status
      ON stakes(status)
    `);

    this.logger.info('Stakes database initialized');
  }

  createStake(stake: Stake): void {
    const stmt = this.db.prepare(`
      INSERT INTO stakes (id, agentId, amount, startTime, endTime, status, rewards, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      stake.id,
      stake.agentId,
      stake.amount,
      stake.startTime,
      stake.endTime,
      stake.status,
      stake.rewards,
      stake.createdAt
    );

    this.logger.debug({ stakeId: stake.id }, 'Stake record created');
  }

  getStake(id: string): Stake | null {
    const stmt = this.db.prepare('SELECT * FROM stakes WHERE id = ?');
    const row = stmt.get(id) as Stake | undefined;
    return row || null;
  }

  getStakesByAgent(agentId: string): Stake[] {
    const stmt = this.db.prepare('SELECT * FROM stakes WHERE agentId = ?');
    return stmt.all(agentId) as Stake[];
  }

  getStakesByStatus(status: StakeStatus): Stake[] {
    const stmt = this.db.prepare('SELECT * FROM stakes WHERE status = ?');
    return stmt.all(status) as Stake[];
  }

  updateStakeStatus(id: string, status: StakeStatus): void {
    const stmt = this.db.prepare('UPDATE stakes SET status = ? WHERE id = ?');
    stmt.run(status, id);
    this.logger.debug({ stakeId: id, status }, 'Stake status updated');
  }

  close(): void {
    this.db.close();
  }
}
```

### Step 3: Add API Endpoints

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

  async createStake(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { amount, duration } = req.body;
      const agentId = req.headers['x-agent-id'] as string;

      // Validation
      if (!amount || !duration) {
        res.status(400).json({
          success: false,
          error: 'Missing required parameters: amount, duration',
        });
        return;
      }

      if (!agentId) {
        res.status(401).json({
          success: false,
          error: 'Missing agent ID',
        });
        return;
      }

      // Create stake
      const result = await this.stakingService.createStake(agentId, {
        amount,
        duration,
      });

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      this.logger.error({ error }, 'Create stake failed');
      next(error);
    }
  }

  async getStakes(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const agentId = req.headers['x-agent-id'] as string;

      if (!agentId) {
        res.status(401).json({
          success: false,
          error: 'Missing agent ID',
        });
        return;
      }

      const stakes = await this.stakingService.getAgentStakes(agentId);

      res.json({
        success: true,
        data: stakes,
      });
    } catch (error) {
      next(error);
    }
  }

  async getStake(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { stakeId } = req.params;

      const stake = await this.stakingService.getStake(stakeId);

      if (!stake) {
        res.status(404).json({
          success: false,
          error: 'Stake not found',
        });
        return;
      }

      res.json({
        success: true,
        data: stake,
      });
    } catch (error) {
      next(error);
    }
  }

  async withdrawStake(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { stakeId } = req.params;

      await this.stakingService.withdrawStake(stakeId);

      res.json({
        success: true,
        message: 'Stake withdrawn successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}
```

```typescript
// src/api/routes/staking.ts
import { Router } from 'express';
import { StakingController } from '../controllers/StakingController';

export function createStakingRoutes(controller: StakingController): Router {
  const router = Router();

  router.post('/stake', controller.createStake.bind(controller));
  router.get('/stakes', controller.getStakes.bind(controller));
  router.get('/stakes/:stakeId', controller.getStake.bind(controller));
  router.post('/stakes/:stakeId/withdraw', controller.withdrawStake.bind(controller));

  return router;
}
```

```typescript
// src/api/routes/index.ts
import { Router } from 'express';
import { createWalletRoutes } from './wallet';
import { createStakingRoutes } from './staking';
import { Services } from '../../types/services';
import { StakingController } from '../controllers/StakingController';

export function createRoutes(services: Services): Router {
  const router = Router();

  const walletController = new WalletController(services.walletService);
  const stakingController = new StakingController(
    services.stakingService,
    services.logger
  );

  router.use('/wallet', createWalletRoutes(walletController));
  router.use('/staking', createStakingRoutes(stakingController));

  return router;
}
```

### Step 4: Add MCP Tools

```typescript
// src/mcp/tools/staking-tools.ts
import { z } from 'zod';

export const stakingTools = [
  {
    name: 'staking_create',
    description: 'Create a new stake with specified amount and duration',
    inputSchema: z.object({
      amount: z.string().describe('Amount to stake (in smallest unit)'),
      duration: z
        .number()
        .int()
        .min(1)
        .describe('Staking duration in days (1-365)'),
    }),
  },
  {
    name: 'staking_list',
    description: 'List all stakes for the current agent',
    inputSchema: z.object({}),
  },
  {
    name: 'staking_get',
    description: 'Get details of a specific stake',
    inputSchema: z.object({
      stakeId: z.string().describe('ID of the stake to retrieve'),
    }),
  },
  {
    name: 'staking_withdraw',
    description: 'Withdraw a completed stake and claim rewards',
    inputSchema: z.object({
      stakeId: z.string().describe('ID of the stake to withdraw'),
    }),
  },
];
```

```typescript
// src/mcp/handlers/staking-handler.ts
import { StakingService } from '../../services/staking/StakingService';
import { Logger } from '../../lib/logger';

interface McpResponse {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

export class StakingHandler {
  constructor(
    private stakingService: StakingService,
    private agentId: string,
    private logger: Logger
  ) {}

  async handleCreate(args: {
    amount: string;
    duration: number;
  }): Promise<McpResponse> {
    this.logger.info({ args }, 'MCP: staking_create called');

    try {
      const result = await this.stakingService.createStake(this.agentId, {
        amount: args.amount,
        duration: args.duration,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                message: 'Stake created successfully',
                data: result,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      this.logger.error({ error, args }, 'MCP: staking_create failed');

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
              },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }
  }

  async handleList(): Promise<McpResponse> {
    this.logger.info('MCP: staking_list called');

    try {
      const stakes = await this.stakingService.getAgentStakes(this.agentId);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                count: stakes.length,
                data: stakes,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      this.logger.error({ error }, 'MCP: staking_list failed');

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
              },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }
  }

  async handleGet(args: { stakeId: string }): Promise<McpResponse> {
    this.logger.info({ args }, 'MCP: staking_get called');

    try {
      const stake = await this.stakingService.getStake(args.stakeId);

      if (!stake) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: false,
                  error: 'Stake not found',
                },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                data: stake,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
              },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }
  }

  async handleWithdraw(args: { stakeId: string }): Promise<McpResponse> {
    this.logger.info({ args }, 'MCP: staking_withdraw called');

    try {
      await this.stakingService.withdrawStake(args.stakeId);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                message: 'Stake withdrawn successfully',
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
              },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }
  }
}
```

### Step 5: Write Tests

```typescript
// test/unit/services/staking/StakingService.spec.ts
import { StakingService } from '../../../../src/services/staking/StakingService';
import { WalletService } from '../../../../src/services/wallet/WalletService';
import { StakesDatabase } from '../../../../src/lib/database/stakes-db';
import { Logger } from '../../../../src/lib/logger';
import {
  InsufficientStakeAmountError,
  InvalidStakeDurationError,
} from '../../../../src/services/staking/errors';

describe('StakingService', () => {
  let stakingService: StakingService;
  let mockWalletService: jest.Mocked<WalletService>;
  let mockStakesDb: jest.Mocked<StakesDatabase>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    mockWalletService = {
      getBalance: jest.fn(),
    } as any;

    mockStakesDb = {
      createStake: jest.fn(),
      getStake: jest.fn(),
      getStakesByAgent: jest.fn(),
      updateStakeStatus: jest.fn(),
    } as any;

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as any;

    stakingService = new StakingService(
      {
        minStakeAmount: '1000',
        minStakeDuration: 7,
        maxStakeDuration: 365,
        rewardRate: 10, // 10% APY
      },
      mockWalletService,
      mockStakesDb,
      mockLogger
    );
  });

  describe('createStake', () => {
    it('should create a stake successfully', async () => {
      mockWalletService.getBalance.mockResolvedValue({
        address: 'test-address',
        balance: '10000',
        tokens: [],
      });

      const result = await stakingService.createStake('agent-123', {
        amount: '5000',
        duration: 30,
      });

      expect(result.amount).toBe('5000');
      expect(result.duration).toBe(30);
      expect(mockStakesDb.createStake).toHaveBeenCalled();
    });

    it('should throw error for insufficient stake amount', async () => {
      await expect(
        stakingService.createStake('agent-123', {
          amount: '500', // Less than minimum 1000
          duration: 30,
        })
      ).rejects.toThrow(InsufficientStakeAmountError);
    });

    it('should throw error for invalid duration', async () => {
      await expect(
        stakingService.createStake('agent-123', {
          amount: '5000',
          duration: 400, // More than max 365
        })
      ).rejects.toThrow(InvalidStakeDurationError);
    });

    it('should throw error for insufficient balance', async () => {
      mockWalletService.getBalance.mockResolvedValue({
        address: 'test-address',
        balance: '1000', // Less than stake amount
        tokens: [],
      });

      await expect(
        stakingService.createStake('agent-123', {
          amount: '5000',
          duration: 30,
        })
      ).rejects.toThrow();
    });
  });

  describe('getAgentStakes', () => {
    it('should return all stakes for an agent', async () => {
      const mockStakes = [
        { id: 'stake-1', agentId: 'agent-123', amount: '1000', status: 'active' },
        { id: 'stake-2', agentId: 'agent-123', amount: '2000', status: 'active' },
      ];

      mockStakesDb.getStakesByAgent.mockReturnValue(mockStakes as any);

      const stakes = await stakingService.getAgentStakes('agent-123');

      expect(stakes).toHaveLength(2);
      expect(mockStakesDb.getStakesByAgent).toHaveBeenCalledWith('agent-123');
    });
  });

  describe('withdrawStake', () => {
    it('should withdraw a completed stake', async () => {
      const pastDate = Date.now() - 1000; // Past end time
      const mockStake = {
        id: 'stake-1',
        agentId: 'agent-123',
        amount: '5000',
        startTime: pastDate - 30 * 24 * 60 * 60 * 1000,
        endTime: pastDate,
        status: 'active' as const,
        rewards: '410',
        createdAt: pastDate - 30 * 24 * 60 * 60 * 1000,
      };

      mockStakesDb.getStake.mockReturnValue(mockStake);

      await stakingService.withdrawStake('stake-1');

      expect(mockStakesDb.updateStakeStatus).toHaveBeenCalledWith(
        'stake-1',
        'withdrawn'
      );
    });

    it('should throw error for non-existent stake', async () => {
      mockStakesDb.getStake.mockReturnValue(null);

      await expect(stakingService.withdrawStake('non-existent')).rejects.toThrow(
        'Stake not found'
      );
    });

    it('should throw error for incomplete stake period', async () => {
      const futureDate = Date.now() + 1000000; // Future end time
      const mockStake = {
        id: 'stake-1',
        agentId: 'agent-123',
        amount: '5000',
        startTime: Date.now(),
        endTime: futureDate,
        status: 'active' as const,
        rewards: '410',
        createdAt: Date.now(),
      };

      mockStakesDb.getStake.mockReturnValue(mockStake);

      await expect(stakingService.withdrawStake('stake-1')).rejects.toThrow(
        'Stake period not completed'
      );
    });
  });
});
```

---

## Example 2: Project Structure in Action

Let's look at how a typical request flows through the application.

### Scenario: User calls `POST /api/staking/stake` to create a stake

**Request Flow:**

```
1. HTTP Request → Express Server
   ↓
2. Middleware (logging, validation)
   ↓
3. Router (src/api/routes/staking.ts)
   ↓
4. Controller (src/api/controllers/StakingController.ts)
   ↓
5. Service (src/services/staking/StakingService.ts)
   ├─→ WalletService (check balance)
   └─→ StakesDatabase (save stake)
   ↓
6. Response back up the chain
```

**Files Involved:**

```
src/api/server.ts
  └─ src/api/middleware/logging.ts
  └─ src/api/routes/index.ts
      └─ src/api/routes/staking.ts
          └─ src/api/controllers/StakingController.ts
              └─ src/services/staking/StakingService.ts
                  ├─ src/services/wallet/WalletService.ts
                  └─ src/lib/database/stakes-db.ts
```

**Code Trace:**

```typescript
// 1. Server receives request
// src/api/server.ts
app.use('/api', createRoutes(services));

// 2. Router matches path
// src/api/routes/index.ts
router.use('/staking', createStakingRoutes(stakingController));

// 3. Route handler
// src/api/routes/staking.ts
router.post('/stake', controller.createStake.bind(controller));

// 4. Controller validates and delegates
// src/api/controllers/StakingController.ts
const result = await this.stakingService.createStake(agentId, {
  amount,
  duration,
});

// 5. Service performs business logic
// src/services/staking/StakingService.ts
const balance = await this.walletService.getBalance();
// ... validation logic
this.stakesDb.createStake(stake);

// 6. Database persists data
// src/lib/database/stakes-db.ts
stmt.run(stake.id, stake.agentId, ...);
```

---

## Example 3: MCP Tool Call Flow

### Scenario: AI agent calls `staking_create` tool

**Request Flow:**

```
1. MCP STDIO Input
   ↓
2. MCP Server (src/mcp/stdio-server.ts)
   ↓
3. Tool Router
   ↓
4. Handler (src/mcp/handlers/staking-handler.ts)
   ↓
5. Service (src/services/staking/StakingService.ts)
   ↓
6. Database + Wallet Service
   ↓
7. MCP Response
```

**Notice:** The service layer is the same for both API and MCP - no duplication!

---

## Example 4: Testing Strategy

### Unit Test Example

```typescript
// test/unit/services/staking/StakingService.spec.ts

// Mock all dependencies
const mockWalletService = {
  getBalance: jest.fn(),
};

const mockStakesDb = {
  createStake: jest.fn(),
};

// Test service in isolation
const service = new StakingService(
  config,
  mockWalletService,
  mockStakesDb,
  mockLogger
);

// Test specific behavior
it('should validate minimum stake amount', async () => {
  await expect(
    service.createStake('agent-1', { amount: '10', duration: 30 })
  ).rejects.toThrow(InsufficientStakeAmountError);
});
```

### Integration Test Example

```typescript
// test/integration/api/staking-routes.spec.ts

// Use real HTTP server and database
import request from 'supertest';
import { app } from '../../../src/api/server';

it('should create a stake via API', async () => {
  const response = await request(app)
    .post('/api/staking/stake')
    .set('x-agent-id', 'test-agent')
    .send({ amount: '5000', duration: 30 })
    .expect(201);

  expect(response.body.success).toBe(true);
  expect(response.body.data.stakeId).toBeDefined();
});
```

---

## Example 5: Adding Configuration

### Adding a New Configuration Value

```typescript
// src/lib/config/constants.ts
export const STAKING_CONFIG = {
  MIN_STAKE_AMOUNT: '1000',
  MIN_DURATION_DAYS: 7,
  MAX_DURATION_DAYS: 365,
  DEFAULT_REWARD_RATE: 10, // 10% APY
  EARLY_WITHDRAWAL_PENALTY: 0.1, // 10% penalty
} as const;
```

```typescript
// src/lib/config/env.ts
const ConfigSchema = z.object({
  // ... existing config
  STAKING_MIN_AMOUNT: z.string().default('1000'),
  STAKING_REWARD_RATE: z.number().default(10),
});
```

**Usage:**

```typescript
import { STAKING_CONFIG } from '../../lib/config/constants';

// In service
if (amountBigInt < BigInt(STAKING_CONFIG.MIN_STAKE_AMOUNT)) {
  throw new Error('Amount too low');
}
```

---

## Summary

This examples document shows:

1. **Complete feature implementation** (Staking)
2. **File organization** in practice
3. **Request flows** (API and MCP)
4. **Testing strategies** at different levels
5. **Configuration management**

**Key Takeaways:**

- Services contain business logic
- API and MCP are thin layers over services
- Database operations are isolated
- Tests are organized by type (unit, integration, e2e)
- Configuration is centralized

**When adding new features, follow these examples!**
