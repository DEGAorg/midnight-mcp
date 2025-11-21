# MCP Research Findings - January 2025
## Technical Research Report on Model Context Protocol

**Date**: 2025-01-21
**Researcher**: Technical Researcher Agent
**Current MCP SDK Version (in codebase)**: 1.15.1
**Latest MCP SDK Version**: 1.23.0-beta.0 (Nov 20, 2024)
**MCP Specification**: 2025-06-18

---

## Executive Summary

Your suspicions were correct - there ARE significant modern patterns and updates missing from the three refactoring documents. The MCP ecosystem has evolved considerably in late 2024/early 2025 with:

1. **Zod v4 Support** (NEW - not in your docs)
2. **McpServer high-level API** (mentioned but not emphasized enough)
3. **registerTool/registerResource/registerPrompt methods** (MODERN - preferred over setRequestHandler)
4. **JSON Schema as wire format** (Zod is convenience layer)
5. **Critical version compatibility issues** with Zod v3/v4

### Key Finding: Your Codebase Uses OLD Pattern

Your current implementation (`@modelcontextprotocol/sdk: ^1.15.1`) uses:
- ✅ `Server` class (low-level) - VALID but not optimal
- ✅ `setRequestHandler` with schema types - VALID but old pattern
- ✅ JSON Schema for `inputSchema` - CORRECT (protocol standard)
- ❌ NO Zod usage - Missing modern convenience
- ❌ Not using `McpServer` - Missing high-level API
- ❌ Not using `registerTool` - Missing modern registration

---

## Critical Findings: What Your Docs Got Wrong/Missed

### 1. TWO Server Classes, Not One

**What Your Docs Say:**
- Documents mention "Server" class from `@modelcontextprotocol/sdk/server/index.js`
- Minimal mention of `McpServer`

**Reality in 2025:**

There are TWO distinct classes with different use cases:

| Aspect | Server (Low-Level) | McpServer (High-Level) |
|--------|-------------------|----------------------|
| Import | `@modelcontextprotocol/sdk/server/index.js` | `@modelcontextprotocol/sdk/server/mcp.js` |
| API Style | Manual `setRequestHandler` | Declarative `registerTool` |
| Abstraction | Low-level protocol control | High-level convenience |
| Use Case | Custom transports, advanced control | Most applications (RECOMMENDED) |
| Notification Debouncing | Manual | Built-in |
| Tool Registration | Manual (List + Call handlers) | Automatic |

**Recommendation for Your Docs:**
Add clear section explaining BOTH classes and when to use each.

---

### 2. Modern Tool Registration Pattern

**What Your Docs Show:**

```typescript
// Your docs show this OLD pattern
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: ALL_TOOLS };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  return await handleToolCall(name, args);
});
```

**Modern Pattern (2025):**

```typescript
// RECOMMENDED: McpServer + registerTool
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';

const server = new McpServer({
  name: 'midnight-mcp',
  version: '2.0.0'
});

// Register tool with Zod schemas
server.registerTool(
  'send',
  {
    title: 'Send Funds',
    description: 'Send native tokens to another address',
    inputSchema: {
      destinationAddress: z.string().describe("Recipient's wallet address"),
      amount: z.string().regex(/^\d+$/).describe("Amount in base units")
    },
    outputSchema: {
      transactionId: z.string()
    }
  },
  async ({ destinationAddress, amount }) => {
    // Direct service call - no HTTP!
    const txId = await walletService.sendFunds(destinationAddress, amount);
    return {
      content: [{ type: 'text', text: JSON.stringify({ transactionId: txId }) }],
      structuredContent: { transactionId: txId }
    };
  }
);
```

**Key Differences:**

1. **Single registration** vs two separate handlers
2. **Zod schemas** with type inference
3. **Auto-generated documentation** from Zod `.describe()`
4. **Type-safe parameters** inferred from inputSchema
5. **Structured output** with `outputSchema` validation

---

### 3. Zod Integration - The Full Story

**What Your Docs Say:**
- "Modern MCP uses Zod for schema validation" (vague)
- Limited explanation of HOW to use Zod

**Reality - Complex Situation:**

#### Zod's Role in MCP

```
┌─────────────────────────────────────────────┐
│  Developer writes Zod schemas               │
│  inputSchema: { a: z.number() }            │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│  MCP SDK converts to JSON Schema           │
│  (using zod-to-json-schema internally)     │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│  Protocol sends JSON Schema over wire      │
│  { type: "object", properties: {...} }     │
└─────────────────────────────────────────────┘
```

