# Model Context Protocol (MCP) - Modern Patterns & Best Practices

**Date**: 2025-01-21
**MCP Specification**: 2025-06-18
**SDK**: @modelcontextprotocol/sdk

---

## What is MCP?

**Model Context Protocol (MCP)** is an open protocol that enables seamless integration between LLM applications and external data sources. Created by Anthropic in November 2024 and adopted by OpenAI in March 2025.

### Key Characteristics

- **Based on JSON-RPC 2.0** - Standard request/response protocol
- **Three Core Primitives**:
  - **Resources**: Data sources (files, APIs, databases)
  - **Tools**: Functions the LLM can execute
  - **Prompts**: Reusable templates for common tasks

- **Transport Layers**:
  - **STDIO**: Local processes (most common for CLI tools)
  - **HTTP with SSE**: Remote servers (streaming support)
  - **HTTP**: Traditional request/response

### Official Documentation

- **Official Site**: https://modelcontextprotocol.io
- **Specification**: https://modelcontextprotocol.io/specification/2025-06-18
- **GitHub**: https://github.com/modelcontextprotocol

---

## MCP Server Types (Agency Swarm Classification)

### 1. Local STDIO Server (MCPServerStdio)

**Use Case**: Local scripts, CLI tools, file system access

**Configuration**:
```python
from agency_swarm.tools.mcp import MCPServerStdio

# Local Python script
mcp_server = MCPServerStdio(
    name="my-local-server",
    command="python",
    args=["path/to/server.py"]
)

# Local Node.js script
mcp_server = MCPServerStdio(
    name="midnight-mcp",
    command="node",
    args=["dist/mcp/stdio-server.js"],
    env={
        "AGENT_ID": "agent1",
        "NETWORK_ID": "testnet"
    }
)
```

**Our Use Case**: ✅ **This is what we use** - Midnight MCP runs as STDIO server

---

### 2. Hosted Remote Server (HostedMCPTool)

**Use Case**: Public web services, shared infrastructure

**Configuration**:
```python
from agency_swarm.tools.mcp import HostedMCPTool

mcp_server = HostedMCPTool(
    name="public-api-server",
    url="https://api.example.com/mcp",
    api_key="your-api-key"
)
```

**Our Use Case**: ❌ Not needed - we're local-first

---

### 3. Hosted Remote with OAuth (mcp-remote + MCPServerStdio)

**Use Case**: Secure remote access with OAuth authentication

**Configuration**:
```python
# Server side: Wrap STDIO with mcp-remote
mcp_server = MCPServerStdio(
    name="secure-server",
    command="npx",
    args=[
        "-y",
        "@modelcontextprotocol/server-remote",
        "--oauth-provider", "google",
        "--",
        "node",
        "dist/mcp/stdio-server.js"
    ]
)
```

**Our Use Case**: ⚠️ Future consideration for multi-user deployments

---

### 4. Streamable HTTP Server (MCPServerStreamableHttp)

**Use Case**: HTTP servers with streaming support, long-running operations

**Configuration**:
```python
from agency_swarm.tools.mcp import MCPServerStreamableHttp

mcp_server = MCPServerStreamableHttp(
    name="streaming-server",
    url="https://api.example.com/mcp-stream",
    headers={"Authorization": "Bearer token"}
)
```

**Our Use Case**: ❌ Not needed - STDIO is sufficient for our use case

---

### 5. Server-Sent Events (MCPServerSse)

**Use Case**: Real-time updates, event streams

**Configuration**:
```python
from agency_swarm.tools.mcp import MCPServerSse

mcp_server = MCPServerSse(
    name="realtime-server",
    url="https://api.example.com/mcp/sse"
)
```

**Our Use Case**: ❌ Not needed - polling is sufficient for blockchain data

---

## Modern MCP Architecture Patterns

### Pattern 1: Handler-Based Architecture (RECOMMENDED)

**Structure**:
```
src/mcp/
├── stdio-server.ts           # Entry point
├── server.ts                 # MCP Server class
├── tools/
│   ├── registry.ts           # Central tool registry
│   ├── wallet-tools.ts       # Tool definitions
│   ├── token-tools.ts
│   └── dao-tools.ts
├── handlers/
│   ├── wallet-handler.ts     # Tool implementations
│   ├── token-handler.ts
│   └── dao-handler.ts
└── resources/
    ├── registry.ts
    └── wallet-resources.ts
```

