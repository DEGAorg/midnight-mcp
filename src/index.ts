/* istanbul ignore file */
/**
 * Midnight MCP Server
 * 
 * This module exports a simple MCP server with tools for getting
 * the current timestamp and a server value.
 */

import { createServer } from './stdio-server.js';

export {
  createServer
};

// Auto-start the server if this file is the main module
// Replace require.main check with import.meta.url check for ES modules
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  const server = createServer();
  server.start().catch(error => {
    console.error("Failed to start server:", error);
    process.exit(1);
  });
} 