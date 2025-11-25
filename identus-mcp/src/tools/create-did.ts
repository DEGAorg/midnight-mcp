/**
 * Create DID Tool
 *
 * MCP tool for creating new Peer DIDs for Midnight City agents.
 * Uses Hyperledger Identus SDK (Apollo + Castor) to generate:
 * - ED25519 key pair for authentication
 * - X25519 key pair for key agreement (DIDComm)
 * - Peer DID (did:peer:2.* format)
 */

import { z } from 'zod';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import {
  createAuthKeyPair,
  createKeyAgreementKeyPair,
  getPublicKeyMultibase,
  exportKeyToString,
} from '../identus-sdk/apollo.js';
import {
  createPeerDID,
  didToString,
} from '../identus-sdk/castor.js';
import {
  saveDID,
  getDIDByAgentId,
} from '../storage/did-storage.js';

/**
 * Input Schema
 */
const CreateDIDInputSchema = z.object({
  agentId: z.string()
    .min(1)
    .describe('Agent identifier to create DID for'),

  name: z.string()
    .min(1)
    .max(64)
    .optional()
    .describe('Optional human-readable name for the agent'),

  keyTypes: z.array(z.enum(['ED25519', 'X25519']))
    .default(['ED25519', 'X25519'])
    .describe('Key types to generate (ED25519 for auth, X25519 for key agreement)'),
});

type CreateDIDInput = z.infer<typeof CreateDIDInputSchema>;

/**
 * Tool Definition
 */
export const createDIDTool = {
  definition: {
    name: 'createDID',
    description: `Create a new Peer DID for an agent with authentication and key agreement keys.

Returns:
- did: The created DID in did:peer:2.* format
- publicKeys: The public keys for authentication and key agreement
- created: Timestamp of DID creation

Example usage:
  {"agentId": "agent-1", "name": "Alice"}

This will create a Peer DID with ED25519 (auth) and X25519 (key agreement) keys.`,
    inputSchema: {
      type: 'object',
      properties: {
        agentId: {
          type: 'string',
          description: 'Agent identifier to create DID for',
        },
        name: {
          type: 'string',
          description: 'Optional human-readable name for the agent',
        },
        keyTypes: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['ED25519', 'X25519'],
          },
          description: 'Key types to generate',
          default: ['ED25519', 'X25519'],
        },
      },
      required: ['agentId'],
    },
  } as Tool,

  /**
   * Execute function
   */
  execute: async (args: unknown) => {
    const input = CreateDIDInputSchema.parse(args);

    try {
      // Check if DID already exists for this agent
      const existingDID = await getDIDByAgentId(input.agentId);
      if (existingDID) {
        return {
          success: true,
          alreadyExists: true,
          did: existingDID.did,
          agentId: input.agentId,
          publicKeys: existingDID.publicKeys,
          created: existingDID.created,
          metadata: {
            name: existingDID.name,
            keyTypes: existingDID.keyTypes,
          },
        };
      }

      // Create new key pairs using Apollo
      const authKeyPair = createAuthKeyPair();
      const keyAgreementKeyPair = createKeyAgreementKeyPair();

      // Create Peer DID using Castor
      const peerDID = await createPeerDID(authKeyPair, keyAgreementKeyPair);
      const didString = didToString(peerDID);

      // Get public keys in multibase format
      const authPublicKey = getPublicKeyMultibase(authKeyPair);
      const keyAgreementPublicKey = getPublicKeyMultibase(keyAgreementKeyPair);

      // Export private keys for storage (WARNING: plain text in Phase 1)
      const authPrivateKey = exportKeyToString(authKeyPair.privateKey);
      const keyAgreementPrivateKey = exportKeyToString(keyAgreementKeyPair.privateKey);

      // Create storage entry
      const created = new Date().toISOString();
      const storageEntry = {
        did: didString,
        agentId: input.agentId,
        name: input.name,
        created: created,
        keyTypes: input.keyTypes,
        publicKeys: {
          auth: authPublicKey,
          keyAgreement: keyAgreementPublicKey,
        },
        privateKeys: {
          auth: authPrivateKey,
          keyAgreement: keyAgreementPrivateKey,
        },
      };

      // Save to storage
      await saveDID(storageEntry);

      return {
        success: true,
        alreadyExists: false,
        did: didString,
        agentId: input.agentId,
        publicKeys: {
          auth: authPublicKey,
          keyAgreement: keyAgreementPublicKey,
        },
        created: created,
        metadata: {
          name: input.name || `Agent ${input.agentId}`,
          keyTypes: input.keyTypes,
        },
      };
    } catch (error) {
      throw new Error(`Failed to create DID: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
};
