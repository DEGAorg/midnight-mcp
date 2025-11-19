# Audit Trail System

A comprehensive audit trail system for tracking AI agent decisions, test outcomes, and transaction traces in the Midnight MCP project.

## Overview

The audit trail system provides structured logging and persistence for:
- **Agent Decision Logging**: Track AI agent reasoning, decisions, and actions
- **Test Outcome Auditing**: Monitor test execution, decisions, and results
- **Transaction Trace Logging**: End-to-end transaction tracing across components
- **Audit Trail Service**: Centralized event logging and persistence

## Components

### 1. Audit Trail Service (`audit-trail-service.ts`)
The core service that handles event logging, persistence, and retrieval.

**Features:**
- Structured event logging with correlation IDs
- Multiple persistence options (memory, file, database)
- Event filtering and retrieval
- Automatic cleanup and retention management
- Export functionality

**Usage:**
```typescript
import { AuditTrailService } from './audit/index';

const auditService = AuditTrailService.getInstance({
  enabled: true,
  persistence: 'file',
  retentionDays: 30,
  maxEvents: 10000
});

// Log an event
const eventId = auditService.logEvent(
  'agent_decision',
  'Agent approved transaction',
  'medium',
  { correlationId: 'corr-123', agentId: 'agent-001' },
  { amount: '1000', recipient: '0x123...' }
);
```

### 2. Agent Decision Logger (`agent-decision-logger.ts`)
Specialized logger for tracking AI agent decisions, reasoning, and actions.

**Features:**
- Log agent reasoning processes
- Track decision inputs, outputs, and alternatives
- Record agent actions and their parameters
- Risk assessment and confidence scoring
- Transaction-specific decision logging

**Usage:**
```typescript
import { AgentDecisionLogger } from './audit/index.js';

const agentLogger = new AgentDecisionLogger();

// Log agent reasoning
agentLogger.logReasoning({
  agentId: 'agent-001',
  context: 'Transaction validation',
  analysis: 'Analyzing transaction parameters',
  factors: ['Amount', 'Recipient', 'Risk score'],
  conclusion: 'Transaction is safe to approve',
  confidence: 0.85
}, correlationId);

// Log agent decision
agentLogger.logDecision({
  agentId: 'agent-001',
  decisionType: 'transaction',
  input: { amount: '1000', recipient: '0x123...' },
  reasoning: 'Transaction meets all criteria',
  confidence: 0.85,
  selectedAction: 'approve',
  riskAssessment: 'low'
}, correlationId);
```

### 3. Test Outcome Auditor (`test-outcome-auditor.ts`)
Specialized auditor for tracking test execution, decisions, and outcomes.

**Features:**
- Track test execution lifecycle
- Log test decisions and reasoning
- Record test outcomes and recommendations
- Monitor test metrics and performance
- Handle test failures with detailed error information

**Usage:**
```typescript
import { TestOutcomeAuditor } from './audit/index.js';

const testAuditor = new TestOutcomeAuditor();

// Start test tracking
const testId = testAuditor.startTest({
  testId: 'test-001',
  testName: 'Transaction Flow Test',
  testSuite: 'Integration Tests',
  environment: 'test',
  startTime: Date.now()
});

// Complete test
testAuditor.completeTest(testId, 'passed', 'All assertions passed');

// Log test outcome
testAuditor.logTestOutcome({
  testId,
  outcome: 'success',
  summary: 'Test completed successfully',
  details: { assertions: 5, passed: 5 },
  recommendations: ['Add more edge cases']
});
```

### 4. Transaction Trace Logger (`transaction-trace-logger.ts`)
Specialized logger for end-to-end transaction tracing.

**Features:**
- Track transaction lifecycle from initiation to completion
- Log individual transaction steps with timing
- Monitor transaction performance and bottlenecks
- Handle transaction failures with detailed error context
- Support for blockchain transaction tracking

**Usage:**
```typescript
import { TransactionTraceLogger } from './audit/index';

const transactionLogger = new TransactionTraceLogger();

// Start transaction trace
transactionLogger.startTrace('tx-123', correlationId, {
  amount: '1000',
  recipient: '0x123...'
});

// Add transaction steps
const stepId = transactionLogger.addStep(
  'tx-123',
  'validate_transaction',
  'validation-service',
  { amount: '1000', recipient: '0x123...' }
);

// Complete step
transactionLogger.completeStep('tx-123', stepId, {
  valid: true,
  riskScore: 0.1
});

// Complete trace
transactionLogger.completeTrace('tx-123', 'completed');
```

## Quick Start

### 1. Initialize All Services
```typescript
import { initializeAuditServices } from './audit/index.js';

const {
  auditService,
  agentLogger,
  testAuditor,
  transactionLogger
} = initializeAuditServices();
```

