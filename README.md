# Midnight MCP Server

A Model Context Protocol (MCP) server implementation with STDIO transport for the Midnight network.

## Overview

This server implements the Model Context Protocol for integration with the Midnight cryptocurrency network. It provides a standard interface for AI models to interact with the Midnight blockchain, wallet functionality, and other network services.

The architecture consists of two main components:
1. **Wallet Server** (`server.ts`) - An Express.js HTTP server that runs the wallet logic and exposes REST API endpoints
2. **STDIO Server** (`stdio-server.ts`) - An MCP-compliant server that acts as a proxy, forwarding tool calls to the wallet server via HTTP requests

## Quick Start

### Prerequisites

- Node.js (v18.20.5)
- Yarn package manager
- Docker and Docker Compose (for production deployment)

### Basic Setup

```bash
# Install dependencies
yarn install

# Build
yarn build

# Set up a new agent
yarn setup-agent -a <agent-name>

# Or set up with a specific hex seed (32-byte entropy)
yarn setup-agent -a <agent-name> -s "your-hex-seed-here"

# Or set up with a BIP39 mnemonic phrase
yarn setup-agent -a <agent-name> -m "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"

# Follow the instructions in the terminal
```

**Note:** The setup scripts support both hex seeds (32-byte entropy) and BIP39 mnemonic phrases. The hex seed is the actual entropy used by the Midnight wallet, while the mnemonic is a human-readable representation of the same cryptographic material.

For detailed setup instructions, see [docs/setup-guide.md](docs/setup-guide.md).

## Project Structure

```
midnight-mcp/
├── src/                    # Source code
│   ├── mcp/               # MCP protocol implementation
│   ├── wallet/            # Wallet management
│   ├── logger/            # Logging system
│   ├── audit/             # Audit trail system
│   └── server.ts          # Express server
├── test/                  # Test suites
│   ├── unit/              # Unit tests
│   ├── integration/       # Integration tests
│   └── e2e/               # End-to-end tests
├── docs/                  # Documentation
│   ├── index.md           # Documentation index
│   ├── system-design.md   # Architecture & API flows
│   ├── setup-guide.md     # Complete setup guide
│   └── wallet-mcp-api.md  # API reference
├── scripts/               # Setup and utility scripts
├── agents/                # Agent-specific configurations
└── docker-compose.yml     # Docker deployment
```

## Architecture

The Midnight MCP server follows a layered architecture:

- **MCP Protocol Layer**: STDIO server implementing the Model Context Protocol
- **HTTP Communication Layer**: HTTP client for wallet server communication
- **Wallet Server Layer**: Express.js server with wallet logic and REST API
- **Storage Layer**: File-based storage for seeds, transactions, and backups
- **External Services**: Integration with Midnight blockchain services

For detailed architecture diagrams and API flows, see [docs/system-design.md](docs/system-design.md).

## Documentation

For complete documentation, including setup guides, API reference, testing, and integration examples, see [docs/index.md](docs/index.md).

## License

```json
"mcp": {
    "servers": {
      "midnight-mcp": {
        "type": "stdio",
        "name": "Midnight MCP",
        "command": "bash",
        "args": [
          "-c",
          "source ~/.nvm/nvm.sh && AGENT_ID=<agent-id> nvm exec 22.15.1 node <path>/midnight-mcp/dist/stdio-server.js"
        ]
      }
    }
  }
```

### Agent ID Configuration

The MCP server supports multiple agents running simultaneously through the use of agent IDs. Each agent gets its own isolated storage space for wallet data and transactions.

#### Setting Agent ID

You can set the agent ID in two ways:

1. **Through Environment Variable** (Required):
```json
"args": [
  "-c",
  "source ~/.nvm/nvm.sh && nvm exec 22.15.1 AGENT_ID=agent-123 yarn start:mcp"
]
```

#### Storage Structure

Each agent's data is stored in an isolated directory:
```
storage/
  ├── seeds/
  │   ├── agent-123/
  │   │   └── seed
  │   └── agent-456/
  │       └── seed
  ├── wallet-backups/
  │   ├── agent-123/
  │   │   ├── wallet-1.json
  │   │   └── wallet-1-transactions.db
  │   └── agent-456/
  │       ├── wallet-1.json
  │       └── wallet-1-transactions.db
  └── logs/
      ├── agent-123/
  │       └── wallet-app.log
  └── agent-456/
      └── wallet-app.log
```

