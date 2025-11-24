# 🧪 MCP Server Tests

This directory contains comprehensive tests for the Midnight MCP server, organized into three main categories: **Unit**, **Integration**, and **End-to-End** tests.

## 📚 Test Documentation

### Detailed Test Overviews
- **[Unit Tests Overview](unit/UNIT_OVERVIEW.md)** — 429 tests across 18 suites with 100% coverage
- **[Integration Tests Overview](integration/INTEGRATION_OVERVIEW.md)** — HTTP server with real MCP transport
- **[E2E Tests Overview](e2e/E2E_OVERVIEW.md)** — Complete workflows with ElizaOS integration
- **[ElizaOS Client Guide](e2e/ELIZA_CLIENT_README.md)** — ElizaOS integration setup and usage

## 🏗️ Test Categories

### Unit Tests

Comprehensive unit tests with mocked services for isolated component testing.

**Location:** `test/unit/`
**Documentation:** [unit/UNIT_OVERVIEW.md](unit/UNIT_OVERVIEW.md)

**Coverage Targets:**
- Line coverage: 80%+
- Branch coverage: 80%+
- Function coverage: 80%+
- Statement coverage: 80%+

**Test Structure:**
- `mcp/` — MCP protocol layer tests
- `services/` — Service layer tests (WalletService, TransactionService, etc.)
- `audit/` — Audit system tests
- `lib/` — Utility and configuration tests

**Run Commands:**
```bash
# Run all unit tests
yarn test:unit

# Run with coverage report
yarn test:unit:coverage

# Run in watch mode
yarn test:unit:watch

# Run silently (for CI)
yarn test:silent
```

### Integration Tests

HTTP-based integration tests for multi-agent server functionality.

**Location:** `test/integration/`
**Documentation:** [integration/INTEGRATION_OVERVIEW.md](integration/INTEGRATION_OVERVIEW.md)

**Test Focus:**
- HTTP MCP server with real transport
- Session management and isolation
- BigInt serialization handling
- Multi-agent coordination
- Tool execution end-to-end

**Run Commands:**
```bash
# Run integration tests
yarn test:integration

# Run in watch mode
yarn test:integration:watch
```

### End-to-End Tests

End-to-end tests with ElizaOS integration and complete system validation.

**Location:** `test/e2e/`
**Documentation:** [e2e/E2E_OVERVIEW.md](e2e/E2E_OVERVIEW.md)

**Test Scenarios:**
- Real wallet operations
- Transaction confirmation tracking
- Multi-step workflows
- ElizaOS agent integration
- MCP protocol validation

**Prerequisites:**
- ElizaOS server running (use `yarn demo:eliza` to set up)
- Agent configured with `yarn setup-agent -a test-agent`
- Built project (`yarn build`)

**Run Commands:**
```bash
# Run all E2E tests
yarn test:e2e

# Run ElizaOS integration tests
yarn test:e2e:eliza

# Run STDIO protocol tests
yarn test:stdio

# Run in watch mode
yarn test:e2e:watch

# Run specific E2E tests
yarn test:e2e:main
yarn test:e2e:basic
yarn test:e2e:debug
yarn test:e2e:simple
```

## Quick Start

### Run All Tests

```bash
yarn test
```

### Run Specific Test Types

```bash
# Unit tests only
yarn test:unit

# Integration tests only
yarn test:integration

# E2E tests only
yarn test:e2e
```

### Generate Coverage Reports

```bash
# Unit test coverage
yarn test:unit:coverage

# All tests with coverage
yarn test:coverage
```

## Test Structure

```
test/
├── README.md                        # This file
├── unit/                            # Unit tests (mocked services)
│   ├── mcp/                         # MCP layer tests
│   │   ├── mcp-server.spec.ts
│   │   ├── session-manager.spec.ts
│   │   └── tool-adapter.spec.ts
│   ├── services/                    # Service layer tests
│   │   ├── wallet.spec.ts
│   │   ├── transaction.spec.ts
│   │   ├── token.spec.ts
│   │   └── orchestrator.spec.ts
│   ├── audit/                       # Audit system tests
│   └── lib/                         # Utility tests
├── integration/                     # Integration tests
│   └── mcp-http-client-test.ts     # HTTP MCP server tests
└── e2e/                            # End-to-end tests
    ├── agent-e2e.spec.ts           # Main E2E scenarios
    ├── basic-messaging.spec.ts     # Basic messaging tests
    ├── debug-messaging.spec.ts     # Debug mode tests
    └── simple-agent-test.spec.ts   # Simple agent tests
```

