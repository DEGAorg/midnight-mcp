# BigInt Serialization Issue - MCP HTTP Transport

## Status: ✅ RESOLVED

## Problem Summary
The `walletStatus` tool was failing with "Do not know how to serialize a BigInt" error when called via HTTP transport, but worked fine in Cursor (which uses STDIO transport).

## Root Cause
The HTTP transport (`StreamableHTTPServerTransport`) performs double JSON serialization:
1. Tool adapter serializes result with BigInt replacer ✅
2. HTTP transport serializes again WITHOUT BigInt replacer ❌

This caused BigInt values from the Midnight SDK to fail serialization at the HTTP layer.

## Evidence
- **STDIO works**: Single serialization layer
- **HTTP fails**: Double serialization, second layer lacks BigInt handling
- **Tool already converts BigInt to string** but transport re-serializes

## Solution Implemented
**Global BigInt Serialization Patch** (`src/mcp/http-server.ts:1-38`)

Applied two patches at the module level (before any imports):
1. **BigInt.prototype.toJSON** - Makes BigInt values automatically serialize to strings
2. **JSON.stringify override** - Wraps the native JSON.stringify to handle BigInt in all contexts

```typescript
// Patch 1: BigInt.prototype.toJSON
(BigInt.prototype as any).toJSON = function() {
  return this.toString();
};

// Patch 2: JSON.stringify override with BigInt replacer
const originalStringify = JSON.stringify;
(globalThis as any).JSON.stringify = function(value, replacer, space) {
  const bigIntReplacer = (key: string, val: any): any => {
    if (typeof val === 'bigint') return val.toString();
    return val;
  };
  // ... handles all replacer variants
};
```

## Why This Works
- **Module-level patch**: Applied before any HTTP transport initialization
- **Global scope**: Handles BigInt in all serialization paths (tool adapter, transport, middleware)
- **Non-breaking**: Preserves existing replacer functions by wrapping them
- **Tested**: All tests pass including session persistence and multi-agent tests

## Files Involved
- ✅ `/src/mcp/http-server.ts` - Global BigInt patch (lines 1-38)
- ✅ `/src/mcp/adapter/tool-adapter.ts` - Tool execution with BigInt-safe logging
- ✅ `/test/mcp-http-client-test.ts` - Integration tests verify fix
- `/src/mcp/tools/wallet-tools.ts` - Tool definitions
- `/src/services/wallet/WalletService.ts` - Returns BigInt values from Midnight SDK

## Test Results
```bash
✅ All tests passing
✅ walletStatus tool works correctly
✅ Session persistence maintained
✅ Multi-agent support functional
✅ Balance: 0, Sync: 100%, isReady: true
```

## Alternative Approaches Considered
1. ❌ Use STDIO transport only - Limits deployment flexibility
2. ❌ Modify wallet service to never return BigInt - Breaks Midnight SDK types
3. ❌ Patch MCP SDK - Not maintainable across SDK updates
4. ✅ Global serialization patch - Clean, non-breaking, works with all transports