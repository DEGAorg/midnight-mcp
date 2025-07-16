/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  // Run tests sequentially for integration tests
  maxWorkers: 1,
  // Increase timeout for integration tests
  testTimeout: 300000, // 5 minutes
  transform: {
   '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        diagnostics: {
          ignoreCodes: [1343]
        },
        astTransformers: {
          before: [
            {
              path: 'node_modules/ts-jest-mock-import-meta',  // or, alternatively, 'ts-jest-mock-import-meta' directly, without node_modules.
              options: { metaObjectReplacement: { url: 'https://www.url.com' } }
            }
          ]
        }
      }
    ]
  },
  moduleNameMapper: {
    '^@midnight-ntwrk/midnight-js-network-id$': '<rootDir>/test/unit/__mocks__/midnight-js-network-id.ts',
    '^@midnight-ntwrk/ledger$': '<rootDir>/test/unit/__mocks__/@midnight-ntwrk/ledger.ts',
    '^@midnight-ntwrk/zswap$': '<rootDir>/test/unit/__mocks__/zswapMock.ts',
    '^.+/logger$': '<rootDir>/test/unit/__mocks__/logger.ts',
    '^.+/wallet$': '<rootDir>/test/unit/__mocks__/wallet.ts',
    '^.+/controllers/wallet.controller$': '<rootDir>/test/unit/__mocks__/wallet.controller.ts',
    '^.+/utils/file-manager$': '<rootDir>/test/unit/__mocks__/file-manager.ts',
    '^.+/wallet/db/TransactionDatabase$': '<rootDir>/test/unit/__mocks__/TransactionDatabase.ts',
    '^.+/wallet/utils$': '<rootDir>/test/unit/__mocks__/wallet-utils.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^src/integrations/marketplace/api$': '<rootDir>/test/unit/__mocks__/marketplace-api.ts',
    '^src/integrations/marketplace/api.js$': '<rootDir>/test/unit/__mocks__/marketplace-api.ts',
    '^src/integrations/marketplace/contract$': '<rootDir>/test/unit/__mocks__/marketplace-contract-complete.ts',
    '^src/integrations/marketplace/contract/index$': '<rootDir>/test/unit/__mocks__/marketplace-contract-complete.ts',
    '^src/integrations/marketplace/contract/index.js$': '<rootDir>/test/unit/__mocks__/marketplace-contract-complete.ts',
    '^src/integrations/marketplace/contract/index.cjs$': '<rootDir>/test/unit/__mocks__/marketplace-contract-complete.ts',
    '^src/integrations/marketplace/contract/index.d.ts$': '<rootDir>/test/unit/__mocks__/marketplace-contract-complete.ts',
    '^src/integrations/marketplace/contract/index.js.map$': '<rootDir>/test/unit/__mocks__/marketplace-contract-complete.ts',
    '^src/integrations/marketplace/contract/witnesses.js$': '<rootDir>/test/unit/__mocks__/marketplace-contract-complete.ts',
    '^src/integrations/marketplace/contract/witnesses.js.map$': '<rootDir>/test/unit/__mocks__/marketplace-contract-complete.ts',
    '^src/integrations/marketplace/contract/witnesses.d.ts$': '<rootDir>/test/unit/__mocks__/marketplace-contract-complete.ts',
    '^src/integrations/marketplace/contract/managed/': '<rootDir>/test/unit/__mocks__/marketplace-contract-complete.ts',
    '^src/integrations/marketplace/contract/managed/marketplace-registry/': '<rootDir>/test/unit/__mocks__/marketplace-contract-complete.ts',
    '^src/integrations/marketplace/contract/managed/marketplace-registry/contract/': '<rootDir>/test/unit/__mocks__/marketplace-contract-complete.ts',
    '^src/integrations/marketplace/contract/managed/marketplace-registry/contract/index.cjs$': '<rootDir>/test/unit/__mocks__/marketplace-contract-complete.ts',
  },
  extensionsToTreatAsEsm: ['.ts'],
  testMatch: [
    '**/test/**/*.spec.ts',
    '**/test/**/*.test.ts'
  ],
  transformIgnorePatterns: [
    '/node_modules/(?!(@midnight-ntwrk/ledger|@midnight-ntwrk/midnight-js-network-id|@midnight-ntwrk/wallet|@midnight-ntwrk/zswap|@midnight-ntwrk/midnight-js-utils|node-fetch|@elizaos/api-client)/)',
    'src/integrations/marketplace/api.ts',
    'src/integrations/marketplace/contract/',
    'src/integrations/marketplace/contract/index.js',
    'src/integrations/marketplace/contract/witnesses.js',
    'src/integrations/marketplace/contract/index.js.map',
    'src/integrations/marketplace/contract/witnesses.js.map',
    'src/integrations/marketplace/contract/index.d.ts',
    'src/integrations/marketplace/contract/witnesses.d.ts',
    'src/integrations/marketplace/contract/managed/',
    'src/integrations/marketplace/contract/common-types',
  ],
  collectCoverage: true,
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/integrations/**/*'
  ],
  coverageReporters: ['text', 'lcov', 'html']
}; 