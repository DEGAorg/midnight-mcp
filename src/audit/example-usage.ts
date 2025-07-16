/* istanbul ignore file */
import { 
  initializeAuditServices,
  AgentDecision,
  TestExecution,
  TransactionTrace
} from './index.js';

// Example: Initialize all audit services
const {
  auditService,
  agentLogger,
  testAuditor,
  transactionLogger
} = initializeAuditServices();

// Example: Agent Decision Logging
export function exampleAgentDecision() {
  const correlationId = auditService.generateCorrelationId();
  
  // Log agent reasoning
  agentLogger.logReasoning({
    agentId: 'agent-001',
    context: 'Transaction validation',
    analysis: 'Analyzing transaction amount and recipient',
    factors: ['Amount threshold', 'Recipient whitelist', 'Risk score'],
    conclusion: 'Transaction appears legitimate',
    confidence: 0.85
  }, correlationId);

  // Log agent decision
  const decision: AgentDecision = {
    agentId: 'agent-001',
    decisionType: 'transaction',
    input: { amount: '1000', recipient: '0x123...' },
    reasoning: 'Transaction amount is within limits and recipient is whitelisted',
    confidence: 0.85,
    alternatives: ['Reject', 'Hold for review'],
    selectedAction: 'approve',
    expectedOutcome: 'Transaction will be processed successfully',
    riskAssessment: 'low'
  };
  
  agentLogger.logDecision(decision, correlationId);
  
  // Log agent action
  agentLogger.logAction({
    agentId: 'agent-001',
    actionType: 'transaction_approval',
    target: 'transaction-123',
    parameters: { approved: true, timestamp: Date.now() },
    timestamp: Date.now(),
    correlationId
  });
}

// Example: Test Outcome Auditing
export function exampleTestAuditing() {
  const testId = 'test-001';
  const correlationId = auditService.generateCorrelationId();
  
  // Start test tracking
  const testExecution: TestExecution = {
    testId,
    testName: 'Transaction Flow Test',
    testSuite: 'Integration Tests',
    agentId: 'agent-001',
    environment: 'test',
    startTime: Date.now(),
    status: 'running',
    correlationId
  };
  
  testAuditor.startTest(testExecution);
  
  // Log test decision
  testAuditor.logTestDecision({
    testId,
    decisionType: 'continue',
    reasoning: 'Test is progressing normally',
    agentId: 'agent-001',
    confidence: 0.9,
    alternatives: ['retry', 'abort'],
    selectedAction: 'continue',
    timestamp: Date.now(),
    correlationId
  });
  
  // Complete test
  testAuditor.completeTest(testId, 'passed', 'All assertions passed');
  
  // Log test outcome
  testAuditor.logTestOutcome({
    testId,
    outcome: 'success',
    summary: 'Transaction flow test completed successfully',
    details: { assertions: 5, passed: 5, failed: 0 },
    recommendations: ['Consider adding more edge cases'],
    nextSteps: ['Run performance tests'],
    timestamp: Date.now(),
    correlationId
  });
}

// Example: Transaction Trace Logging
export function exampleTransactionTracing() {
  const transactionId = 'tx-123';
  const correlationId = auditService.generateCorrelationId();
  
  // Start transaction trace
  transactionLogger.startTrace(transactionId, correlationId, {
    amount: '1000',
    recipient: '0x123...',
    agentId: 'agent-001'
  });
  
  // Add transaction steps
  const validationStepId = transactionLogger.addStep(
    transactionId,
    'validate_transaction',
    'validation-service',
    { amount: '1000', recipient: '0x123...' }
  );
  
  // Simulate step completion
  setTimeout(() => {
    transactionLogger.completeStep(transactionId, validationStepId, {
      valid: true,
      riskScore: 0.1
    });
    
    // Add more steps
    const signingStepId = transactionLogger.addStep(
      transactionId,
      'sign_transaction',
      'wallet-service',
      { transaction: 'signed_data' }
    );
    
    setTimeout(() => {
      transactionLogger.completeStep(transactionId, signingStepId, {
        signature: '0xabc...',
        signed: true
      });
      
      // Log transaction sent
      transactionLogger.logTransactionSent(transactionId, '0xdef...', correlationId);
      
      // Complete trace
      transactionLogger.completeTrace(transactionId, 'completed', 'Transaction processed successfully');
    }, 100);
  }, 100);
}

// Example: Integration with existing wallet code
export function integrateWithWallet() {
  // This shows how you could integrate audit trail with existing wallet operations
  
  // When a transaction is initiated
  const transactionId = 'tx-456';
  const correlationId = auditService.generateCorrelationId();
  
  transactionLogger.startTrace(transactionId, correlationId);
  
  // Log agent decision for transaction
  agentLogger.logTransactionDecision(
    'agent-001',
    transactionId,
    'approve',
    'Transaction amount and recipient are within acceptable limits',
    '1000',
    '0x123...',
    correlationId
  );
  
  // Add transaction processing steps
  const stepId = transactionLogger.addStep(
    transactionId,
    'process_transaction',
    'wallet-manager',
    { amount: '1000', to: '0x123...' }
  );
  
  // When transaction completes or fails
  try {
    // Simulate transaction processing
    const result = { success: true, txHash: '0xabc...' };
    transactionLogger.completeStep(transactionId, stepId, result);
    transactionLogger.logTransactionSent(transactionId, '0xabc...', correlationId);
    transactionLogger.completeTrace(transactionId, 'completed');
  } catch (error) {
    transactionLogger.completeStep(transactionId, stepId, undefined, error as Error);
    transactionLogger.logTransactionFailure(transactionId, error as Error, {}, correlationId);
    transactionLogger.completeTrace(transactionId, 'failed');
  }
}

// Example: Export audit trail for analysis
export function exportAuditTrail() {
  // Export all audit events to file
  const exportPath = auditService.exportToFile('audit-trail-export.json');
  console.log(`Audit trail exported to: ${exportPath}`);
  
  // Get specific events
  const agentDecisions = auditService.getEventsByType('agent_decision');
  const transactionEvents = auditService.getEventsByType('transaction_initiated');
  const testEvents = auditService.getEventsByType('test_started');
  
  console.log(`Total agent decisions: ${agentDecisions.length}`);
  console.log(`Total transactions: ${transactionEvents.length}`);
  console.log(`Total tests: ${testEvents.length}`);
} 