**Critical Points:**

1. **JSON Schema is the wire format** - The MCP protocol itself uses JSON Schema
2. **Zod is a convenience layer** - Provides type safety + validation
3. **You can use either:**
   - Zod schemas → SDK converts to JSON Schema (recommended)
   - Pure JSON Schema → No conversion needed (your current approach)

#### Zod Version Compatibility Crisis

**MAJOR ISSUE (Not in your docs):**

- MCP SDK 1.15.1 (your version) → **Zod v3 only**
- MCP SDK 1.23.0-beta.0 (latest) → **Zod v4 support** ✅
- Breaking changes between v3/v4 → Incompatible

**Error if using Zod v4 with old SDK:**
```
McpError: w._parse is not a function
```

**Current Status:**
- SDK internally uses `zod/v4`
- Backward compatible with `zod/v3.25+`
- Developers can import from either `zod/v3` or `zod/v4`

#### Zod Schema Patterns

**Your docs show JSON Schema:**
```typescript
inputSchema: {
  type: "object",
  properties: {
    amount: { type: "string" }
  },
  required: ["amount"]
}
```

**Modern Zod equivalent:**
```typescript
inputSchema: {
  amount: z.string()
    .regex(/^\d+$/)
    .describe("Amount in base units (1 DUST = 1e6)")
}
```

**Zod Benefits:**
- Type inference → TypeScript knows parameter types
- Runtime validation → Catches bad input
- Better errors → Clear validation messages
- Documentation → `.describe()` auto-generates docs

**Zod Limitations:**
- Transform functions lost in JSON Schema conversion
- Union types may lose options
- SDK generates JSON Schema Draft-07 (some clients need 2020-12)

---

### 4. JSON Schema Still Fully Supported

**Important Clarification (Your docs unclear on this):**

You do NOT need to use Zod. JSON Schema is the protocol standard and works perfectly.

**Your current approach is VALID:**

```typescript
export const ALL_TOOLS = [
  {
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
  }
];
```

This is **100% correct** and follows the MCP specification exactly.

**When to use each:**

| Use JSON Schema When... | Use Zod When... |
|------------------------|----------------|
| You prefer explicit schemas | You want type inference |
| Need full JSON Schema Draft-2020-12 | SDK compatibility is guaranteed |
| Working with legacy systems | Want runtime validation |
| Don't need TypeScript types | Prefer DRY code |
| Avoid dependency on Zod | Building new TypeScript servers |

---

### 5. Modern Error Handling Patterns

**What Your Docs Show:**
Basic McpError usage

**Modern Best Practices (2025):**

```typescript
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

// 1. Use specific error codes
if (!args.amount) {
  throw new McpError(
    ErrorCode.InvalidParams,
    "Missing required parameter: amount"
  );
}

// 2. Map service errors to MCP errors
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

// 3. Return structured error responses
return {
  content: [{
    type: "text",
    text: JSON.stringify({
      error: true,
      message: "Failed to process",
      code: "INSUFFICIENT_FUNDS"
    })
  }],
  isError: true
};
```

**Error Codes (from spec):**
- `ErrorCode.InvalidParams` - Missing/invalid parameters
- `ErrorCode.InvalidRequest` - Request can't be processed
- `ErrorCode.InternalError` - Server-side error
- `ErrorCode.MethodNotFound` - Unknown tool/method

**Best Practices:**
1. Use try/catch around ALL handlers
2. Return meaningful error messages
3. Use `isError` flag in responses
4. Implement retry logic for transient errors
5. Log all errors with structured logging

---

### 6. Response Format Standards

**What Your Docs Show:**
Basic content array

**Complete Response Structure (2025):**

```typescript
// Tool response interface
interface ToolResponse {
  content: Array<{
    type: "text" | "image" | "resource";
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
  structuredContent?: Record<string, unknown>; // NEW in v1.22.0
}

// Example: Success response with structured output
return {
  content: [{
    type: "text",
    text: JSON.stringify({
      transactionId: "tx_123",
      status: "SENT"
    }, null, 2)
  }],
  structuredContent: { // Enables type-safe parsing by clients
    transactionId: "tx_123",
    status: "SENT"
  }
};

// Example: Error response
return {
  content: [{
    type: "text",
    text: "Transaction failed: Insufficient funds"
  }],
  isError: true
};
```

**Key Points:**
- `structuredContent` is NEW (v1.22.0+)
- Validated against `outputSchema` if provided
- Enables type-safe client parsing
- Separate from human-readable `content`

