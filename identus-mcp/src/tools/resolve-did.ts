/**
 * Resolve DID Tool
 *
 * MCP tool for resolving Peer DIDs to their DID Documents.
 * Returns the full W3C DID Document including:
 * - Verification methods (public keys)
 * - Authentication methods
 * - Key agreement methods
 * - Service endpoints (if any)
 */

import { z } from 'zod';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { resolveDID as resolveIdentusDID } from '../identus-sdk/castor.js';
import { getDIDByString } from '../storage/did-storage.js';

/**
 * Input Schema
 */
const ResolveDIDInputSchema = z.object({
  did: z.string()
    .regex(/^did:peer:2\.[1-9A-HJ-NP-Za-km-z]+$/, {
      message: 'Invalid Peer DID format. Expected did:peer:2.<base58btc-data>',
    })
    .describe('DID to resolve (must be a Peer DID)'),
});

type ResolveDIDInput = z.infer<typeof ResolveDIDInputSchema>;

/**
 * Tool Definition
 */
export const resolveDIDTool = {
  definition: {
    name: 'resolveDID',
    description: `Resolve a Peer DID to its DID Document.

Returns the full W3C DID Core 1.0 compliant DID Document including:
- verificationMethod: Public keys for authentication and key agreement
- authentication: References to authentication keys
- keyAgreement: References to key agreement keys
- service: Service endpoints (if any)

Example usage:
  {"did": "did:peer:2.Ez6LSbysY2xFMRpGMhb7tFTLMpeuPRaqaWM1yECx2AtzE3KCc"}

This will return the complete DID Document with verification methods.`,
    inputSchema: {
      type: 'object',
      properties: {
        did: {
          type: 'string',
          description: 'DID to resolve (must be a Peer DID in did:peer:2.* format)',
          pattern: '^did:peer:2\\.[1-9A-HJ-NP-Za-km-z]+$',
        },
      },
      required: ['did'],
    },
  } as Tool,

  /**
   * Execute function
   */
  execute: async (args: unknown) => {
    const input = ResolveDIDInputSchema.parse(args);

    try {
      // First check if we have this DID in local storage
      const storedDID = await getDIDByString(input.did);

      // Resolve DID Document using Castor
      const didDocument = await resolveIdentusDID(input.did);

      // Extract verification methods, authentication, and key agreement
      const verificationMethods = didDocument.verificationMethods || [];
      const authentication = didDocument.authentication || [];
      const keyAgreement = didDocument.keyAgreement || [];
      const services = didDocument.services || [];

      return {
        success: true,
        did: input.did,
        didDocument: didDocument,
        verificationMethods: verificationMethods,
        authentication: authentication,
        keyAgreement: keyAgreement,
        services: services,
        // Include storage info if available
        storedLocally: !!storedDID,
        agentId: storedDID?.agentId,
      };
    } catch (error) {
      throw new Error(`Failed to resolve DID: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
};
