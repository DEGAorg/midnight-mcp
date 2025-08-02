// Jest mock for TransactionDatabase
const __mockTransactionDb = {
  createTransaction: jest.fn(),
  markTransactionAsSent: jest.fn(),
  markTransactionAsCompleted: jest.fn(),
  markTransactionAsFailed: jest.fn(),
  getTransactionById: jest.fn(),
  getTransactionByTxIdentifier: jest.fn(),
  getTransactionsByState: jest.fn(),
  getAllTransactions: jest.fn(),
  getPendingTransactions: jest.fn(),
  close: jest.fn(),
};

module.exports = {
  __mockTransactionDb,
  default: __mockTransactionDb,
}; 