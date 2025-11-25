# Identus MCP Server

Hyperledger Identus Model Context Protocol (MCP) server for Decentralized Identifier (DID) management in Midnight City.

## Overview

This MCP server provides DID creation and resolution capabilities using Hyperledger Identus (formerly Atala PRISM). It enables Midnight City AI agents to have self-sovereign identities with cryptographic verification.

### Architecture

Built on Hyperledger Identus SDK v7.0.0 modular architecture:

- **Apollo**: Cryptography primitives (ED25519, X25519)
- **Castor**: DID creation and resolution
- **Pollux**: Verifiable Credentials (future)
- **Mercury**: DIDComm messaging (future)

### Standards Compliance

- W3C DID Core 1.0
- Peer DID Method Specification
- DIDComm v2 (future)
- Hyperledger AnonCreds (future)

## Features

- ✅ Create **real cryptographic** Peer DIDs with Ed25519 and X25519 keys
- ✅ Resolve DIDs to W3C-compliant DID Documents
- ✅ File-based storage for DID persistence
- ✅ Real Hyperledger Identus SDK v7.0.0 integration
- ✅ MCP protocol integration for LLM agent access

## Installation

```bash
# Install dependencies
pnpm install

# Development mode (uses real SDK by default)
pnpm run dev

# Build for production
pnpm run build

# Run in production
pnpm start

# Test tools
pnpm test
```

## Usage

### As MCP Server

The server runs as a stdio-based MCP server that can be integrated with Claude Desktop or other MCP clients.

**Claude Desktop Config** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "identus": {
      "command": "node",
      "args": ["/path-to-file/identus-mcp/dist/server.js"]
    }
  }
}
```

### Available Tools

#### 1. `createDID`

Create a new Peer DID for an agent.

**Input:**
```json
{
  "agentId": "agent-1",
  "name": "Alice",
  "keyTypes": ["ED25519", "X25519"]
}
```

**Output:**
```json
{
  "success": true,
  "did": "did:peer:2.Ez6LSbysY2xFMRpGMhb7tFTLMpeuPRaqaWM1yECx2AtzE3KCc",
  "agentId": "agent-1",
  "publicKeys": {
    "auth": "z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK",
    "keyAgreement": "z6LSbysY2xFMRpGMhb7tFTLMpeuPRaqaWM1yECx2AtzE3KCc"
  },
  "created": "2024-11-24T00:00:00Z",
  "metadata": {
    "name": "Alice",
    "keyTypes": ["ED25519", "X25519"]
  }
}
```

#### 2. `resolveDID`

Resolve a Peer DID to its DID Document.

**Input:**
```json
{
  "did": "did:peer:2.Ez6LSbysY2xFMRpGMhb7tFTLMpeuPRaqaWM1yECx2AtzE3KCc"
}
```

**Output:**
```json
{
  "success": true,
  "did": "did:peer:2.Ez6LSbysY2xFMRpGMhb7tFTLMpeuPRaqaWM1yECx2AtzE3KCc",
  "didDocument": {
    "@context": [
      "https://www.w3.org/ns/did/v1",
      "https://w3id.org/security/suites/ed25519-2020/v1"
    ],
    "id": "did:peer:2.Ez6LSbysY2xFMRpGMhb7tFTLMpeuPRaqaWM1yECx2AtzE3KCc",
    "verificationMethod": [...],
    "authentication": [...],
    "keyAgreement": [...]
  }
}
```

## Real SDK Implementation ✅

The server uses the **real Hyperledger Identus SDK v7.0.0** for cryptographic DID operations!

```bash
# Run with real SDK
pnpm run dev
```

This provides:
- ✅ Real cryptographic Peer DIDs using Ed25519 and X25519 keys
- ✅ W3C DID Core 1.0 compliant DID Documents
- ✅ File-based storage for DID persistence (JSON)
- ✅ Full Identus SDK integration (Apollo + Castor)

**Storage:** DIDs and private keys are stored in `storage/dids.json` (gitignored for security)

## Testing

```bash
# Run tool tests with real SDK
pnpm test

# Expected output:
# ✅ createDID: DID created for agent-test-1
# ✅ resolveDID: DID Document resolved
# ✅ All tests passed!
```

## Integration with Midnight City

### Agent Initialization Flow

1. Agent spawns in Midnight City
2. MCP client calls `createDID` tool with agent ID
3. DID is created and stored in agent state
4. Agent uses DID for:
   - Identity verification
   - Credential issuance
   - Secure messaging
   - Blockchain identity NFTs

### Event Stream Integration

When DIDs are created/resolved, events are emitted:

```typescript
{
  type: 'mcp_call',
  timestamp: 1700000000,
  data: {
    server: 'identus',
    tool: 'createDID',
    agentId: 'agent-1',
    result: { did: '...' }
  }
}
```

## File Structure

```
identus-mcp/
├── package.json           # Dependencies and scripts
├── tsconfig.json          # TypeScript configuration
├── README.md              # This file
├── src/
│   ├── server.ts          # MCP server entry point
│   ├── identus-sdk/       # Real SDK wrappers
│   │   ├── apollo.ts      # Cryptography operations
│   │   └── castor.ts      # DID operations
│   ├── storage/           # Persistence layer
│   │   └── did-storage.ts # File-based DID storage
│   └── tools/
│       ├── create-did.ts  # createDID tool implementation
│       └── resolve-did.ts # resolveDID tool implementation
├── storage/               # DID storage directory
│   └── dids.json          # Persisted DIDs (gitignored)
└── dist/                  # Compiled JavaScript (after build)
```

## References

- [Hyperledger Identus Docs](https://hyperledger-identus.github.io/docs/)
- [W3C DID Core 1.0](https://www.w3.org/TR/did-core/)
- [Peer DID Method](https://identity.foundation/peer-did-method-spec/)
- [Model Context Protocol](https://modelcontextprotocol.io/)

## License

MIT

## Contributing