**Benefits**:
- ✅ Separation of concerns (definitions vs implementations)
- ✅ Easy to test handlers independently
- ✅ Clear domain boundaries
- ✅ Scales well with team size

---

### Pattern 2: Service-Direct Integration (RECOMMENDED FOR US)

**Concept**: MCP handlers call service layer directly (no HTTP)

```typescript
// ❌ OLD WAY (Midnight MCP current)
MCP Tool → HTTP Client → Express API → Controller → Service

// ✅ NEW WAY (What we want)
MCP Tool → Handler → Service
```

**Example**:
```typescript
// src/mcp/handlers/wallet-handler.ts
export class WalletHandler {
  constructor(
    private walletService: WalletService,
    private transactionService: TransactionService
  ) {}

  async handleSend(args: { to: string; amount: string }) {
    // Direct service call - no HTTP!
    const txId = await this.walletService.sendFunds(args.to, args.amount);
    return { content: [{ type: "text", text: txId }] };
  }
}
```

**Benefits**:
- ✅ Faster (no HTTP overhead)
- ✅ Type-safe (TypeScript interfaces)
- ✅ Easier to debug (same process)
- ✅ Better error handling (no JSON serialization issues)

---

### Pattern 3: Tool Filtering (Optional)

**Use Case**: Limit which tools are exposed to specific clients

**Implementation**:
```python
# Agency Swarm example
from agency_swarm.tools.mcp import MCPServerStdio

mcp_server = MCPServerStdio(
    name="midnight-mcp",
    command="node",
    args=["dist/mcp/stdio-server.js"],
    # Only expose wallet tools to this agent
    filter_by_name=["walletStatus", "walletBalance", "send"]
)
```

**Our Use Case**: ⚠️ Consider for multi-agent scenarios

---

### Pattern 4: Resource-Based Architecture

**Concept**: Expose data as resources (read-only) vs tools (actions)

```typescript
// Resource: Wallet status (read-only)
{
  uri: "midnight://wallet/status",
  name: "Wallet Status",
  description: "Current wallet sync status and readiness"
}

// Tool: Send funds (action)
{
  name: "send",
  description: "Send native tokens to another address",
  inputSchema: { /* ... */ }
}
```

**When to Use**:
- **Resources**: Static/cached data, expensive to compute
- **Tools**: Actions, mutations, real-time queries

---

## Server Class Comparison: Server vs McpServer

### Two Server Classes - Which Should You Use?

MCP SDK provides **TWO distinct server classes** with different APIs:

| Aspect | Server (Low-Level) | McpServer (High-Level) |
|--------|-------------------|----------------------|
| **Import** | `@modelcontextprotocol/sdk/server/index.js` | `@modelcontextprotocol/sdk/server/mcp.js` |
| **API Style** | Manual `setRequestHandler` | Declarative `registerTool` |
| **Abstraction** | Low-level protocol control | High-level convenience |
| **Use Case** | Custom transports, advanced control | **Most applications (RECOMMENDED)** |
| **Notification Debouncing** | Manual | Built-in |
| **Tool Registration** | Manual (List + Call handlers) | Automatic |
| **SDK Version** | All versions | 1.0.0+ |

### Server (Low-Level) - Traditional Pattern

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';

const server = new Server({
  name: "midnight-mcp-server",
  version: "2.0.0"
}, {
  capabilities: {
    resources: {},
    tools: {}
  }
});

// List tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: ALL_TOOLS };
});