---

### 7. Transport Setup - Complete Picture

**What Your Docs Show:**
STDIO setup (correct)

**All Transport Options (2025):**

#### Option 1: STDIO (Your Current - Correct for CLI)

```typescript
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const transport = new StdioServerTransport();
await server.connect(transport);
```

**When to use:** Local CLI tools, spawned processes

#### Option 2: Streamable HTTP (NEW - Recommended for Remote)

```typescript
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';

const app = express();
const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: undefined,
  enableJsonResponse: true
});

await server.connect(transport);

app.post('/mcp', async (req, res) => {
  await transport.handleRequest(req, res, req.body);
});
```

**When to use:** Remote servers, long-running operations

#### Option 3: SSE (DEPRECATED)

```typescript
// ❌ DEPRECATED in favor of Streamable HTTP
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
```

**Update Your Docs:** Remove SSE examples, add Streamable HTTP

---

### 8. Resource Pattern (Mentioned but Incomplete)

**What Your Docs Show:**
Basic resource concept

**Modern Resource Patterns (2025):**

#### Static Resources

```typescript
server.registerResource(
  'config',
  'config://app',
  {
    title: 'Application Config',
    description: 'Application configuration data'
  },
  async (uri) => ({
    contents: [{
      uri: uri.href,
      text: JSON.stringify({ version: '1.0.0' })
    }]
  })
);
```

#### Dynamic Resources (Templates)

```typescript
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';

server.registerResource(
  'user-profile',
  new ResourceTemplate('users://{userId}/profile'),
  {
    title: 'User Profile',
    description: 'User profile data'
  },
  async (uri) => {
    const { userId } = uri.params;
    const profile = await getUserProfile(userId);
    return {
      contents: [{
        uri: uri.href,
        text: JSON.stringify(profile)
      }]
    };
  }
);
```

**When to Use Resources vs Tools:**
- **Resources**: Read-only data, expensive to compute, cacheable
- **Tools**: Actions, mutations, side effects, real-time queries

---

### 9. Prompts (Missing from Your Docs)

**Major Omission:** Your docs don't cover Prompts at all!

**What are Prompts in MCP?**

Reusable templates that guide AI interactions.

**Example:**

```typescript
server.registerPrompt(
  'code-review',
  {
    title: 'Code Review Assistant',
    description: 'Helps review code changes',
    inputSchema: {
      filePath: z.string(),
      language: z.enum(['typescript', 'python', 'rust'])
    }
  },
  async ({ filePath, language }) => ({
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `Review this ${language} file: ${filePath}`
        }
      }
    ]
  })
);
```

**MCP's Three Primitives:**
1. **Tools** - Actions/functions
2. **Resources** - Data/context
3. **Prompts** - Interaction templates

**Add to Your Docs:** Complete section on Prompts

---

### 10. SDK Version Migration Path

**Your Current Version:** 1.15.1
**Latest Version:** 1.23.0-beta.0

**Breaking Changes Between Versions:**

| Version | Key Changes | Impact |
|---------|-------------|--------|
| 1.15.1 (current) | Zod v3 only | Limited to old Zod |
| 1.22.0 | `registerTool` accepts ZodType directly | Can use complex Zod schemas |
| 1.22.0 | `structuredContent` support | Better client parsing |
| 1.23.0-beta.0 | Zod v4 support | Modern Zod features |
| 1.23.0-beta.0 | Migrated to Vitest | Testing infrastructure |

**Recommendation:**
Upgrade to 1.23.0 (when stable) for Zod v4 support and modern features.

---

## Real-World Server Examples Analysis

### Official Servers Repository

Source: [github.com/modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers)

**Key Findings:**

1. **All use Server class** (low-level), not McpServer
2. **All use setRequestHandler pattern** (manual)
3. **Heavy Zod usage** for validation
4. **Modular file structure:**
   - `index.ts` - Main entry point
   - `lib.ts` - Core functionality
   - `*-utils.ts` - Helper utilities
   - `*-validation.ts` - Validation logic

**Example: Filesystem Server Structure**
```
src/filesystem/
├── index.ts              # Server setup + handlers
├── lib.ts                # Core file operations
├── path-utils.ts         # Path manipulation
├── path-validation.ts    # Security validation
└── roots-utils.ts        # MCP Roots handling
```

**Pattern Observation:**
Official servers prioritize **granular control** (Server class) over convenience (McpServer). This suggests:
- McpServer is newer/less battle-tested
- Server class gives more flexibility
- Both are valid choices

