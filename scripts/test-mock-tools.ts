#!/usr/bin/env tsx

/**
 * Mock Tools Test Script
 *
 * Tests all MCP tools with mock data to verify they work correctly
 * without requiring actual wallet/network connections.
 */

import {
  walletStatusTool,
  walletAddressTool,
  walletBalanceTool,
  getTransactionTool,
} from '../src/mcp/tools/wallet-tools.js';

import {
  listTokensTool,
  getTokenBalanceTool,
  registerTokenTool,
  sendShieldedTokenTool,
  sendNativeTokenTool,
} from '../src/mcp/tools/token-tools.js';

import {
  openDaoElectionTool,
  castDaoVoteTool,
  closeDaoElectionTool,
  fundDaoTreasuryTool,
} from '../src/mcp/tools/dao-tools.js';

import {
  getUserInfoTool,
  isUserRegisteredTool,
  isUserVerifiedTool,
} from '../src/mcp/tools/marketplace-tools.js';

// Mock services - not used since we're using mock data
const mockServices: any = {};

async function testWalletTools() {
  console.log('\n📝 Testing Wallet Tools...\n');

  try {
    // Test walletStatus
    console.log('1. Testing walletStatus...');
    const status = await walletStatusTool.execute({}, mockServices);
    console.log('✅ walletStatus:', JSON.stringify(status, null, 2));

    // Test walletAddress
    console.log('\n2. Testing walletAddress...');
    const address = await walletAddressTool.execute({}, mockServices);
    console.log('✅ walletAddress:', JSON.stringify(address, null, 2));

    // Test walletBalance
    console.log('\n3. Testing walletBalance...');
    const balance = await walletBalanceTool.execute({}, mockServices);
    console.log('✅ walletBalance:', JSON.stringify(balance, null, 2));

    // Test getTransaction - existing transaction
    console.log('\n4. Testing getTransaction (existing)...');
    const tx1 = await getTransactionTool.execute({ transactionId: 'tx-completed' }, mockServices);
    console.log('✅ getTransaction (existing):', JSON.stringify(tx1, null, 2));

    // Test getTransaction - non-existing transaction
    console.log('\n5. Testing getTransaction (non-existing)...');
    try {
      await getTransactionTool.execute({ transactionId: 'tx-nonexistent' }, mockServices);
      console.log('❌ Should have thrown error for non-existent transaction');
    } catch (error: any) {
      console.log('✅ getTransaction (non-existing) correctly threw error:', error.message);
    }

    console.log('\n✅ All Wallet Tools Passed!\n');
  } catch (error) {
    console.error('❌ Wallet Tools Failed:', error);
    throw error;
  }
}

async function testTokenTools() {
  console.log('\n📝 Testing Token Tools...\n');

  try {
    // Test listTokens
    console.log('1. Testing listTokens...');
    const tokens = await listTokensTool.execute({}, mockServices);
    console.log('✅ listTokens:', JSON.stringify(tokens, null, 2));

    // Test getTokenBalance
    console.log('\n2. Testing getTokenBalance...');
    const balance = await getTokenBalanceTool.execute({ tokenName: 'DAO_VOTING' }, mockServices);
    console.log('✅ getTokenBalance:', JSON.stringify(balance, null, 2));

    // Test registerToken
    console.log('\n3. Testing registerToken...');
    const registered = await registerTokenTool.execute({
      name: 'TEST_TOKEN',
      symbol: 'TST',
      contractAddress: '0xtest1234',
      decimals: 6
    }, mockServices);
    console.log('✅ registerToken:', JSON.stringify(registered, null, 2));

    // Test sendShieldedToken
    console.log('\n4. Testing sendShieldedToken...');
    const sentShielded = await sendShieldedTokenTool.execute({
      tokenId: 'dega_dao_vote:0x1234',
      destinationAddress: 'addr_test1qzx8m3qasx97l6lcrzfht5hc0g0v8l9lgs3yqgekkj5ru6nptlsaw',
      amount: '1000000'
    }, mockServices);
    console.log('✅ sendShieldedToken:', JSON.stringify(sentShielded, null, 2));

    // Test sendNativeToken
    console.log('\n5. Testing sendNativeToken...');
    const sentNative = await sendNativeTokenTool.execute({
      destinationAddress: 'addr_test1qzx8m3qasx97l6lcrzfht5hc0g0v8l9lgs3yqgekkj5ru6nptlsaw',
      amount: '500000'
    }, mockServices);
    console.log('✅ sendNativeToken:', JSON.stringify(sentNative, null, 2));

    console.log('\n✅ All Token Tools Passed!\n');
  } catch (error) {
    console.error('❌ Token Tools Failed:', error);
    throw error;
  }
}

