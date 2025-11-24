# Midnight MCP Setup Guide

Complete setup and installation instructions for the Midnight MCP server. Follow this guide step-by-step to get your development environment ready.

## Prerequisites

- **Node.js** v18.20.5 or higher
- **Yarn** package manager

## Quick Start

Follow these steps in order for a complete setup:

### 1. Clone and Install

```bash
# Clone the repository
git clone https://github.com/DEGAorg/midnight-mcp.git
cd midnight-mcp

# Install dependencies
yarn install
```

### 2. Build the Project

```bash
# Build TypeScript → JavaScript (outputs to dist/)
yarn build
```

## Agent Setup

Before running any server, you need to create an agent with wallet credentials:

### Set Up Agent

```bash
# Set up a new agent with an auto-generated seed
yarn setup-agent -a <agent-name>

# Set up a new agent in a specific directory, example debugs with mcp-inspector
yarn setup-agent -a <agent-name> -d /path/to/your/project

# Or provide your own hex seed (32-byte entropy in hex format)
yarn setup-agent -a <agent-name> -s "your-hex-seed-here"

# Or provide your own BIP39 mnemonic phrase (12 or 24 words)
yarn setup-agent -a <agent-name> -m "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"

# Force overwrite existing seed file
yarn setup-agent -a <agent-name> -f

# Additional options:
# -w, --words <number>    Number of words in mnemonic (12 or 24, default: 24)
# -p, --password <string> Optional password for additional security
```

### Understanding Seeds and Mnemonics

The setup scripts work with two related but distinct concepts:

- **Hex Seed**: A 32-byte (64 hex characters) entropy value that serves as the cryptographic foundation for your wallet
- **BIP39 Mnemonic**: A human-readable phrase of 12 or 24 words that represents the same entropy in a more user-friendly format

**Key Points:**
- The hex seed is the actual entropy (random data) used by the Midnight wallet
- The mnemonic is a BIP39-compliant phrase that can be converted to/from the hex seed
- Both represent the same cryptographic material and provide access to the same wallet
- The mnemonic can be imported into any BIP39-compatible wallet that supports Midnight

The script will:
1. Create the necessary directory structure
2. Generate or verify the provided seed/mnemonic
3. Display the generated wallet information:
   - **Midnight Seed (hex)**: The 32-byte entropy in hexadecimal format
   - **BIP39 Mnemonic**: The human-readable seed phrase
   - **Derived Seed (if password provided)**: Additional entropy derived from the mnemonic + password

**IMPORTANT:** Save these values securely. Both the hex seed and mnemonic provide access to your funds.

**NOTE:** The BIP39 mnemonic can be imported into any GUI wallet that supports the Midnight blockchain, providing direct access to your funds.

### Configure Environment Variables

Create a `.env` file with the necessary configuration values.

```bash
# Copy the example .env file and customize it
cp .env.example .env
```

Edit the `.env` file to include your agent ID and wallet server configuration:

```env
# Required
AGENT_ID=<agent-name>

# Wallet Server Configuration
WALLET_SERVER_HOST=localhost
WALLET_SERVER_PORT=3000

# Network Configuration
NETWORK_ID=TestNet
WALLET_FILENAME=midnight-wallet
LOG_LEVEL=info

# External Services (if using external proof server)
USE_EXTERNAL_PROOF_SERVER=true
PROOF_SERVER=http://proof-server:8080
INDEXER=http://indexer:8080
INDEXER_WS=ws://indexer:8080
MN_NODE=http://midnight-node:8080
```

**For complete script documentation, see [scripts/README.md](../scripts/README.md).**

## Choose Your Deployment Mode

The Midnight MCP server supports three deployment modes. Choose the one that fits your use case:

### Option A: STDIO Mode (AI Assistants)

**Use Case:** Claude Desktop, Cursor IDE, single-agent development

```bash
# Development mode (with hot reload)
AGENT_ID=my-agent yarn dev

# Production mode (uses compiled dist/)
AGENT_ID=my-agent yarn start
```