## Prerequisites

- Node.js v18.20.5 or higher
- Yarn package manager
- For E2E tests: ElizaOS agents accessible

## Test Configuration

Tests use Jest with the following configuration:

**File:** `jest.config.js`

```javascript
{
  preset: 'ts-jest',
  testEnvironment: 'node',
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
}
```

## Test Statistics

- **Unit Tests:** 429 tests across 18 test suites
- **Integration Tests:** HTTP server with session management
- **E2E Tests:** Complete workflow validation with ElizaOS

## Environment Variables for Testing

```bash
# Required for tests
AGENT_ID=test-agent
NODE_ENV=test
CI=true

# Network configuration (uses TestNet defaults)
NETWORK_ID=TestNet
LOG_LEVEL=error

# Optional contract addresses
DAO_CONTRACT_ADDRESS=0x...
MARKETPLACE_CONTRACT_ADDRESS=0x...
```

## Writing Tests

### Unit Test Example

```typescript
import { WalletService } from '@/lib/services/wallet';
import { createMockWallet } from '../mocks/wallet';

describe('WalletService', () => {
  it('should return wallet address', async () => {
    const mockWallet = createMockWallet();
    const service = new WalletService(mockWallet);

    const address = await service.getAddress();

    expect(address).toBe('addr_test1q...');
  });
});
```

### Integration Test Example

```typescript
import { MCPClient } from '@modelcontextprotocol/sdk/client';

describe('HTTP MCP Server', () => {
  it('should handle walletStatus tool call', async () => {
    const client = new MCPClient();

    const result = await client.callTool('walletStatus', {});

    expect(result.content[0].text).toContain('isReady');
  });
});
```

### E2E Test Example

```typescript
describe('Wallet Operations E2E', () => {
  it('should complete full transaction workflow', async () => {
    // 1. Check wallet status
    const status = await agent.walletStatus();
    expect(status.isReady).toBe(true);

    // 2. Send transaction
    const txHash = await agent.sendNativeToken({
      to: 'addr_test1q...',
      amount: '1000'
    });

    // 3. Wait for confirmation
    const tx = await agent.getTransaction({ hash: txHash });
    expect(tx.status).toBe('confirmed');
  });
});
```

## Continuous Integration

Tests run automatically on:
- Pull requests to `main`, `uat`, `develop`
- Direct pushes to protected branches
- Scheduled daily runs at 2 AM UTC

**CI Workflow:** `.github/workflows/unit-tests.yml`

## Troubleshooting

### Tests Fail Locally

```bash
# Clean install
rm -rf node_modules .yarn/cache
yarn install

# Rebuild
yarn clean
yarn build

# Run tests
yarn test:unit
```

### Coverage Not Generated

```bash
# Ensure coverage directory exists
mkdir -p coverage

# Run with verbose output
yarn test:unit:coverage --verbose
```

### E2E Tests Timeout

```bash
# Increase Jest timeout
jest.setTimeout(60000); // 60 seconds

# Or set in jest.config.js
testTimeout: 60000
```

### Integration Tests Fail

```bash
# Check if HTTP server is running
curl http://localhost:3001/health

# Check environment variables
echo $AGENT_ID
echo $BASE_STORAGE_DIR

# Verify agent setup
yarn setup-agent -a test-agent
```

## 📖 Additional Documentation

### Project Documentation
- **[Main README](../README.md)** — Project overview and quick start
- **[Available Commands](../README.md#-available-commands)** — All test commands documented
- **[Scripts Documentation](../scripts/README.md)** — Utility scripts for testing setup
- **[Documentation Index](../docs/index.md)** — Complete documentation navigation

### External Resources
- **[Jest Documentation](https://jestjs.io/)** — Testing framework
- **[Testing Best Practices](https://testingjavascript.com/)** — Testing patterns and practices
- **[MCP Protocol Specification](https://modelcontextprotocol.io/)** — Model Context Protocol spec
- **[ElizaOS Documentation](https://elizaos.ai/)** — ElizaOS integration guide

---

*For complete testing information, see the detailed test overviews linked at the top of this document.*
