module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  rules: {
    // Unused variables - more permissive
    '@typescript-eslint/no-unused-vars': ['warn', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      caughtErrorsIgnorePattern: '^_'
    }],

    // Allow 'any' in certain contexts
    '@typescript-eslint/no-explicit-any': 'off',

    // More permissive TypeScript configurations
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off',
    '@typescript-eslint/no-var-requires': 'off',

    // General rules
    'prefer-const': 'warn',
    'no-var': 'error',
    'no-console': 'off', // Allow console in development and tests
  },
  ignorePatterns: [
    'dist/',
    'node_modules/',
    'coverage/',
    '*.js',
    '*.d.ts',
    'src/integrations/marketplace/contract/',
  ],
  overrides: [
    {
      // Stricter configuration for production files
      files: ['src/**/*.ts'],
      excludedFiles: ['src/**/*.test.ts', 'src/**/*.spec.ts', 'src/**/example*.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'warn',
        '@typescript-eslint/no-unused-vars': 'error',
        'no-console': 'warn',
      }
    },
    {
      // Very permissive configuration for tests
      files: ['test/**/*.ts', '**/*.test.ts', '**/*.spec.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off',
        'no-console': 'off',
        '@typescript-eslint/no-var-requires': 'off',
      }
    },
    {
      // Permissive configuration for example files
      files: ['**/example*.ts', '**/*example*.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
        'no-console': 'off',
      }
    }
  ]
};
