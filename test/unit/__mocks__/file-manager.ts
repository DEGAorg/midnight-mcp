// src/utils/__mocks__/file-manager.ts

const FileManager = {
  getInstance: jest.fn(() => ({
    getPath: jest.fn(() => '/mock/path'),
    ensureDirectoryExists: jest.fn(),
    writeFile: jest.fn(),
    readFile: jest.fn(() => 'mock-seed'),
    fileExists: jest.fn(() => true),
    deleteFile: jest.fn(),
    listFiles: jest.fn(() => []),
    getFileStats: jest.fn(() => ({})),
    createReadStream: jest.fn(),
    createWriteStream: jest.fn(),
  })),
};

const FileType = {
  SEED: 'seed',
  WALLET_BACKUP: 'wallet-backup',
  LOG: 'log',
  TRANSACTION_DB: 'transaction-db',
};

export { FileManager, FileType };