**Configuration:** See [MCP Server Configuration](#mcp-server-configuration-for-ai-models) below.

### Option B: HTTP MCP Mode (Multi-Agent Platform)

**Use Case:** Multi-agent platforms, ElizaOS integration, 100+ concurrent agents

```bash
# Development mode (with hot reload)
AGENT_ID=my-agent yarn dev:mcp:http

# Production mode (runs on port 3001)
AGENT_ID=my-agent yarn start:mcp:http
```

**Features:**
- Session-based agent isolation via `mcp-session-id` header
- LRU cache with automatic eviction
- Prometheus metrics at `/metrics`
- Health checks at `/health`

### Option C: REST API Mode

**Use Case:** Legacy systems, custom web applications, testing

```bash
# Development mode (with hot reload)
AGENT_ID=my-agent yarn dev:api

# Production mode (runs on port 3000)
AGENT_ID=my-agent yarn start:api
```

**Endpoints:** `/wallet/status`, `/wallet/balance`, `/wallet/send`, etc.

**For detailed comparison of all modes, see [SERVER_MODES.md](SERVER_MODES.md).**

## MCP Server Configuration for AI Models

### Automatic Configuration (Recommended)

Generate MCP configuration automatically with NVM path detection:

```bash
yarn mcp:config
```

This will:
1. Find Node.js >= 20 in your NVM installation
2. Generate MCP JSON configuration with absolute paths
3. Copy configuration to clipboard (macOS)
4. Display configuration for manual pasting

### Manual Configuration

If you prefer manual setup, use this template:

```json
{
  "midnight-mcp": {
    "type": "stdio",
    "name": "Midnight MCP",
    "command": "node",
    "args": ["/absolute/path/to/midnight-mcp/dist/mcp/stdio-server.js"],
    "env": {
      "AGENT_ID": "my-agent",
      "LOG_LEVEL": "error",
      "BASE_STORAGE_DIR": "/absolute/path/to/midnight-mcp/.storage"
    },
    "cwd": "/absolute/path/to/midnight-mcp"
  }
}
```

**Important:** Use absolute paths, not relative paths!

### Agent ID Configuration

The MCP server supports multiple agents running simultaneously through the use of agent IDs. Each agent gets its own isolated storage space for wallet data and transactions.

#### Setting Agent ID

You can set the agent ID in two ways:

1. **Through Environment Variable** (Required):
```json
"args": [
  "-c",
  "source ~/.nvm/nvm.sh && nvm exec 22.15.1 AGENT_ID=<agent-name> yarn start:mcp"
]
```

#### Storage Structure

Each agent's data is stored in an isolated directory:
```
storage/
  ├── seeds/
  │   ├── <agent-name>/
  │   │   └── seed
  │   └── agent-456/
  │       └── seed
  ├── wallet-backups/
  │   ├── <agent-name>/
  │   │   ├── wallet-1.json
  │   │   └── wallet-1-transactions.db
  │   └── agent-456/
  │       ├── wallet-1.json
  │       └── wallet-1-transactions.db
  └── logs/
      ├── <agent-name>/
  │       └── wallet-app.log
  └── agent-456/
      └── wallet-app.log
```

For development, you can run with an agent ID:
```bash
AGENT_ID=<agent-name> yarn dev
```

**NOTE:** Replace `<path>` with the absolute path to directory where you cloned the `midnight-mcp` repository.

## Integrating with ElizaOS

### Quick Start with Demo

The easiest way to get started with ElizaOS integration:

```bash
# Create demo ElizaOS project with MCP configured
yarn demo:eliza

# Navigate to demo project
cd demo-eliza-mcp-project

# Start ElizaOS
npm start
```

This automatically creates an ElizaOS project with:
- MCP plugin installed
- Character configured with Midnight MCP tools
- Agent setup complete

**For manual ElizaOS setup, see [test/e2e/ELIZA_CLIENT_README.md](../test/e2e/ELIZA_CLIENT_README.md).**

### ElizaOS Integration Features

The MCP server integrates with ElizaOS to provide:

- **AI Agent Conversations** — Natural language interactions with blockchain tools
- **Automatic Tool Discovery** — MCP tools are automatically available to agents
- **Contextual Help** — Agents understand Midnight blockchain concepts
- **Error Handling** — Graceful error handling in conversational context
- **Real-time Updates** — Live wallet and transaction status updates

### Available MCP Tools

When integrated with ElizaOS, agents have access to these tools:

- `walletStatus` — Check wallet synchronization status
- `walletAddress` — Get wallet receiving address
- `walletBalance` — View current balance
- `getTransaction` — Get transaction details
- `sendNativeToken` — Send funds to another address
- `registerToken` — Register shielded tokens
- `sendShieldedToken` — Send shielded tokens
- Plus DAO and Marketplace tools (when contracts are configured)

**For complete API reference, see [wallet-mcp-api.md](wallet-mcp-api.md).**

## Testing

### Run Tests

```bash
# All tests
yarn test

# Unit tests only (429 tests, 100% coverage)
yarn test:unit

# Integration tests (HTTP server)
yarn test:integration

# E2E tests (with ElizaOS)
yarn test:e2e
```

**For detailed testing information, see [test/README.md](../test/README.md).**

## Additional Documentation

- **[Main README](../README.md)** — Project overview and all available commands
- **[Scripts Documentation](../scripts/README.md)** — All utility scripts with examples
- **[Server Modes Comparison](SERVER_MODES.md)** — Detailed comparison of STDIO/HTTP/API modes
- **[Architecture](ARCHITECTURE.md)** — Technical architecture and patterns
- **[Deployment Guide](DEPLOYMENT.md)** — Deployment methods and examples
- **[API Reference](wallet-mcp-api.md)** — Complete MCP tools API documentation
- **[Test Documentation](../test/README.md)** — Testing guide and organization
- **[Documentation Index](index.md)** — Complete documentation navigation

## Troubleshooting

### "ENOENT: no such file or directory, mkdir '/.storage'"

- Ensure `BASE_STORAGE_DIR` is set to **absolute path** in MCP config
- Set `cwd` to project root in MCP config
- Use `yarn mcp:config` to generate correct configuration

### "Agent seed not found"

Run `yarn setup-agent -a <agent-id>` to create agent credentials first.

### "NVM not found"

Install NVM or use absolute Node.js path in MCP configuration.

### Wallet not syncing

- Check network connectivity to indexer and RPC node
- Verify `NETWORK_ID` matches your seed's network
- Wait for initial sync (can take 1-2 minutes)
- Check logs for connection errors

---

*For more troubleshooting, see the [Common Issues](../README.md#common-issues) section in the main README.* 