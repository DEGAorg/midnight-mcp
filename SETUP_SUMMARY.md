# Setup Summary for Claude Code

## ✅ Quick Setup (3 Steps)

### 1. Build the project
```bash
yarn build
```

### 2. Generate MCP config
```bash
yarn mcp:config
```

### 3. Select and copy the JSON output between the lines, then paste into Claude Code MCP settings

**Pro tip:** The output is valid JSON ready to paste - just select everything between the separator lines!

That's it! The script automatically:
- Finds your latest Node.js version >= 20 from NVM
- Generates the complete config with absolute paths
- Works for ANY user with ANY Node version

---

## Why This Works

**The Problem:**
- Claude Code doesn't inherit your shell's NVM environment
- Cursor works fine because it sources your shell profile
- Need absolute paths to Node binary and working directory

**The Solution:**
- ✅ Absolute path to Node binary from NVM
- ✅ Absolute path to MCP server script
- ✅ Set `cwd` to fix path resolution

**No hardcoded versions!** The script finds the best available Node automatically.

---

## Example Output

When you run `yarn mcp:config`, you'll see something like:

```
✅ Found Node.js: v20.19.2
📍 Path: /Users/YOU/.nvm/versions/node/v20.19.2/bin/node

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 SELECT AND COPY EVERYTHING BETWEEN THE LINES BELOW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

"midnight-mcp": {
  "type": "stdio",
  "name": "Midnight MCP",
  "command": "/Users/YOU/.nvm/versions/node/v20.19.2/bin/node",
  "args": [
    "/path/to/midnight-mcp/dist/mcp/stdio-server.js"
  ],
  "env": {
    "AGENT_ID": "workshop",
    "LOG_LEVEL": "error"
  },
  "cwd": "/path/to/midnight-mcp"
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Paste this into your Claude Code MCP settings JSON
💡 Location: Claude Code → Settings → MCP Servers
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Just select and copy the JSON between the separator lines - it's ready to paste!**

---

## Files Created

| File | Purpose |
|------|---------|
| `scripts/get-node-path.sh` | Finds latest Node.js >= 20 in NVM |
| `scripts/generate-mcp-config.sh` | Generates complete MCP config |
| `docs/CLAUDE_CODE_SETUP.md` | Detailed setup guide |

---

## Testing

After configuring Claude Code:

1. **Restart Claude Code**
2. **Test in chat:**
   ```
   "Can you check my wallet status?"
   ```
3. **Should work!** ✅

---

## Need Help?

See `docs/CLAUDE_CODE_SETUP.md` for detailed troubleshooting.
