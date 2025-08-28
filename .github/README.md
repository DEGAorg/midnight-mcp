# GitHub Actions & CI/CD Configuration

This folder contains all CI/CD configuration for the Midnight MCP Server project.

## 📋 Available Workflows

### 1. Unit Tests (`unit-tests.yml`)
**Purpose**: Execute unit tests to validate changes across multiple branches

**Triggers**:
- Pull requests to: `main`, `uat`, `develop`, `feature/docker`
- Direct push to: `main`, `uat`, `develop`, `feature/docker`

**Features**:
- ✅ Runs linting with ESLint (continue-on-error: true)
- ✅ Executes unit tests with Jest (`yarn test:unit:coverage`)
- ✅ Generates comprehensive coverage reports
- ✅ Reports available as artifacts (retention: 7 days)
- ✅ Timeout: 20 minutes
- ✅ Node.js 22.15.1 (Ubuntu Latest)
- ✅ Yarn package manager with cache enabled
- ✅ Environment variables: `NODE_ENV=test`, `CI=true`, `AGENT_ID=test-agent`
- ✅ Generates test summary with coverage metrics
- ✅ Artifacts: `coverage/` and `logs/`

**Workflow Steps**:
1. **Checkout**: Clone the repository
2. **Setup Node.js**: Install Node.js 22.15.1 with Yarn cache
3. **Environment**: Copy `env.example` to `.env`
4. **Dependencies**: Run `yarn install`
5. **Linting**: Execute `yarn lint` (doesn't block on errors)
6. **Tests**: Execute `yarn test:unit:coverage` with test variables
7. **Artifacts**: Upload coverage reports and logs
8. **Summary**: Generate summary with detailed coverage metrics

### 2. CI Validation (`ci-validation.yml`)
**Purpose**: Complete code validation including unit and integration tests

**Triggers**:
- Pull requests to `feature/review-docs`
- Direct push to `feature/review-docs`

**Features**:
- ✅ Runs linting with ESLint
- ✅ Unit tests + integration
- ✅ Complete coverage reports
- ✅ Reports available as artifacts
- ✅ Timeout: 30 minutes
- ✅ Node.js 22.15.1 (Docker-based)

### 3. E2E Tests (`e2e-tests.yml`)
**Purpose**: End-to-end tests to validate complete system integration

**Triggers**:
- Pull requests to `main` and `develop`
- Push to `main` and `develop`
- Scheduled daily at 2 AM UTC

**Features**:
- ✅ Multiple Node.js versions (18.20.5, 20.x, 22.x)
- ✅ Different test suites (stdio, eliza, jest)
- ✅ Performance tests
- ✅ Timeout: 45-60 minutes

## 🔧 Branch Protection Configuration

### Protected Branch: `feature/review-docs`

To ensure code quality, the `feature/review-docs` branch has the following protections:

#### Required Status Checks
- `Unit Tests / unit-tests`
- `CI Validation / validate`

#### Protection Rules
- ✅ Require status checks to pass before merge
- ✅ Require branch to be up to date
- ✅ Require conversation resolution
- ✅ Require pull request before merge
- ✅ Require at least 1 approval
- ✅ Dismiss stale approvals

## 📊 Metrics and Reports

### Code Coverage
- **Tool**: Jest Coverage
- **Files**: `coverage/lcov.info`, `coverage/coverage-summary.json`
- **Formats**: HTML, JSON, LCOV
- **Retention**: 7 days for artifacts
- **Generated Metrics**:
  - Lines coverage percentage
  - Statements coverage percentage
  - Functions coverage percentage
  - Branches coverage percentage

### Linting
- **Tool**: ESLint
- **Configuration**: `.eslintrc.cjs`
- **Scripts**: `yarn lint`, `yarn lint:fix`
- **Rules**: TypeScript + Prettier compatible

### Generated Artifacts
- **Unit Tests**:
  - HTML and JSON coverage reports
  - Detailed execution logs
  - Test summary with coverage metrics
  - Artifact name: `unit-test-results`
- **CI Validation**:
  - Complete coverage reports
  - Execution logs
  - Test results
  - Performance metrics

## 🚀 Recommended Workflow

### For Developers

1. **Create Feature Branch**
   ```bash
   git checkout -b feature/new-functionality
   ```

2. **Local Development**
   ```bash
   yarn install
   yarn build
   yarn test:unit
   yarn test:integration
   ```

3. **Create Pull Request**
   - Target: `feature/review-docs`
   - Workflows will run automatically

4. **Review Status Checks**
   - Wait for all tests to pass
   - Review coverage reports
   - Fix any failures

5. **Merge**
   - Only available when all checks pass
   - Requires reviewer approval

### For Administrators

1. **Configure Branch Protection**
   - Follow the guide in `branch-protection.md`
   - Configure required status checks

2. **Monitor Workflows**
   - Review GitHub Actions logs
   - Verify coverage reports
   - Adjust timeouts if necessary

3. **Monitor Unit Tests Workflow**
   - Navigate to the **Actions** tab in GitHub
   - Select the **Unit Tests** workflow
   - Review the generated summary with coverage metrics
   - Download artifacts for detailed analysis
   - Verify that `coverage/lcov.info` is generated correctly

4. **Maintain Configuration**
   - Update Node.js versions
   - Review security dependencies
   - Optimize execution times

## 🛠️ Troubleshooting

### Common Issues

#### Workflows Don't Run
- Verify triggers in the YAML file
- Confirm that the branch is in the triggers list
- Review repository permissions

#### Tests Fail
- Review detailed logs in GitHub Actions
- Verify Jest configuration
- Confirm that dependencies are up to date

#### Coverage Not Generated
- Verify that `coverage/lcov.info` is generated
- Confirm Jest configuration
- Review test execution logs
- Verify that `coverage/coverage-summary.json` exists
- Review the test summary generated by the workflow

#### Linting Fails
- Verify ESLint configuration in `.eslintrc.cjs`
- Confirm that ESLint dependencies are installed
- Review specific rules that cause errors

#### Timeouts
- Increase `timeout-minutes` in the workflow
- Optimize Jest configuration
- Consider test parallelization

### Debug Commands

```bash
# Verify local configuration
yarn lint
yarn test:unit --verbose
yarn test:coverage --verbose

# Clean cache
yarn cache clean
rm -rf node_modules
yarn install

# Verify Node.js version
node --version
yarn --version

# Run in Docker (as in CI)
docker build -t midnight-mcp-test .
docker run --rm -v $(pwd):/app -w /app midnight-mcp-test sh -c "yarn install && yarn lint && yarn test:unit"
```

## 📈 Future Improvements

### Planned Optimizations
- [ ] Unit test parallelization
- [ ] Optimized dependency cache
- [ ] Automated security tests
- [ ] Static code analysis
- [ ] Slack/Discord notifications

### Monitoring
- [ ] CI/CD metrics dashboard
- [ ] Test failure alerts
- [ ] Performance reports
- [ ] Coverage trend analysis

## 📚 Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Jest Testing Framework](https://jestjs.io/)
- [Jest Coverage Documentation](https://jestjs.io/docs/configuration#collectcoveragefrom--arraystring)
- [ESLint Documentation](https://eslint.org/)
- [Branch Protection Rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/defining-the-mergeability-of-pull-requests/about-protected-branches)

---

*This configuration ensures that only high-quality, well-tested code is integrated into the `feature/review-docs` branch.* 
