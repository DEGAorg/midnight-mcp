// Export all audit trail components
export { AuditTrailService } from './audit-trail-service.js';
export { TransactionTraceLogger } from './transaction-trace-logger.js';
export { AgentDecisionLogger } from './agent-decision-logger.js';
export { TestOutcomeAuditor } from './test-outcome-auditor.js';

// Export types from their respective files
export type {
  AuditEvent,
  AuditEventType,
  AuditTrailQuery,
  AuditTrailExport,
  AuditReport
} from './types.js';

export type {
  TransactionTrace,
  TransactionStep,
  TransactionContext
} from './transaction-trace-logger.js';

export type {
  AgentDecision,
  AgentAction,
  AgentReasoning
} from './agent-decision-logger.js';

export type {
  TestOutcome,
  TestDecision,
  TestMetrics,
  TestExecution
} from './test-outcome-auditor.js';

// Export integration example
export { AuditIntegrationExample, runAuditIntegrationExample } from './integration-example.js';

// Convenience function to initialize all audit services
export function initializeAuditServices(options?: {
  auditTrail?: any;
  agentDecision?: any;
  testOutcome?: any;
  transactionTrace?: any;
}) {
  const { AuditTrailService } = require('./audit-trail-service.js');
  const { AgentDecisionLogger } = require('./agent-decision-logger.js');
  const { TestOutcomeAuditor } = require('./test-outcome-auditor.js');
  const { TransactionTraceLogger } = require('./transaction-trace-logger.js');

  const auditService = AuditTrailService.getInstance(options?.auditTrail);
  const agentLogger = new AgentDecisionLogger(auditService);
  const testAuditor = new TestOutcomeAuditor(auditService);
  const transactionLogger = new TransactionTraceLogger(auditService);

  return {
    auditService,
    agentLogger,
    testAuditor,
    transactionLogger
  };
} 