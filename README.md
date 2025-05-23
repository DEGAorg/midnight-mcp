# Midnight MCP Server

A Model Context Protocol (MCP) server implementation with STDIO transport for the Midnight network.

## Overview

This server implements the Model Context Protocol for integration with the Midnight cryptocurrency network. It provides a standard interface for AI models to interact with the Midnight blockchain, wallet functionality, and other network services.

## Prerequisites

- Node.js (v18.20.5)
- Yarn package manager
- Docker and Docker Compose (for running the proof server)

## Setup and Installation

### 1. Install Dependencies

```bash
yarn install
```

### 2. Set Up Agent

Set up a new agent with the provided script:

```bash
# Set up a new agent with an auto-generated seed
yarn setup-agent -a agent-123

# Set up a new agent in a specific directory
yarn setup-agent -a agent-123 -d /path/to/your/project

# Or provide your own seed
yarn setup-agent -a agent-123 -s "your-seed-here"

# Force overwrite existing seed file
yarn setup-agent -a agent-123 -f

# Additional options:
# -w, --words <number>    Number of words in mnemonic (12 or 24, default: 24)
# -p, --password <string> Optional password for additional security
```

The script will:
1. Create the necessary directory structure
2. Generate or verify the provided seed
3. Display the generated wallet information:
   - Midnight Seed (hex)
   - BIP39 Mnemonic
   - Derived Seed (if password was provided)

**IMPORTANT:** Save these values securely. The seed and mnemonic provide access to your funds.

**NOTE:** The BIP39 mnemonic can be imported into any GUI wallet that supports the Midnight blockchain, providing direct access to your funds.

### 3. Configure Environment Variables

Create a `.env` file with the necessary configuration values:

```bash
# Copy the example .env file and customize it
cp .env.example .env
```

Edit the `.env` file to include your agent ID:

```
# Required
AGENT_ID=agent-123
```

### 4. Start the Proof Server

The Midnight MCP server requires a proof server for cryptographic operations. Start it using Docker Compose:

```bash
docker-compose up -d
```

This will start a container running the Midnight proof server on port 6300.

### 5. Building the Server

#### For Production

For production environments, build the server and run from the dist directory:

```bash
# Build the MCP server
yarn build:mcp
```

The stdio-server provides a standard input/output interface that conforms to the Model Context Protocol, allowing AI models to communicate with the Midnight network.

## MCP Server Configuration for AI Models

JSON Config:

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
AGENT_ID=agent-123 yarn dev:mcp:stdio
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