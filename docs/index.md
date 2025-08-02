# Midnight MCP Documentation

Welcome to the Midnight MCP documentation. This index provides navigation to all documentation resources for the Model Context Protocol (MCP) server implementation for the Midnight network.

## 📚 Quick Navigation

### 🏗️ System Design & Architecture
- **[System Design](system-design.md)** - Comprehensive system architecture, API flows, and deployment diagrams
- **[Wallet MCP API](wallet-mcp-api.md)** - Complete API reference for wallet operations and MCP tools

### 🚀 Setup & Installation
- **[Setup Guide](setup-guide.md)** - Complete setup instructions for development and production

### 🧪 Testing Documentation
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
docs/
├── index.md                           # This file - Documentation navigation
├── system-design.md                   # Architecture and API flow diagrams
├── setup-guide.md                     # Complete setup and installation guide
├── wallet-mcp-api.md                  # Wallet MCP API reference
├── image.png                          # Architecture diagram
└── tests/                             # Testing documentation
    ├── README.md                      # Test documentation overview
    ├── test-scenarios.md              # Test scenario descriptions
    ├── test-sequence-diagrams.md      # Test sequence diagrams
    ├── test-1-identity-match.md       # Identity validation test
    ├── test-2-agent-not-registered.md # Agent registration test
    ├── test-3-sender-mismatch.md      # Sender validation test
    ├── test-4-valid-payment.md        # Valid payment test
    ├── test-5-wrong-amount.md         # Amount validation test
    ├── test-6-unknown-sender.md       # Unknown sender test
    ├── test-7-no-payment.md           # No payment scenario test
    ├── test-8-duplicate-transaction.md # Duplicate transaction test
    └── diagrams/                      # Test flow diagrams
        ├── send-funds.png             # Send funds flow diagram
        └── wallet-status.png          # Wallet status flow diagram
```

## 🔗 Related Documentation

### **Source Code Documentation**
- **[Source Code Overview](../src/README.md)** - Module structure and implementation details
- **[Logger System](../src/logger/README.md)** - Logging configuration and cloud integrations
- **[Audit System](../src/audit/README.md)** - Audit trail and decision logging
- **[Wallet Module](../src/wallet/README.md)** - Transaction tracking and wallet management

### **Testing Documentation**
- **[Test Overview](../test/README.md)** - Complete testing strategy and organization
- **[E2E Testing](../test/e2e/README.md)** - End-to-end testing with ElizaOS integration
- **[Integration Testing](../test/integration/README.md)** - HTTP-based integration tests
- **[Unit Testing](../test/unit/README.md)** - Unit test coverage and organization

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