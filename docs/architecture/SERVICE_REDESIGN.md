# Service Layer Redesign Proposal

## Executive Summary

After analyzing the current `src/wallet/` implementation (1,792 lines in WalletManager), this document proposes a clean service layer architecture that:

1. **Eliminates** the `src/wallet/` directory entirely
2. **Redesigns** services based on understanding actual implementation patterns
3. **Maintains** all functionality while improving maintainability
4. **Separates** concerns properly (wallet ops, transactions, tokens, marketplace, DAO)

## Current State Analysis

### What We Learned from src/wallet/

**WalletManager (1,792 lines)** contains:
- 38 public methods across 5 domains
- Direct Midnight SDK integration (@midnight-ntwrk/wallet)
- Transaction database management
- Token registry management
- Contract orchestration (DAO, Marketplace)

**Key Implementation Patterns**:
1. Wallet lifecycle: `start()` → state management → `close()`
2. Transaction tracking: Database + wallet state coordination
3. Token operations: ShieldedTokenManager + TokenRegistryDatabase
4. DAO/Marketplace: Contract state as source of truth
5. Error handling: Custom errors with retry logic

### What We're Deleting

```
src/wallet/
├── index.ts (1,792 lines - WalletManager)
├── shielded-tokens.ts (ShieldedTokenManager)
├── dao.ts (DaoService)
├── marketplace.ts (MarketplaceService)
└── db/ (Moved to src/lib/database/)
```

All of the above will be **DELETED** after redesign is complete.

## New Service Architecture

### Core Principles

1. **Single Responsibility**: Each service handles one domain
2. **Constructor Injection**: Dependencies passed explicitly
3. **No God Classes**: Largest service ~400 lines max
4. **SDK Encapsulation**: Only WalletService directly uses Midnight SDK
5. **Clean APIs**: Method signatures match actual usage patterns

### Service Hierarchy

```
┌─────────────────────────────────────────┐
│         WalletServiceMCP (MCP)          │
│  (Orchestrator for MCP tool handlers)   │
└──────────────┬──────────────────────────┘
               │
               │ delegates to
               │
┌──────────────▼──────────────────────────┐
│         WalletOrchestrator              │
│  (Coordinates multiple services)         │
└──┬───┬───┬───┬───┬──────────────────────┘
   │   │   │   │   │
   │   │   │   │   └─────────────┐
   │   │   │   │                 │
   ▼   ▼   ▼   ▼   ▼             ▼
┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────────┐
│Wlt │ │Txn │ │Tkn │ │Mkt │ │  DAO   │
└────┘ └────┘ └────┘ └────┘ └────────┘
```

## Service API Definitions

### 1. WalletService (Core Wallet Operations)

**Responsibility**: Direct Midnight SDK integration, wallet lifecycle, basic operations

```typescript
// src/services/wallet/WalletService.ts

import { Wallet } from '@midnight-ntwrk/wallet-api';
import { NetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import type { WalletState } from '@midnight-ntwrk/ledger';

export interface WalletConfig {
  networkId: NetworkId;
  seed: Uint8Array;
  walletFilename: string;
  useExternalProofServer: boolean;
  proofServer?: string;
  indexer?: string;
  indexerWS?: string;
  node?: string;
}

export class WalletService {
  private wallet: Wallet | null = null;
  private walletState: WalletState | null = null;

  constructor(private config: WalletConfig) {}

  // Lifecycle
  async start(): Promise<void>;
  async close(): Promise<void>;
  isReady(): boolean;

  // State Access
  getState(): WalletState;
  getWallet(): Wallet;

  // Basic Operations
  getAddress(): string;
  getBalance(): bigint;

  // Private helpers for SDK integration
  private createProviders(): Promise<Providers>;
  private initializeWallet(): Promise<Wallet>;
  private setupStateSubscription(): void;
}
```

**Key Design Decisions**:
- Encapsulates ALL Midnight SDK interaction
- Exposes `getWallet()` for advanced operations (used by other services)
- Maintains wallet state subscription internally
- No transaction/token logic here

---

### 2. TransactionService (Transaction Management)

**Responsibility**: Transaction submission, tracking, status queries, database coordination

