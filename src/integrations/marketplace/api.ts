import { ContractAddress } from "@midnight-ntwrk/compact-runtime";
import { DeployedMarketplaceRegistryContract, MarketplaceRegistryContract, MarketplaceRegistryProviders, RegistryState } from "./common-types";
import { assertIsContractAddress } from "@midnight-ntwrk/midnight-js-utils";
import { MarketplaceRegistry, witnesses } from "./contract/index.js";
import { findDeployedContract, FinalizedCallTxData } from "@midnight-ntwrk/midnight-js-contracts";
import { FinalizedTxData } from "@midnight-ntwrk/midnight-js-types";

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
  const finalizedTxData = await marketplaceRegistryContract.callTx.register(text);
  console.log(`Transaction ${finalizedTxData.public.txId} added in block ${finalizedTxData.public.blockHeight}`);
  return finalizedTxData.public;
};

export const isPublicKeyRegistered = async (
  providers: MarketplaceRegistryProviders,
  contractAddress: ContractAddress,
  pk: Uint8Array,
): Promise<boolean> => {
  assertIsContractAddress(contractAddress);
  console.log('Checking if public key is registered (pure read)...');

  const state = await getMarketplaceRegistryLedgerState(providers, contractAddress);
  if (state === null) {
    console.log('No contract state found');
    return false;
  }

  try {
    const isRegistered = state.registry.member(pk);
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
  pk: Uint8Array,
): Promise<string | null> => {
  assertIsContractAddress(contractAddress);
  console.log('Verifying text identifier (pure read)...');

  const state = await getMarketplaceRegistryLedgerState(providers, contractAddress);
  if (state === null) {
    console.log('No contract state found');
    return null;
  }

  try {
    // Check if the public key exists in the registry
    if (!state.registry.member(pk)) {
      console.log('Public key not registered');
      return null;
    }

    // Return the text identifier associated with the public key
    const text = state.registry.lookup(pk);
    console.log(`Text identifier found: ${text}`);
    return text;
  } catch (error) {
    console.error(`Error verifying text identifier: ${error}`);
    return null;
  }
};