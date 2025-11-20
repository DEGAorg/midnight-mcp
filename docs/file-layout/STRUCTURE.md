# Project Structure

Complete overview of the midnight-mcp-old folder structure after refactoring.

## High-Level Structure

```
midnight-mcp-old/
├── src/              # Source code
├── test/             # All tests
├── scripts/          # Utility scripts
├── docker/           # Docker configuration
├── docs/             # Documentation
├── .env.example      # Environment variables template
├── package.json      # Dependencies and scripts
└── tsconfig.json     # TypeScript configuration
```

## Detailed Source Structure

### Root: `src/`

```
src/
├── lib/              # Shared libraries and utilities
├── services/         # Business logic (domain services)
├── api/              # REST API (Express server)
├── mcp/              # MCP Server (STDIO)
├── contracts/        # Blockchain smart contracts
├── types/            # Shared TypeScript type definitions
├── audit/            # Audit trail system
└── index.ts          # Application entry point
```

---

## 1. Shared Libraries: `src/lib/`

Low-level utilities and infrastructure code that's used across the application.

```
src/lib/
├── config/           # Configuration management
│   ├── env.ts        # Environment variable loading & validation
│   ├── constants.ts  # Application constants (ports, timeouts, etc.)
│   └── wallet-config.ts  # Wallet-specific configuration
│
├── logger/           # Logging infrastructure
│   ├── index.ts      # Logger factory and exports
│   ├── pino-logger.ts    # Pino logger implementation
│   └── types.ts      # Logger type definitions
│
├── database/         # Database clients and connection management
│   ├── sqlite-client.ts      # SQLite connection setup
│   ├── transaction-db.ts     # Transaction database operations
│   └── token-registry-db.ts  # Token registry database
│
└── utils/            # General utilities
    ├── seed-manager.ts   # Seed generation and management
    ├── file-manager.ts   # File system operations
    ├── http-client.ts    # HTTP client utilities
    └── conversion.ts     # Type conversion utilities (BigInt, decimals)
```

**Purpose:** Infrastructure code that doesn't contain business logic. These are the building blocks.

**Guidelines:**
- ✅ Pure functions and utilities
- ✅ No business logic
- ✅ Highly reusable
- ✅ Well-tested
- ❌ No dependencies on services or API code

---

## 2. Business Logic: `src/services/`

Core business logic organized by domain. Each service handles operations for a specific domain.

```
src/services/
├── wallet/
│   ├── WalletService.ts      # Main wallet operations
│   ├── TransactionService.ts # Transaction tracking and management
│   ├── TokenService.ts       # Token operations (register, send, balance)
│   ├── types.ts              # Wallet domain types
│   └── errors.ts             # Custom wallet errors
│
├── marketplace/
│   ├── MarketplaceService.ts # Marketplace registration and verification
│   └── types.ts              # Marketplace domain types
│
└── dao/
    ├── DaoService.ts         # DAO operations (elections, voting)
    └── types.ts              # DAO domain types
```

**Purpose:** Business logic separated by domain. Services are classes that orchestrate operations.

**Service Pattern:**
```typescript
// services/wallet/WalletService.ts
export class WalletService {
  constructor(
    private config: WalletConfig,
    private transactionService: TransactionService,
    private logger: Logger
  ) {}

  async sendFunds(params: SendFundsParams): Promise<SendResult> {
    // Business logic here
  }
}
```