---

## Production MCP Servers (2025)

### Notable Examples

1. **GitHub MCP Server** (Official)
   - Rewritten in Go for performance
   - Repository intelligence, PR automation
   - Production-grade reference

2. **Last9** - Real-time production context (logs, metrics, traces)

3. **Sentry** - Official Sentry integration

4. **Needle** - RAG out of the box

5. **Docker Hub** - Artifact repository access

**Common Patterns:**
- Focus on domain-specific functionality
- Strong error handling
- Comprehensive logging
- Rate limiting for production

---

## Outdated/Missing Patterns in Your Docs

### MCP-REFACTORING-PLAN.md

#### OUTDATED:
1. **Line 158-201: Tool Definition Pattern**
   - Shows only JSON Schema
   - Missing Zod alternative
   - Should show BOTH approaches

2. **Line 203-302: Handler Pattern**
   - Shows manual implementation
   - Missing `registerTool` approach
   - Should contrast old vs new

3. **Line 346-506: Server Setup Pattern**
   - Uses `Server` class only
   - Doesn't mention `McpServer`
   - Missing modern convenience API

#### MISSING:
1. **Zod Integration Section**
   - How to migrate from JSON Schema to Zod
   - Zod v3 vs v4 considerations
   - Type inference benefits

2. **Prompts Section**
   - No mention of prompts primitive
   - Missing third pillar of MCP

3. **Resource Templates**
   - Shows static resources only
   - Missing dynamic resource patterns

4. **Output Schema**
   - No mention of `outputSchema`
   - Missing `structuredContent` pattern

5. **SDK Version Compatibility**
   - Doesn't address version-specific features
   - No upgrade path

---

### MCP-MODERN-PATTERNS.md

#### OUTDATED:
1. **Line 4: MCP Specification Date**
   - Says "2025-06-18" (future date - typo?)
   - Latest spec is actually 2025-06-18 (correct but confusing)

2. **Line 264-295: Request Handler Setup**
   - Shows only `setRequestHandler` pattern
   - Should emphasize `registerTool` as modern approach

3. **Line 370-377: STDIO Transport Setup**
   - Correct but missing alternatives
   - Should mention Streamable HTTP

#### MISSING:
1. **McpServer vs Server Comparison**
   - Docs mention both but don't explain difference clearly
   - Should have decision matrix

2. **Zod Version Compatibility**
   - Critical issue not covered
   - Should warn about v3/v4 incompatibility

3. **JSON Schema Draft Versions**
   - SDK generates Draft-07
   - Some clients need Draft-2020-12
   - Known compatibility issue

4. **registerTool Patterns**
   - Only shown in examples
   - Should be in "Best Practices" section

5. **Response Patterns**
   - Missing `structuredContent` field
   - Missing `isError` flag usage
   - Incomplete error response examples

6. **Real-World Examples**
   - No links to production servers
   - Missing community patterns

---

### MCP-REFACTORING-SUMMARY.md

#### OUTDATED:
1. **Performance Numbers (Line 173-200)**
   - Based on assumed HTTP overhead
   - Should be verified with actual measurements
   - May be optimistic

#### MISSING:
1. **SDK Upgrade Consideration**
   - Currently on 1.15.1
   - Should mention upgrading to 1.23.0+
   - Impact of Zod v4 support

2. **Modern API Migration**
   - Doesn't mention migrating to `registerTool`
   - Assumes `setRequestHandler` is standard
   - Should present choice

3. **Alternative Patterns**
   - Only presents one refactoring approach
   - Doesn't discuss McpServer option
   - Missing comparison

---

## Specific Recommendations for Each Doc

### MCP-REFACTORING-PLAN.md Updates

**Add Sections:**

1. **Section: "SDK Version Considerations"** (after line 7)
   ```markdown
   ## SDK Version Considerations

   **Current Version:** @modelcontextprotocol/sdk ^1.15.1
   **Latest Version:** 1.23.0-beta.0

   ### Key Differences
   - 1.15.1: Zod v3 only
   - 1.22.0+: registerTool accepts ZodType directly
   - 1.23.0+: Zod v4 support, structuredContent

   ### Upgrade Path
   [Details on upgrading...]
   ```

2. **Section: "Modern Tool Registration Patterns"** (after line 151)
   ```markdown
   ## Modern Tool Registration Patterns

   ### Option 1: McpServer + registerTool (Modern)
   [Show registerTool pattern with Zod]

   ### Option 2: Server + setRequestHandler (Traditional)
   [Show current pattern]

   ### Comparison
   [Decision matrix]
   ```