// Call tool
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  return await handleToolCall(name, args);
});
```

**When to Use**:
- ✅ Need custom transport implementations
- ✅ Require fine-grained protocol control
- ✅ Building framework/library on top of MCP
- ✅ Already using this pattern (migration not urgent)

---

### McpServer (High-Level) - Modern Pattern ⭐ RECOMMENDED

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

const server = new McpServer({
  name: 'midnight-mcp-server',
  version: '2.0.0'
});

// Register tool with automatic listing + calling
server.registerTool(
  'send',
  {
    title: 'Send Funds',
    description: 'Send native tokens to another address',
    inputSchema: {
      destinationAddress: z.string()
        .regex(/^0x[a-fA-F0-9]{40}$/)
        .describe("Recipient's wallet address"),
      amount: z.string()
        .regex(/^\d+$/)
        .describe("Amount in base units")
    },
    outputSchema: {
      transactionId: z.string()
    }
  },
  async ({ destinationAddress, amount }) => {
    // Type-safe parameters inferred from schema!
    const txId = await walletService.sendFunds(destinationAddress, amount);
    return {
      content: [{ type: 'text', text: JSON.stringify({ transactionId: txId }) }],
      structuredContent: { transactionId: txId } // Type-safe, validated output
    };
  }
);
```

**When to Use**:
- ✅ Building new MCP servers (start here!)
- ✅ Want type-safe parameters
- ✅ Need automatic tool listing
- ✅ Prefer declarative API
- ✅ Want built-in best practices

---

### Side-by-Side Comparison

```typescript
// ===== TRADITIONAL (Server) =====
// ❌ Two separate handlers
// ❌ Manual routing in handleToolCall
// ❌ No type inference
// ❌ Manual tool array management

const ALL_TOOLS = [{
  name: "send",
  description: "Send funds",
  inputSchema: {
    type: "object",
    properties: {
      destinationAddress: { type: "string" },
      amount: { type: "string" }
    },
    required: ["destinationAddress", "amount"]
  }
}];

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: ALL_TOOLS };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'send':
      return await handleSend(args); // No type safety here!
    // ... 15+ more cases
  }
});

// ===== MODERN (McpServer) =====
// ✅ Single registration
// ✅ Automatic routing
// ✅ Type-safe parameters
// ✅ Self-documenting

server.registerTool(
  'send',
  {
    title: 'Send Funds',
    inputSchema: {
      destinationAddress: z.string(),
      amount: z.string()
    }
  },
  async ({ destinationAddress, amount }) => {
    // TypeScript knows these types!
    return await handleSend(destinationAddress, amount);
  }
);
```

---

### Midnight MCP Recommendation

**Current Status**: Your codebase uses **Server** (traditional pattern)
**SDK Version**: 1.15.1 (supports both patterns)

**Our Recommendation**:
1. **Keep Server for now** - It works perfectly, no urgent need to change
2. **Add Zod schemas** (optional) - Can use with Server class too
3. **Consider McpServer** for new features - Cleaner API
4. **Migrate incrementally** - When SDK is upgraded to 1.23.0+

---

## Zod Integration - Complete Guide

### What is Zod's Role in MCP?

**Key Fact**: JSON Schema is the MCP wire format. Zod is a convenience layer that provides type safety and better DX.

```
Developer writes Zod schemas
   ↓
SDK converts to JSON Schema (internally)
   ↓
Protocol sends JSON Schema over wire
```

### Your Current Setup

**From package.json**:
- SDK Version: `1.15.1` (older)
- Zod Version: `3.25.71` (v3)

**Compatibility**:
- ✅ Your versions work together
- ⚠️ SDK 1.15.1 supports Zod v3 only
- ⚠️ Latest SDK (1.23.0) adds Zod v4 support

---

### Basic Zod Patterns with MCP

#### Pattern 1: Simple Input Schema

```typescript
import { z } from 'zod';

// JSON Schema (your current approach)
inputSchema: {
  type: "object",
  properties: {
    destinationAddress: { type: "string" },
    amount: { type: "string" }
  },
  required: ["destinationAddress", "amount"]
}

// Zod equivalent (modern)
inputSchema: {
  destinationAddress: z.string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .describe("Recipient's wallet address"),
  amount: z.string()
    .regex(/^\d+$/)
    .describe("Amount in base units")
}
```

**Benefits**:
- Type inference: TypeScript knows parameter types
- Runtime validation: Automatic input checking
- Better errors: Clear validation messages
- Documentation: `.describe()` auto-generates descriptions

---

#### Pattern 2: Optional Parameters

