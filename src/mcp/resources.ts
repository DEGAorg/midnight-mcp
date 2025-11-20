/* istanbul ignore file */
import { McpError, ErrorCode, Resource } from "@modelcontextprotocol/sdk/types.js";

/**
 * Simple logging function
 */
function log(...args: any[]) {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}]`, ...args);
}

/**
 * Define the default Midnight wallet resource
 */
export const DEFAULT_MIDNIGHT_RESOURCE: Resource = {
  uri: "midnight://wallet-info",
  name: "Midnight Wallet Information",
  description: "Basic information about Midnight wallet capabilities",
  mimeType: "application/json"
};

/**
 * Define wallet status resource
 */
export const WALLET_STATUS_RESOURCE: Resource = {
  uri: "midnight://wallet-status",
  name: "Wallet Status",
  description: "Current status of the Midnight wallet",
  mimeType: "application/json"
};

/**
 * Define wallet address resource
 */
export const WALLET_ADDRESS_RESOURCE: Resource = {
  uri: "midnight://wallet-address",
  name: "Wallet Address",
  description: "The address of the current Midnight wallet",
  mimeType: "application/json"
};

/**
 * Define wallet balance resource
 */
export const WALLET_BALANCE_RESOURCE: Resource = {
  uri: "midnight://wallet-balance",
  name: "Wallet Balance",
  description: "Current balance of the Midnight wallet",
  mimeType: "application/json"
};

/**
 * Define transactions resource
 */
export const TRANSACTIONS_RESOURCE: Resource = {
  uri: "midnight://transactions",
  name: "All Transactions",
  description: "All transactions for the Midnight wallet",
  mimeType: "application/json"
};

/**
 * Define pending transactions resource
 */
export const PENDING_TRANSACTIONS_RESOURCE: Resource = {
  uri: "midnight://pending-transactions",
  name: "Pending Transactions",
  description: "List of pending transactions for the Midnight wallet",
  mimeType: "application/json"
};

/**
 * List of all available resources
 */
export const RESOURCES = [
  DEFAULT_MIDNIGHT_RESOURCE,
  WALLET_STATUS_RESOURCE,
  WALLET_ADDRESS_RESOURCE,
  WALLET_BALANCE_RESOURCE,
  TRANSACTIONS_RESOURCE,
];

/**
 * Handle list resources request
 */
export function handleListResources(): Resource[] {
  log("Handling list resources request");
  return RESOURCES;
}

/**
 * Handle read resource request
 * @param resourceUri The resource URI to read
 * @param midnightServer The Midnight server instance
 * @returns The resource metadata and content generation function
 */
export function handleReadResource(resourceUri: string): Resource {
    log(`Handling read resource request for ${resourceUri}`);
    
    const resource = RESOURCES.find((r) => r.uri === resourceUri);
    
    if (!resource) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Resource not found: ${resourceUri}`
      );
    }
    
    return resource;
  }