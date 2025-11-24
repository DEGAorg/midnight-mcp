# Midnight MCP Setup Guide

Complete setup and installation instructions for the Midnight MCP server.

## Prerequisites

- Node.js (v18.20.5)
- Yarn package manager

## Installation

### 1. Install Dependencies

```bash
yarn install
```

## Development Setup (Local)

For local development, set up an agent and run the development server:

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

### Run Development Server

```bash
# Start the development server
yarn dev AGENT_ID=<agent-name>
```

This will start the wallet express server in development mode with hot reloading.
This is not the MCP server, but the logic server. The MCP is the stdio process run after built.

## Building for Production

### Build the Application

```bash
# Build the application
yarn build
```

### Run Production Server

The stdio-server is not an standalone process, it meant for AI usage, so after building there is no need to run it manually.

The stdio-server provides a standard input/output interface that conforms to the Model Context Protocol, allowing AI models to communicate with the Midnight network via HTTP requests to the wallet server.

## MCP Server Configuration for AI Models

### JSON Config

```json
"mcp": {
    "servers": {
      "midnight-mcp": {
        "type": "stdio",
        "name": "Midnight MCP",
        "command": "bash",
        "args": [
          "-c",
          "source ~/.nvm/nvm.sh && AGENT_ID=testing nvm exec 22.15.1 node /Users/apple/dev/workstuff/MIDNIGHTAI-SIM/repo/midnight-mcp/dist/index.js"
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

### E2E Test Suites

Run different types of E2E tests:

```bash
# End to End testing by Jest -> MCP -> Wallet -> Blockchain
yarn test:e2e
```

### ElizaOS Integration Features

The MCP server integrates with ElizaOS to provide:

- **AI Agent Conversations**: Natural language interactions with blockchain tools
- **Automatic Tool Discovery**: MCP tools are automatically available to agents
- **Contextual Help**: Agents understand Midnight blockchain concepts
- **Error Handling**: Graceful error handling in conversational context
- **Real-time Updates**: Live wallet and transaction status updates

### Available MCP Tools for Agents

When integrated with ElizaOS, agents have access to these tools:

- `walletStatus` - Check wallet synchronization status
- `walletAddress` - Get wallet receiving address
- `walletBalance` - View current balance
- `getTransactions` - List transaction history
- `sendFunds` - Send funds to another address
- `verifyTransaction` - Verify transaction status
- `getWalletConfig` - Get wallet configuration

### Example Agent Conversations

```
User: "Hello! Can you check my wallet status?"
Agent: "I'll check your wallet status for you! 💰 Let me connect to the Midnight network..."

User: "What's my current balance?"
Agent: "Let me check your current balance on the Midnight network. 🔍"

User: "Show me my recent transactions"
Agent: "I'll fetch your recent transactions from the Midnight blockchain. ⛓️"
```

For detailed E2E testing documentation, see [test/e2e/README.md](../test/e2e/README.md). 