```typescript
// src/services/wallet/TransactionService.ts

import { Wallet } from '@midnight-ntwrk/wallet-api';
import { TransactionDatabase } from '../../lib/database/transaction-db.js';
import type { TransactionId } from '@midnight-ntwrk/ledger';

export interface TransactionRecord {
  transactionId: string;
  blockHeight: bigint | null;
  status: 'pending' | 'confirmed' | 'failed';
  timestamp: number;
  from: string;
  to: string;
  amount: bigint;
  type: 'send' | 'receive' | 'token_transfer' | 'contract_call';
  metadata?: Record<string, any>;
}

export interface SendFundsParams {
  recipientAddress: string;
  amount: bigint;
}

export interface SendFundsResult {
  transactionId: string;
  blockHeight: bigint;
  success: boolean;
}

export class TransactionService {
  constructor(
    private wallet: Wallet,
    private transactionDb: TransactionDatabase
  ) {}

  // Transaction Submission
  async sendFunds(params: SendFundsParams): Promise<SendFundsResult>;
  async initiateSendFunds(params: SendFundsParams): Promise<SendFundsResult>;

  // Transaction Queries
  async getTransactionStatus(txId: string): Promise<TransactionRecord | null>;
  async getTransactions(limit?: number, offset?: number): Promise<TransactionRecord[]>;
  async getPendingTransactions(): Promise<TransactionRecord[]>;

  // Verification
  async verifyTransactionIdentifier(txId: string, identifier: string): Promise<boolean>;

  // Database Sync
  private async recordTransaction(tx: TransactionRecord): Promise<void>;
  private async updateTransactionStatus(txId: string, status: string, blockHeight?: bigint): Promise<void>;
}
```

**Key Design Decisions**:
- Takes `Wallet` instance (from WalletService) as dependency
- Coordinates wallet operations + database persistence
- Returns simplified transaction records (not raw SDK types)
- Handles both immediate (`sendFunds`) and deferred (`initiateSendFunds`) operations

---

### 3. TokenService (Token Operations)

**Responsibility**: Token registration, balance queries, token transfers

```typescript
// src/services/wallet/TokenService.ts

import { Wallet } from '@midnight-ntwrk/wallet-api';
import { TokenRegistryDatabase, TokenInfo } from '../../lib/database/token-registry-db.js';
import type { ContractAddress } from '@midnight-ntwrk/compact-runtime';

export interface RegisterTokenParams {
  contractAddress: string;
  name: string;
  symbol: string;
  decimals: number;
}

export interface SendTokenParams {
  tokenContractAddress: string;
  recipientAddress: string;
  amount: bigint;
}

export interface TokenBalance {
  tokenName: string;
  symbol: string;
  balance: bigint;
  decimals: number;
  contractAddress: string;
}

export class TokenService {
  constructor(
    private wallet: Wallet,
    private tokenDb: TokenRegistryDatabase
  ) {}

  // Token Registration
  async registerToken(params: RegisterTokenParams): Promise<TokenInfo>;
  async registerTokensBatch(tokens: RegisterTokenParams[]): Promise<TokenInfo[]>;
  async listWalletTokens(): Promise<TokenInfo[]>;

  // Token Operations
  async getTokenBalance(tokenName: string): Promise<bigint>;
  async sendToken(params: SendTokenParams): Promise<string>; // returns txId

  // Token Discovery
  async getTokenInfo(contractAddress: string): Promise<TokenInfo | null>;

  // Private helpers
  private deriveTokenType(contractAddress: ContractAddress): Uint8Array;
  private createTokenCoin(tokenType: Uint8Array, amount: bigint): CoinInfo;
}
```

**Key Design Decisions**:
- No smart contract for balance/send (uses wallet coin management directly)
- Token type derived from: domain separator + contract address
- Database stores token metadata (name, symbol, decimals)
- Wallet state provides actual balances

---

### 4. MarketplaceService (Marketplace Operations)

**Responsibility**: User registration and verification in marketplace contracts

