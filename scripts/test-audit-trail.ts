#!/usr/bin/env tsx

/**
 * Audit Trail Test Runner
 * 
 * This script demonstrates the audit trail functionality in action.
 * It runs various scenarios and shows how audit data is collected and analyzed.
 */

import { 
  AuditTrailService, 
  TransactionTraceLogger, 
  AgentDecisionLogger, 
  TestOutcomeAuditor,
  AuditIntegrationExample 
} from '../src/audit/index.js';
import { AuditEventType, AuditSeverity } from '../src/audit/types.js';

async function runAuditTrailDemo() {
  console.log('🚀 Starting Audit Trail Demo...\n');

  // Initialize audit trail components
  const auditService = AuditTrailService.getInstance();
  const transactionLogger = new TransactionTraceLogger(auditService);
  const agentLogger = new AgentDecisionLogger(auditService);
  const testAuditor = new TestOutcomeAuditor(auditService);

  try {
    // Demo 1: Basic audit event logging
    console.log('📝 Demo 1: Basic Audit Event Logging');
    const eventId = auditService.logEvent(
      AuditEventType.AGENT_DECISION,
      'Demo audit event',
      AuditSeverity.MEDIUM,
      { source: 'demo-script', agentId: 'demo-agent' }
    );
    console.log(`✅ Logged audit event with ID: ${eventId}\n`);

    // Demo 2: Transaction tracing
    console.log('🔍 Demo 2: Transaction Tracing');
    const transactionId = 'demo-tx-123';
    const correlationId = auditService.generateCorrelationId();
    
    transactionLogger.startTrace(transactionId, correlationId, {
      amount: '5.0',
      recipient: 'demo-recipient',
      agentId: 'demo-agent',
      operation: 'demo-transaction'
    });

    // Add some steps
    const validationStepId = transactionLogger.addStep(
      transactionId,
      'validate_funds',
      'demo-wallet',
      { amount: '5.0', availableBalance: '10.0' }
    );

    transactionLogger.completeStep(transactionId, validationStepId, {
      valid: true,
      sufficientFunds: true
    });

    const creationStepId = transactionLogger.addStep(
      transactionId,
      'create_transaction',
      'demo-wallet',
      { amount: '5.0', recipient: 'demo-recipient' }
    );

    transactionLogger.completeStep(transactionId, creationStepId, {
      transactionCreated: true,
      txHash: 'demo-tx-hash-456'
    });

    transactionLogger.logTransactionSent(transactionId, 'demo-tx-hash-456', correlationId);
    transactionLogger.completeTrace(transactionId, 'completed', 'Demo transaction completed successfully');

    console.log(`✅ Transaction trace completed for: ${transactionId}\n`);

    // Demo 3: Agent decision logging
    console.log('🤖 Demo 3: Agent Decision Logging');
    agentLogger.logTransactionDecision(
      'security-agent',
      'security-check-1',
      'approve',
      'Transaction passes security checks',
      '5.0',
      'demo-recipient',
      correlationId
    );

    agentLogger.logTransactionDecision(
      'compliance-agent',
      'compliance-check-1',
      'approve',
      'Transaction complies with regulations',
      '5.0',
      'demo-recipient',
      correlationId
    );

    agentLogger.logTransactionDecision(
      'risk-agent',
      'risk-assessment-1',
      'approve',
      'Risk level: LOW - Amount within limits',
      '5.0',
      'demo-recipient',
      correlationId
    );

    console.log('✅ Agent decisions logged\n');

    // Demo 4: Test outcome tracking
    console.log('🧪 Demo 4: Test Outcome Tracking');
    const testId = testAuditor.startTest({
      testId: 'demo-test-123',
      testName: 'Demo Transaction Test',
      testSuite: 'DemoSuite',
      environment: 'demo',
      startTime: Date.now(),
      status: 'running'
    });

    testAuditor.logTestDecision({
      testId,
      decisionType: 'continue',
      reasoning: 'Initial validation passed',
      confidence: 0.9,
      selectedAction: 'proceed',
      timestamp: Date.now()
    });

    testAuditor.logTestDecision({
      testId,
      decisionType: 'modify',
      reasoning: 'Selecting high-value transaction path',
      confidence: 0.8,
      selectedAction: 'high_value_path',
      timestamp: Date.now()
    });

    testAuditor.completeTest(testId, 'passed', 'Demo test completed successfully');

    console.log('✅ Test outcome tracked\n');

    // Demo 5: Data export and analysis
    console.log('📊 Demo 5: Data Export and Analysis');
    
    // Export all audit data
    const allEvents = auditService.getAllEvents();
    console.log(`📈 Total audit events: ${allEvents.length}`);

    // Export transaction traces
    const traces = transactionLogger.getTraces();
    console.log(`🔍 Transaction traces: ${traces.length}`);

    // Export agent decisions
    const decisions = await agentLogger.exportDecisions({});
    console.log(`🤖 Agent decisions: ${decisions.length}`);

    // Export test outcomes
    const testOutcomes = await testAuditor.exportTestOutcomes({});
    console.log(`🧪 Test outcomes: ${testOutcomes.length}`);

    // Query events by type
    const agentEvents = auditService.getEventsByType(AuditEventType.AGENT_DECISION);
    const transactionEvents = auditService.getEventsByType(AuditEventType.TRANSACTION_SENT);
    
    console.log(`📝 Agent decision events: ${agentEvents.length}`);
    console.log(`💸 Transaction events: ${transactionEvents.length}`);

    // Get events by correlation ID
    const correlatedEvents = auditService.getEventsByCorrelationId(correlationId);
    console.log(`🔗 Events with correlation ID: ${correlatedEvents.length}\n`);

    // Demo 6: Run integration example
    console.log('🔄 Demo 6: Integration Example');
    const example = new AuditIntegrationExample();
    
    // Mock wallet manager to avoid actual wallet operations
    (example as any).walletManager = {
      sendFunds: async () => ({ txIdentifier: 'integration-tx-hash' })
    };

    await example.runCompleteTransactionWorkflow();
    console.log('✅ Integration example completed\n');

    // Demo 7: Performance test
    console.log('⚡ Demo 7: Performance Test');
    const startTime = Date.now();
    
    // Generate many events quickly
    for (let i = 0; i < 50; i++) {
      auditService.logEvent(
        AuditEventType.AGENT_DECISION,
        `Performance test event ${i}`,
        AuditSeverity.MEDIUM,
        { source: 'performance-test' }
      );
    }

    const endTime = Date.now();
    const duration = endTime - startTime;
    console.log(`✅ Generated 50 events in ${duration}ms\n`);

    // Final summary
    console.log('📋 Final Summary:');
    console.log(`- Total audit events: ${auditService.getAllEvents().length}`);
    console.log(`- Transaction traces: ${transactionLogger.getTraces().length}`);
    console.log(`- Test outcomes: ${testAuditor.getTestOutcomes().length}`);
    console.log(`- Unique correlation IDs: ${new Set(auditService.getAllEvents().map(e => e.context.correlationId)).size}`);

    console.log('\n🎉 Audit Trail Demo completed successfully!');

  } catch (error) {
    console.error('❌ Error during audit trail demo:', error);
    throw error;
  }
}

// Run the demo if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAuditTrailDemo().catch(console.error);
}

export { runAuditTrailDemo }; 