```typescript
// With default values
inputSchema: {
  tokenName: z.string(),
  decimals: z.number().default(6)
    .describe("Token decimals (default: 6)"),
  description: z.string().optional()
    .describe("Optional token description")
}

// Handler automatically gets typed parameters
async ({ tokenName, decimals = 6, description }) => {
  // decimals is number (not number | undefined)
  // description is string | undefined
}
```

---

#### Pattern 3: Enums and Validation

```typescript
//  DAO vote tool with enum
inputSchema: {
  voteType: z.enum(['yes', 'no', 'absence'])
    .describe("Vote choice: yes, no, or absence")
}

// Amount validation
inputSchema: {
  amount: z.string()
    .regex(/^\d+$/, "Amount must be numeric")
    .refine(val => BigInt(val) > 0n, "Amount must be positive")
    .describe("Amount in base units")
}
```

---

#### Pattern 4: Output Schemas (Type-Safe Responses)

```typescript
server.registerTool(
  'send',
  {
    title: 'Send Funds',
    inputSchema: {
      destinationAddress: z.string(),
      amount: z.string()
    },
    outputSchema: { // NEW - Type-safe response validation
      transactionId: z.string(),
      status: z.enum(['INITIATED', 'SENT', 'COMPLETED']),
      timestamp: z.number()
    }
  },
  async ({ destinationAddress, amount }) => {
    const txId = await walletService.sendFunds(destinationAddress, amount);

    const output = {
      transactionId: txId,
      status: 'SENT' as const,
      timestamp: Date.now()
    };

    return {
      content: [{ type: 'text', text: JSON.stringify(output) }],
      structuredContent: output // Validated against outputSchema!
    };
  }
);
```

**Key Point**: `structuredContent` is validated against `outputSchema` automatically.

---

### Migration from JSON Schema to Zod

**Step 1**: Install/verify Zod (already done in your project)

```bash
# Your project already has: "zod": "^3.25.71"
```

**Step 2**: Import Zod

```typescript
import { z } from 'zod';
```

**Step 3**: Convert schemas incrementally

```typescript
// BEFORE (JSON Schema)
export const WALLET_TOOLS = [{
  name: "send",
  description: "Send funds",
  inputSchema: {
    type: "object",
    properties: {
      destinationAddress: {
        type: "string",
        pattern: "^0x[a-fA-F0-9]{40}$"
      },
      amount: { type: "string" }
    },
    required: ["destinationAddress", "amount"]
  }
}];

// AFTER (Zod - with McpServer)
server.registerTool(
  'send',
  {
    title: 'Send Funds',
    description: 'Send native tokens to another address',
    inputSchema: {
      destinationAddress: z.string()
        .regex(/^0x[a-fA-F0-9]{40}$/)
        .describe("Recipient's wallet address"),
      amount: z.string()
        .regex(/^\d+$/)
        .describe("Amount in base units")
    }
  },
  async ({ destinationAddress, amount }) => {
    // Types automatically inferred!
    // destinationAddress: string
    // amount: string
  }
);
```

---

### Zod with Traditional Server Class

**Important**: You can use Zod even with the low-level `Server` class!

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

const server = new Server(/* ... */);

// Define Zod schemas separately
const SendInputSchema = z.object({
  destinationAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  amount: z.string().regex(/^\d+$/)
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'send') {
    // Validate with Zod manually
    const validated = SendInputSchema.parse(args);

    // Now validated has type inference!
    const { destinationAddress, amount } = validated;

    return await handleSend(destinationAddress, amount);
  }
});
```

**Pattern**: Manual validation with `.parse()`, but you still get type safety!

---

### Zod Limitations with MCP

**Transform Functions Lost**:
```typescript
// This works for TypeScript, but transform is lost in JSON Schema
z.string().transform(s => parseInt(s)) // ❌ Transform lost

// Instead, transform in handler:
async ({ amount }) => {
  const amountNum = parseInt(amount); // ✅ Manual transform
}
```

**Union Types May Lose Options**:
```typescript
// Some union types don't convert well
z.union([z.string(), z.number()]) // ⚠️ May not preserve both options

// Prefer discriminated unions:
z.discriminatedUnion('type', [
  z.object({ type: z.literal('string'), value: z.string() }),
  z.object({ type: z.literal('number'), value: z.number() })
])
```

---

### Recommended Approach for Midnight MCP

**Phase 1: Keep JSON Schema, Add Zod Types**
```typescript
// Define Zod schema for type inference
const SendInputSchema = z.object({
  destinationAddress: z.string(),
  amount: z.string()
});