### 2. Use in Your Application
```typescript
// Generate correlation ID for linking related events
const correlationId = auditService.generateCorrelationId();

// Log agent decision
agentLogger.logTransactionDecision(
  'agent-001',
  'tx-123',
  'approve',
  'Transaction is within limits',
  '1000',
  '0x123...',
  correlationId
);

// Start transaction trace
transactionLogger.startTrace('tx-123', correlationId);

// Track transaction steps
const stepId = transactionLogger.addStep(
  'tx-123',
  'process_transaction',
  'wallet-service'
);

// Complete transaction
transactionLogger.completeStep('tx-123', stepId, { success: true });
transactionLogger.completeTrace('tx-123', 'completed');
```

### 3. Export Audit Trail
```typescript
// Export all events to file
const exportPath = auditService.exportToFile('audit-trail.json');

// Get specific events
const agentDecisions = auditService.getEventsByType('agent_decision');
const transactionEvents = auditService.getEventsByType('transaction_initiated');
```

## Integration with Existing Code

### Wallet Integration
```typescript
// In your wallet service
import { TransactionTraceLogger, AgentDecisionLogger } from './audit/index.js';

class WalletService {
  private transactionLogger = new TransactionTraceLogger();
  private agentLogger = new AgentDecisionLogger();

  async sendFunds(to: string, amount: string) {
    const transactionId = generateTransactionId();
    const correlationId = this.transactionLogger.generateCorrelationId();
    
    // Start transaction trace
    this.transactionLogger.startTrace(transactionId, correlationId);
    
    // Log agent decision
    this.agentLogger.logTransactionDecision(
      'wallet-agent',
      transactionId,
      'approve',
      'Transaction validated',
      amount,
      to,
      correlationId
    );
    
    try {
      // Add processing step
      const stepId = this.transactionLogger.addStep(
        transactionId,
        'send_funds',
        'wallet-service',
        { to, amount }
      );
      
      // Process transaction
      const result = await this.processTransaction(to, amount);
      
      // Complete step
      this.transactionLogger.completeStep(transactionId, stepId, result);
      this.transactionLogger.completeTrace(transactionId, 'completed');
      
      return result;
    } catch (error) {
      this.transactionLogger.completeStep(transactionId, stepId, undefined, error);
      this.transactionLogger.completeTrace(transactionId, 'failed');
      throw error;
    }
  }
}
```

### Test Integration
```typescript
// In your test files
import { TestOutcomeAuditor } from './audit/index.js';

describe('Transaction Tests', () => {
  const testAuditor = new TestOutcomeAuditor();
  
  it('should process transaction successfully', async () => {
    const testId = testAuditor.startTest({
      testId: 'tx-test-001',
      testName: 'Transaction Processing Test',
      testSuite: 'Integration Tests',
      environment: 'test',
      startTime: Date.now()
    });
    
    try {
      // Your test logic here
      const result = await walletService.sendFunds('0x123...', '1000');
      expect(result.success).toBe(true);
      
      testAuditor.completeTest(testId, 'passed', 'Transaction processed successfully');
    } catch (error) {
      testAuditor.completeTest(testId, 'failed', error.message);
      throw error;
    }
  });
});
```

## Configuration

### Audit Trail Options
```typescript
const auditService = AuditTrailService.getInstance({
  enabled: true,                    // Enable/disable audit trail
  persistence: 'file',              // 'memory' | 'file' | 'database'
  retentionDays: 30,               // Days to retain events
  maxEvents: 10000,                // Maximum events in memory
  includeMetadata: true,           // Include metadata in events
  correlationIdGenerator: () => uuidv4() // Custom correlation ID generator
});
```

### File Persistence
Events are stored in JSONL format in the logs directory:
```
logs/
  audit/
    audit-events-2024-01-15.jsonl
    audit-events-2024-01-16.jsonl
    audit-trail-export.json
```

## Event Types

### Agent Events
- `agent_decision`: Agent decision with reasoning
- `agent_action`: Agent action execution
- `agent_reasoning`: Agent reasoning process

### Transaction Events
- `transaction_initiated`: Transaction started
- `transaction_sent`: Transaction sent to blockchain
- `transaction_completed`: Transaction completed
- `transaction_failed`: Transaction failed
- `transaction_trace`: Transaction step trace

### Test Events
- `test_started`: Test execution started
- `test_completed`: Test execution completed
- `test_decision`: Test decision made
- `test_outcome`: Test outcome recorded

### System Events
- `system_event`: General system event
- `error_event`: Error occurrence
- `security_event`: Security-related event

## Benefits

1. **Traceability**: Link related events across components
2. **Debugging**: Detailed audit trail for troubleshooting
3. **Compliance**: Structured logging for regulatory requirements
4. **Performance**: Monitor transaction and test performance
5. **Security**: Track agent decisions and actions
6. **Reproducibility**: Complete audit trail for test outcomes

## Future Enhancements

- Database persistence for better querying
- Real-time audit trail streaming
- Advanced filtering and search capabilities
- Integration with external monitoring systems
- Automated audit trail analysis and reporting 