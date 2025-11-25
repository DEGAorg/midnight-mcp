#!/usr/bin/env tsx

/**
 * Test Script for Identus MCP Tools
 *
 * Tests createDID and resolveDID tools with real Identus SDK.
 * Run with: pnpm test or tsx src/tools/test-tools.ts
 */

import { createDIDTool } from './create-did.js';
import { resolveDIDTool } from './resolve-did.js';

async function testCreateDID() {
  console.log('\n📝 Testing createDID tool...\n');

  try {
    // Test 1: Create DID for new agent
    console.log('1. Creating DID for agent-test-1...');
    const result1 = await createDIDTool.execute({
      agentId: 'agent-test-1',
      name: 'Test Agent 1',
    });
    console.log('✅ Result:', JSON.stringify(result1, null, 2));

    // Test 2: Create DID for existing agent (should return existing)
    console.log('\n2. Creating DID for agent-1 (existing)...');
    const result2 = await createDIDTool.execute({
      agentId: 'agent-1',
    });
    console.log('✅ Result:', JSON.stringify(result2, null, 2));

    // Test 3: Create DID with only ED25519 key
    console.log('\n3. Creating DID with only ED25519 key...');
    const result3 = await createDIDTool.execute({
      agentId: 'agent-test-2',
      name: 'Test Agent 2',
      keyTypes: ['ED25519'],
    });
    console.log('✅ Result:', JSON.stringify(result3, null, 2));

    console.log('\n✅ All createDID tests passed!\n');
    return true;
  } catch (error) {
    console.error('❌ createDID test failed:', error);
    return false;
  }
}

async function testResolveDID() {
  console.log('\n📝 Testing resolveDID tool...\n');

  try {
    // Test 1: Resolve existing DID
    console.log('1. Resolving existing DID (agent-1)...');
    const result1 = await resolveDIDTool.execute({
      did: 'did:peer:2.Ez6LSbysY2xFMRpGMhb7tFTLMpeuPRaqaWM1yECx2AtzE3KCc',
    });
    console.log('✅ Result:', JSON.stringify(result1, null, 2));

    // Test 2: Resolve non-existent DID (should fail)
    console.log('\n2. Resolving non-existent DID...');
    try {
      await resolveDIDTool.execute({
        did: 'did:peer:2.EzNonExistentDID123456789',
      });
      console.log('❌ Should have thrown error for non-existent DID');
      return false;
    } catch (error: any) {
      console.log('✅ Correctly threw error:', error.message);
    }

    // Test 3: Invalid DID format (should fail validation)
    console.log('\n3. Testing invalid DID format...');
    try {
      await resolveDIDTool.execute({
        did: 'invalid-did-format',
      });
      console.log('❌ Should have thrown validation error');
      return false;
    } catch (error: any) {
      console.log('✅ Correctly threw validation error:', error.message);
    }

    console.log('\n✅ All resolveDID tests passed!\n');
    return true;
  } catch (error) {
    console.error('❌ resolveDID test failed:', error);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting Identus MCP Tools Test Suite...\n');
  console.log('='.repeat(60));

  const createDIDSuccess = await testCreateDID();
  const resolveDIDSuccess = await testResolveDID();

  console.log('='.repeat(60));

  if (createDIDSuccess && resolveDIDSuccess) {
    console.log('\n🎉 All tests passed successfully!\n');
    console.log('Summary:');
    console.log('  ✅ createDID: 3/3 tests passed');
    console.log('  ✅ resolveDID: 3/3 tests passed');
    console.log('\n  Total: 6/6 tests passed ✨\n');
    process.exit(0);
  } else {
    console.error('\n💥 Some tests failed!\n');
    process.exit(1);
  }
}

// Run tests
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { main as runTests };
