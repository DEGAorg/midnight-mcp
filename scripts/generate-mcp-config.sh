#!/bin/bash

# Generate MCP configuration for Claude Code
# Automatically finds the best Node version (>= 20)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Get Node path
NODE_PATH=$("$SCRIPT_DIR/get-node-path.sh")
if [ $? -ne 0 ]; then
  echo "❌ Failed to find Node.js >= 20"
  exit 1
fi

NODE_VERSION=$(basename "$(dirname "$(dirname "$NODE_PATH")")")

# Generate config
CONFIG=$(cat <<EOF
"midnight-mcp": {
  "type": "stdio",
  "name": "Midnight MCP",
  "command": "$NODE_PATH",
  "args": [
    "$PROJECT_ROOT/dist/mcp/stdio-server.js"
  ],
  "env": {
    "AGENT_ID": "workshop",
    "LOG_LEVEL": "error",
    "BASE_STORAGE_DIR": "$PROJECT_ROOT/.storage"
  },
  "cwd": "$PROJECT_ROOT"
}
EOF
)

# Copy to clipboard
echo "$CONFIG" | pbcopy

echo "✅ Found Node.js: $NODE_VERSION"
echo "📍 Path: $NODE_PATH"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ Configuration copied to clipboard!"
echo "📋 Just paste (Cmd+V) into Claude Code MCP settings"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "$CONFIG"
