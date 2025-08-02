# Branch Protection Configuration

## Branch Protection Setup

To ensure that unit tests and integration tests pass before allowing pull request merges to the `feature/review-docs` branch, follow these steps:

### 1. Configure Branch Protection Rules

1. Go to **Settings** > **Branches** in your GitHub repository
2. Click **Add rule** or **Add branch protection rule**
3. In **Branch name pattern**, enter: `feature/review-docs`
4. Check the following options:

#### Status Check Requirements
- ✅ **Require status checks to pass before merging**
- ✅ **Require branches to be up to date before merging**
- ✅ **Require conversation resolution before merging**

#### Required Status Checks
Add the following status checks:
- `Unit Tests / unit-tests`
- `CI Validation / validate`

### 2. Additional Recommended Configuration

#### Push Restrictions
- ✅ **Restrict pushes that create files that cannot be deleted**
- ✅ **Require linear history**
- ✅ **Include administrators**

#### Pull Request Reviews
- ✅ **Require a pull request before merging**
- ✅ **Require approvals** (minimum 1)
- ✅ **Dismiss stale PR approvals when new commits are pushed**
- ✅ **Require review from code owners**

### 3. Configured Workflows

The repository includes the following workflows that will run automatically:

#### Unit Tests Workflow
- **File**: `.github/workflows/unit-tests.yml`
- **Trigger**: Pull requests and pushes to `feature/review-docs`
- **Executes**: Unit tests with Jest
- **Generates**: Coverage reports

#### CI Validation Workflow
- **File**: `.github/workflows/ci-validation.yml`
- **Trigger**: Pull requests and pushes to `feature/review-docs`
- **Executes**: Unit tests + integration tests
- **Generates**: Complete coverage reports

### 4. Configuration Verification

To verify that the configuration is correct:

1. Create a pull request to `feature/review-docs`
2. Verify that the status checks appear:
   - ✅ Unit Tests
   - ✅ CI Validation
3. Confirm that you cannot merge until both pass
4. Verify that coverage reports are uploaded to Codecov

### 5. Troubleshooting

#### Status Checks Don't Appear
- Verify that workflows are on the correct branch
- Ensure that job names match the configuration
- Check GitHub Actions logs

#### Tests Fail
- Review workflow logs
- Verify that dependencies are up to date
- Confirm that Jest configuration is correct

#### Coverage Not Uploaded
- Verify that the `coverage/lcov.info` file is generated
- Confirm that Codecov credentials are configured
- Check repository permissions

### 6. Local Testing Commands

Before pushing, run locally:

```bash
# Install dependencies
yarn install

# Build the project
yarn build

# Run unit tests
yarn test:unit

# Run integration tests
yarn test:integration

# Generate coverage report
yarn test:coverage
```

### 7. Important Notes

- Workflows use Node.js 22.15.1 (from Dockerfile)
- Docker-based execution for consistent environment
- Yarn 4.1.0 is used as the package manager
- Timeouts are configured to avoid long builds
- Artifacts are retained for 7 days
- Coverage reports are generated locally and available as artifacts
- ESLint is included for code quality checks 
