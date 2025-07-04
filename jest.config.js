/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
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
    '^.+/logger$': '<rootDir>/test/unit/__mocks__/logger.ts',
    '^.+/wallet$': '<rootDir>/test/unit/__mocks__/wallet.ts',
    '^.+/utils/file-manager$': '<rootDir>/test/unit/__mocks__/file-manager.ts',
    '^.+/wallet/db/TransactionDatabase$': '<rootDir>/test/unit/__mocks__/TransactionDatabase.ts',
    '^.+/wallet/utils$': '<rootDir>/test/unit/__mocks__/wallet-utils.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  extensionsToTreatAsEsm: ['.ts'],
  testMatch: [
    '**/test/**/*.spec.ts',
    '**/test/**/*.test.ts'
  ],
  transformIgnorePatterns: [
    '/node_modules/(?!(@midnight-ntwrk/ledger|@midnight-ntwrk/midnight-js-network-id|@midnight-ntwrk/wallet)/)'
  ],
  collectCoverage: true,
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts'
  ],
  coverageReporters: ['text', 'lcov', 'html']
}; 