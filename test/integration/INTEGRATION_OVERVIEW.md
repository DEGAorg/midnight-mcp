# Wallet MCP Integration Tests

This directory contains integration tests for the Wallet MCP system that test the Docker implementation via HTTP API calls.

## Overview

The integration tests make HTTP calls to the server running in Docker and verify the responses for the 8 planned test scenarios. The test environment (wallets, contracts, transactions) is created by an external script in the [marketplace-registry-contract repository](https://github.com/DEGAorg/marketplace-registry-contract).

## Prerequisites

1. **Docker Server**: The server must be running in Docker (started manually)
2. **External Setup**: Test environment created by external script (wallets, contracts, transactions)

### Test Scenarios

The tests cover 8 main scenarios:

1. **Valid Payment Received**: Transaction from registered agent with correct amount
2. **Payment With Wrong Amount**: Transaction from valid sender but incorrect amount
3. **Payment From Unknown Sender**: Transaction from unregistered wallet
4. **No Payment Received**: Verification of non-existent transaction
5. **Valid Identity Match**: Sender matches registered identity
6. **Agent Not Registered**: Sender not found in registration contract
7. **Sender Mismatch**: On-chain sender doesn't match off-chain session
8. **Duplicate Transaction Detection**: Same transaction verified multiple times

## Running the Tests

### 1. Create Test Configuration

Run the setup script in the [marketplace-registry-contract repository](https://github.com/DEGAorg/marketplace-registry-contract/blob/main/marketplace-registry-cli/src/test-setup.ts) to generate the test environment (wallets, contracts, transactions). Copy the output from that script to `test-config.json`:

```bash
# Run the setup script in the marketplace-registry-contract repository
# Copy the output to this location:
cp <path-to-setup-script-output> test/integration/mcp/test-config.json
```

The `test-config.json` file should contain the actual output from the setup script, including:

**Required fields to update:**
- `wallets.wallet1.address` - Registered agent wallet address
- `wallets.wallet2.address` - Unregistered agent wallet address  
- `transactions.validPayment.identifier` - Valid payment transaction ID
- `transactions.wrongAmount.identifier` - Wrong amount transaction ID
- `transactions.unknownSender.identifier` - Unknown sender transaction ID

### 2. Run Integration Tests

```bash
# Run all integration tests
yarn test:integration

```

## Test Configuration

### Environment Variables

- `TEST_SERVER_URL`: URL of the Docker server (default: `http://localhost:3000`)
- `TEST_TIMEOUT`: Timeout for server readiness (default: 60000ms)

### Test Data

The test data is configured in the test file with identifiers that should match those created by the external script:

```typescript
const testData = {
  validPayment: {
    identifier: 'valid-payment-from-wallet1', // Created by external script
    expectedAmount: '1000000', // 1 MID in dust
    senderAddress: 'wallet1-address'
  },
  // ... other test cases
};
```

## Test Structure

### HTTP-Only Testing

The tests make pure HTTP calls to the server running in Docker:

```typescript
// Example test
test('should verify valid payment', async () => {
  const response = await request(baseUrl)
    .post('/wallet/verify-transaction')
    .send({ identifier: 'valid-payment-from-wallet1' })
    .expect(200);

  expect(response.body.exists).toBe(true);
  expect(response.body.transactionAmount).toBe('1000000');
});
```

### Test Categories

1. **Health and Status Endpoints**: Basic server health and wallet status
2. **Transaction Management**: Send funds, get transactions, etc.
3. **Test Scenarios**: The 8 main test cases
4. **Error Handling**: Invalid requests and error responses
5. **API Response Format**: Response structure validation
6. **End-to-End Scenarios**: Complete workflow testing

## Expected Test Results

### Successful Test Run

```
✓ Health and Status Endpoints
  ✓ should return health check status
  ✓ should return wallet status
  ✓ should return wallet address
  ✓ should return wallet balance
  ✓ should return wallet configuration

✓ Transaction Management Endpoints
  ✓ should return transactions list
  ✓ should return pending transactions
  ✓ should handle send funds request
  ✓ should reject send funds with missing parameters

✓ Test Case 1: Valid Payment Received
  ✓ should verify valid payment with correct amount and registered sender

✓ Test Case 2: Payment With Wrong Amount
  ✓ should detect amount mismatch for valid sender

✓ Test Case 3: Payment From Unknown Sender
  ✓ should handle transaction from unregistered sender

✓ Test Case 4: No Payment Received
  ✓ should handle case when no transaction is found

✓ Test Case 5: Valid Identity Match
  ✓ should verify sender matches registered identity

✓ Test Case 6: Agent Not Registered
  ✓ should reject sender not found in registration contract

✓ Test Case 7: Sender Mismatch With Off-chain Session
  ✓ should detect mismatch between on-chain sender and off-chain session

✓ Test Case 8: Duplicate Transaction Detection
  ✓ should detect and handle duplicate transaction processing

✓ Error Handling
  ✓ should handle missing identifier in verify transaction
  ✓ should handle invalid transaction ID format
  ✓ should handle non-existent transaction ID

✓ API Response Format Validation
  ✓ should return consistent response format for all endpoints
  ✓ should handle CORS headers correctly

✓ End-to-End Test Scenarios
  ✓ should run all 8 test scenarios against the Docker server
```

## Troubleshooting

### Common Issues

1. **Server Not Ready**: Ensure Docker containers are running and healthy
2. **Test Data Mismatch**: Verify external script created transactions with expected identifiers
3. **Network Issues**: Check if server is accessible at the configured URL
4. **Timeout Errors**: Increase timeout values for slow environments

### Debug Information

The tests include extensive logging to help with debugging:

```typescript
logger.info('Wallet status:', response.body);
logger.info('Valid payment verification result:', response.body);
logger.info('All test scenario results:', results);
```

### Manual Testing

You can manually test the endpoints using curl:

```bash
# Health check
curl http://localhost:3000/health

# Wallet status
curl http://localhost:3000/wallet/status

# Verify transaction
curl -X POST http://localhost:3000/wallet/verify-transaction \
  -H "Content-Type: application/json" \
  -d '{"identifier": "valid-payment-from-wallet1"}'
```

## File Structure

```
test/integration/mcp/
├── index.spec.ts                    # Main integration test file
├── test-config.json                 # Test configuration (copy from setup script output)
└── README.md                        # This file
```

## Contributing

When adding new tests:

1. Follow the HTTP-only testing pattern
2. Use descriptive test names
3. Include proper error handling
4. Add logging for debugging
5. Update this README with new test scenarios 