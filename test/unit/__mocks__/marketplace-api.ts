// Comprehensive mock for marketplace API
// This completely replaces the problematic marketplace API module

import { ContractAddress } from "@midnight-ntwrk/compact-runtime";

// Mock types
export interface DeployedMarketplaceRegistryContract {
  deployTxData: { public: { contractAddress: string } };
  callTx: {
    register: (text: string) => Promise<{ public: { txId: string; blockHeight: number } }>;
  };
}

export interface MarketplaceRegistryContract {
  contract: string;
}

export interface MarketplaceRegistryPrivateStateId {
  id: string;
}

export interface MarketplaceRegistryProviders {
  privateStateProvider: any;
  publicDataProvider: any;
  zkConfigProvider: any;
  proofProvider: any;
  walletProvider: any;
  midnightProvider: any;
}

export interface RegistryState {
  registry: {
    member: (pk: Uint8Array) => boolean;
    lookup: (pk: Uint8Array) => string | null;
  };
}

// Mock contract configuration
export const contractConfig = {
  privateStateStoreName: 'marketplace-registry-private-state',
  zkConfigPath: '/mock/path/to/contract',
};

// Mock utility function
const stringToUint8Array = (str: string): Uint8Array => {
  return new Uint8Array(Buffer.from(str.replace('0x', ''), 'hex'));
};

// Mock createWalletAndMidnightProvider
export const createWalletAndMidnightProvider = jest.fn(async (wallet: any) => {
  return {
    coinPublicKey: 'mock-coin-public-key',
    encryptionPublicKey: 'mock-encryption-public-key',
    balanceTx: jest.fn(() => Promise.resolve({ balanced: true })),
    submitTx: jest.fn(() => Promise.resolve('mock-transaction-id')),
  };
});

// Mock configureProviders
export const configureProviders = jest.fn(async (wallet: any) => {
  return {
    privateStateProvider: { provider: 'mock-private-state' },
    publicDataProvider: { provider: 'mock-public-data' },
    zkConfigProvider: { provider: 'mock-zk-config' },
    proofProvider: { provider: 'mock-proof' },
    walletProvider: { provider: 'mock-wallet' },
    midnightProvider: { provider: 'mock-midnight' },
  };
});

// Mock getMarketplaceRegistryLedgerState
export const getMarketplaceRegistryLedgerState = jest.fn(async (
  providers: MarketplaceRegistryProviders,
  contractAddress: ContractAddress,
): Promise<RegistryState | null> => {
  return {
    registry: {
      member: jest.fn(() => true),
      lookup: jest.fn(() => 'mock-text-identifier'),
    },
  };
});

// Mock marketplaceRegistryContractInstance
export const marketplaceRegistryContractInstance: MarketplaceRegistryContract = {
  contract: 'mock-contract-instance',
};

// Mock joinContract
export const joinContract = jest.fn(async (
  providers: MarketplaceRegistryProviders,
  contractAddress: string,
): Promise<DeployedMarketplaceRegistryContract> => {
  return {
    deployTxData: { public: { contractAddress } },
    callTx: {
      register: jest.fn((text: string) => 
        Promise.resolve({ 
          public: { 
            txId: 'mock-tx-id', 
            blockHeight: 12345 
          } 
        })
      ),
    },
  };
});

// Mock register
export const register = jest.fn(async (
  marketplaceRegistryContract: DeployedMarketplaceRegistryContract, 
  text: string
): Promise<any> => {
  const result = await marketplaceRegistryContract.callTx.register(text);
  return result.public;
});

// Mock isPublicKeyRegistered
export const isPublicKeyRegistered = jest.fn(async (
  providers: MarketplaceRegistryProviders,
  contractAddress: ContractAddress,
  pk: string,
): Promise<boolean> => {
  return true; // Mock as registered
});

// Mock verifyTextPure
export const verifyTextPure = jest.fn(async (
  providers: MarketplaceRegistryProviders,
  contractAddress: ContractAddress,
  pk: string,
): Promise<string | null> => {
  return 'mock-verified-text'; // Mock as verified
});

// Default export for compatibility
export default {
  contractConfig,
  createWalletAndMidnightProvider,
  configureProviders,
  getMarketplaceRegistryLedgerState,
  marketplaceRegistryContractInstance,
  joinContract,
  register,
  isPublicKeyRegistered,
  verifyTextPure,
}; 