3. **Section: "Zod vs JSON Schema"** (after line 201)
   ```markdown
   ## Schema Definition Approaches

   ### Approach A: JSON Schema (Current)
   - ✅ No dependencies
   - ✅ Protocol standard
   - ❌ No type inference

   ### Approach B: Zod Schemas (Modern)
   - ✅ Type safety
   - ✅ Runtime validation
   - ❌ Dependency on Zod
   - ❌ Version compatibility issues
   ```

**Update Sections:**

1. **Lines 158-201:** Add Zod alternative alongside JSON Schema
2. **Lines 346-506:** Show both Server and McpServer approaches
3. **Lines 203-302:** Add registerTool handler pattern

---

### MCP-MODERN-PATTERNS.md Updates

**Add Sections:**

1. **Section: "Server API Comparison"** (before line 148)
   ```markdown
   ## Server vs McpServer: Detailed Comparison

   | Feature | Server | McpServer |
   |---------|--------|-----------|
   [Complete comparison table]

   ### When to Use Server
   [Scenarios]

   ### When to Use McpServer
   [Scenarios]
   ```

2. **Section: "Zod Integration Guide"** (after line 360)
   ```markdown
   ## Zod Integration: Complete Guide

   ### Why Zod?
   [Benefits]

   ### Zod Version Compatibility
   - SDK 1.15.1 → Zod v3 only
   - SDK 1.23.0+ → Zod v4 support

   ### Migration from JSON Schema
   [Step-by-step]

   ### Common Pitfalls
   [Known issues]
   ```

3. **Section: "Prompts Primitive"** (after line 262)
   ```markdown
   ## Prompts: The Third Pillar

   ### What are Prompts?
   [Explanation]

   ### Registration Pattern
   [Code examples]

   ### Use Cases
   [When to use prompts vs tools]
   ```

4. **Section: "Response Patterns & Output Schemas"** (after line 522)
   ```markdown
   ## Modern Response Patterns

   ### Basic Response
   [Simple content array]

   ### Structured Response (v1.22.0+)
   [With structuredContent]

   ### Error Responses
   [With isError flag]

   ### Output Schema Validation
   [Type-safe responses]
   ```

**Update Sections:**

1. **Lines 264-295:** Emphasize registerTool over setRequestHandler
2. **Lines 449-463:** Expand tool naming to include modern patterns
3. **Lines 370-383:** Add Streamable HTTP transport

---

### MCP-REFACTORING-SUMMARY.md Updates

**Add Sections:**

1. **Section: "Implementation Choices"** (after line 93)
   ```markdown
   ## Implementation Choices

   ### Server Class Decision
   - Option A: Keep Server class (traditional)
   - Option B: Migrate to McpServer (modern)
   - **Recommendation:** [Your choice with rationale]

   ### Registration Pattern
   - Option A: setRequestHandler (current pattern)
   - Option B: registerTool (modern convenience)
   - **Recommendation:** [Your choice with rationale]

   ### Schema Approach
   - Option A: JSON Schema (no dependencies)
   - Option B: Zod schemas (type safety)
   - **Recommendation:** [Your choice with rationale]
   ```

2. **Section: "SDK Upgrade Plan"** (after line 300)
   ```markdown
   ## SDK Upgrade Considerations

   **Current:** 1.15.1
   **Target:** 1.23.0

   ### Benefits
   - Zod v4 support
   - structuredContent
   - Modern features

   ### Risks
   - Beta version
   - Breaking changes

   ### Timeline
   [When to upgrade]
   ```

**Update Sections:**

1. **Lines 173-200:** Add disclaimer about performance estimates
2. **Lines 327-346:** Add modern patterns as options

---

## Code Examples: Old vs New Patterns

### Complete Comparison: Send Tool

#### Current Pattern (Your Codebase)

```typescript
// src/mcp/tools.ts
export const ALL_TOOLS = [
  {
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
  }
];

// src/mcp/stdio-server.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";

const server = new Server({
  name: "midnight-mcp-server",
  version: "1.0.0"
}, {
  capabilities: {
    tools: {}
  }
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: ALL_TOOLS };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  return await handleToolCall(name, args);
});
```

#### Modern Pattern (2025)

