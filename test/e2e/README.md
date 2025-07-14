# E2E Testing for Midnight MCP Server

This directory contains comprehensive End-to-End (E2E) tests for the Midnight MCP server, including integration with elizaOS and various testing approaches.

## Overview

The E2E tests validate the complete integration flow from MCP server startup to AI agent interactions, ensuring that the Midnight blockchain functionality works correctly through the Model Context Protocol.

## Test Approaches

### 1. Direct MCP Protocol Testing (`mcp-server.spec.ts`)

Tests the MCP server directly using the MCP SDK:

- **Protocol Compliance**: Validates MCP protocol implementation
- **Tool Discovery**: Tests tool listing and schema validation
- **Tool Execution**: Executes wallet operations and blockchain queries
- **Resource Management**: Tests resource discovery and access
- **Error Handling**: Validates error responses and edge cases
- **Performance**: Tests response times and concurrent operations

**Run with:**
```bash
yarn test:e2e
```

### 2. ElizaOS Integration Testing (`eliza-integration.spec.ts`)

Tests the integration between elizaOS and the MCP server using the [@fleek-platform/eliza-plugin-mcp](https://github.com/fleek-platform/eliza-plugin-mcp):

- **ElizaOS Setup**: Creates and configures elizaOS projects
- **Plugin Integration**: Tests MCP plugin loading and configuration
- **Agent Conversations**: Tests AI agent interactions with MCP tools
- **Tool Integration**: Validates tool exposure through elizaOS
- **Error Handling**: Tests graceful error handling in agent context
- **Performance**: Tests conversation response times

**Features:**
- Automatic elizaOS project creation
- MCP plugin installation and configuration
- Agent conversation simulation
- Real-time tool execution testing

## Eliza Integration Tests

### Overview

The Eliza integration tests (`eliza-integration.spec.ts`) provide comprehensive end-to-end testing of the AI agent integration with the Midnight MCP server. These tests simulate real user interactions with the AI agent and validate that the agent can successfully interact with blockchain functionality.

### Test Categories

#### 1. Wallet Functionality Tests

**Wallet Status Tests:**
- Check wallet status and synchronization
- Get wallet address
- Get current balance
- Get wallet configuration

**Transaction Operations:**
- Send funds to sample addresses
- Verify transactions (both received and non-existent)
- List transaction history

#### 2. Marketplace Functionality Tests

**Authentication and Status:**
- Check marketplace login status
- Verify user authentication

**Service Management:**
- List available services
- Register new services
- Add content to services
- Hire services from marketplace

#### 3. Integration Tests

**Cross-Functionality Flows:**
- Complete wallet-to-marketplace workflows
- Error handling and graceful degradation
- End-to-end user journeys

#### 4. Performance Tests

**Load Testing:**
- Concurrent request handling
- Rapid successive requests
- Response time validation
- System stability under load

### Running Eliza Integration Tests

#### Prerequisites

1. **Docker Backend**: Ensure the Docker backend is running
   ```bash
   docker-compose up -d
   ```

2. **Eliza AI Agents**: Make sure Eliza AI agents are running and accessible
   ```bash
   # Check if Eliza is running
   curl http://localhost:3000/health
   ```

3. **Wallet Server**: Verify the wallet server is accessible
   ```bash
   curl http://localhost:3000/health
   ```

#### Quick Start

Run the tests with Jest:
```bash
# Run all E2E tests
yarn test:e2e

# Run only Eliza integration tests
yarn test:e2e:eliza

# Run with Jest options
yarn test:e2e --verbose --detectOpenHandles
```

#### Environment Variables

Configure test behavior with environment variables:

```bash
# Eliza API configuration
export ELIZA_API_URL=http://localhost:3000
export TEST_TIMEOUT=30000
export TEST_RETRIES=3

# Run tests
yarn test:e2e
```

### Test Structure

#### Helper Functions (`helpers.ts`)

The test suite includes comprehensive helper functions:

- **ElizaHttpClient**: HTTP client for communicating with Eliza AI agents
- **TestValidator**: Utility functions for validating test responses with flexible pattern matching
- **TestResultFormatter**: Formatting and reporting test results
- **WaitUtils**: Utilities for handling async operations and timeouts
- **TestLogger**: Structured logging for test operations

#### Test Validation

Tests validate responses using pattern matching:

```typescript
// Success indicators
TestValidator.hasSuccessIndicators(response)

// Error indicators  
TestValidator.hasErrorIndicators(response)

// Wallet information
TestValidator.hasWalletInfo(response)

// Marketplace information
TestValidator.hasMarketplaceInfo(response)
```

#### Data Extraction

Extract specific data from AI responses:

```typescript
// Extract wallet address
const address = TestValidator.extractWalletAddress(response);

// Extract balance amount
const balance = TestValidator.extractBalance(response);

// Extract transaction ID
const txId = TestValidator.extractTransactionId(response);
```

### Test Scenarios

#### Wallet Tests

1. **Wallet Status Check**
   - Message: "What is the midnight wallet status?"
   - Expected: Response contains wallet information and status

2. **Get Wallet Address**
   - Message: "What is my wallet address?"
   - Expected: Response contains valid wallet address

3. **Get Balance**
   - Message: "What is my balance?"
   - Expected: Response contains balance information

4. **Send Funds**
   - Message: "Send 1000000 dust units to address 0x1234..."
   - Expected: Response indicates successful transaction initiation

5. **Verify Transaction**
   - Message: "Verify transaction abc123"
   - Expected: Response contains transaction verification result

#### Marketplace Tests

1. **Login Status**
   - Message: "Am I logged into the marketplace?"
   - Expected: Response indicates login status

2. **List Services**
   - Message: "List services available in the marketplace"
   - Expected: Response contains list of available services

3. **Register Service**
   - Message: "Register a new service called 'Test Service'"
   - Expected: Response indicates successful registration

4. **Add Content**
   - Message: "Add content to the service: 'Test content'"
   - Expected: Response indicates content addition

5. **Hire Service**
   - Message: "Hire a service from the marketplace"
   - Expected: Response indicates service hiring process

### Debugging Tests

#### Verbose Output

Enable verbose logging:
```bash
yarn test:e2e --verbose
```

#### Individual Test Debugging

Run specific test categories:
```bash
# Run only wallet tests
yarn test:e2e --testNamePattern="Wallet"

# Run only marketplace tests  
yarn test:e2e --testNamePattern="Marketplace"

# Run only performance tests
yarn test:e2e --testNamePattern="Performance"
```

#### Response Analysis

The tests include comprehensive logging that shows:
- Raw AI responses
- Extracted data
- Validation results
- Performance metrics

### Troubleshooting

#### Common Issues

1. **Connection Errors**
   ```
   ❌ Cannot connect to Eliza API
   ```
   - Check if Eliza is running on the correct port
   - Verify network connectivity
   - Check firewall settings

2. **Timeout Errors**
   ```
   ❌ Request timeout after 30000ms
   ```
   - Increase timeout value: `--timeout 60000`
   - Check system performance
   - Verify service responsiveness

3. **Validation Failures**
   ```
   ❌ Response validation failed
   ```
   - Check AI agent configuration
   - Verify MCP plugin installation
   - Review response patterns

#### Debug Commands

```bash
# Check service health
curl http://localhost:3000/health

# Test Eliza API directly
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What is my wallet status?"}'

# Check Docker containers
docker ps

# View logs
docker logs midnight-wallet-server

# Run tests with debug output
yarn test:e2e --verbose --detectOpenHandles
```

### Performance Benchmarks

#### Expected Response Times

- **Basic Queries**: < 5 seconds
- **Wallet Operations**: < 10 seconds  
- **Transaction Operations**: < 15 seconds
- **Marketplace Operations**: < 8 seconds
- **Concurrent Requests**: < 20 seconds

#### Success Rate Targets

- **Individual Tests**: > 95% success rate
- **Concurrent Tests**: > 80% success rate
- **Performance Tests**: > 90% success rate

### Continuous Integration

#### GitHub Actions

Add to your CI pipeline:

```yaml
- name: Run Eliza Integration Tests
  run: |
    # Start services
    docker-compose up -d
    
    # Wait for services
    sleep 30
    
    # Run tests
    tsx test/e2e/run-tests.ts --timeout 60000
```

#### Local Development

For local development, use the watch mode:

```bash
# Run tests in watch mode
yarn test:e2e --watch

# Run with coverage
yarn test:e2e --coverage
```

## Test Scripts

### 1. STDIO Protocol Testing (`scripts/test-e2e-stdio.ts`)

Direct JSON-RPC testing over STDIO interface:

```bash
yarn test:e2e:stdio
```

**Features:**
- Raw JSON-RPC protocol testing
- Protocol initialization validation
- Tool and resource discovery
- Error condition testing
- Performance benchmarking

### 2. ElizaOS CLI Testing (`scripts/test-e2e-eliza.ts`)

Full elizaOS integration testing:

```bash
yarn test:e2e:eliza
```

**Features:**
- ElizaOS CLI installation verification
- Project creation and setup
- MCP plugin installation
- Agent-to-MCP communication testing
- End-to-end conversation flows

### 3. Comprehensive Testing (`scripts/test-e2e-full.ts`)

Runs all test suites in sequence:

```bash
yarn test:e2e:full
```

**Includes:**
- Unit tests
- Integration tests
- All E2E test approaches
- Performance benchmarking
- Test report generation

## ElizaOS Integration Setup

### Prerequisites

1. **Install ElizaOS CLI:**
```bash
npm install -g @elizaos/cli@beta
```

2. **Verify Installation:**
```bash
elizaos --version
```

### Manual Setup for Development

1. **Create ElizaOS Project:**
```bash
elizaos create my-mcp-project
cd my-mcp-project
```

2. **Install MCP Plugin:**
```bash
bun add @fleek-platform/eliza-plugin-mcp
```

3. **Configure Character with MCP:**
```json
{
  "name": "Midnight Agent",
  "bio": "AI agent with Midnight blockchain capabilities",
  "plugins": ["@fleek-platform/eliza-plugin-mcp"],
  "settings": {
    "mcp": {
      "servers": {
        "midnight-mcp": {
          "type": "stdio",
          "name": "Midnight MCP Server",
          "command": "node",
          "args": ["path/to/midnight-mcp/dist/stdio-server.js"],
          "env": {
            "AGENT_ID": "your-agent-id"
          }
        }
      }
    }
  }
}
```

4. **Start ElizaOS:**
```bash
elizaos start
```

## Test Configuration

### Environment Variables

Tests use these environment variables:

- `AGENT_ID`: Unique identifier for test agents
- `NODE_ENV`: Set to 'test' for test runs
- `WALLET_SERVER_HOST`: Localhost for test servers
- `WALLET_SERVER_PORT`: Different ports for each test suite
- `NETWORK_ID`: 'TestNet' for test environment
- `USE_EXTERNAL_PROOF_SERVER`: 'false' for local testing

### Test Isolation

Each test suite uses:

- **Unique Agent IDs**: Prevents test interference
- **Separate Seed Files**: Isolated wallet data
- **Different Ports**: Prevents port conflicts
- **Cleanup Procedures**: Removes test artifacts

## Available Tools for Testing

The MCP server exposes these tools for testing:

### Wallet Operations
- `walletStatus`: Get wallet sync status
- `walletAddress`: Get wallet receiving address  
- `walletBalance`: Get current balance
- `getWalletConfig`: Get wallet configuration

### Transaction Operations
- `sendFunds`: Send funds to another address
- `getTransactions`: List all transactions
- `getPendingTransactions`: List pending transactions
- `getTransactionStatus`: Get specific transaction status
- `verifyTransaction`: Verify transaction receipt

## Test Data and Fixtures

### Test Seed Files

Generated automatically for each test:
- Location: `.storage/seeds/{agent-id}.seed`
- Content: Test-specific seed values
- Cleanup: Automatic removal after tests

### Mock Data

Tests use mock data for:
- Wallet addresses
- Transaction hashes
- Balance amounts
- Network responses

## Performance Benchmarks

### Expected Response Times

- **Tool Listing**: < 1 second
- **Wallet Status**: < 2 seconds
- **Balance Query**: < 3 seconds
- **Transaction List**: < 5 seconds
- **Agent Conversation**: < 10 seconds

### Concurrent Operations

Tests validate:
- Multiple simultaneous tool calls
- Concurrent agent conversations
- Server stability under load
- Resource cleanup efficiency

## Troubleshooting

### Common Issues

1. **ElizaOS CLI Not Found**
   ```bash
   npm install -g @elizaos/cli@beta
   ```

2. **MCP Plugin Installation Fails**
   ```bash
   bun add @fleek-platform/eliza-plugin-mcp
   # or
   npm install @fleek-platform/eliza-plugin-mcp
   ```

3. **Port Conflicts**
   - Tests use ports 3001-3004
   - Stop any running services on these ports
   - Or modify port configurations in test files

4. **Seed File Permissions**
   ```bash
   chmod 755 .storage/seeds/
   ```

5. **Node.js Version**
   - Requires Node.js 18.20.5+
   - ElizaOS requires Node.js 23.3.0+

### Debug Mode

Enable detailed logging:

```bash
DEBUG=mcp:* yarn test:e2e:full
```

### Test Logs

Check test outputs in:
- `test-results/`: Generated test reports
- `logs/`: Server and application logs
- Console output during test execution

## CI/CD Integration

### GitHub Actions

Tests run automatically on:
- Pull requests
- Main branch commits
- Release tags

### Test Reports

Generated artifacts:
- Jest test reports
- Coverage reports
- Performance benchmarks
- Integration test results

## Contributing to Tests

### Adding New Tests

1. **Unit Tests**: Add to `test/unit/`
2. **Integration Tests**: Add to `test/integration/`
3. **E2E Tests**: Add to `test/e2e/`
4. **Scripts**: Add to `scripts/`

### Test Guidelines

1. **Isolation**: Tests should not depend on each other
2. **Cleanup**: Always clean up test artifacts
3. **Timeout**: Set appropriate timeouts for async operations
4. **Mocking**: Mock external dependencies when possible
5. **Documentation**: Document test purpose and setup

### Running Specific Tests

```bash
# Run only MCP protocol tests
yarn test:e2e --testNamePattern="MCP.*Protocol"

# Run only elizaOS integration tests  
yarn test:e2e --testNamePattern="ElizaOS.*Integration"

# Run with coverage
yarn test:e2e --coverage

# Run in watch mode
yarn test:e2e --watch
```

## Future Enhancements

### Planned Additions

1. **Visual Testing**: Screenshot comparisons for UI
2. **Load Testing**: High-concurrency scenarios
3. **Security Testing**: Vulnerability assessments
4. **Cross-platform**: Windows/macOS/Linux testing
5. **Browser Testing**: Web interface validation
6. **Mobile Testing**: Mobile app integration

### Tool Improvements

1. **Better Mocking**: More realistic mock responses
2. **Test Data**: Expanded test datasets
3. **Reporting**: Enhanced test reports
4. **Monitoring**: Real-time test monitoring
5. **Automation**: Fully automated CI/CD pipelines

For questions or issues with E2E testing, please refer to the main project documentation or create an issue in the repository. 