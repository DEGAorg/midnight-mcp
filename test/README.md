# MCP Server Tests

This directory contains comprehensive tests for the Midnight Control Plane (MCP) server, organized into three main categories.

## 📚 Test Documentation

- **[Unit Tests](unit/README.md)** - Comprehensive unit tests with 100% coverage across all metrics
- **[Integration Tests](integration/README.md)** - HTTP-based integration tests for Docker deployments  
- **[E2E Tests](e2e/README.md)** - End-to-end tests with ElizaOS integration and MCP protocol validation

## 🚀 Quick Start

### Run Specific Test Types
```bash
# Unit tests only
yarn test:unit

# Integration tests only  
yarn test:integration

# E2E tests only
yarn test:e2e

```

## 🏗️ Test Structure

```
test/
├── README.md                        # This file - Main test documentation
├── unit/                            # Unit tests (100% coverage)
│   └── README.md                    # Detailed unit test documentation
├── integration/                     # Integration tests
│   └── README.md                    # HTTP-based integration testing
└── e2e/                            # End-to-end tests
    └── README.md                    # E2E testing with AI agents
```

## 🔧 Prerequisites

- Node.js and Yarn installed
- For integration tests: Docker server running
- For E2E tests: Eliza AI agents accessible

## 📈 Test Statistics

- **Unit Tests:** 429 tests across 18 test suites
- **Integration Tests:** 8 main test scenarios
- **E2E Tests:** Comprehensive AI agent integration testing

For detailed information about each test type, configuration, and troubleshooting, please refer to the specific README files in each subdirectory. 