type SendInput = z.infer<typeof SendInputSchema>;

// Keep JSON Schema in tool definition (for now)
const SEND_TOOL = {
  name: "send",
  inputSchema: { /* JSON Schema */ }
};

// Use type in handler
async function handleSend(args: SendInput) {
  // Type-safe parameters!
}
```

**Phase 2: Migrate to McpServer with Zod**
```typescript
server.registerTool(
  'send',
  {
    inputSchema: SendInputSchema.shape // Use Zod directly
  },
  async (args) => {
    // Fully type-safe now!
  }
);
```

---

### Zod Version Compatibility Matrix

| SDK Version | Zod v3 Support | Zod v4 Support | Your Status |
|-------------|---------------|----------------|-------------|
| 1.15.1 | ✅ Yes | ❌ No | ← You are here |
| 1.22.0 | ✅ Yes | ⚠️ Partial | |
| 1.23.0+ | ✅ Yes | ✅ Yes | Upgrade target |

**Recommendation**:
- Stay on SDK 1.15.1 + Zod v3 (stable)
- Upgrade to SDK 1.23.0 when it's stable (not beta)
- Test thoroughly before upgrading

---

## The Third Pillar: Prompts

### What are Prompts in MCP?

MCP has **three core primitives**:
1. **Resources**: Data sources (files, databases, APIs)
2. **Tools**: Functions/actions LLMs can execute
3. **Prompts**: Reusable templates for common tasks ← YOU MISSED THIS!

**Prompts** are pre-defined message templates that help users accomplish specific tasks.

### Basic Prompt Registration

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

const server = new McpServer({
  name: 'midnight-mcp-server',
  version: '2.0.0'
});

server.registerPrompt(
  'review-transaction',
  {
    title: 'Review Transaction',
    description: 'Get AI review of a transaction before sending',
    argsSchema: {
      destinationAddress: z.string(),
      amount: z.string(),
      tokenName: z.string().optional()
    }
  },
  ({ destinationAddress, amount, tokenName = 'DUST' }) => ({
    messages: [{
      role: 'user',
      content: {
        type: 'text',
        text: `Please review this transaction before I send it:

Sending: ${amount} ${tokenName}
To: ${destinationAddress}

Is this transaction safe? Are there any concerns I should be aware of?`
      }
    }]
  })
);
```

### Context-Aware Prompts with Completions

```typescript
import { completable } from '@modelcontextprotocol/sdk/server/completable.js';

server.registerPrompt(
  'dao-vote-analysis',
  {
    title: 'DAO Vote Analysis',
    description: 'Analyze a DAO proposal before voting',
    argsSchema: {
      electionId: completable(
        z.string().describe('Election ID'),
        (value) => {
          // Return suggestions based on current elections
          return getDaoElections()
            .filter(e => e.id.startsWith(value))
            .map(e => e.id);
        }
      ),
      voteChoice: completable(
        z.enum(['yes', 'no', 'absence']).describe('Your intended vote'),
        () => ['yes', 'no', 'absence']
      )
    }
  },
  async ({ electionId, voteChoice }) => {
    const election = await getDaoElectionDetails(electionId);

    return {
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `I'm planning to vote "${voteChoice}" on this DAO proposal:

Election ID: ${electionId}
Description: ${election.description}
Current Status: ${election.status}

Can you help me understand:
1. What this proposal does
2. Potential risks or benefits
3. Whether my vote aligns with my interests`
        }
      }]
    };
  }
);
```

### When to Use Prompts vs Tools

| Use Prompts When... | Use Tools When... |
|---------------------|------------------|
| Guiding user through a task | Executing an action |
| Requesting AI analysis | Querying data |
| Educational/exploratory | Transactional operations |
| Multiple steps with AI input | Direct service calls |

**Example for Midnight MCP**:
- **Tool**: `send` - Actually sends funds
- **Prompt**: `review-transaction` - Asks AI to review before sending

---

## Anthropic SDK Best Practices

