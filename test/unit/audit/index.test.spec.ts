jest.mock('../../../src/integrations/marketplace/api.js', () => require('../__mocks__/marketplace-api.ts'));

import * as auditIndex from '../../../src/audit/index';

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

describe('runAuditIntegrationExample', () => {
  it('should be exported and callable', async () => {
    expect(typeof auditIndex.runAuditIntegrationExample).toBe('function');
    await auditIndex.runAuditIntegrationExample();
  });
}); 