# Testing the Midnight Control Plane (MCP) Server

This document provides a comprehensive guide on testing the Midnight Control Plane (MCP) Server, including unit tests, integration tests, and testing against custom networks.

## Table of Contents

- [Overview](#overview)
- [Test Types](#test-types)
- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)
- [Testing Against Custom Networks](#testing-against-custom-networks)
- [CI/CD Integration](#cicd-integration)
- [Troubleshooting](#troubleshooting)

## Overview

The MCP Server testing framework uses Jest for both unit and integration tests. The tests are designed to ensure the MCP Server correctly interacts with the Midnight blockchain and properly manages wallets and transactions.

## Test Types

### Unit Tests

Unit tests focus on testing individual components in isolation by mocking external dependencies. These tests verify that each component behaves as expected under various conditions.

**Location:** `test/unit/`

### Integration Tests

Integration tests verify that components work together correctly and can interact with external systems like the Midnight network and proof servers.

**Location:** `test/integration/`

## Running Tests

### Prerequisites

- Node.js 18 or higher
- Yarn

### Unit Tests

Run unit tests with:

```bash
# Run all unit tests
yarn test:unit

# Run with coverage report
yarn test:coverage

# Run in watch mode during development
yarn test:watch
```

### Integration Tests

#### Option 1: Local Network

To run integration tests against a local Midnight network:

1. Start the local network:

```bash
yarn start:local-network
```

2. Run the integration tests:

```bash
yarn test:integration
```

#### Option 2: Docker Environment

For a fully isolated test environment:

```bash
yarn test:docker
```

This uses `docker-compose.test.yml` to set up mock services for testing.

### Custom Network Tests

To test against a custom Midnight network:

```bash
# Set environment variables for the custom network
export CUSTOM_NETWORK_API_HOST=your-network-host
export CUSTOM_NETWORK_API_PORT=5001
export CUSTOM_NETWORK_PROOF_HOST=your-proof-server
export CUSTOM_NETWORK_PROOF_PORT=5002
export CUSTOM_NETWORK_PROOF_API_KEY=your-api-key

# Run tests
yarn test:custom-network
```

## Writing Tests

### Unit Test Example

```typescript
describe('MCPServer', () => {
  it('should return the wallet balance when wallet is ready', () => {
    const mcpServer = new MCPServer(/* ... */);
    const balance = mcpServer.getBalance();
    expect(balance).toBe(/* expected value */);
  });
});
```

### Integration Test Example

```typescript
describe('MCPServer Integration', () => {
  it('should connect to the network and return a valid address', () => {
    const mcpServer = new MCPServer(/* ... */);
    const address = mcpServer.getAddress();
    expect(address).toMatch(/^mdnt/);
  });
});
```

## Testing Against Custom Networks

For testing against custom networks (like staging or testnet), use the `test:custom-network` script with appropriate environment variables:

```bash
# Example for connecting to the testnet
export CUSTOM_NETWORK_API_HOST=testnet.midnight.org
export CUSTOM_NETWORK_API_PORT=443
export CUSTOM_NETWORK_API_USE_HTTPS=true
export CUSTOM_NETWORK_PROOF_HOST=proof.testnet.midnight.org
export CUSTOM_NETWORK_PROOF_PORT=443
export CUSTOM_NETWORK_PROOF_USE_HTTPS=true
export CUSTOM_NETWORK_PROOF_API_KEY=your-testnet-api-key

yarn test:custom-network
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: MCP Tests

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Set up Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: yarn install
      - name: Run unit tests
        run: yarn test:unit

  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run integration tests with Docker
        run: yarn test:docker
```

## Troubleshooting

### Common Issues

1. **Wallet not ready timeout**

   If tests fail with "Timed out waiting for wallet to be ready", check:
   - Network connectivity to the Midnight node
   - Proof server accessibility
   - Increase timeout in `waitForWalletReady` function

2. **Docker errors**

   If Docker-based tests fail:
   - Ensure Docker and Docker Compose are installed
   - Check if required ports (5001, 5002) are available
   - Verify Docker has sufficient resources

3. **Network errors**

   For custom network tests:
   - Verify network hostnames and ports
   - Check API keys are correct
   - Confirm network is accessible from your environment

### Debug Logs

To enable verbose logging during tests:

```bash
# Run with debug logs
DEBUG=midnight:* yarn test:integration
```

## Advanced Testing

### Property-Based Testing

For more comprehensive testing, consider using property-based testing with the jest-fast-check library:

```typescript
import * as fc from 'fast-check';
import { jestFastCheck } from 'jest-fast-check';

describe('MCPServer transfer', () => {
  jestFastCheck('should transfer different amounts correctly', fc.nat(1000).map(BigInt), (amount) => {
    // Test logic with randomly generated amounts
  });
});
```

### Simulating Network Conditions

For resilience testing, simulate poor network conditions:

```typescript
it('should handle network delays', async () => {
  // Mock network delay in wallet operations
  jest.spyOn(wallet, 'sendFunds').mockImplementation(async () => {
    await new Promise(resolve => setTimeout(resolve, 5000)); // 5s delay
    return { /* response */ };
  });
  
  // Test that the system handles the delay correctly
});
``` 