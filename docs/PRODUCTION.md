# Midnight MCP Production Deployment Guide

This guide outlines how to deploy the Midnight MCP (Midnight Coordination Point) server in a production environment using Docker Compose.

## Prerequisites

- Docker and Docker Compose installed on your server
- Node.js and Yarn installed for initial setup
- A secure environment for storing sensitive wallet seeds and API keys

## Production Deployment Steps

### 1. Clone and Install Dependencies

First install dependencies:

```bash
# Install dependencies using Yarn
yarn install
```

### 2. Generate Wallet Seed and API Key

After installing dependencies, generate a wallet seed and API key that will be used for authentication:

```bash
# Run the generate-seed script
yarn generate-seed
```

The script will generate and display:
- A **Midnight Seed** (a hex string) - This is the entropy value used for your wallet
- A **BIP39 Mnemonic** - The word sequence corresponding to your seed
- A **Secure API Key** - Required for authenticating API requests to your MCP server

**IMPORTANT:** Save all of these values securely. The seed and mnemonic provide access to your funds, and the API key controls access to your MCP API.

**NOTE:** The BIP39 mnemonic can be imported into any GUI wallet that supports the Midnight blockchain, providing direct access to your funds. Always keep your mnemonic secure.

### 3. Configure Environment Variables

Create a `.env` file with the necessary configuration values. An `.env.example` file is provided in the repository with all available options:

```bash
# Copy the example .env file and customize it
cp .env.example .env
```

Edit the `.env` file to include your generated seed and API key:

```
# Required
SEED=your_generated_seed_here
API_KEY=your_generated_api_key_here

# Optional (defaults shown)
NETWORK_ID=TestNet
MCP_PORT=3000
PROOF_SERVER_PORT=6300
WALLET_FILENAME=midnight-wallet
LOG_LEVEL=info

# Advanced network configuration (if needed)
# INDEXER=https://custom-indexer.example.com/api/v1/graphql
# INDEXER_WS=wss://custom-indexer.example.com/api/v1/graphql/ws
# NODE=https://custom-node.example.com
```

### 4. Deploy with Docker Compose

The project includes a `docker-compose.yml` file that configures both the MCP server and its required proof server for production use. The Docker Compose approach simplifies deployment by handling networking, volume management, and container coordination automatically.

Start the services using:

```bash
# Start the services in detached mode
docker-compose up -d
```

This will:
- Build the MCP server image if needed
- Start the MCP server and proof server containers
- Link them on a private network
- Mount the necessary volumes for data persistence
- Expose the services on the configured ports

To check the service status:

```bash
docker-compose ps
```

To view the logs:

```bash
# View logs for all services
docker-compose logs

# View logs for just the MCP server and follow output
docker-compose logs -f mcp
```

### 5. API Authentication

Agents and services connecting to the MCP server must include the API key in each request.

There are two ways to pass the API key:

1. **HTTP header** (preferred method):
   ```
   x-api-key: your_generated_api_key_here
   ```

2. **Query parameter**:
   ```
   ?api_key=your_generated_api_key_here
   ```

Example of making an authenticated request:

```bash
curl -H "x-api-key: your_generated_api_key_here" http://your-server:3000/address
```

## Container Management

### Docker Compose Commands

```bash
# Stop all services
docker-compose stop

# Start all services
docker-compose start

# Restart all services
docker-compose restart

# Stop and remove containers, networks, and volumes
docker-compose down

# Rebuild and restart services
docker-compose up -d --build
```

### Service-Specific Commands

```bash
# Restart just the MCP server
docker-compose restart mcp

# View logs for just the proof server
docker-compose logs proof-server
```

## Data Persistence and Backups

The Docker Compose configuration creates several volumes to persist data:

- `wallet-backups`: Stores wallet backup files
- `logs`: Stores application logs

You can back up these volumes to ensure data persistence:

```bash
# Create a backup directory
mkdir -p ~/midnight-mcp-backups

# Back up the wallet backups
docker run --rm -v midnight-mcp_wallet-backups:/data -v ~/midnight-mcp-backups:/backup \
  busybox tar czf /backup/wallet-backups-$(date +%Y%m%d).tar.gz -C /data .

# Back up the logs
docker run --rm -v midnight-mcp_logs:/data -v ~/midnight-mcp-backups:/backup \
  busybox tar czf /backup/logs-$(date +%Y%m%d).tar.gz -C /data .
```

Note the volume names include the project name prefix (usually the directory name or specified with `-p`).

## Upgrading

To upgrade to a new version:

1. Pull the latest code:
   ```bash
   git pull
   ```

2. Rebuild and restart the services:
   ```bash
   docker-compose down
   docker-compose up -d --build
   ```

This process will preserve all data stored in the volumes while upgrading the containers to the latest code.

## Troubleshooting

### Connection Issues
- Verify the containers are running: `docker-compose ps`
- Check logs for errors: `docker-compose logs mcp`
- Ensure API key is correctly configured in requests

### Wallet Not Syncing
- Check network connectivity to the indexer and node services
- Verify NETWORK_ID is correct in your .env file
- Restart the services: `docker-compose restart`

### Proof Server Issues
- Check if the proof server is running: `docker-compose ps proof-server`
- View proof server logs: `docker-compose logs proof-server`
- Ensure the MCP server can communicate with the proof server

### API Authentication Errors
- Confirm API_KEY in .env matches the key used in requests
- Check that 'x-api-key' header is properly formatted in requests 