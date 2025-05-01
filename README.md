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

### 2. Generate Wallet Seed

Generate a wallet seed:

```bash
# Run the generate-seed script
yarn generate-seed
```

The script will generate and display:
- A **Midnight Seed** (a hex string) - The entropy value used for your wallet
- A **BIP39 Mnemonic** - The word sequence corresponding to your seed

**IMPORTANT:** Save these values securely. The seed and mnemonic provide access to your funds.

**NOTE:** The BIP39 mnemonic can be imported into any GUI wallet that supports the Midnight blockchain, providing direct access to your funds.

### 3. Configure Environment Variables

Create a `.env` file with the necessary configuration values:

```bash
# Copy the example .env file and customize it
cp .env.example .env
```

Edit the `.env` file to include your generated seed:

```
# Required
SEED=your_generated_seed_here
```

### 4. Start the Proof Server

The Midnight MCP server requires a proof server for cryptographic operations. Start it using Docker Compose:

```bash
docker-compose up -d
```

This will start a container running the Midnight proof server on port 6300.

### 5. Building and Running the Server

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
      "midnight-mcp-server": {
        "type": "stdio",
        "name": "Midnight MCP Server",
        "command": "node",
        "args": ["<path>/midnight-mcp/dist/stdio-server.js"]
      }
    }
  }
```

NOTE: Replace `<path>` with the absolute path to directory where you cloned the `midnight-mcp` repository.
