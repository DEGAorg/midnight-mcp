import { CoinInfo, ContractAddress } from "@midnight-ntwrk/compact-runtime";
import { DeployedMarketplaceRegistryContract, MarketplaceRegistryContract, MarketplaceRegistryPrivateStateId, MarketplaceRegistryProviders, RegistryState } from "./common-types";
import { assertIsContractAddress } from "@midnight-ntwrk/midnight-js-utils";
import { MarketplaceRegistry, witnesses } from "./contract/index.js";
import { findDeployedContract, FinalizedCallTxData } from "@midnight-ntwrk/midnight-js-contracts";
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

const currentDir = path.resolve(process.cwd());

export const contractConfig = {
  privateStateStoreName: 'marketplace-registry-private-state',
  zkConfigPath: path.resolve(currentDir, 'contract', 'managed', 'marketplace-registry'),
};

// string to Uint8Array
const stringToUint8Array = (str: string): Uint8Array => {
  return new Uint8Array(Buffer.from(str.replace('0x', ''), 'hex'));
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

export const configureProviders = async (wallet: Wallet & Resource) => {
  const walletAndMidnightProvider = await createWalletAndMidnightProvider(wallet);
  return {
    privateStateProvider: levelPrivateStateProvider<typeof MarketplaceRegistryPrivateStateId>({
      privateStateStoreName: contractConfig.privateStateStoreName,
    }),
    publicDataProvider: indexerPublicDataProvider(config.indexer, config.indexerWS),
    zkConfigProvider: new NodeZkConfigProvider<'register' | 'verify_text' | 'read_own_public_key'>(
      contractConfig.zkConfigPath,
    ),
    proofProvider: httpClientProofProvider(config.proofServer),
    walletProvider: walletAndMidnightProvider,
    midnightProvider: walletAndMidnightProvider,
  };
};

export const getMarketplaceRegistryLedgerState = async (
  providers: MarketplaceRegistryProviders,
  contractAddress: ContractAddress,
): Promise<RegistryState | null> => {
  assertIsContractAddress(contractAddress);
  console.log('Checking contract ledger state...');
  const state = await providers.publicDataProvider
    .queryContractState(contractAddress)
    .then((contractState) => (contractState != null ? MarketplaceRegistry.ledger(contractState.data) : null));
  console.log(`Ledger state: ${state ? 'Registry available' : 'No state'}`);
  return state;
};

export const marketplaceRegistryContractInstance: MarketplaceRegistryContract = new MarketplaceRegistry.Contract(witnesses);

export const joinContract = async (
  providers: MarketplaceRegistryProviders,
  contractAddress: string,
): Promise<DeployedMarketplaceRegistryContract> => {
  const marketplaceRegistryContract = await findDeployedContract(providers, {
    contractAddress,
    contract: marketplaceRegistryContractInstance,
    privateStateId: 'marketplaceRegistryPrivateState',
    initialPrivateState: {},
  });
  console.log(`Joined contract at address: ${marketplaceRegistryContract.deployTxData.public.contractAddress}`);
  return marketplaceRegistryContract;
};

export const register = async (marketplaceRegistryContract: DeployedMarketplaceRegistryContract, text: string): Promise<FinalizedTxData> => {
  console.log('Registering text identifier...');
  const finalizedTxData = await (marketplaceRegistryContract.callTx.register as any)(text);
  console.log(`Transaction ${finalizedTxData.public.txId} added in block ${finalizedTxData.public.blockHeight}`);
  return finalizedTxData.public;
};

export const isPublicKeyRegistered = async (
  providers: MarketplaceRegistryProviders,
  contractAddress: ContractAddress,
  pk: string,
): Promise<boolean> => {
  assertIsContractAddress(contractAddress);
  console.log('Checking if public key is registered (pure read)...');

  const state = await getMarketplaceRegistryLedgerState(providers, contractAddress);
  if (state === null) {
    console.log('No contract state found');
    return false;
  }

  try {
    const pkUint8Array = stringToUint8Array(pk);
    const isRegistered = state.registry.member(pkUint8Array);
    console.log(`Public key registered: ${isRegistered}`);
    return isRegistered;
  } catch (error) {
    console.error(`Error checking registration: ${error}`);
    return false;
  }
};

export const verifyTextPure = async (
  providers: MarketplaceRegistryProviders,
  contractAddress: ContractAddress,
  pk: string,
): Promise<string | null> => {
  assertIsContractAddress(contractAddress);
  console.log('Verifying text identifier (pure read)...');

  const state = await getMarketplaceRegistryLedgerState(providers, contractAddress);
  if (state === null) {
    console.log('No contract state found');
    return null;
  }

  try {
    const pkUint8Array = stringToUint8Array(pk);
    // Check if the public key exists in the registry
    if (!state.registry.member(pkUint8Array)) {
      console.log('Public key not registered');
      return null;
    }

    // Return the text identifier associated with the public key
    const text = state.registry.lookup(pkUint8Array);
    console.log(`Text identifier found: ${text}`);
    return text;
  } catch (error) {
    console.error(`Error verifying text identifier: ${error}`);
    return null;
  }
};