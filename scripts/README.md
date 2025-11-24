# Scripts Documentation

This directory contains utility scripts for agent setup, testing, and demonstration purposes.

## Available Scripts

### Setup & Configuration

#### `setup-agent.ts`

Creates and configures an agent with wallet credentials and directory structure.

**Usage:**
```bash
# Generate new agent with random seed
yarn setup-agent -a my-agent

# Import existing hex seed
yarn setup-agent -a my-agent -s "0123456789abcdef..."

# Import BIP39 mnemonic
yarn setup-agent -a my-agent -m "word1 word2 word3 ..."

# Force overwrite existing seed
yarn setup-agent -a my-agent -f
```

**Options:**
- `-a, --agent-id <id>` — Agent identifier (required)
- `-s, --seed <hex>` — Import 64-character hex seed
- `-m, --mnemonic <words>` — Import BIP39 mnemonic (12 or 24 words)
- `-f, --force` — Overwrite existing seed file
- `-w, --words <number>` — Mnemonic word count (12 or 24, default: 24)
- `-p, --password <string>` — Optional password for additional security
- `-d, --dir <path>` — Project root directory (default: current directory)

**What it creates:**
```
.storage/
├── seeds/<agent-id>/seed          # 32-byte hex entropy
├── wallet-backups/<agent-id>/     # Wallet state backups
├── transaction-db/<agent-id>/     # SQLite transaction databases
└── logs/<agent-id>/               # Agent-specific logs
```

**Output:**
- Hex seed (32 bytes = 64 hex characters)
- BIP39 mnemonic (for backup and GUI wallet import)
- MCP configuration for Claude Desktop/Cursor
- Instructions for Claude Code configuration

---

#### `generate-seed.ts`

BIP39 mnemonic and seed generation/conversion utility.

**Usage:**
```bash
# Generate new 24-word mnemonic
yarn generate-seed

# Generate 12-word mnemonic
yarn generate-seed -w 12

# Convert mnemonic to seed
yarn generate-seed -m "word1 word2 ... word24"

# Verify hex seed
yarn generate-seed -s "0123456789abcdef..."
```

**Options:**
- `-w, --words <number>` — Word count (12 or 24, default: 24)
- `-p, --password <string>` — Optional password
- `-f, --format <string>` — Output format (full or compact)
- `-e, --entropy <hex>` — Use provided entropy
- `-s, --seed <hex>` — Verify existing seed
- `-m, --mnemonic <string>` — Convert mnemonic to seed
- `-M, --midnight-seed <hex>` — Convert Midnight seed to mnemonic

**Use Cases:**
- Generate wallet seeds for testing
- Convert between hex seeds and mnemonics
- Validate existing seeds
- Create backup mnemonics

---

#### `generate-mcp-config.sh`

Generates MCP configuration for Claude Code with automatic NVM Node.js path detection.

**Usage:**
```bash
yarn mcp:config
```

**What it does:**
1. Finds Node.js >= 20 in NVM
2. Generates MCP JSON configuration with absolute paths
3. Copies configuration to clipboard (macOS)
4. Displays configuration for manual pasting

**Output:**
```json
"midnight-mcp": {
  "type": "stdio",
  "name": "Midnight MCP",
  "command": "/path/to/node",
  "args": ["/path/to/dist/mcp/stdio-server.js"],
  "env": {
    "AGENT_ID": "workshop",
    "LOG_LEVEL": "error",
    "BASE_STORAGE_DIR": "/path/to/.storage"
  },
  "cwd": "/path/to/project"
}
```

**Requirements:**
- NVM installed with Node.js >= 20
- macOS (for clipboard copy via `pbcopy`)

---

### Demo & Examples

#### `demo-eliza-mcp.ts`

Automated demo setup for ElizaOS + MCP integration.

**Usage:**
```bash
yarn demo:eliza
```

**What it does:**
1. Checks prerequisites (Node.js, ElizaOS CLI)
2. Creates `demo-eliza-mcp-project/` directory
3. Generates ElizaOS project structure
4. Installs dependencies (@elizaos/core, MCP plugin)
5. Creates character configuration with MCP settings
6. Provides step-by-step instructions

**Prerequisites:**
- Node.js 18.20.5+
- ElizaOS CLI (will attempt to install if missing)

**Output Structure:**
```
demo-eliza-mcp-project/
├── package.json                    # ElizaOS dependencies
├── characters/                     # Agent characters
│   └── midnight-agent.json         # MCP-enabled agent
├── .env                            # Environment configuration
└── node_modules/                   # ElizaOS + MCP plugin
```

**After Setup:**
```bash
cd demo-eliza-mcp-project
npm start
# Opens browser to http://localhost:3003
```

---

### Testing Scripts

#### `test-e2e-eliza.ts`

Comprehensive ElizaOS + MCP integration end-to-end test.

**Usage:**
```bash
tsx scripts/test-e2e-eliza.ts
```

**What it tests:**
1. ElizaOS CLI installation
2. Create ElizaOS project
3. MCP plugin installation
4. MCP server health check
5. Start ElizaOS server
6. MCP integration validation
7. Conversation flow
8. MCP tool execution

**Prerequisites:**
- Built project (`yarn build`)
- Test agent setup (`yarn setup-agent -a test-agent`)
- Network connectivity to Midnight testnet

