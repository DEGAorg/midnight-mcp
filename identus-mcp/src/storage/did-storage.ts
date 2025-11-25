/**
 * DID Storage Module
 *
 * Simple in-memory storage for DIDs.
 * In production, this should use a proper database.
 */

export interface DIDStorageEntry {
  did: string;
  agentId: string;
  name?: string;
  created: string;
  keyTypes: string[];
  publicKeys: {
    auth: string;
    keyAgreement: string;
  };
  privateKeys: {
    auth: string;
    keyAgreement: string;
  };
}

// In-memory storage (should be replaced with database in production)
const didStorage: Map<string, DIDStorageEntry> = new Map();
const agentIdIndex: Map<string, string> = new Map(); // agentId -> did

/**
 * Save a DID entry to storage
 */
export async function saveDID(entry: DIDStorageEntry): Promise<void> {
  didStorage.set(entry.did, entry);
  agentIdIndex.set(entry.agentId, entry.did);
}

/**
 * Get DID by agent ID
 */
export async function getDIDByAgentId(agentId: string): Promise<DIDStorageEntry | null> {
  const did = agentIdIndex.get(agentId);
  if (!did) {
    return null;
  }
  return didStorage.get(did) || null;
}

/**
 * Get DID by DID string
 */
export async function getDIDByString(did: string): Promise<DIDStorageEntry | null> {
  return didStorage.get(did) || null;
}

/**
 * Get all DIDs
 */
export async function getAllDIDs(): Promise<DIDStorageEntry[]> {
  return Array.from(didStorage.values());
}

/**
 * Delete DID by DID string
 */
export async function deleteDID(did: string): Promise<boolean> {
  const entry = didStorage.get(did);
  if (!entry) {
    return false;
  }

  didStorage.delete(did);
  agentIdIndex.delete(entry.agentId);
  return true;
}
