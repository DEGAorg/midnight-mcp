# GitHub Workflow: Unit Tests

## Overview

The unit tests workflow automatically runs on pull requests and pushes to specific branches to ensure code quality and maintain test coverage.

## Trigger Conditions

The workflow runs on:
- **Pull requests** to: `main`, `uat`, `develop`, `feature/docker`
- **Direct pushes** to: `main`, `uat`, `develop`, `feature/docker`

## Workflow Steps

### 1. Environment Setup
- **Platform**: Ubuntu Latest
- **Node.js Version**: 22.15.1
- **Package Manager**: Yarn (with caching enabled)
- **Timeout**: 20 minutes

### 2. Repository Checkout
- Uses `actions/checkout@v4` to clone the repository

### 3. Node.js Setup
- Installs Node.js 22.15.1
- Configures Yarn package manager with caching

### 4. Environment Configuration
- Copies `env.example` to `.env` for test environment setup

### 5. Dependencies Installation
- Runs `yarn install` to install project dependencies

### 6. Code Quality Checks
- **Linting**: Runs `yarn lint` (continues on error)
- **Unit Tests**: Executes `yarn test:unit:coverage` with test environment variables

### 7. Test Environment Variables
```bash
NODE_ENV=test
CI=true
AGENT_ID=test-agent
```

### 8. Artifacts and Reporting

#### Test Results Upload
- Uploads coverage reports and logs as artifacts
- Retention period: 7 days
- Artifact name: `unit-test-results`

#### Test Summary Generation
The workflow generates a comprehensive test summary including:
- **Environment Information**:
  - Node.js version confirmation
  - Platform details
  - Execution method
- **Coverage Analysis**:
  - Coverage report generation status
  - Coverage files listing
  - Detailed coverage metrics:
    - Lines coverage percentage
    - Statements coverage percentage
    - Functions coverage percentage
    - Branches coverage percentage

## Monitoring

To monitor workflow execution:
1. Navigate to the **Actions** tab in the GitHub repository
2. Select the **Unit Tests** workflow
3. View detailed logs and download artifacts
4. Check the generated test summary for coverage metrics

## Troubleshooting

### Common Issues
- **Timeout**: Workflow times out after 20 minutes
- **Linting Errors**: Linting failures don't block the workflow (continue-on-error: true)

### Debugging
- Review the test summary for detailed coverage information
- Download artifacts to inspect coverage reports locally
- Check workflow logs for specific error messages
