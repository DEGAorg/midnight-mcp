# BigInt Serialization Issue - MCP HTTP Transport

## Problem Summary
The `walletStatus` tool fails with "Do not know how to serialize a BigInt" error when called via HTTP transport, but works fine in Cursor (which uses STDIO transport).

## Root Cause
The HTTP transport (`StreamableHTTPServerTransport`) performs double JSON serialization:
1. Tool adapter serializes result with BigInt replacer ✅
2. HTTP transport serializes again WITHOUT BigInt replacer ❌

## Evidence
- **STDIO works**: Single serialization layer
- **HTTP fails**: Double serialization, second layer lacks BigInt handling
- **Tool already converts BigInt to string** but transport re-serializes

## Attempted Fixes
1. ✅ Converted BigInt to string in walletStatus tool
2. ✅ Added BigInt replacer to tool adapter
3. ✅ Disabled `enableJsonResponse` in transport
4. ❌ Still fails due to MCP SDK internal serialization

## Files Involved
- `/src/mcp/tools/wallet-tools.ts` - Tool definitions
- `/src/mcp/adapter/tool-adapter.ts` - Tool execution & first serialization
- `/src/mcp/http-server.ts` - HTTP transport configuration
- `/src/services/wallet/WalletService.ts` - Returns BigInt values

## Workaround Options
1. Use STDIO transport instead of HTTP (what Cursor does)
2. Modify wallet service to never return BigInt
3. Patch MCP SDK to handle BigInt
4. Use a different HTTP transport implementation

## Next Steps
- Consider implementing custom HTTP transport
- Or fully migrate BigInt values to strings at service layer
- Or wait for MCP SDK update to handle BigInt natively