### 1. Error Handling

```typescript
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

// Throw MCP-specific errors
if (!args.amount) {
  throw new McpError(
    ErrorCode.InvalidParams,
    "Missing required parameter: amount"
  );
}

// Map service errors to MCP errors
try {
  await walletService.sendFunds(to, amount);
} catch (error) {
  if (error instanceof InsufficientFundsError) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      "Insufficient funds for transaction"
    );
  }
  throw new McpError(
    ErrorCode.InternalError,
    `Transaction failed: ${error.message}`
  );
}
```

**Standard Error Codes**:
- `ErrorCode.InvalidParams` - Missing/invalid parameters
- `ErrorCode.InvalidRequest` - Request can't be processed
- `ErrorCode.InternalError` - Server-side error
- `ErrorCode.MethodNotFound` - Unknown tool/method

---

### 3. Typed Tool Definitions

```typescript
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

export const SEND_TOOL: Tool = {
  name: "send",
  description: "Send native tokens to another address",
  inputSchema: {
    type: "object",
    properties: {
      destinationAddress: {
        type: "string",
        description: "Recipient's wallet address"
      },
      amount: {
        type: "string",
        description: "Amount to send in base units"
      }
    },
    required: ["destinationAddress", "amount"]
  }
};
```

**Best Practices**:
- ✅ Use TypeScript `type` annotations
- ✅ Provide clear descriptions
- ✅ Specify all required parameters
- ✅ Document parameter formats (e.g., "base units", "hex string")

---

### 4. STDIO Transport Setup

```typescript
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const transport = new StdioServerTransport();
await server.connect(transport);
```

**Important**:
- **Logging**: Use `stderr` for logs (not `stdout`)
- **JSON-RPC**: Only JSON-RPC messages on `stdout`
- **Buffering**: Flush after each message

---

### 5. Graceful Shutdown

```typescript
// Handle process signals
process.on('SIGINT', async () => {
  console.error('Shutting down server...');
  await server.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.error('Shutting down server...');
  await server.close();
  process.exit(0);
});
```

---

## Midnight MCP Recommendations

### Current State Assessment

**What We Have**:
- ✅ STDIO transport (correct choice)
- ✅ Anthropic SDK (@modelcontextprotocol/sdk)
- ✅ Basic request handlers

**What Needs Improvement**:
- ❌ God class pattern (662 lines)
- ❌ HTTP layer (unnecessary)
- ❌ Giant switch statement
- ❌ No domain separation

---

### Recommended Architecture

**Transport**: STDIO (keep as-is)
**Pattern**: Handler-Based + Service-Direct
**Structure**: Domain-separated handlers

```
Midnight MCP Server (STDIO)
   ↓
MCPServer class
   ├── WalletHandler → WalletService
   ├── TokenHandler → TokenService
   ├── DaoHandler → DaoService
   └── MarketplaceHandler → MarketplaceService
```

---

### Migration Priority

1. **High Priority**: Remove HTTP layer (biggest performance win)
2. **High Priority**: Split god class into handlers (maintainability)
3. **Medium Priority**: Implement proper error handling
4. **Low Priority**: Add resource support (nice-to-have)

---

## Tool Design Best Practices

### 1. Naming Convention

```typescript
// ✅ GOOD: Clear, action-oriented names
"send"              // Action: send funds
"walletBalance"     // Query: get wallet balance
"openDaoElection"   // Action: open election

// ❌ BAD: Ambiguous or vague names
"wallet"            // What about wallet?
"dao"               // What DAO operation?
"execute"           // Execute what?
```

---

### 2. Parameter Design

```typescript
// ✅ GOOD: Clear types and validation
inputSchema: {
  type: "object",
  properties: {
    amount: {
      type: "string",
      description: "Amount in base units (1 DUST = 1e6 base units)",
      pattern: "^[0-9]+$"
    },
    destinationAddress: {
      type: "string",
      description: "Recipient's wallet address (hex format)",
      pattern: "^0x[a-fA-F0-9]{40}$"
    }
  },
  required: ["amount", "destinationAddress"]
}

// ❌ BAD: Unclear types
inputSchema: {
  type: "object",
  properties: {
    data: { type: "string" }  // What data? What format?
  }
}
```

