# Claude Code MCP Setup

## TL;DR - Quick Setup

Run this command to generate your MCP config:

```bash
./scripts/generate-mcp-config.sh
```

Copy the output into your Claude Code MCP settings.

---

## Why This Is Needed

Claude Code (and Claude Desktop) don't inherit your shell's NVM configuration due to macOS security restrictions. They use a minimal system PATH and can't find Node versions managed by NVM.

**In Cursor:** Works fine because Cursor sources your shell profile
**In Claude Code:** Needs absolute paths to Node binary

## The Problem

When you configure MCP like this:
```json
{
  "command": "node",  // ❌ Won't work - Claude Code can't find "node"
  "args": ["dist/mcp/stdio-server.js"]
}
```

You'll get errors like:
- `Error [ERR_REQUIRE_ESM]: require() of ES Module ... not supported` (wrong Node version)
- `ENOENT: no such file or directory, mkdir '/.storage/logs/workshop'` (wrong working directory)

## The Solution

Use absolute paths:
```json
{
  "command": "/Users/YOU/.nvm/versions/node/vXX.XX.X/bin/node",  // ✅ Full path
  "args": ["/full/path/to/dist/mcp/stdio-server.js"],
  "cwd": "/full/path/to/project"  // ✅ Set working directory
}
```

## Automatic Configuration

### Option 1: Use the Generator Script (Recommended)

```bash
cd /path/to/midnight-mcp
./scripts/generate-mcp-config.sh
```

This script:
- ✅ Automatically finds the latest Node.js version >= 20
- ✅ Generates the complete MCP config with absolute paths
- ✅ Works for any user with any Node version

### Option 2: Manual Configuration

1. Find your Node path:
```bash
./scripts/get-node-path.sh
# Output: /Users/YOU/.nvm/versions/node/v20.19.2/bin/node
```

2. Use the path in your MCP config:
```json
{
  "midnight-mcp": {
    "type": "stdio",
    "name": "Midnight MCP",
    "command": "/Users/YOU/.nvm/versions/node/v20.19.2/bin/node",
    "args": [
      "/full/path/to/midnight-mcp/dist/mcp/stdio-server.js"
    ],
    "env": {
      "AGENT_ID": "workshop",
      "LOG_LEVEL": "error"
    },
    "cwd": "/full/path/to/midnight-mcp"
  }
}
```

## Key Configuration Fields

| Field | Purpose | Example |
|-------|---------|---------|
| `command` | Absolute path to Node binary from NVM | `/Users/YOU/.nvm/versions/node/v20.19.2/bin/node` |
| `args` | Absolute path to MCP server script | `["/path/to/dist/mcp/stdio-server.js"]` |
| `cwd` | Project root directory (fixes path resolution) | `/path/to/midnight-mcp` |
| `env.AGENT_ID` | Agent identifier for wallet/storage isolation | `"workshop"` |
| `env.LOG_LEVEL` | Log verbosity (error, warn, info, debug) | `"error"` |

## Node Version Requirements

**Minimum:** Node.js >= 20.x
**Recommended:** Node.js 20.19.x or 23.x

The Midnight SDK requires Node >= 20 with ESM support.

## Troubleshooting

### Script Fails: "No Node.js version >= 20 found"
```bash
# Install Node 20 with NVM
nvm install 20
nvm use 20
```

### Still Getting ERR_REQUIRE_ESM Error
- Check that your `command` path points to Node >= 20
- Run: `$(./scripts/get-node-path.sh) --version` to verify

### ENOENT Error: "mkdir '/.storage/logs/workshop'"
- Make sure you added the `"cwd"` field to your MCP config
- Verify the `cwd` path is absolute and points to the project root

### Claude Code Can't Find the Script
- Ensure you've built the project: `yarn build`
- Verify the path: `ls /path/to/dist/mcp/stdio-server.js`

## Testing Your Configuration

After updating your MCP config in Claude Code:

1. **Restart Claude Code** completely
2. **Test connection** by asking Claude to call a wallet tool:
   ```
   "Can you check my wallet status?"
   ```
3. **Check logs** in Claude Code's MCP panel for any errors

## References

- [Configure Claude MCP for use with NVM](https://gist.github.com/cognivator/ceca5a68d696b0575962ff3d18c31aa5)
- [MCP Servers Don't Work with NVM · Issue #64](https://github.com/modelcontextprotocol/servers/issues/64)
- [Solution for MCP Connection Issues with NVM/NPM](https://github.com/orgs/modelcontextprotocol/discussions/31)
