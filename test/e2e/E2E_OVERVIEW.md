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

### 2. ElizaOS Integration Testing (`agent-e2e.spec.ts`)

Tests the integration between Eliza AI agents and the MCP server using HTTP API calls:

- **Enhanced Response Handling**: Uses content validation to wait for specific information in responses
- **Multiple Message Handling**: Properly handles multiple messages in responses
- **Extended Timeouts**: 60-second timeouts to accommodate longer response times
- **Sequential Execution**: Tests run sequentially with delays between tests for stability
- **Content Validation**: Tests continue waiting until expected content is found

**Features:**
- HTTP API communication with Eliza AI agents
- Content validation for response verification
- Sequential test execution for stability
- Comprehensive logging and result tracking
- Real-time tool execution testing

## Eliza Integration Tests

### Overview

The Eliza integration tests (`agent-e2e.spec.ts`) provide comprehensive end-to-end testing of the AI agent integration with the Midnight MCP server. These tests simulate real user interactions with the AI agent and validate that the agent can successfully interact with blockchain functionality.

### Test Configuration

#### Enhanced Response Handling
- **Content Validation**: Tests use content validators to wait for specific information in responses
- **Multiple Message Support**: Properly handles responses with multiple messages
- **Extended Timeouts**: 60-second timeouts (increased from 15 seconds) to accommodate longer response times
- **Sequential Execution**: Each test waits for the previous one to complete with 10-second delays between tests

#### Test Structure
- **Channel Management**: Tests use a specific channel ID (`4af73091-392d-47f5-920d-eeaf751e81d2`)
- **History Clearing**: Channel history is cleared before test execution
- **Result Tracking**: Comprehensive result tracking with detailed logging
- **Error Handling**: Graceful error handling and validation

### Test Categories

#### 1. Wallet Functionality Tests

**Wallet Status Tests:**
- Check conversation history is empty
- Verify balance extraction with actual response format
- Check wallet status and synchronization
- Get wallet address with validation
- Get current balance with number validation
- Get wallet configuration

**Transaction Operations:**
- Send funds to sample addresses
- Verify transactions (including non-existent transactions)
- Handle transaction verification errors gracefully

#### 2. Marketplace Functionality Tests

**Authentication and Status:**
- Check marketplace login status
- Verify user authentication with conflict detection

**Service Management:**
- List available services with pattern validation
- Register new services with detailed parameters
- Add content to services
- Handle service registration responses

#### 3. Integration Tests

**Error Handling:**
- Handle nonsensical messages gracefully
- Validate error response patterns
- Test system stability under invalid inputs

### Running Eliza Integration Tests

#### Prerequisites

1. **Docker Backend**: Ensure the Docker backend is running
   ```bash
   docker-compose up -d
   ```

2. **Eliza AI Agents**: Make sure Eliza AI agents are running and accessible
   ```bash
   # Check if Eliza is running
   curl http://localhost:{PORT}/health
   ```

3. **Wallet Server**: Verify the wallet server is accessible
   ```bash
   curl http://localhost:{PORT}/health
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
export TEST_TIMEOUT=180000  # 3 minutes per test
export TEST_RETRIES=3

# Run tests
yarn test:e2e
```

### Test Structure

#### Helper Functions (`helpers.ts`)

The test suite includes comprehensive helper functions:

- **TestValidator**: Utility functions for validating test responses with flexible pattern matching
- **TestResultFormatter**: Formatting and reporting test results
- **WaitUtils**: Utilities for handling async operations and timeouts
- **TestLogger**: Structured logging for test operations
- **ElizaHttpClient**: HTTP client for communicating with Eliza AI agents

#### Test Validation

Tests validate responses using pattern matching:

```typescript
// Success indicators
TestValidator.hasSuccessIndicators(response)

// Error indicators  
TestValidator.hasErrorIndicators(response)

// Wallet information
TestValidator.hasWalletStatusInfo(response)

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

1. **Conversation History Check**
   - Validates that channel history is empty before tests
   - Expected: Empty message array

2. **Balance Extraction Verification**
   - Tests balance extraction with actual response format
   - Expected: Correct balance extraction from formatted response

3. **Wallet Status Check**
   - Message: "What is the midnight wallet status?"
   - Expected: Response contains wallet information and status

4. **Get Wallet Address**
   - Message: "What is my wallet address?"
   - Expected: Response contains valid wallet address with validation

5. **Get Balance**
   - Message: "What is my balance?"
   - Expected: Response contains balance information with number validation

6. **Get Wallet Configuration**
   - Message: "What is the wallet configuration?"
   - Expected: Response contains wallet configuration information

#### Transaction Tests

1. **Send Funds**
   - Message: "Send 1 dust units to address [sample_address]"
   - Expected: Response indicates successful transaction initiation

2. **Verify Non-Existent Transaction**
   - Message: "Verify transaction fake-transaction-id-12345"
   - Expected: Response contains appropriate error or "not found" message

#### Marketplace Tests

1. **Login Status**
   - Message: "Am I logged into the marketplace?"
   - Expected: Response indicates authentication status with conflict detection

2. **List Services**
   - Message: "List services available in the marketplace"
   - Expected: Response contains list of available services with pattern validation

3. **Register Service**
   - Message: "Register a new service and return the service id, the service is called 'Test Service' with description 'A test service for E2E testing' price 25 DUST and to receive payment at address [address] and private privacy"
   - Expected: Response indicates successful registration

4. **Add Content**
   - Message: "Add content to the service: 'This is test content for the service'"
   - Expected: Response indicates content addition

#### Error Handling Tests

1. **Nonsensical Message Handling**
   - Message: "Access invalid wallet data"
   - Expected: System handles gracefully without crashing

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

# Run only error handling tests
yarn test:e2e --testNamePattern="Extra"
```

#### Response Analysis

The tests include comprehensive logging that shows:
- Raw AI responses
- Extracted data
- Validation results
- Performance metrics
- Detailed test results with data

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
   ❌ Request timeout after 180000ms
   ```
   - Tests now use 3-minute timeouts
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

- **Basic Queries**: < 10 seconds
- **Wallet Operations**: < 30 seconds  
- **Transaction Operations**: < 60 seconds
- **Marketplace Operations**: < 45 seconds
- **Error Handling**: < 30 seconds

#### Success Rate Targets

- **Individual Tests**: > 95% success rate
- **Sequential Tests**: > 90% success rate
- **Error Handling Tests**: > 85% success rate


#### Local Development

For local development, use the watch mode:

```bash
# Run tests in watch mode
yarn test:e2e --watch

# Run with coverage
yarn test:e2e --coverage
```

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

### Test Sample Data

Tests use consistent sample data:
- **Sample Address**: `mn_shield-addr_test19xcjsrp9qku2t7w59uelzfzgegey9ghtefapn9ga3ys5nq0qazksxqy9ej627ysrd0946qswt8feer7j86pvltk4p6m63zwavfkdqnj2zgqp93ev`
- **Sample Transaction ID**: `fake-transaction-id-12345`
- **Test Service Name**: "Test Service"
- **Test Service Description**: "A test service for E2E testing"
