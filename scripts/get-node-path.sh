#!/bin/bash

# Find the best Node.js version (>= 20) in NVM
# Outputs the absolute path to the node binary

NVM_DIR="${NVM_DIR:-$HOME/.nvm}"

if [ ! -d "$NVM_DIR/versions/node" ]; then
  echo "Error: NVM not found at $NVM_DIR" >&2
  exit 1
fi

# Find all Node v20+ versions, sort, and pick the latest
NODE_PATH=$(find "$NVM_DIR/versions/node" -maxdepth 1 -type d -name "v2*" -o -name "v3*" | \
  sort -V | tail -1)

if [ -z "$NODE_PATH" ]; then
  echo "Error: No Node.js version >= 20 found in NVM" >&2
  echo "Available versions:" >&2
  ls "$NVM_DIR/versions/node" >&2
  exit 1
fi

NODE_BIN="$NODE_PATH/bin/node"

if [ ! -f "$NODE_BIN" ]; then
  echo "Error: Node binary not found at $NODE_BIN" >&2
  exit 1
fi

echo "$NODE_BIN"
