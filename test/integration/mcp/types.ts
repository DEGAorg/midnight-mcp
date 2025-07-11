export interface TestConfig {
  server: {
    url: string;
    timeout: number;
  };
  wallets: {
    wallet1: {
      address: string;
      pubkey: string;
      description: string;
      userId: string;
    };
    wallet2: {
      address: string;
      pubkey: string;
      description: string;
      userId: string;
    };
  };
  marketplace: {
    address: string;
    description: string;
  };
  transactions: {
    validPayment: TransactionConfig;
    wrongAmount: TransactionConfig;
    unknownSender: TransactionConfig;
    noPayment: TransactionConfig;
    validIdentityMatch: TransactionConfig;
    agentNotRegistered: TransactionConfig;
    senderMismatch: TransactionConfig;
    duplicateTransaction: TransactionConfig;
  };
  testAmounts: {
    validAmount: string;
    wrongAmount: string;
    zeroAmount: string;
  };
  metadata: {
    setupScriptVersion: string;
    lastUpdated: string;
    description: string;
  };
}

export interface TransactionConfig {
  identifier: string;
  expectedAmount: string;
  senderAddress?: string;
  actualAmount?: string;
  registeredIdentity?: string;
  sessionIdentity?: string;
  description: string;
}

export interface WalletConfig {
  address: string;
  pubkey: string;
  description: string;
}

export interface MarketplaceConfig {
  address: string;
  description: string;
}

export interface TestAmounts {
  validAmount: string;
  wrongAmount: string;
  zeroAmount: string;
}

export interface Metadata {
  setupScriptVersion: string;
  lastUpdated: string;
  description: string;
} 