```typescript
// src/services/marketplace/MarketplaceService.ts

import { Wallet } from '@midnight-ntwrk/wallet-api';
import { deployContract, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import type { Providers } from '@midnight-ntwrk/midnight-js-types';

export interface MarketplaceProviders extends Providers {
  privateStateProvider: any;
  publicDataProvider: any;
  zkConfigProvider: any;
  proofProvider: any;
}

export interface RegisterUserParams {
  name: string;
  email: string;
}

export interface VerifyUserParams {
  email: string;
}

export interface VerifyUserResult {
  verified: boolean;
  userExists: boolean;
  name?: string;
}

export class MarketplaceService {
  private deployedContract: any | null = null;

  constructor(
    private wallet: Wallet,
    private providers: MarketplaceProviders
  ) {}

  // Contract Management
  async deployMarketplaceContract(): Promise<string>; // returns contract address
  async joinMarketplaceContract(contractAddress: string): Promise<void>;

  // User Operations
  async registerUser(params: RegisterUserParams): Promise<{ txId: string; blockHeight: bigint }>;
  async verifyUser(params: VerifyUserParams): Promise<VerifyUserResult>;

  // State Queries
  async getMarketplaceState(): Promise<any>;

  // Private helpers
  private ensureContractDeployed(): void;
  private async readContractState(): Promise<any>;
}
```

**Key Design Decisions**:
- Thin wrapper around marketplace contract operations
- Contract state is source of truth (no local database)
- Deploy vs Join contract patterns
- Pure read operations for verification

---

### 5. DaoService (DAO Voting Operations)

**Responsibility**: DAO election management, voting, treasury operations

```typescript
// src/services/dao/DaoService.ts

import { Wallet } from '@midnight-ntwrk/wallet-api';
import { deployContract, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import type { Providers } from '@midnight-ntwrk/midnight-js-types';

export interface DaoProviders extends Providers {
  privateStateProvider: any;
  publicDataProvider: any;
  zkConfigProvider: any;
  proofProvider: any;
}

export enum VoteType {
  YES = 0,
  NO = 1,
  ABSENT = 2,
}

export interface ElectionStatus {
  isOpen: boolean;
  electionId: string;
  yesVotes: bigint;
  noVotes: bigint;
  absentVotes: bigint;
  totalVotes: bigint;
}

export interface DaoState {
  election_open: boolean;
  election_id: Uint8Array;
  yes_votes: bigint;
  no_votes: bigint;
  absent_votes: bigint;
  total_votes: bigint;
  treasury: {
    value: bigint;
    color: Uint8Array;
    nonce: Uint8Array;
    mt_index: bigint;
  };
  dao_vote_coin_color: Uint8Array;
}

export class DaoService {
  private deployedContract: any | null = null;

  constructor(
    private wallet: Wallet,
    private providers: DaoProviders
  ) {}

  // Contract Management
  async deployDaoContract(
    fundingTokenAddress: string,
    daoVoteTokenAddress: string
  ): Promise<string>; // returns contract address
  async joinDaoContract(contractAddress: string): Promise<void>;

  // Election Operations
  async openElection(electionId: string): Promise<{ txId: string; blockHeight: bigint }>;
  async closeElection(): Promise<{ txId: string; blockHeight: bigint }>;
  async castVote(voteType: VoteType): Promise<{ txId: string; blockHeight: bigint }>;

  // Treasury Operations
  async fundTreasury(amount: bigint): Promise<{ txId: string; blockHeight: bigint }>;
  async payoutApprovedProposal(): Promise<{ txId: string; blockHeight: bigint }>;
  async cancelPayout(): Promise<{ txId: string; blockHeight: bigint }>;

  // State Queries
  async getElectionStatus(): Promise<ElectionStatus | null>;
  async getDaoState(): Promise<DaoState | null>;

  // Private helpers
  private ensureContractDeployed(): void;
  private async readContractState(): Promise<DaoState | null>;
  private createVoteCoin(voteType: VoteType): CoinInfo;
  private createFundingCoin(amount: bigint): CoinInfo;
}
```

**Key Design Decisions**:
- Contract state is source of truth
- Vote coins created from wallet state
- Treasury operations use coin-based funding
- Election lifecycle managed through contract calls

---

### 6. WalletOrchestrator (Service Coordinator)

**Responsibility**: Coordinate multiple services, provide unified high-level API

