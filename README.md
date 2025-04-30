# Midnight MCP Server

A Model Context Protocol (MCP) server implementation with STDIO transport for the Midnight network.

## Overview

This server implements the Model Context Protocol for integration with the Midnight cryptocurrency network. It provides a standard interface for AI models to interact with the Midnight blockchain, wallet functionality, and other network services.

## Prerequisites

- Node.js (v18.20.5)
- Yarn package manager
- Docker and Docker Compose (for running the proof server)
- A secure environment for storing sensitive wallet seeds and API keys

## Setup and Installation

### 1. Install Dependencies

```bash
yarn install
```

### 2. Generate Wallet Seed and API Key

Generate a wallet seed and API key for authentication:

```bash
# Run the generate-seed script
yarn generate-seed
```

The script will generate and display:
- A **Midnight Seed** (a hex string) - The entropy value used for your wallet
- A **BIP39 Mnemonic** - The word sequence corresponding to your seed
- A **Secure API Key** - Required for authenticating API requests to your MCP server

**IMPORTANT:** Save all of these values securely. The seed and mnemonic provide access to your funds, and the API key controls access to your MCP API.

**NOTE:** The BIP39 mnemonic can be imported into any GUI wallet that supports the Midnight blockchain, providing direct access to your funds.

### 3. Configure Environment Variables

Create a `.env` file with the necessary configuration values:

```bash
# Copy the example .env file and customize it
cp .env.example .env
```

Edit the `.env` file to include your generated seed and API key:

```
# Required
SEED=your_generated_seed_here
API_KEY=your_generated_api_key_here
```

### 4. Start the Proof Server

The Midnight MCP server requires a proof server for cryptographic operations. Start it using Docker Compose:

```bash
docker-compose up -d
```

This will start a container running the Midnight proof server on port 6300.

### 5. Building and Running the Server

#### For Development

For development purposes, you can run the server with:

```bash
yarn dev:mcp
```

This will run the server in development mode with hot reloading.

#### For Production

For production environments, build the server and run from the dist directory:

```bash
# Build the MCP server
yarn build:mcp

# Run the server
node dist/stdio-server.js
```

The stdio-server provides a standard input/output interface that conforms to the Model Context Protocol, allowing AI models to communicate with the Midnight network.

## Server Configuration

The `stdio-server.ts` file initializes a Midnight wallet instance using configuration from `config.js`. It provides:

- STDIO transport for seamless integration with AI models
- Error handling for both MCP and Midnight-specific errors
- Tool registration and management
- Clean shutdown on process termination

## Docker Compose Deployment

The project includes a `docker-compose.yml` file that configures both the MCP server and its required proof server:

```bash
# Start the services in detached mode
docker-compose up -d
```

This will:
- Start the Midnight proof server containers

### Data Persistence and Backups

The Docker Compose configuration creates volumes to persist data:

- `wallet-backups`: Stores wallet backup files

Make sure to implement a backup strategy for these volumes to prevent data loss.