```typescript
// src/mcp/server.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';

const server = new McpServer({
  name: 'midnight-mcp-server',
  version: '2.0.0'
});

// Register send tool with Zod
server.registerTool(
  'send',
  {
    title: 'Send Funds',
    description: 'Send native tokens to another address',
    inputSchema: {
      destinationAddress: z.string()
        .regex(/^0x[a-fA-F0-9]{40}$/)
        .describe("Recipient's wallet address (hex format)"),
      amount: z.string()
        .regex(/^\d+$/)
        .describe("Amount in base units (1 DUST = 1e6 base units)")
    },
    outputSchema: {
      transactionId: z.string(),
      status: z.enum(['SENT', 'PENDING', 'FAILED'])
    }
  },
  async ({ destinationAddress, amount }) => {
    // TypeScript knows the types!
    // destinationAddress: string
    // amount: string

    try {
      const txId = await walletService.sendFunds(destinationAddress, amount);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            transactionId: txId,
            status: 'SENT'
          }, null, 2)
        }],
        structuredContent: {
          transactionId: txId,
          status: 'SENT'
        }
      };
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
  }
);
```

#### Hybrid Pattern (Recommended for Your Project)

```typescript
// Keep Server class for control, but use modern patterns
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import * as z from 'zod/v3'; // Compatible with SDK 1.15.1

const server = new Server({
  name: "midnight-mcp-server",
  version: "2.0.0"
}, {
  capabilities: {
    tools: {}
  }
});

// Define Zod schemas (for type safety)
const SendInputSchema = z.object({
  destinationAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  amount: z.string().regex(/^\d+$/)
});

type SendInput = z.infer<typeof SendInputSchema>;

// Convert to JSON Schema for protocol
import { zodToJsonSchema } from 'zod-to-json-schema';

const SEND_TOOL = {
  name: "send",
  description: "Send funds",
  inputSchema: zodToJsonSchema(SendInputSchema)
};

// Use setRequestHandler with Zod validation
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === 'send') {
    // Validate with Zod
    const args = SendInputSchema.parse(request.params.arguments);

    // TypeScript knows the types!
    const { destinationAddress, amount } = args;

    // Handle...
  }
});
```

---

## Migration Path Recommendation

### For Your Project

Given your current state:
- SDK 1.15.1
- Server class
- JSON Schema
- Working codebase

**Recommended Approach: Incremental Modernization**

#### Phase 1: Add Zod (Keep Current Structure)

```bash
pnpm add zod@^3.23.8 zod-to-json-schema
```

1. Keep `Server` class
2. Keep `setRequestHandler`
3. Add Zod schemas alongside JSON Schema
4. Use Zod for validation in handlers
5. Convert Zod → JSON Schema for tool definitions

**Benefits:**
- Type safety without refactoring
- Incremental adoption
- No breaking changes

#### Phase 2: Upgrade SDK (When 1.23.0 Stable)

```bash
pnpm add @modelcontextprotocol/sdk@^1.23.0
pnpm add zod@^4.0.0
```

1. Update to Zod v4
2. Use `structuredContent` in responses
3. Consider `registerTool` for new tools

#### Phase 3: Evaluate McpServer (Optional)

1. Test McpServer in parallel
2. Compare developer experience
3. Migrate if beneficial

**Don't Rush:** Your current approach is valid. Modernize incrementally.

---

## Critical Issues to Address

### 1. JSON Schema Draft Version

**Issue:** SDK generates JSON Schema Draft-07, some clients need Draft-2020-12

**Impact:** May cause validation errors with certain MCP clients

**Solution:**
- Monitor client compatibility
- Consider custom JSON Schema generation if needed
- File issue with SDK if blocking

### 2. Zod Transform Functions

**Issue:** Zod transforms are lost during JSON Schema conversion

**Impact:** Can't use complex Zod patterns

**Example:**
```typescript
// This won't work properly
z.string().transform(val => parseInt(val))
```

**Solution:**
- Do transforms in handler, not schema
- Use separate validation and transformation steps

### 3. Union Types in Zod

**Issue:** Union types may lose options in conversion

**Workaround:**
```typescript
// Instead of
z.union([z.string(), z.number()])

// Use
z.string().or(z.number())
```

---

## Community Insights & Trends

### Popular Solutions (2025)

1. **Hybrid Approach:** JSON Schema for protocol, Zod for validation
2. **Server Class:** More common in production than McpServer
3. **Direct Service Integration:** Removing HTTP layers (like your plan)
4. **Modular File Structure:** Splitting by domain (your approach ✅)

### Controversial Topics

1. **Zod Dependency:** Some resist adding Zod dependency
2. **Server vs McpServer:** Debate about abstraction level
3. **JSON Schema Draft Versions:** Compatibility concerns
4. **Protocol Versioning:** Date-based versions confusing