---

### 3. Response Format

```typescript
// ✅ GOOD: Structured, typed responses
return {
  content: [{
    type: "text",
    text: JSON.stringify({
      transactionId: "tx_123456",
      status: "SENT",
      amount: "1000000",
      timestamp: 1642524800
    }, null, 2)
  }]
};

// ❌ BAD: Plain strings without structure
return {
  content: [{
    type: "text",
    text: "Transaction sent successfully"
  }]
};
```

---

### 4. Idempotency

```typescript
// ✅ GOOD: Idempotent operations
{
  name: "getWalletBalance",
  description: "Get current wallet balance (idempotent, can retry)"
}

// ⚠️ CAREFUL: Non-idempotent operations
{
  name: "send",
  description: "Send funds (non-idempotent, do not retry without checking status)"
}
```

**Best Practice**: For non-idempotent operations, return transaction ID immediately so client can poll status.

---

## Testing MCP Servers

### Unit Testing Handlers

```typescript
// test/unit/mcp/handlers/wallet-handler.test.ts
import { WalletHandler } from '../../../../src/mcp/handlers/wallet-handler.js';

describe('WalletHandler', () => {
  it('should return wallet balance', async () => {
    const mockWalletService = {
      getBalance: jest.fn().mockResolvedValue({ available: 1000000n })
    };

    const handler = new WalletHandler({
      walletService: mockWalletService as any,
      transactionService: {} as any
    });

    const result = await handler.handleWalletBalance();

    expect(result.content[0].text).toContain('1000000');
    expect(mockWalletService.getBalance).toHaveBeenCalled();
  });
});
```

---

### Integration Testing

```typescript
// test/integration/mcp/mcp-server.test.ts
import { MCPServer } from '../../../src/mcp/server.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

describe('MCP Server Integration', () => {
  it('should list all tools', async () => {
    const server = new MCPServer(config);
    const client = new Client({ /* ... */ });

    const response = await client.listTools();

    expect(response.tools.length).toBeGreaterThan(0);
    expect(response.tools.find(t => t.name === 'send')).toBeDefined();
  });
});
```

---

## Security Considerations

### 1. Input Validation

```typescript
// Always validate inputs before passing to services
if (!args.destinationAddress?.match(/^0x[a-fA-F0-9]{40}$/)) {
  throw new McpError(
    ErrorCode.InvalidParams,
    "Invalid destination address format"
  );
}

// Validate amounts
const amountBigInt = BigInt(args.amount);
if (amountBigInt <= 0n) {
  throw new McpError(
    ErrorCode.InvalidParams,
    "Amount must be positive"
  );
}
```

---

### 2. Rate Limiting

```typescript
// For production, implement rate limiting per tool
class RateLimiter {
  private calls = new Map<string, number[]>();

  check(toolName: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const calls = this.calls.get(toolName) || [];

    // Remove old calls outside window
    const recentCalls = calls.filter(t => now - t < windowMs);

    if (recentCalls.length >= limit) {
      return false; // Rate limit exceeded
    }

    recentCalls.push(now);
    this.calls.set(toolName, recentCalls);
    return true;
  }
}
```

---

### 3. Error Sanitization

```typescript
// Don't leak sensitive information in errors
try {
  await privateKeyOperation();
} catch (error) {
  // ❌ BAD: Leak implementation details
  throw new Error(`Failed: ${error.message} with key ${privateKey}`);

  // ✅ GOOD: Sanitized error
  throw new McpError(
    ErrorCode.InternalError,
    "Cryptographic operation failed"
  );
}
```

---

## Performance Optimization

### 1. Caching

```typescript
class WalletHandler {
  private balanceCache: Map<string, { value: bigint; timestamp: number }> = new Map();
  private cacheTtl = 5000; // 5 seconds

  async handleWalletBalance() {
    const cached = this.balanceCache.get('balance');
    if (cached && Date.now() - cached.timestamp < this.cacheTtl) {
      return { content: [{ type: "text", text: cached.value.toString() }] };
    }

    const balance = await this.walletService.getBalance();
    this.balanceCache.set('balance', { value: balance.available, timestamp: Date.now() });

    return { content: [{ type: "text", text: balance.available.toString() }] };
  }
}
```