**Test Flow:**
```
Setup → Start MCP Server → Install ElizaOS → Configure MCP →
Start ElizaOS → Test Integration → Validate Tools → Cleanup
```

---

#### `test-e2e-full.ts`

Comprehensive test suite runner for all test types.

**Usage:**
```bash
tsx scripts/test-e2e-full.ts
```

**Test Suites Run:**
1. **Health Checks**
   - Node.js version verification
   - TypeScript compilation
   - Dependencies check

2. **Unit Tests** (60s timeout)
   - 429 tests across 18 suites
   - 100% coverage

3. **Integration Tests** (120s timeout)
   - HTTP server with real transport
   - Session management

4. **Jest E2E Tests** (180s timeout)
   - MCP SDK validation
   - Tool execution

5. **STDIO Protocol Tests** (120s timeout)
   - Direct JSON-RPC testing

**Output:**
- Test summary with pass/fail counts
- Performance metrics
- JSON report in `test-results/`

---

#### `test-audit-trail.ts`

Demonstrates audit trail functionality with comprehensive examples.

**Usage:**
```bash
tsx scripts/test-audit-trail.ts
```

**What it demonstrates:**
- Audit event logging
- Transaction tracing
- Agent decision tracking
- Test outcome logging
- Audit data export
- Performance testing (50 events)

**Use Cases:**
- Understanding audit system
- Testing audit functionality
- Performance benchmarking

---

### Utility Scripts

#### `query.ts`

ElizaOS API client example and testing script.

**Usage:**
```bash
tsx scripts/query.ts
```

**What it does:**
- Connects to ElizaOS API client
- Lists available agents
- Fetches agent by name
- Sends messages to channels
- Retrieves channel messages

**Status:** Example/testing script, not production-ready

**Prerequisites:**
- Running ElizaOS server
- Valid API endpoint configuration

---

#### `register-tokens.ts`

Batch token registration utility.

**Usage:**
```bash
tsx scripts/register-tokens.ts
```

**What it does:**
- Registers common tokens (DAO_VOTING, FUNDING, REWARD)
- Supports environment variable configuration
- Waits for wallet readiness
- Provides registration statistics

**Status:** Currently broken - import path needs fixing

**Prerequisites:**
- Running wallet service
- Agent setup with valid seed

---

#### `get-node-path.sh`

Helper script to find Node.js executable in NVM.

**Usage:**
```bash
./scripts/get-node-path.sh
```

**What it does:**
1. Searches NVM directory for Node.js v20+
2. Sorts versions and selects latest
3. Validates node binary exists
4. Returns absolute path to node executable

**Called by:** `generate-mcp-config.sh`

**Requirements:**
- NVM installed
- Node.js >= 20 in NVM

---

## Usage Patterns

### Setting Up a New Agent

```bash
# Step 1: Build project
yarn build

# Step 2: Set up agent
yarn setup-agent -a my-agent

# Step 3: Configure MCP (for Claude Code)
yarn mcp:config
# Paste output into Claude Code MCP settings
```

### Running Demo

```bash
# Create demo project
yarn demo:eliza

# Navigate to demo
cd demo-eliza-mcp-project

# Start ElizaOS
npm start
```

### Running Tests

```bash
# Unit tests only
yarn test:unit

# Integration tests only
yarn test:integration

# E2E tests only
yarn test:e2e

# Or run comprehensive test suite
tsx scripts/test-e2e-full.ts
```

---

## Troubleshooting

### "Agent seed not found"

**Solution:** Run `yarn setup-agent -a <agent-id>` first

### "NVM not found"

**Solution:** Install NVM or use absolute Node.js path in MCP config

### "ElizaOS CLI not found"

**Solution:** Install globally: `npm install -g @elizaos/cli@beta`

### "Import path error in register-tokens.ts"

**Solution:** Script needs import path fix - currently broken

---

## Related Documentation

- [Main Documentation](../docs/index.md) - Documentation index
- [Setup Guide](../docs/setup-guide.md) - Complete setup instructions
- [Testing Guide](../test/README.md) - Testing overview and commands
- [E2E Testing](../test/e2e/E2E_OVERVIEW.md) - End-to-end test details

---

## Script Index

| Script | Purpose | Usage |
|--------|---------|-------|
| `setup-agent.ts` | Create agent with wallet | `yarn setup-agent -a <id>` |
| `generate-seed.ts` | Generate/convert seeds | `yarn generate-seed` |
| `generate-mcp-config.sh` | Generate MCP config | `yarn mcp:config` |
| `demo-eliza-mcp.ts` | Create ElizaOS demo | `yarn demo:eliza` |
| `test-e2e-eliza.ts` | ElizaOS E2E tests | `tsx scripts/test-e2e-eliza.ts` |
| `test-e2e-full.ts` | Full test suite | `tsx scripts/test-e2e-full.ts` |
| `test-audit-trail.ts` | Audit trail demo | `tsx scripts/test-audit-trail.ts` |
| `query.ts` | ElizaOS API example | `tsx scripts/query.ts` |
| `register-tokens.ts` | Batch token registration | `tsx scripts/register-tokens.ts` |
| `get-node-path.sh` | Find Node.js in NVM | `./scripts/get-node-path.sh` |

---

*For package.json scripts (yarn commands), see the [Available Commands](#) section in the main README.*
