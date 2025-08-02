// src/utils/__mocks__/file-manager.ts

// Store the mock instance created by getInstance
let currentMockInstance: any = null;

const FileManager = {
  // This will return a new mock instance each time or the one set by setMockInstance
  getInstance: jest.fn(() => {
    if (!currentMockInstance) {
      currentMockInstance = {
        getPath: jest.fn(() => '/mock/path'),
        ensureDirectoryExists: jest.fn(),
        writeFile: jest.fn(), // Default mock, can be overridden
        readFile: jest.fn(() => 'mock-seed'),
        fileExists: jest.fn(() => true),
        deleteFile: jest.fn(),
        listFiles: jest.fn(() => []),
        getFileStats: jest.fn(() => ({})),
        createReadStream: jest.fn(),
        createWriteStream: jest.fn(),
      };
    }
    return currentMockInstance;
  }),
  // Method to reset the internal mock instance state
  resetInstance: jest.fn(() => {
    currentMockInstance = null; // Clear the stored instance
    FileManager.getInstance.mockClear(); // Clear calls on getInstance itself
  }),
  // A helper to allow setting a specific mock instance or resetting writeFile
  setMockInstance: jest.fn((mockObj: any) => {
    currentMockInstance = mockObj;
  }),
};


const FileType = {
  SEED: 'seed',
  WALLET_BACKUP: 'wallet-backup',
  LOG: 'log',
  TRANSACTION_DB: 'transaction-db',
};

export { FileManager, FileType };