---

### 2. Lazy Initialization

```typescript
class MCPServer {
  private daoService?: DaoService;

  private getDaoService(): DaoService {
    if (!this.daoService) {
      // Only initialize when first DAO tool is called
      this.daoService = new DaoService(this.config);
    }
    return this.daoService;
  }
}
```

---

### 3. Batch Operations

```typescript
// ✅ GOOD: Batch tool for bulk operations
{
  name: "registerTokensBatch",
  description: "Register multiple tokens in a single operation",
  inputSchema: {
    type: "object",
    properties: {
      tokens: {
        type: "array",
        items: { /* token config */ }
      }
    }
  }
}
```

---

## Monitoring & Observability

### 1. Structured Logging

```typescript
this.logger.info('Tool called', {
  tool: 'send',
  args: { to: args.destinationAddress, amount: args.amount },
  correlationId: this.generateCorrelationId()
});
```

---

### 2. Metrics Collection

```typescript
class MetricsCollector {
  private callCounts = new Map<string, number>();
  private callDurations = new Map<string, number[]>();

  recordCall(toolName: string, durationMs: number) {
    this.callCounts.set(toolName, (this.callCounts.get(toolName) || 0) + 1);

    const durations = this.callDurations.get(toolName) || [];
    durations.push(durationMs);
    this.callDurations.set(toolName, durations);
  }

  getStats(toolName: string) {
    const durations = this.callDurations.get(toolName) || [];
    return {
      count: this.callCounts.get(toolName) || 0,
      avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length || 0
    };
  }
}
```

---

## Comparison: Old vs New Architecture

### Old Architecture (Current)

```
Complexity:  ████████████ 12/10
Performance: ██████░░░░░░  6/10
Testability: ████░░░░░░░░  4/10
Maintainability: ███░░░░░░░░░  3/10

Total LOC: ~1,488 lines
Files: 3 large files
Layers: 5 (MCP → HTTP Client → HTTP Server → Controller → Service)
```

### New Architecture (Planned)

```
Complexity:  ████░░░░░░░░  4/10
Performance: ██████████░░ 10/10
Testability: ██████████░░ 10/10
Maintainability: ████████░░░░  8/10

Total LOC: ~1,200 lines (structured across 12+ files)
Files: 12+ focused files (~100-150 lines each)
Layers: 2 (MCP → Service)
```

---

## Key Takeaways

### DO ✅
- Use STDIO transport for local CLI tools
- Separate tool definitions from implementations
- Call services directly (no HTTP layer)
- Implement proper error handling with McpError
- Structure responses as JSON
- Log to stderr (not stdout)
- Handle graceful shutdown

### DON'T ❌
- Create god classes (keep handlers < 200 lines)
- Use HTTP layer between MCP and services
- Leak sensitive information in errors
- Write logs to stdout (breaks JSON-RPC)
- Return unstructured text responses
- Ignore rate limiting in production

---

## Additional Resources

### Comprehensive Research Report

For complete technical research including:
- Detailed Zod integration patterns
- SDK version compatibility analysis
- Real-world production examples
- Community best practices
- Migration strategies
- Official source citations

**See**: `MCP-RESEARCH-FINDINGS-2025.md` (1446 lines of in-depth research)

This document was created based on extensive research of:
- Official MCP specification (2025-06-18)
- TypeScript SDK documentation (versions 1.15.1 - 1.23.0)
- Official code examples from @modelcontextprotocol/typescript-sdk
- Real-world implementations
- Community patterns and production use cases

### Related Documentation

- **MCP-REFACTORING-PLAN.md**: Detailed implementation plan for refactoring
- **MCP-REFACTORING-SUMMARY.md**: Executive summary and quick reference
- **IMPLEMENTATION-STATUS.md**: Current progress on blockchain integration

---

**Document Version**: 2.0 (Updated with Modern Patterns)
**Date**: 2025-01-21
**Author**: Implementation Team
**Based On**:
- MCP Specification 2025-06-18
- @modelcontextprotocol/sdk (TypeScript)
- Agency Swarm patterns
- Official TypeScript SDK examples
- Context7 MCP documentation
- Technical research findings