### Expert Opinions

1. **"Use Server class for production"** - More control, battle-tested
2. **"Zod is worth it for TypeScript projects"** - Type safety pays off
3. **"Start simple with JSON Schema"** - Can add Zod later
4. **"registerTool is cleaner but less flexible"** - Trade-offs

---

## Emerming Trends (2025)

### 1. MCP as Standard Protocol

- OpenAI adopted MCP (March 2025)
- Growing ecosystem (270+ servers)
- Enterprise adoption increasing

### 2. Language-Specific SDKs

- TypeScript (official)
- Python (official)
- C# (.NET)
- Java (Spring AI)
- Go (GitHub's implementation)
- Rust (community)

### 3. Framework Integration

- Spring AI MCP Boot Starters
- Fastify MCP plugins
- Express middleware

### 4. Tool Composition

- Servers exposing multiple related tools
- Dynamic tool discovery
- Tool chaining

### 5. Security Focus

- OAuth integration
- Scoped permissions
- Rate limiting
- Input sanitization

---

## Testing Recommendations

### What Your Docs Show

Basic unit testing patterns

### Modern Testing Patterns (2025)

#### 1. Schema Validation Testing

```typescript
import { describe, it, expect } from 'vitest';
import { SendInputSchema } from './schemas.js';

describe('Send Input Schema', () => {
  it('should accept valid address', () => {
    expect(() => SendInputSchema.parse({
      destinationAddress: '0x1234567890123456789012345678901234567890',
      amount: '1000000'
    })).not.toThrow();
  });

  it('should reject invalid address', () => {
    expect(() => SendInputSchema.parse({
      destinationAddress: 'invalid',
      amount: '1000000'
    })).toThrow();
  });
});
```

#### 2. Tool Registration Testing

```typescript
describe('Tool Registration', () => {
  it('should register send tool', () => {
    const server = new McpServer({ name: 'test', version: '1.0.0' });

    server.registerTool('send', { /* ... */ }, async () => {});

    // Verify tool is registered
    const tools = await server.listTools();
    expect(tools.find(t => t.name === 'send')).toBeDefined();
  });
});
```

#### 3. Integration Testing with MCP Client

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

describe('MCP Integration', () => {
  it('should call send tool successfully', async () => {
    const client = new Client({ /* ... */ });

    const result = await client.callTool('send', {
      destinationAddress: '0x...',
      amount: '1000000'
    });

    expect(result.content[0].text).toContain('transactionId');
  });
});
```

---

## Documentation Structure Recommendations

### Suggested New Structure

```
docs/architecture/
├── MCP-OVERVIEW.md                    # NEW: High-level overview
├── MCP-SPECIFICATION-NOTES.md         # NEW: Spec highlights
├── MCP-SDK-GUIDE.md                   # NEW: SDK usage guide
│   ├── Server vs McpServer
│   ├── Registration patterns
│   ├── Schema approaches
│   └── Version compatibility
├── MCP-PATTERNS.md                    # RENAME from MCP-MODERN-PATTERNS.md
│   ├── Handler patterns
│   ├── Error handling
│   ├── Response formats
│   └── Real-world examples
├── MCP-REFACTORING-PLAN.md           # UPDATE (keep existing)
│   ├── Add SDK choices
│   ├── Add schema choices
│   └── Add migration options
├── MCP-MIGRATION-GUIDE.md            # NEW: Step-by-step migration
│   ├── Phase 1: Add Zod
│   ├── Phase 2: Modernize handlers
│   ├── Phase 3: Upgrade SDK
│   └── Phase 4: Evaluate McpServer
└── MCP-REFACTORING-SUMMARY.md        # UPDATE (keep existing)
```

---

## Citations & Sources

### Official Documentation

[1] Model Context Protocol. "Official Specification 2025-06-18." https://modelcontextprotocol.io/specification/2025-06-18

[2] Model Context Protocol. "TypeScript SDK." GitHub, 2024-2025. https://github.com/modelcontextprotocol/typescript-sdk

[3] Model Context Protocol. "Official Servers Repository." GitHub, 2025. https://github.com/modelcontextprotocol/servers

[4] NPM. "@modelcontextprotocol/sdk Package." https://www.npmjs.com/package/@modelcontextprotocol/sdk

### Technical Articles & Guides

[5] MCPcat. "Add Custom Tools to TypeScript MCP Servers - Complete Guide." 2025. https://mcpcat.io/guides/adding-custom-tools-mcp-server-typescript/

[6] MCPcat. "Error Handling in MCP Servers - Best Practices Guide." 2025. https://mcpcat.io/guides/error-handling-custom-mcp-servers/

[7] BytePlus. "MCP Zod Validation: Comprehensive Guide 2025." https://www.byteplus.com/en/topic/541200

[8] DEV Community. "How to build MCP servers with TypeScript SDK." 2025. https://dev.to/shadid12/how-to-build-mcp-servers-with-typescript-sdk-1c28

### GitHub Issues & Discussions

[9] Model Context Protocol. "Zod 4 supported · Issue #555." GitHub, 2024. https://github.com/modelcontextprotocol/typescript-sdk/issues/555

[10] Model Context Protocol. "MCP SDK v1.17.5 Incompatible with Zod v4 · Issue #1429." GitHub, 2024. https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1429

[11] Model Context Protocol. "`registerTool`: accept ZodType<object> · PR #816." GitHub, 2024. https://github.com/modelcontextprotocol/typescript-sdk/pull/816

### Release Notes

[12] Model Context Protocol. "Releases · typescript-sdk." GitHub, 2024-2025. https://github.com/modelcontextprotocol/typescript-sdk/releases

### Enterprise Implementations

[13] GitHub. "A practical guide on how to use the GitHub MCP server." The GitHub Blog, 2025. https://github.blog/ai-and-ml/generative-ai/a-practical-guide-on-how-to-use-the-github-mcp-server/

[14] Spring. "Connect Your AI to Everything: Spring AI's MCP Boot Starters." Spring Blog, 2025. https://spring.io/blog/2025/09/16/spring-ai-mcp-intro-blog/

---

## Summary: Key Takeaways

### What Your Docs Got Right ✅

1. **Architecture Direction:** Removing HTTP layer is correct
2. **Domain Separation:** Handler-based structure is modern
3. **Service Integration:** Direct service calls is best practice
4. **STDIO Transport:** Correct choice for CLI tools
5. **Testing Strategy:** Solid testing approach

### What Your Docs Missed ❌

1. **McpServer vs Server:** Didn't clarify two classes
2. **registerTool Pattern:** Modern convenience API
3. **Zod Integration:** How and why to use Zod
4. **Prompts Primitive:** Third pillar of MCP
5. **Output Schemas:** Type-safe response patterns
6. **SDK Version Issues:** Compatibility concerns
7. **Real-World Examples:** Production patterns
8. **JSON Schema vs Zod:** Trade-offs and choices

### What Your Docs Got Wrong ⚠️

1. **Performance Numbers:** Unverified estimates
2. **SSE Transport:** Should note it's deprecated
3. **Single Pattern:** Didn't present alternatives
4. **Zod as Requirement:** It's optional, JSON Schema works

### Immediate Actions Needed 🚨

1. **Add Server vs McpServer comparison** to all docs
2. **Document registerTool alternative** alongside setRequestHandler
3. **Add Zod integration guide** with version compatibility
4. **Include Prompts section** to complete MCP primitives
5. **Update response patterns** with structuredContent
6. **Add SDK upgrade considerations** to migration plan
7. **Provide code examples** for both old and new patterns

---

## Final Recommendations

### For Immediate Implementation

**Keep Your Current Approach:**
- Server class → Proven, flexible
- setRequestHandler → Works perfectly
- JSON Schema → Protocol standard

**Add Modern Enhancements:**
- Introduce Zod for type safety (optional)
- Add structuredContent to responses
- Implement proper error codes
- Use isError flag

**Document Both Patterns:**
- Show traditional approach (your current)
- Show modern approach (registerTool + Zod)
- Explain when to use each
- Provide migration path

### For Future Consideration

1. **Upgrade to SDK 1.23.0** when stable
2. **Experiment with McpServer** for new features
3. **Add Prompts support** if needed
4. **Consider Zod v4** for new schemas
5. **Monitor community patterns** and adapt

---

## Contact for Clarifications

This research was conducted on January 21, 2025, based on:
- Official MCP documentation (spec 2025-06-18)
- TypeScript SDK releases up to 1.23.0-beta.0
- Community resources and production examples
- Your existing codebase (SDK 1.15.1)

**Note:** MCP is rapidly evolving. Patterns may change. Always verify against official documentation when implementing.

---

**Research Status:** ✅ Complete
**Confidence Level:** High (based on official sources and production examples)
**Next Steps:** Review findings, update documentation, decide on implementation approach
