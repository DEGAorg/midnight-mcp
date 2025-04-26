# MCP Server Tests

This directory contains tests for the Midnight Control Plane (MCP) server. The tests are divided into unit tests and integration tests.

## Test Structure

- `unit/`: Unit tests that mock external dependencies
- `integration/`: Integration tests that interact with a real or mock network
- `helpers.ts`: Common test helpers and utilities

## Running Tests

### Unit Tests

Unit tests can be run independently of any external services:

```bash
# Run all unit tests
yarn test:unit

# Run unit tests with coverage
yarn test:coverage

# Run tests in watch mode during development
yarn test:watch
```

### Integration Tests

Integration tests require a running Midnight network. You have two options:

#### 1. Use a local network

If you have a local Midnight network running, you can run the integration tests directly:

```bash
yarn test:integration
```

The integration tests will connect to the network at `localhost:5001` and the proof server at `localhost:5002`.

#### 2. Use Docker Compose

For a fully isolated test environment, use the provided Docker Compose configuration:

```bash
# Start the test environment with mock services
yarn test:docker
```

This will spin up:
- A mock Midnight node
- A mock proof server
- The integration test runner

### Skipping Integration Tests

If you need to skip integration tests that require an actual network connection, set the environment variable:

```bash
SKIP_INTEGRATION_TESTS=true yarn test:integration
```

## Writing Tests

### Unit Tests

Unit tests use Jest's mocking capabilities to isolate the behavior of components:

```typescript
// Example unit test
describe('MCPServer', () => {
  it('should return the wallet balance when wallet is ready', () => {
    // Test logic...
  });
});
```

### Integration Tests

Integration tests should be written to verify the behavior of the system with real dependencies:

```typescript
describe('MCPServer Integration Tests', () => {
  it('should return a valid address', () => {
    // Integration test logic...
  });
});
```

## Test Fixtures

For tests that require test data or fixtures, add them to the `fixtures/` directory and reference them in your tests.

## Continuous Integration

The tests are configured to run in CI on every pull request. The CI workflow includes:

1. Running unit tests
2. Running a subset of integration tests with mock services

## Debugging Tests

To debug tests, you can use the following techniques:

1. Add `console.log()` statements to your tests
2. Set the `DEBUG=jest` environment variable for more verbose Jest output
3. Run tests with the `--verbose` flag: `yarn test:unit --verbose` 