For development, you can run with an agent ID:
```bash
AGENT_ID=agent-123 yarn dev
```

NOTE: Replace `<path>` with the absolute path to directory where you cloned the `midnight-mcp` repository.

## Integrating with ElizaOS

### Install ElizaOS

Install Node.js: Ensure you have Node.js 23.3.0+ installed on your system. You can download and install it from the official Node.js website: https://docs.npmjs.com/downloading-and-installing-node-js-and-npm

Install the ElizaOS CLI: Run the following command in your terminal:

```bash
npm install -g @elizaos/cli@beta
```

This will install the ElizaOS CLI globally on your system.

Verify the Installation: After the installation is complete, verify that the ElizaOS CLI is working by running the following command:

```bash
elizaos --version
```

This should display the version of the ElizaOS CLI installed on your system.

To create a new Eliza project using the eliza create command, follow these steps:

1. Open a Terminal: Open a terminal window on your system.
2. Run the eliza create Command: Run the following command in the terminal:

```bash
elizaos create
```

This will launch the ElizaOS project creation wizard:

3. Follow the Wizard: Follow the prompts in the wizard to configure your new Eliza project. You will be asked to provide some basic project information, such as the project name and description.
4. Create the Project: After filling in the required information, the wizard will create a new Eliza project for you. This may take a few seconds to complete.
5. Navigate to the Project Directory: Once the project is created, navigate to the project directory using the cd command:

```bash
cd my-project-name
```

Replace my-project-name with the actual name of your project.

```bash
elizaos start
```

This will launch the ElizaOS server and make the agent accessible via the web interface at https://localhost:3000.

You now have a new Eliza project up and running!

### Install the MCP Plugin for ElizaOS

Inside your eliza project run:

```bash
bun add @fleek-platform/eliza-plugin-mcp
```

Now in the character.json file that you'll use to create your AI Agent add the mcp json structure shown above.

All set! You're ready to use AI agents with on-chain capabilities for the Midnight blockchain.

## E2E Testing with ElizaOS

This project includes comprehensive End-to-End testing that validates the integration between the Midnight MCP server and ElizaOS using the [@fleek-platform/eliza-plugin-mcp](https://github.com/fleek-platform/eliza-plugin-mcp).

### Quick Demo

Run the interactive demo to see ElizaOS + MCP integration in action:

```bash
yarn demo:eliza
```

This will:
1. Check prerequisites and install ElizaOS CLI if needed
2. Create a demo ElizaOS project with MCP integration
3. Configure the Midnight MCP server connection
4. Provide instructions to start the agent

### E2E Test Suites

Run different types of E2E tests:

```bash
# Direct MCP protocol testing
yarn test:e2e

# STDIO JSON-RPC testing
yarn test:e2e:stdio

# ElizaOS integration testing  
yarn test:e2e:eliza

# Comprehensive test suite
yarn test:e2e:full

# Interactive demo
yarn demo:eliza
```

### ElizaOS Integration Features

The MCP server integrates with ElizaOS to provide:

- **AI Agent Conversations**: Natural language interactions with blockchain tools
- **Automatic Tool Discovery**: MCP tools are automatically available to agents
- **Contextual Help**: Agents understand Midnight blockchain concepts
- **Error Handling**: Graceful error handling in conversational context
- **Real-time Updates**: Live wallet and transaction status updates

### Available MCP Tools for Agents

When integrated with ElizaOS, agents have access to these tools, grouped by category:

#### Wallet Tools

- `walletStatus` - Check wallet synchronization status
- `walletAddress` - Get wallet receiving address
- `walletBalance` - View current balance
- `getTransactions` - List transaction history
- `getTransactionStatus` - Get the status of a transaction by ID
- `sendFunds` - Send funds to another address
- `verifyTransaction` - Verify transaction status
- `getWalletConfig` - Get wallet configuration

#### Marketplace Tools

- `registerInMarketplace` - Register a user in the marketplace
- `verifyUserInMarketplace` - Verify a user in the marketplace

### Example Agent Conversations

```
User: "Hello! Can you check my wallet status?"
Agent: "I'll check your wallet status for you! 💰 Let me connect to the Midnight network..."

User: "What's my current balance?"
Agent: "Let me check your current balance on the Midnight network. 🔍"

User: "Show me my recent transactions"
Agent: "I'll fetch your recent transactions from the Midnight blockchain. ⛓️"
```

For detailed E2E testing documentation, see [test/e2e/README.md](test/e2e/README.md).
