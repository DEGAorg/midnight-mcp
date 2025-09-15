# DAO Configuration

This document explains how to configure and use the DAO (Decentralized Autonomous Organization) functionality in the Midnight MCP server.

## Overview

The DAO functionality allows you to interact with a custom DAO voting contract. Unlike the token system which supports multiple tokens, the DAO system is designed for a single, specific DAO contract configured via environment variables.

## Environment Configuration

### DAO Environment Variable

Configure your DAO using the `DAO` environment variable:

```bash
export DAO="CONTRACT_ADDRESS:VOTE_COIN_COLOR:VOTE_COIN_VALUE:FUND_COIN_COLOR:FUND_COIN_VALUE:DESCRIPTION"
```

### Configuration Format

The DAO configuration uses a colon-separated format with the following components:

1. **CONTRACT_ADDRESS** - The address of the DAO voting contract
2. **VOTE_COIN_COLOR** - The color/type of coins used for voting
3. **VOTE_COIN_VALUE** - The value/amount of coins required for each vote
4. **FUND_COIN_COLOR** - The color/type of coins used for funding the treasury
5. **FUND_COIN_VALUE** - The default value/amount for treasury funding
6. **DESCRIPTION** - Optional description of the DAO (can be omitted)

### Example Configuration

```bash
# Basic DAO configuration
export DAO="0x1234567890abcdef:0x456:500:0x789:1000:Custom DAO for voting"

# Multiple DAO configurations (using DAO_1, DAO_2, etc.)
export DAO="0x1234567890abcdef:0x456:500:0x789:1000:Main DAO"
export DAO_1="0xabcdef1234567890:0x123:1000:0x456:2000:Secondary DAO"
```

### Configuration Template

You can get a configuration template by calling:

```bash
curl -X GET http://localhost:3000/dao/config-template
```

This will return a template showing the expected format.

## Available Operations

### 1. Open Election

Start a new election in the DAO:

```bash
curl -X POST http://localhost:3000/dao/open-election \
  -H "Content-Type: application/json" \
  -d '{
    "electionId": "election-2024-01"
  }'
```

### 2. Close Election

Close the current election:

```bash
curl -X POST http://localhost:3000/dao/close-election
```

### 3. Cast Vote

Cast a vote in the current election:

```bash
curl -X POST http://localhost:3000/dao/cast-vote \
  -H "Content-Type: application/json" \
  -d '{
    "voteType": "YES"
  }'
```

Valid vote types:
- `YES` - Vote in favor
- `NO` - Vote against
- `ABSENT` - Abstain from voting

### 4. Fund Treasury

Fund the DAO treasury with tokens:

```bash
curl -X POST http://localhost:3000/dao/fund-treasury \
  -H "Content-Type: application/json" \
  -d '{
    "amount": "1500"
  }'
```

### 5. Payout Proposal

Payout an approved proposal from the treasury:

```bash
curl -X POST http://localhost:3000/dao/payout-proposal
```

### 6. Get Election Status

Check the current status of the election:

```bash
curl -X GET http://localhost:3000/dao/election-status
```

### 7. Get DAO State

Get the full state of the DAO contract:

```bash
curl -X GET http://localhost:3000/dao/state
```

## Configuration Details

### Contract Address

The contract address should be a valid hexadecimal address for the DAO voting contract deployed on the Midnight network.

### Coin Colors

Coin colors are used to identify different types of tokens or coins within the DAO system. These should match the colors used in your DAO contract.

### Coin Values

- **Vote Coin Value**: The amount of tokens required to cast a single vote
- **Fund Coin Value**: The default amount used when funding the treasury (can be overridden in API calls)

### Multiple DAO Support

While the system is designed for a single DAO, you can configure multiple DAOs using `DAO_1`, `DAO_2`, etc. environment variables. The system will use the first available configuration.

## Error Handling

The DAO system includes comprehensive error handling:

- **Configuration Errors**: If the DAO environment variable is missing or malformed
- **Contract Errors**: If the DAO contract is not accessible or returns errors
- **Wallet Errors**: If the wallet is not ready or lacks sufficient funds
- **Validation Errors**: If required parameters are missing or invalid

## Security Considerations

1. **Private Keys**: Ensure your wallet private keys are secure
2. **Contract Address**: Verify the contract address is correct before configuring
3. **Coin Values**: Double-check coin values to avoid unexpected behavior
4. **Network**: Ensure you're connected to the correct Midnight network

## Troubleshooting

### Common Issues

1. **"DAO configuration not found"**
   - Check that the `DAO` environment variable is set
   - Verify the format matches the expected structure

2. **"Wallet not ready"**
   - Ensure the wallet is fully initialized and synced
   - Check wallet status using `/wallet/status`

3. **"Contract not accessible"**
   - Verify the contract address is correct
   - Ensure the contract is deployed on the current network

4. **"Insufficient funds"**
   - Check wallet balance for the required coin types
   - Ensure you have enough tokens for voting or funding

### Debug Information

Enable debug logging to get more detailed information about DAO operations:

```bash
export LOG_LEVEL=debug
```

## Integration with MCP Tools

The DAO functionality is also available through MCP tools for use in AI agents and other automated systems. The tools follow the same simplified interface without requiring dynamic contract addresses or coin configurations.

## Example Workflow

1. **Configure DAO**:
   ```bash
   export DAO="0x1234567890abcdef:0x456:500:0x789:1000:My DAO"
   ```

2. **Start Election**:
   ```bash
   curl -X POST http://localhost:3000/dao/open-election \
     -H "Content-Type: application/json" \
     -d '{"electionId": "proposal-001"}'
   ```

3. **Cast Votes**:
   ```bash
   curl -X POST http://localhost:3000/dao/cast-vote \
     -H "Content-Type: application/json" \
     -d '{"voteType": "YES"}'
   ```

4. **Check Status**:
   ```bash
   curl -X GET http://localhost:3000/dao/election-status
   ```

5. **Close Election**:
   ```bash
   curl -X POST http://localhost:3000/dao/close-election
   ```

6. **Fund Treasury** (if needed):
   ```bash
   curl -X POST http://localhost:3000/dao/fund-treasury \
     -H "Content-Type: application/json" \
     -d '{"amount": "2000"}'
   ```

This configuration system makes the DAO functionality easy to use while maintaining security and flexibility for your specific DAO contract requirements.
