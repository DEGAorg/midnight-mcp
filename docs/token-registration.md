# Token Registration Guide

This guide explains how to register tokens in the Midnight MCP system using various methods including environment variables and API endpoints.

## Overview

The token registration system allows you to:
- Register individual tokens with human-readable names
- Batch register multiple tokens at once
- Auto-register tokens from environment variables
- Use proper token type generation with domain separators
- Persist token registrations in a SQLite database

## Methods

### 1. Environment Variables

#### Single TOKENS Variable

Set the `TOKENS` environment variable with multiple token configurations separated by `|`:

```bash
export TOKENS="DAO_VOTING:DVT:0x1234567890abcdef:dega_dao_vote:DAO voting token|FUNDING:FUND:0xfedcba0987654321:dega_funding_token:Funding token"
```

#### Multiple Numbered Variables

Use `TOKENS_1`, `TOKENS_2`, etc. for better organization:

```bash
export TOKENS_1="DAO_VOTING:DVT:0x1234567890abcdef:dega_dao_vote:DAO voting token"
export TOKENS_2="FUNDING:FUND:0xfedcba0987654321:dega_funding_token:Funding token"
export TOKENS_3="REWARD:REW:0x1111111111111111:reward_token:Reward token"
```

#### Format

Each token configuration follows this format:
```
TOKEN_NAME:SYMBOL:CONTRACT_ADDRESS:DOMAIN_SEPARATOR:DESCRIPTION
```

**Required Fields:**
- `TOKEN_NAME`: Human-readable name (e.g., "DAO_VOTING")
- `SYMBOL`: Token symbol (e.g., "DVT")
- `CONTRACT_ADDRESS`: Contract address (e.g., "0x1234567890abcdef")

**Optional Fields:**
- `DOMAIN_SEPARATOR`: Domain separator for token type generation (defaults to "custom_token")
- `DESCRIPTION`: Human-readable description

**Examples:**
```bash
# Minimal format
TOKENS="MYTOKEN:MT:0x1234567890abcdef"

# With domain separator
TOKENS="DAO_VOTING:DVT:0x1234567890abcdef:dega_dao_vote"

# Full format
TOKENS="DAO_VOTING:DVT:0x1234567890abcdef:dega_dao_vote:DAO voting token for governance"
```

### 2. API Endpoints

#### Register Single Token

```bash
curl -X POST http://localhost:3000/api/wallet/tokens/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "DAO_VOTING",
    "symbol": "DVT",
    "contractAddress": "0x1234567890abcdef",
    "domainSeparator": "dega_dao_vote",
    "description": "DAO voting token"
  }'
```

#### Batch Register Tokens

```bash
curl -X POST http://localhost:3000/api/wallet/tokens/batch \
  -H "Content-Type: application/json" \
  -d '{
    "tokens": [
      {
        "name": "DAO_VOTING",
        "symbol": "DVT",
        "contractAddress": "0x1234567890abcdef",
        "domainSeparator": "dega_dao_vote",
        "description": "DAO voting token"
      },
      {
        "name": "FUNDING",
        "symbol": "FUND",
        "contractAddress": "0xfedcba0987654321",
        "domainSeparator": "dega_funding_token",
        "description": "Funding token"
      }
    ]
  }'
```

#### Register from Environment String

```bash
curl -X POST http://localhost:3000/api/wallet/tokens/register-from-env \
  -H "Content-Type: application/json" \
  -d '{
    "envValue": "DAO_VOTING:DVT:0x1234567890abcdef:dega_dao_vote:DAO voting token|FUNDING:FUND:0xfedcba0987654321:dega_funding_token:Funding token"
  }'
```

### 3. Script Registration

Use the provided script to register common tokens:

```bash
# Register common tokens
npm run register-tokens

# Register from environment variables
npm run register-tokens -- --env
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/wallet/tokens/register` | POST | Register a single token |
| `/api/wallet/tokens/balance/:tokenName` | GET | Get token balance |
| `/api/wallet/tokens/send` | POST | Send tokens |
| `/api/wallet/tokens/list` | GET | List all tokens |
| `/api/wallet/tokens/batch` | POST | Batch register tokens |
| `/api/wallet/tokens/register-from-env` | POST | Register from env string |
| `/api/wallet/tokens/config-template` | GET | Get config template |
| `/api/wallet/tokens/stats` | GET | Get registry statistics |

