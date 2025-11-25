/**
 * Castor - DID Management Module Wrapper
 *
 * Wraps Hyperledger Identus Castor module for DID operations.
 * Castor handles:
 * - DID creation (Peer DIDs, PRISM DIDs)
 * - DID resolution
 * - DID Document management
 *
 * Based on @hyperledger/identus-sdk v7.0.0
 */

import { Castor as IdentusCastor, Domain } from '@hyperledger/identus-sdk';
import { getApollo } from './apollo.js';

/**
 * Castor singleton instance
 */
let castorInstance: IdentusCastor | null = null;

/**
 * Get or create Castor instance
 */
export function getCastor(): IdentusCastor {
  if (!castorInstance) {
    const apollo = getApollo();
    castorInstance = new IdentusCastor(apollo);
  }
  return castorInstance;
}

/**
 * Create a Peer DID with given key pairs
 *
 * @param authKeyPair - ED25519 key pair for authentication
 * @param keyAgreementKeyPair - X25519 key pair for key agreement
 * @param services - Optional services to include in DID Document
 * @returns Peer DID instance
 */
export async function createPeerDID(
  authKeyPair: any,
  keyAgreementKeyPair: any,
  services: any[] = []
) {
  const castor = getCastor();

  // SDK v7.0.0 expects public keys array for createPeerDID
  // Extract public keys from the KeyPair objects
  const peerDID = await castor.createPeerDID(
    [authKeyPair.publicKey, keyAgreementKeyPair.publicKey],
    services
  );

  return peerDID;
}

/**
 * Resolve a DID to its DID Document
 *
 * @param did - DID string to resolve
 * @returns DID Document
 */
export async function resolveDID(did: string) {
  const castor = getCastor();

  // Parse DID string to DID object
  const didObject = Domain.DID.fromString(did);

  // Resolve DID to DID Document
  const didDocument = await castor.resolveDID(didObject.toString());

  return didDocument;
}

/**
 * Parse DID string to DID object
 *
 * @param did - DID string
 * @returns DID object
 */
export function parseDID(did: string) {
  return Domain.DID.fromString(did);
}

/**
 * Convert DID object to string
 *
 * @param did - DID object
 * @returns DID string
 */
export function didToString(did: any): string {
  return did.toString();
}

export { Domain };
