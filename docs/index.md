# Midnight MCP Documentation

Welcome to the Midnight MCP documentation. This index provides navigation to all documentation resources for the Model Context Protocol (MCP) server implementation for the Midnight network.

## 📚 Quick Navigation

### Getting Started
- **[Main README](../README.md)** - Project overview and quick start guide
- **[Available Commands](../README.md#available-commands)** - All yarn commands (build, dev, start, test)
- **[Setup Guide](setup-guide.md)** - Complete installation and configuration
- **[Scripts Documentation](../scripts/README.md)** - Utility scripts with examples (setup-agent, generate-seed, etc.)

### 🏗️ System Design & Architecture
- **[Architecture](ARCHITECTURE.md)** - Technical architecture deep-dive and patterns
- **[System Design](system-design.md)** - System architecture, API flows, and deployment diagrams
- **[Deployment Guide](DEPLOYMENT.md)** - Deployment methods and server modes
- **[Wallet MCP API](wallet-mcp-api.md)** - Complete API reference for wallet operations and MCP tools

### 🧪 Testing Documentation
- **[Test Overview](../test/README.md)** - Complete testing guide and organization
- **[E2E Testing](../test/e2e/E2E_OVERVIEW.md)** - End-to-end tests with ElizaOS integration
- **[Unit Tests](../test/unit/UNIT_OVERVIEW.md)** - Unit test coverage (429 tests, 100% coverage)
- **[Integration Tests](../test/integration/INTEGRATION_OVERVIEW.md)** - HTTP server integration tests
- **[Test Scenarios](tests/test-scenarios.md)** - Overview of test scenarios and validation approaches
- **[Test Sequence Diagrams](tests/test-sequence-diagrams.md)** - Detailed test flow diagrams and sequences
- **[Test Cases](tests/)** - Individual test case documentation:
  - [Identity Match Test](tests/test-1-identity-match.md)
  - [Agent Registration Test](tests/test-2-agent-not-registered.md)
  - [Sender Validation Test](tests/test-3-sender-mismatch.md)
  - [Valid Payment Test](tests/test-4-valid-payment.md)
  - [Amount Validation Test](tests/test-5-wrong-amount.md)
  - [Unknown Sender Test](tests/test-6-unknown-sender.md)
  - [No Payment Test](tests/test-7-no-payment.md)
  - [Duplicate Transaction Test](tests/test-8-duplicate-transaction.md)

### 📊 Visual Resources
- **[Test Diagrams](tests/diagrams/)** - Visual diagrams for test flows:
  - [Send Funds Flow](tests/diagrams/send-funds.png)
  - [Wallet Status Flow](tests/diagrams/wallet-status.png)
- **[Architecture Diagram](image.png)** - High-level system architecture visualization

## 🎯 Documentation Categories

### **Getting Started**
- **Setup Guide** - Complete setup and installation instructions
- **System Design** - Understanding the architecture and components
- **Wallet MCP API** - API reference for integration

### **Development & Integration**
- **System Design** - Architecture patterns and component relationships
- **API Flows** - Request/response patterns and data flow
- **Error Handling** - Error scenarios and validation flows

### **Testing & Validation**
- **Test Scenarios** - Comprehensive test coverage overview
- **Test Cases** - Individual test case documentation
- **Test Diagrams** - Visual test flow representations

### **Deployment & Operations**
- **System Design** - Deployment scenarios and configurations
- **Architecture Diagrams** - Production vs development setups

## 🔍 Finding What You Need

### **For New Users**
1. Start with the [Setup Guide](setup-guide.md) for installation instructions
2. Review [System Design](system-design.md) for architecture understanding
3. Check [Wallet MCP API](wallet-mcp-api.md) for available tools

### **For Developers**
1. Study [System Design](system-design.md) for component relationships
2. Review [Test Scenarios](tests/test-scenarios.md) for validation approaches
3. Examine individual [Test Cases](tests/) for specific scenarios

### **For Integration**
1. Reference [Wallet MCP API](wallet-mcp-api.md) for API specifications
2. Review [System Design](system-design.md) for integration patterns
3. Check [Test Sequence Diagrams](tests/test-sequence-diagrams.md) for flow validation

### **For Testing**
1. Start with [Test Scenarios](tests/test-scenarios.md) overview
2. Review [Test Sequence Diagrams](tests/test-sequence-diagrams.md) for flows
3. Examine specific [Test Cases](tests/) for detailed scenarios

## 📋 Documentation Structure

```
midnight-mcp/
├── README.md                          # Main project documentation
├── docs/                              # Documentation directory
│   ├── index.md                       # This file - Documentation navigation
│   ├── ARCHITECTURE.md                # Technical architecture patterns
│   ├── DEPLOYMENT.md                  # Deployment guide and server modes
│   ├── setup-guide.md                 # Complete setup and installation
│   ├── system-design.md               # System architecture and API flows
│   ├── wallet-mcp-api.md              # MCP tools API reference
│   ├── image.png                      # Architecture diagram
│   └── tests/                         # Test case documentation
│       ├── README.md                  # Test documentation overview
│       ├── test-scenarios.md          # Test scenario descriptions
│       ├── test-sequence-diagrams.md  # Test sequence diagrams
│       ├── test-1-identity-match.md   # Identity validation test
│       ├── test-2-agent-not-registered.md
│       ├── test-3-sender-mismatch.md
│       ├── test-4-valid-payment.md
│       ├── test-5-wrong-amount.md
│       ├── test-6-unknown-sender.md
│       ├── test-7-no-payment.md
│       ├── test-8-duplicate-transaction.md
│       └── diagrams/                  # Test flow diagrams
│           ├── send-funds.png
│           └── wallet-status.png
├── scripts/                           # Utility scripts
│   └── README.md                      # Scripts documentation
├── test/                              # Test suites
│   ├── README.md                      # Testing overview
│   ├── unit/                          # Unit tests
│   │   └── UNIT_OVERVIEW.md           # Unit test documentation
│   ├── integration/                   # Integration tests
│   │   └── INTEGRATION_OVERVIEW.md    # Integration test docs
│   └── e2e/                           # End-to-end tests
│       ├── E2E_OVERVIEW.md            # E2E test documentation
│       └── ELIZA_CLIENT_README.md     # ElizaOS client guide
└── src/                               # Source code (documented inline)
```

## 🔗 Related Documentation

### **Source Code Documentation**
- **[Source Code Overview](../src/README.md)** - Module structure and implementation details
- **[Logger System](../src/logger/README.md)** - Logging configuration and cloud integrations
- **[Audit System](../src/audit/README.md)** - Audit trail and decision logging
- **[Wallet Module](../src/wallet/README.md)** - Transaction tracking and wallet management

### **Testing Documentation**
- **[Test Overview](../test/README.md)** - Complete testing strategy and organization
- **[E2E Testing](../test/e2e/E2E_OVERVIEW.md)** - End-to-end testing with ElizaOS integration
- **[Integration Testing](../test/integration/INTEGRATION_OVERVIEW.md)** - HTTP-based integration tests
- **[Unit Testing](../test/unit/UNIT_OVERVIEW.md)** - Unit test coverage and organization
- **[ElizaOS Client](../test/e2e/ELIZA_CLIENT_README.md)** - ElizaOS integration guide

### **CI/CD Documentation**
- **[E2E Test Workflow](../.github/workflows/e2e-tests.yml)** - Automated testing pipeline

## 📝 Contributing to Documentation

When adding new documentation:

1. **Update this index** with links to new documents
2. **Use clear naming** that reflects the content
3. **Include descriptions** for navigation clarity
4. **Organize logically** within existing categories
5. **Cross-reference** related documentation

## 🆘 Need Help?

- **Setup Issues**: Check the [Setup Guide](setup-guide.md)
- **API Questions**: Review [Wallet MCP API](wallet-mcp-api.md)
- **Architecture Questions**: Study [System Design](system-design.md)
- **Testing Issues**: Check [Test Documentation](tests/)
- **Integration Problems**: Review [E2E Testing](../test/e2e/README.md)

---

*This documentation is maintained as part of the Midnight MCP project. For the latest updates, check the repository.* 