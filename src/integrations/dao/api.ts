import { CoinInfo, ContractAddress } from "@midnight-ntwrk/compact-runtime";
import { 
  DeployedDaoVotingContract, 
  DaoVotingProviders, 
  DaoVotingPrivateState,
  DaoVotingState,
  VoteType,
  ElectionStatus
} from "./common-types.js";

// Re-export VoteType for external use
export { VoteType };
import { assertIsContractAddress } from "@midnight-ntwrk/midnight-js-utils";
import { DaoVoting, witnesses } from "./contract/index.js";
import { findDeployedContract, deployContract, FinalizedCallTxData } from "@midnight-ntwrk/midnight-js-contracts";
import { BalancedTransaction, createBalancedTx, FinalizedTxData, MidnightProvider, UnbalancedTransaction, WalletProvider } from "@midnight-ntwrk/midnight-js-types";
import { Wallet } from "@midnight-ntwrk/wallet-api";
import { Transaction, TransactionId } from "@midnight-ntwrk/zswap";
import { Resource } from "@midnight-ntwrk/wallet";
import { getLedgerNetworkId, getZswapNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { Transaction as ZswapTransaction } from '@midnight-ntwrk/zswap';
import { levelPrivateStateProvider } from "@midnight-ntwrk/midnight-js-level-private-state-provider";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { NodeZkConfigProvider } from "@midnight-ntwrk/midnight-js-node-zk-config-provider";
import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { config } from "../../config.js";
import path from "path";
import { firstValueFrom } from 'rxjs';
import { createLogger } from "../../logger/index.js";

const logger = createLogger('dao-voting-api');

const currentDir = path.resolve(process.cwd());

export const contractConfig = {
  privateStateStoreName: 'dao-voting-private-state',
  zkConfigPath: path.resolve(currentDir, 'src/integrations/dao/contract/managed/dao-voting/dao-voting'),
};

/**
 * Helper function to pad string to specified length
 * pad(n, s): UTF-8 bytes of s followed by 0x00 up to length n
 */
export const pad = (s: string, n: number): Uint8Array => {
  const bytes = new TextEncoder().encode(s);
  if (bytes.length > n) throw new Error('String too long for pad length');
  const out = new Uint8Array(n);
  out.set(bytes);
  return out;
};

export const createWalletAndMidnightProvider = async (wallet: Wallet): Promise<WalletProvider & MidnightProvider> => {
  // Get the current wallet state using firstValueFrom
  const state = await firstValueFrom(wallet.state());
  
  return {
    coinPublicKey: state.coinPublicKey,
    encryptionPublicKey: state.encryptionPublicKey,
    balanceTx(tx: UnbalancedTransaction, newCoins: CoinInfo[]): Promise<BalancedTransaction> {
      return wallet
        .balanceTransaction(
          ZswapTransaction.deserialize(tx.serialize(getLedgerNetworkId()), getZswapNetworkId()),
          newCoins,
        )
        .then((tx) => wallet.proveTransaction(tx))
        .then((zswapTx) => {
          const ledgerTx = Transaction.deserialize(zswapTx.serialize(getZswapNetworkId()), getLedgerNetworkId());
          return createBalancedTx(ledgerTx as any);
        });
    },
    submitTx(tx: BalancedTransaction): Promise<TransactionId> {
      return wallet.submitTransaction(tx);
    },
  };
};

export const configureProviders = async (wallet: Wallet & Resource): Promise<DaoVotingProviders> => {
  const walletAndMidnightProvider = await createWalletAndMidnightProvider(wallet);
  return {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: contractConfig.privateStateStoreName,
    }),
    publicDataProvider: indexerPublicDataProvider(config.indexer, config.indexerWS),
    zkConfigProvider: new NodeZkConfigProvider<'open_election' | 'close_election' | 'cast_vote' | 'fund_treasury' | 'payout_approved_proposal' | 'cancel_payout'>(
      contractConfig.zkConfigPath,
    ),
    proofProvider: httpClientProofProvider(config.proofServer),
    walletProvider: walletAndMidnightProvider,
    midnightProvider: walletAndMidnightProvider,
  };
};

export const daoVotingContractInstance = new (DaoVoting as any).Contract(witnesses);

export const getDaoVotingLedgerState = async (
  providers: DaoVotingProviders,
  contractAddress: ContractAddress,
): Promise<DaoVotingState | null> => {
  assertIsContractAddress(contractAddress);
  logger.info('Checking DAO voting contract ledger state...');
  const state = await providers.publicDataProvider
    .queryContractState(contractAddress)
    .then((contractState: any) => (contractState != null ? (DaoVoting as any).ledger(contractState.data) : null));
  logger.info(`Ledger state: ${state ? 'DAO voting available' : 'No state'}`);
  return state;
};

export const joinDaoVotingContract = async (
  providers: DaoVotingProviders,
  contractAddress: string,
): Promise<DeployedDaoVotingContract> => {
  const daoVotingContract = await findDeployedContract(providers, {
    contractAddress,
    contract: daoVotingContractInstance,
    privateStateId: 'daoVotingPrivateState',
    initialPrivateState: {},
  });
  logger.info(`Joined DAO voting contract at address: ${daoVotingContract.deployTxData.public.contractAddress}`);
  return daoVotingContract as any;
};

