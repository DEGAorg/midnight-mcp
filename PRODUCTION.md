# Midnight MCP Production Deployment Guide

This guide outlines how to deploy the Midnight MCP (Midnight Coordination Point) server and proof server in a production environment using Docker Compose.

## Prerequisites

- Docker and Docker Compose installed on your server
- A secure environment for storing sensitive wallet seeds

## Quick Start

1. Clone the repository:
   ```bash
   git clone https://github.com/your-organization/midnight-mcp.git
   cd midnight-mcp
   ```

2. Create a `.env` file with your configuration (you can copy from `.env.example`):
   ```bash
   cp .env.example .env
   ```

3. Generate a new wallet seed (if you don't already have one):
   ```bash
   docker-compose run --rm mcp yarn generate-seed
   ```

4. Update the `.env` file with your seed and any other configuration:
   ```
   SEED=your_generated_seed_here
   NETWORK_ID=TestNet
   # Configure other settings as needed
   ```

5. Start the services:
   ```bash
   docker-compose up -d
   ```

6. Check the logs to monitor the startup process:
   ```bash
   docker-compose logs -f
   ```

## Configuration Options

### Required Environment Variables

- `SEED`: Your wallet seed (required)

### Optional Environment Variables

- `NETWORK_ID`: Network to connect to (MainNet, TestNet, DevNet - defaults to TestNet)
- `MCP_PORT`: Port to expose the MCP server on (defaults to 3000)
- `PROOF_SERVER_PORT`: Port to expose the proof server on (defaults to 6300)
- `WALLET_FILENAME`: Name used for wallet backup files (defaults to midnight-wallet)
- `LOG_LEVEL`: Logging level (debug, info, warn, error - defaults to info)

### Network Configuration

By default, the MCP server will connect to the Midnight TestNet. To connect to a different network:

```
NETWORK_ID=MainNet
INDEXER=https://indexer.midnight.network/api/v1/graphql
INDEXER_WS=wss://indexer.midnight.network/api/v1/graphql/ws
NODE=https://rpc.midnight.network
```

## Volumes and Data Persistence

The Docker Compose configuration creates several volumes to persist data:

- `wallet-backups`: Stores wallet backup files
- `logs`: Stores application logs
- `proof-server-data`: Stores proof server data

You can back up these volumes to ensure data persistence:

```bash
docker volume backup midnight-mcp_wallet-backups
```

## Health Checks

The Docker Compose configuration includes health checks for both services. You can monitor the health status with:

```bash
docker-compose ps
```

The MCP server exposes a `/health` endpoint that can be used for monitoring and load balancer checks.

## Security Considerations

1. **Protect your seed**: The wallet seed grants full access to your funds. Ensure it's kept secret and secure.

2. **Network security**: Configure your firewall to only expose the necessary ports.

3. **Consider using Docker secrets**: For production deployments, consider using Docker secrets instead of environment variables for sensitive data.

4. **Regular backups**: Set up a backup strategy for your wallet data.

## Troubleshooting

### Wallet Not Syncing

If the wallet is not syncing properly:

1. Check the logs:
   ```bash
   docker-compose logs mcp
   ```

2. Try restarting the services:
   ```bash
   docker-compose restart
   ```

3. Check network connectivity to the indexer and node services.

### Proof Server Issues

If the proof server is not functioning:

1. Check the logs:
   ```bash
   docker-compose logs proof-server
   ```

2. Ensure the NETWORK environment variable matches your NETWORK_ID.

3. Verify that the proof server is accessible from the MCP container:
   ```bash
   docker-compose exec mcp wget --spider --quiet http://proof-server:6300/health
   ```

## Upgrading

To upgrade to a new version:

1. Pull the latest code:
   ```bash
   git pull
   ```

2. Rebuild and restart the services:
   ```bash
   docker-compose down
   docker-compose build
   docker-compose up -d
   ```

## Advanced Configuration

For advanced configurations, such as integration with external monitoring systems or custom network settings, refer to the detailed documentation. 