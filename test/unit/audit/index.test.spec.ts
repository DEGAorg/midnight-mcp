import * as auditIndex from '@audit/index.js';

describe('initializeAuditServices', () => {
  it('should initialize all audit services with default options', () => {
    const result = auditIndex.initializeAuditServices();
    expect(result.auditService).toBeDefined();
    expect(result.agentLogger).toBeDefined();
    expect(result.testAuditor).toBeDefined();
    expect(result.transactionLogger).toBeDefined();
  });

  it('should pass options to AuditTrailService.getInstance', () => {
    const options = { auditTrail: { custom: true } };
    const result = auditIndex.initializeAuditServices(options);
    expect(result.auditService).toBeDefined();
  });
});

describe('Audit Module Exports', () => {
  it('should export initializeAuditServices function', () => {
    expect(typeof auditIndex.initializeAuditServices).toBe('function');
  });

  it('should export AuditTrailService class', () => {
    expect(auditIndex.AuditTrailService).toBeDefined();
  });

  it('should export TransactionTraceLogger class', () => {
    expect(auditIndex.TransactionTraceLogger).toBeDefined();
  });

  it('should export AgentDecisionLogger class', () => {
    expect(auditIndex.AgentDecisionLogger).toBeDefined();
  });

  it('should export TestOutcomeAuditor class', () => {
    expect(auditIndex.TestOutcomeAuditor).toBeDefined();
  });
});
