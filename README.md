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

# Follow the instrucitons in the terminal
```

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

This project is licensed under the MIT License.