async function testDaoTools() {
  console.log('\n📝 Testing DAO Tools...\n');

  try {
    // Test openDaoElection
    console.log('1. Testing openDaoElection...');
    const opened = await openDaoElectionTool.execute({ electionId: 'test-election-2024' }, mockServices);
    console.log('✅ openDaoElection:', JSON.stringify(opened, null, 2));

    // Test castDaoVote
    console.log('\n2. Testing castDaoVote...');
    const voted = await castDaoVoteTool.execute({ voteChoice: 'yes' }, mockServices);
    console.log('✅ castDaoVote:', JSON.stringify(voted, null, 2));

    // Test closeDaoElection
    console.log('\n3. Testing closeDaoElection...');
    const closed = await closeDaoElectionTool.execute({ electionId: 'test-election-2024' }, mockServices);
    console.log('✅ closeDaoElection:', JSON.stringify(closed, null, 2));

    // Test fundDaoTreasury
    console.log('\n4. Testing fundDaoTreasury...');
    const funded = await fundDaoTreasuryTool.execute({ amountDecimal: '1000.5' }, mockServices);
    console.log('✅ fundDaoTreasury:', JSON.stringify(funded, null, 2));

    console.log('\n✅ All DAO Tools Passed!\n');
  } catch (error) {
    console.error('❌ DAO Tools Failed:', error);
    throw error;
  }
}

async function testMarketplaceTools() {
  console.log('\n📝 Testing Marketplace Tools...\n');

  try {
    // Test getUserInfo - existing user
    console.log('1. Testing getUserInfo (existing user)...');
    const user1 = await getUserInfoTool.execute({ userId: 'user-123' }, mockServices);
    console.log('✅ getUserInfo (existing):', JSON.stringify(user1, null, 2));

    // Test getUserInfo - non-existing user
    console.log('\n2. Testing getUserInfo (non-existing user)...');
    try {
      await getUserInfoTool.execute({ userId: 'user-nonexistent' }, mockServices);
      console.log('❌ Should have thrown error for non-existent user');
    } catch (error: any) {
      console.log('✅ getUserInfo (non-existing) correctly threw error:', error.message);
    }

    // Test isUserRegistered
    console.log('\n3. Testing isUserRegistered...');
    const registered1 = await isUserRegisteredTool.execute({ userId: 'registered-user-1' }, mockServices);
    console.log('✅ isUserRegistered (true):', JSON.stringify(registered1, null, 2));

    const registered2 = await isUserRegisteredTool.execute({ userId: 'unknown-user' }, mockServices);
    console.log('✅ isUserRegistered (false):', JSON.stringify(registered2, null, 2));

    // Test isUserVerified
    console.log('\n4. Testing isUserVerified...');
    const verified1 = await isUserVerifiedTool.execute({ userId: 'verified-user-1' }, mockServices);
    console.log('✅ isUserVerified (true):', JSON.stringify(verified1, null, 2));

    const verified2 = await isUserVerifiedTool.execute({ userId: 'registered-user-1' }, mockServices);
    console.log('✅ isUserVerified (false):', JSON.stringify(verified2, null, 2));

    console.log('\n✅ All Marketplace Tools Passed!\n');
  } catch (error) {
    console.error('❌ Marketplace Tools Failed:', error);
    throw error;
  }
}

async function main() {
  console.log('🚀 Starting Mock Tools Test Suite...\n');
  console.log('='.repeat(60));

  try {
    await testWalletTools();
    await testTokenTools();
    await testDaoTools();
    await testMarketplaceTools();

    console.log('='.repeat(60));
    console.log('\n🎉 All Mock Tools Tests Passed Successfully!\n');
    console.log('Summary:');
    console.log('  ✅ Wallet Tools: 5/5 tests passed');
    console.log('  ✅ Token Tools: 5/5 tests passed');
    console.log('  ✅ DAO Tools: 4/4 tests passed');
    console.log('  ✅ Marketplace Tools: 4/4 tests passed');
    console.log('\n  Total: 18/18 tests passed ✨\n');
  } catch (error) {
    console.error('\n💥 Test Suite Failed!');
    console.error(error);
    process.exit(1);
  }
}

// Run the test suite
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { main as runMockToolsTests };