## Token Operations

### Get Token Balance

```bash
curl http://localhost:3000/api/wallet/tokens/balance/DAO_VOTING
```

### Send Tokens

```bash
curl -X POST http://localhost:3000/api/wallet/tokens/send \
  -H "Content-Type: application/json" \
  -d '{
    "tokenName": "DAO_VOTING",
    "toAddress": "0xrecipient_address",
    "amount": "100"
  }'
```

### List All Tokens

```bash
curl http://localhost:3000/api/wallet/tokens/list
```

### Get Registry Statistics

```bash
curl http://localhost:3000/api/wallet/tokens/stats
```

## Common Token Types

### DAO Tokens

```bash
# DAO Voting Token
TOKENS="DAO_VOTING:DVT:0x1234567890abcdef:dega_dao_vote:DAO voting token"

# Funding Token
TOKENS="FUNDING:FUND:0xfedcba0987654321:dega_funding_token:Funding token"
```

### Custom Tokens

```bash
# Custom token with default domain separator
TOKENS="MYTOKEN:MT:0x1111111111111111:custom_token:My custom token"

# Reward token
TOKENS="REWARD:REW:0x2222222222222222:reward_token:Reward token for incentives"
```

## Database Persistence

Token registrations are automatically persisted in a SQLite database located at:
```
{walletBackupFolder}/token-registry.db
```

The database includes:
- Token information (name, symbol, contract address, domain separator)
- Generated token type hex
- Creation and update timestamps
- Automatic indexing for fast lookups

## Error Handling

The system provides comprehensive error handling:

- **Validation Errors**: Invalid token configurations are caught and reported
- **Duplicate Prevention**: Attempts to register existing tokens are skipped
- **Database Errors**: Database connection issues are logged and handled
- **Batch Processing**: Individual token failures don't stop batch processing

## Best Practices

1. **Use Descriptive Names**: Choose clear, descriptive token names
2. **Consistent Symbols**: Use consistent symbol conventions (e.g., all caps)
3. **Domain Separators**: Use appropriate domain separators for token types
4. **Environment Variables**: Use numbered variables (`TOKENS_1`, `TOKENS_2`) for better organization
5. **Validation**: Always validate contract addresses before registration
6. **Documentation**: Include descriptions for better token management

## Troubleshooting

### Common Issues

1. **Invalid Contract Address**: Ensure contract addresses are valid hexadecimal strings starting with `0x`
2. **Duplicate Tokens**: Check if tokens are already registered before attempting registration
3. **Database Issues**: Ensure the wallet backup folder is writable
4. **Environment Variables**: Verify environment variable format and escaping

### Debug Mode

Enable debug logging to see detailed token registration information:

```bash
LOG_LEVEL=debug npm start
```

## Examples

### Complete Setup Script

```bash
#!/bin/bash

# Set up common DAO tokens
export TOKENS_1="DAO_VOTING:DVT:0x1234567890abcdef:dega_dao_vote:DAO voting token"
export TOKENS_2="FUNDING:FUND:0xfedcba0987654321:dega_funding_token:Funding token"
export TOKENS_3="REWARD:REW:0x1111111111111111:reward_token:Reward token"

# Start the service (tokens will be auto-registered)
npm start
```

### API Integration Example

```typescript
import { WalletServiceMCP } from './src/mcp/index.js';

const walletService = WalletServiceMCP.getInstance();

// Register tokens programmatically
const tokens = [
  {
    name: 'DAO_VOTING',
    symbol: 'DVT',
    contractAddress: '0x1234567890abcdef',
    domainSeparator: 'dega_dao_vote',
    description: 'DAO voting token'
  }
];

const result = walletService.registerTokensBatch(tokens);
console.log(`Registered ${result.registeredCount} tokens`);
```