```typescript
// src/services/wallet/WalletOrchestrator.ts

import { WalletService } from './WalletService.js';
import { TransactionService } from './TransactionService.js';
import { TokenService } from './TokenService.js';
import { MarketplaceService } from '../marketplace/MarketplaceService.js';
import { DaoService } from '../dao/DaoService.js';

export class WalletOrchestrator {
  public readonly walletService: WalletService;
  public readonly transactionService: TransactionService;
  public readonly tokenService: TokenService;
  public readonly marketplaceService: MarketplaceService;
  public readonly daoService: DaoService;

  constructor(config: WalletConfig) {
    // Initialize services in dependency order
    this.walletService = new WalletService(config);

    // These will be initialized after wallet.start()
    this.transactionService = null as any;
    this.tokenService = null as any;
    this.marketplaceService = null as any;
    this.daoService = null as any;
  }

  async start(): Promise<void> {
    await this.walletService.start();

    const wallet = this.walletService.getWallet();

    // Initialize dependent services
    this.transactionService = new TransactionService(
      wallet,
      new TransactionDatabase()
    );

    this.tokenService = new TokenService(
      wallet,
      new TokenRegistryDatabase()
    );

    this.marketplaceService = new MarketplaceService(
      wallet,
      await this.createMarketplaceProviders()
    );

    this.daoService = new DaoService(
      wallet,
      await this.createDaoProviders()
    );
  }

  async close(): Promise<void> {
    await this.walletService.close();
  }

  // High-level convenience methods
  async getFullWalletState(): Promise<any> {
    return {
      address: this.walletService.getAddress(),
      balance: this.walletService.getBalance(),
      transactions: await this.transactionService.getTransactions(),
      tokens: await this.tokenService.listWalletTokens(),
    };
  }

  private async createMarketplaceProviders(): Promise<any> { /* ... */ }
  private async createDaoProviders(): Promise<any> { /* ... */ }
}
```

**Key Design Decisions**:
- Single entry point for all wallet operations
- Manages service lifecycle (start → close)
- Coordinates shared Wallet instance
- Provides high-level convenience methods
- Each service can still be used independently

---

## WalletServiceMCP Refactoring

The current `WalletServiceMCP` (662 lines) becomes a **thin MCP tool handler** that delegates to `WalletOrchestrator`:

```typescript
// src/mcp/index.ts (BEFORE - 662 lines)
export class WalletServiceMCP {
  private walletManager: WalletManager; // 1,792-line god class

  async getBalance() {
    return this.walletManager.getBalance();
  }
  // ... 30+ methods duplicating WalletManager
}

// src/mcp/index.ts (AFTER - ~200 lines)
export class WalletServiceMCP {
  private orchestrator: WalletOrchestrator;

  async getBalance() {
    return this.orchestrator.walletService.getBalance();
  }

  async sendFunds(params: SendFundsParams) {
    return this.orchestrator.transactionService.sendFunds(params);
  }

  async registerToken(params: RegisterTokenParams) {
    return this.orchestrator.tokenService.registerToken(params);
  }

  // ... delegates to appropriate service
}
```

**Size Reduction**:
- WalletServiceMCP: 662 lines → ~200 lines (70% reduction)
- Eliminates WalletManager entirely (1,792 lines deleted)
- Total code reduction: ~2,200 lines → ~1,200 lines across 6 focused services

---

## Migration Plan

### Phase 1: Create Service Skeletons
1. Create all 6 service files with interfaces
2. Implement WalletService (SDK integration)
3. Add basic error handling

### Phase 2: Implement Core Services
1. TransactionService (most critical)
2. TokenService
3. WalletOrchestrator

### Phase 3: Implement Contract Services
1. MarketplaceService
2. DaoService

### Phase 4: Refactor WalletServiceMCP
1. Replace WalletManager dependency
2. Delegate to WalletOrchestrator
3. Update all tool handlers

### Phase 5: Delete Old Code
1. Delete `src/wallet/` directory entirely
2. Update imports throughout codebase
3. Fix build errors

### Phase 6: Testing &amp; Validation
1. Unit tests for each service
2. Integration tests for orchestrator
3. E2E tests for MCP tools

---

## Error Handling Strategy

Each service will throw typed errors:

```typescript
// src/services/wallet/errors.ts

export enum ServiceErrorType {
  // Wallet errors
  WALLET_NOT_READY = 'WALLET_NOT_READY',
  WALLET_START_FAILED = 'WALLET_START_FAILED',

  // Transaction errors
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  TX_SUBMISSION_FAILED = 'TX_SUBMISSION_FAILED',
  TX_NOT_FOUND = 'TX_NOT_FOUND',

  // Token errors
  TOKEN_NOT_REGISTERED = 'TOKEN_NOT_REGISTERED',
  TOKEN_ALREADY_REGISTERED = 'TOKEN_ALREADY_REGISTERED',
  INVALID_TOKEN_ADDRESS = 'INVALID_TOKEN_ADDRESS',

  // Contract errors
  CONTRACT_NOT_DEPLOYED = 'CONTRACT_NOT_DEPLOYED',
  CONTRACT_CALL_FAILED = 'CONTRACT_CALL_FAILED',
  ELECTION_NOT_OPEN = 'ELECTION_NOT_OPEN',

  // Generic
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
}

export class ServiceError extends Error {
  constructor(
    public type: ServiceErrorType,
    message: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}
```

---

## Configuration Updates

Update `src/lib/config/env.ts` to support service configuration:

```typescript
const ConfigSchema = z.object({
  // ... existing fields ...

  // Service Configuration
  TRANSACTION_SYNC_INTERVAL_MS: z.number().default(1000),
  MAX_TRANSACTION_RETRIES: z.number().default(3),
  TOKEN_CACHE_TTL_MS: z.number().default(60000),

  // Contract Configuration
  DAO_ZK_CONFIG_PATH: z.string().default('src/contracts/dao/contract/managed/dao-voting'),
  MARKETPLACE_ZK_CONFIG_PATH: z.string().default('src/contracts/marketplace/contract/managed/marketplace'),
});
```

---

## Benefits of This Design

### ✅ Maintainability
- Each service &lt; 400 lines (down from 1,792-line god class)
- Single responsibility principle
- Easy to test in isolation

### ✅ Flexibility
- Services can be used independently
- Easy to add new features (e.g., NFT service)
- Clear dependency graph

### ✅ Type Safety
- Explicit interfaces for all operations
- No `any` types in public APIs
- Zod validation at boundaries

### ✅ Performance
- Shared Wallet instance (no redundant state)
- Efficient database access patterns
- Minimal SDK overhead

### ✅ Testability
- Constructor injection for mocking
- Clear service boundaries
- Isolated business logic

---

## Next Steps

**Awaiting approval to proceed with**:
1. Creating service skeleton files
2. Implementing WalletService first (foundation)
3. Continuing through migration phases

**Questions for clarification**:
1. Should we keep any part of the current `src/wallet/` as reference during implementation?
2. Any specific methods/patterns from WalletManager you want to discuss before I start?
3. Preference for error handling (throw errors vs return Result type)?

---

## Appendix: Complete File Structure After Redesign

```
src/
├── lib/
│   ├── config/
│   │   ├── constants.ts
│   │   └── env.ts
│   ├── logger/
│   ├── utils/
│   └── database/
│       ├── transaction-db.ts
│       └── token-registry-db.ts
├── services/
│   ├── wallet/
│   │   ├── WalletService.ts         (NEW - SDK integration)
│   │   ├── TransactionService.ts    (NEW - redesigned)
│   │   ├── TokenService.ts          (NEW - redesigned)
│   │   ├── WalletOrchestrator.ts    (NEW - coordinator)
│   │   └── errors.ts                (NEW - typed errors)
│   ├── marketplace/
│   │   └── MarketplaceService.ts    (NEW - redesigned)
│   └── dao/
│       └── DaoService.ts            (NEW - redesigned)
├── api/
│   ├── server.ts
│   └── controllers/
│       └── wallet.controller.ts
├── mcp/
│   ├── index.ts                     (REFACTORED - thin wrapper)
│   ├── stdio-server.ts
│   ├── tools.ts
│   └── resources.ts
├── contracts/
│   ├── dao/
│   └── marketplace/
├── types/
│   └── shared.ts
└── index.ts

DELETED:
src/wallet/ (entire directory - 2,000+ lines removed)
```
