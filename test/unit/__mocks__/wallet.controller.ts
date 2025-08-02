// Mock for wallet controller
export class WalletController {
  constructor(walletService: any) {
    // Mock constructor
  }

  getStatus = jest.fn().mockResolvedValue({ status: 'ready' });
  getAddress = jest.fn().mockResolvedValue({ address: 'mock-address' });
  getBalance = jest.fn().mockResolvedValue({ balance: '1000' });
  sendFunds = jest.fn().mockResolvedValue({ transactionId: 'mock-tx-id' });
  verifyTransaction = jest.fn().mockResolvedValue({ verified: true });
  getTransactionStatus = jest.fn().mockResolvedValue({ status: 'completed' });
  getTransactions = jest.fn().mockResolvedValue({ transactions: [] });
  getPendingTransactions = jest.fn().mockResolvedValue({ transactions: [] });
  getWalletConfig = jest.fn().mockResolvedValue({ config: 'mock-config' });
  healthCheck = jest.fn().mockResolvedValue({ status: 'healthy' });
  registerInMarketplace = jest.fn().mockResolvedValue({ registered: true });
  verifyUserInMarketplace = jest.fn().mockResolvedValue({ verified: true });
} 