export const deployDaoVotingContract = async (
  providers: DaoVotingProviders,
  privateState: DaoVotingPrivateState,
  fundingTokenAddress: string,
  daoVoteTokenAddress: string,
): Promise<DeployedDaoVotingContract> => {
  logger.info('Deploying DAO voting contract...');
  const fundingTokenAddressBytes = new Uint8Array(Buffer.from(fundingTokenAddress.replace('0x', ''), 'hex'));
  const daoVoteTokenAddressBytes = new Uint8Array(Buffer.from(daoVoteTokenAddress.replace('0x', ''), 'hex'));
  const daoVotingContract = await deployContract(providers, {
    contract: daoVotingContractInstance,
    privateStateId: 'daoVotingPrivateState',
    initialPrivateState: privateState,
    args: [
      { bytes: fundingTokenAddressBytes },
      { bytes: daoVoteTokenAddressBytes },
    ],
  } as any);
  logger.info(`Deployed DAO voting contract at address: ${daoVotingContract.deployTxData.public.contractAddress}`);
  return daoVotingContract as any;
};

export const openElection = async (
  daoVotingContract: DeployedDaoVotingContract,
  electionId: string,
): Promise<FinalizedTxData> => {
  logger.info(`Opening election with ID: ${electionId}`);
  const electionIdBytes = pad(electionId, 32);
  const finalizedTxData = await daoVotingContract.callTx.open_election(electionIdBytes);
  logger.info(`Transaction ${finalizedTxData.public.txId} added in block ${finalizedTxData.public.blockHeight}`);
  return finalizedTxData.public;
};

export const closeElection = async (
  daoVotingContract: DeployedDaoVotingContract,
): Promise<FinalizedTxData> => {
  logger.info('Closing election...');
  const finalizedTxData = await daoVotingContract.callTx.close_election();
  logger.info(`Transaction ${finalizedTxData.public.txId} added in block ${finalizedTxData.public.blockHeight}`);
  return finalizedTxData.public;
};

export const castVote = async (
  daoVotingContract: DeployedDaoVotingContract,
  voteType: VoteType,
  voteCoin: any, // CoinInfo type from the contract
): Promise<FinalizedTxData> => {
  const voteTypeNames = ['YES', 'NO', 'ABSENT'];
  logger.info(`Casting ${voteTypeNames[voteType]} vote...`);
  const finalizedTxData = await daoVotingContract.callTx.cast_vote(BigInt(voteType), voteCoin);
  logger.info(`Transaction ${finalizedTxData.public.txId} added in block ${finalizedTxData.public.blockHeight}`);
  return finalizedTxData.public;
};

export const fundTreasury = async (
  daoVotingContract: DeployedDaoVotingContract,
  fundCoin: any, // CoinInfo type from the contract
): Promise<FinalizedTxData> => {
  logger.info('Funding treasury...');
  const finalizedTxData = await daoVotingContract.callTx.fund_treasury(fundCoin);
  logger.info(`Transaction ${finalizedTxData.public.txId} added in block ${finalizedTxData.public.blockHeight}`);
  return finalizedTxData.public;
};

export const payoutApprovedProposal = async (
  daoVotingContract: DeployedDaoVotingContract,
): Promise<FinalizedTxData> => {
  logger.info('Paying out approved proposal to contract owner...');
  const finalizedTxData = await daoVotingContract.callTx.payout_approved_proposal();
  logger.info(`Transaction ${finalizedTxData.public.txId} added in block ${finalizedTxData.public.blockHeight}`);
  return finalizedTxData.public;
};

export const cancelPayout = async (
  daoVotingContract: DeployedDaoVotingContract,
): Promise<FinalizedTxData> => {
  logger.info('Cancelling payout...');
  const finalizedTxData = await daoVotingContract.callTx.cancel_payout();
  logger.info(`Transaction ${finalizedTxData.public.txId} added in block ${finalizedTxData.public.blockHeight}`);
  return finalizedTxData.public;
};

export const getElectionStatus = async (
  providers: DaoVotingProviders,
  contractAddress: ContractAddress,
): Promise<ElectionStatus | null> => {
  const state = await getDaoVotingLedgerState(providers, contractAddress);
  if (state === null) {
    return null;
  }

  return {
    isOpen: state.election_open,
    electionId: Buffer.from(state.election_id).toString('hex'),
    yesVotes: state.yes_votes,
    noVotes: state.no_votes,
    absentVotes: state.absent_votes,
    totalVotes: state.total_votes,
  };
};

export const displayDaoVotingState = async (
  providers: DaoVotingProviders,
  daoVotingContract: DeployedDaoVotingContract,
): Promise<{ state: DaoVotingState | null; contractAddress: string }> => {
  const contractAddress = daoVotingContract.deployTxData.public.contractAddress;
  const state = await getDaoVotingLedgerState(providers, contractAddress);
  if (state === null) {
    logger.info(`There is no DAO voting contract deployed at ${contractAddress}.`);
  } else {
    logger.info(`DAO Voting State:`);
    logger.info(`  Election Open: ${state.election_open}`);
    logger.info(`  Election ID: ${Buffer.from(state.election_id).toString('hex')}`);
    logger.info(`  Yes Votes: ${state.yes_votes}`);
    logger.info(`  No Votes: ${state.no_votes}`);
    logger.info(`  Absent Votes: ${state.absent_votes}`);
    logger.info(`  Total Votes: ${state.total_votes}`);
    logger.info(`  Treasury Value: ${state.treasury.value}`);
    logger.info(`  Treasury Coin Color: ${Buffer.from(state.treasury.color).toString('hex')}`);
    logger.info(`  Treasury Coin nonce: ${Buffer.from(state.treasury.nonce).toString('hex')}`);
    logger.info(`  Treasury Coin mt_index: ${state.treasury.mt_index}`);
    logger.info(`  DAO Vote Coin Color: ${Buffer.from(state.dao_vote_coin_color).toString('hex')}`);
  }
  return { contractAddress, state };
};