**Guidelines:**
- ✅ Use constructor injection for dependencies
- ✅ Single responsibility per service
- ✅ No inheritance (composition over inheritance)
- ✅ Domain-specific errors
- ❌ No direct HTTP/MCP handling (that's in api/mcp layers)
- ❌ No heavy abstractions (no ports/adapters unless needed)

---

## 3. REST API: `src/api/`

Express-based REST API for HTTP access to wallet functionality.

```
src/api/
├── server.ts         # Express app setup and startup
├── middleware/       # Express middleware
│   ├── error-handler.ts  # Global error handling
│   ├── validation.ts     # Request validation
│   ├── auth.ts           # Authentication (if needed)
│   └── logging.ts        # Request logging
│
├── routes/           # Route definitions
│   ├── index.ts      # Route aggregator (combines all routes)
│   ├── wallet.ts     # Wallet endpoints (/wallet/*)
│   ├── tokens.ts     # Token endpoints (/tokens/*)
│   ├── dao.ts        # DAO endpoints (/dao/*)
│   └── marketplace.ts    # Marketplace endpoints (/marketplace/*)
│
└── controllers/      # Request handlers
    ├── WalletController.ts
    ├── TokenController.ts
    └── DaoController.ts
```

**Purpose:** HTTP REST API layer. Thin controllers that call services.

**Pattern:**
```typescript
// api/routes/wallet.ts
import { Router } from 'express';
import { WalletController } from '../controllers/WalletController';

export function createWalletRoutes(controller: WalletController): Router {
  const router = Router();

  router.get('/status', controller.getStatus.bind(controller));
  router.post('/send', controller.sendFunds.bind(controller));

  return router;
}

// api/controllers/WalletController.ts
export class WalletController {
  constructor(private walletService: WalletService) {}

  async getStatus(req: Request, res: Response): Promise<void> {
    const status = await this.walletService.getStatus();
    res.json(status);
  }
}
```

**Guidelines:**
- ✅ Controllers are thin - just handle HTTP concerns
- ✅ Delegate to services for business logic
- ✅ Use middleware for cross-cutting concerns
- ✅ Validate input at the API boundary
- ❌ No business logic in controllers
- ❌ No direct database access

---

## 4. MCP Server: `src/mcp/`

MCP (Model Context Protocol) server for AI agent integration via STDIO.

```
src/mcp/
├── stdio-server.ts   # MCP server entry point and setup
├── tools/            # MCP tool definitions
│   ├── index.ts      # Tool registry
│   ├── wallet-tools.ts       # Wallet MCP tools
│   ├── token-tools.ts        # Token MCP tools
│   ├── dao-tools.ts          # DAO MCP tools
│   └── marketplace-tools.ts  # Marketplace MCP tools
│
└── handlers/         # Tool handlers (call services)
    ├── wallet-handler.ts
    ├── token-handler.ts
    └── dao-handler.ts
```

**Purpose:** MCP server that exposes tools for AI agents. Separate from REST API.

**Pattern:**
```typescript
// mcp/tools/wallet-tools.ts
import { z } from 'zod';

export const walletTools = [
  {
    name: 'wallet_status',
    description: 'Get wallet status and balance',
    inputSchema: z.object({}),
  },
  {
    name: 'wallet_send',
    description: 'Send funds to an address',
    inputSchema: z.object({
      to: z.string(),
      amount: z.string(),
      token: z.string().optional(),
    }),
  },
];

// mcp/handlers/wallet-handler.ts
export class WalletHandler {
  constructor(private walletService: WalletService) {}

  async handleWalletStatus(): Promise<McpResponse> {
    const status = await this.walletService.getStatus();
    return {
      content: [{ type: "text", text: JSON.stringify(status, null, 2) }]
    };
  }

  async handleWalletSend(args: { to: string; amount: string }): Promise<McpResponse> {
    const result = await this.walletService.sendFunds(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }
}
```

**Guidelines:**
- ✅ Tools are simple definitions (name, description, schema)
- ✅ Handlers delegate to services (no business logic)
- ✅ Direct service calls (no HTTP proxy)
- ✅ Use Zod for input validation
- ❌ No HTTP client calls
- ❌ No duplicate business logic

---

## 5. Smart Contracts: `src/contracts/`

Blockchain smart contract integrations (compiled contracts and wrappers).

```
src/contracts/
├── marketplace/
│   ├── compiled/     # Compiled contract files
│   │   ├── index.js      # Compiled JavaScript
│   │   ├── index.d.ts    # TypeScript definitions
│   │   └── managed/      # Managed resources
│   │       ├── election-nft.compact
│   │       ├── indexer.compact
│   │       └── marketplace.compact
│   │
│   └── api.ts    # Clean wrapper functions for contract interactions
│
└── dao/
    ├── compiled/     # Compiled DAO contract files
    │   ├── index.js
    │   ├── index.d.ts
    │   └── managed/
    │       └── dao.compact
    │
    └── api.ts    # DAO contract wrapper
```

**Purpose:** Smart contract artifacts and wrapper functions.

**Pattern:**
```typescript
// contracts/marketplace/wrapper.ts
import * as contract from './compiled/index.js';

export async function registerInMarketplace(
  wallet: Wallet,
  params: RegisterParams
): Promise<TransactionResult> {
  const tx = await contract.registerUser(wallet, params);
  return tx;
}

export async function verifyInMarketplace(
  wallet: Wallet,
  address: string
): Promise<boolean> {
  const result = await contract.verifyUser(wallet, address);
  return result;
}
```

**Guidelines:**
- ✅ Keep compiled files in `compiled/` subdirectory
- ✅ Create clean wrapper functions
- ✅ Type-safe wrappers
- ❌ No business logic in wrappers
- ❌ Don't modify compiled files

---

## 6. Shared Types: `src/types/`

TypeScript type definitions used across multiple modules.

```
src/types/
├── wallet.ts         # Wallet-related types
├── transaction.ts    # Transaction types
├── token.ts          # Token types
├── api.ts            # API request/response types
└── mcp.ts            # MCP tool types
```

**Purpose:** Shared TypeScript interfaces and types.

**Example:**
```typescript
// types/wallet.ts
export interface WalletBalance {
  address: string;
  balance: string;
  tokens: TokenBalance[];
}

export interface TokenBalance {
  name: string;
  symbol: string;
  balance: string;
  decimals: number;
}

export interface SendFundsParams {
  to: string;
  amount: string;
  token?: string;
}

export interface SendResult {
  transactionId: string;
  status: 'pending' | 'sent' | 'completed' | 'failed';
  message?: string;
}
```

**Guidelines:**
- ✅ Pure type definitions only
- ✅ No implementation code
- ✅ Document complex types
- ✅ Use consistent naming (interfaces with 'I' prefix or not - pick one)
- ❌ No business logic
- ❌ No default exports (use named exports)

---

## 7. Audit System: `src/audit/`

Audit trail system for compliance and tracking (minimal changes from original).

```
src/audit/
├── index.ts                      # Main exports
├── audit-trail-service.ts        # Audit trail service
├── transaction-trace-logger.ts   # Transaction tracing
└── types.ts                      # Audit types
```

**Purpose:** Audit and compliance tracking.

**Guidelines:**
- ✅ Keep mostly as-is (working well)
- ✅ Integrate with logger
- ❌ Don't over-engineer

---

## 8. Application Entry: `src/index.ts`

Main application entry point that starts servers.

```typescript
// src/index.ts
import { createApiServer } from './api/server';
import { createMcpServer } from './mcp/stdio-server';
import { AppConfig } from './lib/config/env';
import { createLogger } from './lib/logger';

async function main() {
  const config = AppConfig.load();
  const logger = createLogger('main');

  // Initialize services
  const services = await initializeServices(config, logger);

  // Start API server (if enabled)
  if (config.enableApi) {
    const apiServer = createApiServer(services);
    apiServer.listen(config.apiPort);
    logger.info(`API server listening on port ${config.apiPort}`);
  }

  // Start MCP server (if enabled)
  if (config.enableMcp) {
    const mcpServer = createMcpServer(services);
    await mcpServer.start();
    logger.info('MCP server started on STDIO');
  }
}

main().catch(console.error);
```

---

## Test Structure

```
test/
├── unit/             # Unit tests (isolated, mocked dependencies)
│   ├── services/
│   │   ├── wallet/
│   │   │   ├── WalletService.spec.ts
│   │   │   ├── TransactionService.spec.ts
│   │   │   └── TokenService.spec.ts
│   │   ├── marketplace/
│   │   │   └── MarketplaceService.spec.ts
│   │   └── dao/
│   │       └── DaoService.spec.ts
│   │
│   ├── lib/
│   │   ├── config/
│   │   │   └── env.spec.ts
│   │   └── utils/
│   │       └── conversion.spec.ts
│   │
│   └── api/
│       └── controllers/
│           └── WalletController.spec.ts
│
├── integration/      # Integration tests (real dependencies)
│   ├── api/
│   │   ├── wallet-routes.spec.ts
│   │   └── token-routes.spec.ts
│   │
│   └── mcp/
│       ├── wallet-tools.spec.ts
│       └── token-tools.spec.ts
│
└── e2e/              # End-to-end tests (full flow)
    └── full-flow.spec.ts
```

**Test Naming Convention:**
- Unit tests: `[FileName].spec.ts`
- Integration tests: `[feature]-[type].spec.ts`
- E2E tests: `[flow-name].spec.ts`

---

## Scripts

```
scripts/
├── setup-agent.ts        # Agent initialization script
├── setup-docker.ts       # Docker environment setup
└── generate-seed.ts      # Seed generation utility
```

**Purpose:** Utility scripts for development and deployment.

---

## Docker

```
docker/
├── docker-compose.yml        # Production compose file
├── docker-compose.dev.yml    # Development compose file
└── Dockerfile                # Container image definition
```

**Note:** May move docker files to root later if preferred.

---

## Documentation

```
docs/
├── file-layout/          # This directory
│   ├── README.md
│   ├── STRUCTURE.md      # This file
│   ├── GUIDELINES.md
│   ├── MIGRATION.md
│   └── EXAMPLES.md
│
├── ARCHITECTURE.md       # Architecture overview
├── API.md               # API documentation
└── MCP.md               # MCP tools documentation
```

---

## Configuration Files (Root)

```
midnight-mcp-old/
├── .env.example          # Environment variables template
├── .gitignore           # Git ignore rules
├── package.json         # Dependencies and npm scripts
├── pnpm-lock.yaml       # Lockfile (using pnpm)
├── tsconfig.json        # TypeScript configuration
├── jest.config.js       # Jest test configuration
├── eslint.config.mjs    # ESLint configuration
└── README.md            # Project README
```

---

## Key Principles

1. **Separation of Concerns**
   - API, MCP, and Services are separate
   - Each has clear responsibility

2. **Single Source of Truth**
   - Services contain business logic
   - API and MCP are thin layers

3. **Dependency Flow**
   ```
   API/MCP → Services → lib/database, lib/utils
   ```

4. **No Circular Dependencies**
   - lib/ never imports from services/
   - services/ never import from api/ or mcp/
   - api/ and mcp/ never import from each other

5. **Testability**
   - Services are easy to unit test (mock dependencies)
   - API/MCP can be integration tested
   - Full flows tested in e2e

---

## What Goes Where?

| Type of Code | Location | Example |
|-------------|----------|---------|
| Business logic | `src/services/` | Calculate transaction fee |
| Database operations | `src/lib/database/` | Query transactions table |
| HTTP endpoints | `src/api/routes/` | `GET /wallet/status` |
| MCP tools | `src/mcp/tools/` | `wallet_status` tool |
| Configuration | `src/lib/config/` | Load environment variables |
| Utilities | `src/lib/utils/` | Convert BigInt to decimal |
| Type definitions | `src/types/` | Interface definitions |
| Smart contracts | `src/contracts/` | Contract wrappers |
| Tests | `test/` | All tests |
| Scripts | `scripts/` | Setup utilities |

---

## Anti-Patterns to Avoid

❌ **Don't:**
- Put business logic in controllers or handlers
- Create god classes (1000+ lines)
- Use deep folder nesting (3+ levels)
- Create circular dependencies
- Mix API and MCP concerns
- Add unnecessary abstraction layers

✅ **Do:**
- Keep services focused (single responsibility)
- Use dependency injection
- Keep controllers/handlers thin
- Test each layer independently
- Document complex code
- Follow existing patterns

---

## Next Steps

See:
- [GUIDELINES.md](./GUIDELINES.md) - Detailed guidelines for adding new code
- [MIGRATION.md](./MIGRATION.md) - How to migrate from old to new structure
- [EXAMPLES.md](./EXAMPLES.md) - Real-world examples
