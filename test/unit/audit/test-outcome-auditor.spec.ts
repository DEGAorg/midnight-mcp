import { AuditEventType } from '@audit/types.js';
import { TestOutcomeAuditor, TestExecution, TestDecision, TestOutcome, TestMetrics } from '@audit/test-outcome-auditor.js';

jest.mock('@audit/audit-trail-service.js', () => {
  return {
    AuditTrailService: {
      getInstance: jest.fn(() => ({
        generateCorrelationId: jest.fn(() => 'corr-1'),
        logEvent: jest.fn(() => 'event-1'),
        getAllEvents: jest.fn(() => []),
        getEventsByCorrelationId: jest.fn(() => [])
      }))
    }
  };
});

describe('TestOutcomeAuditor', () => {
  let auditor: TestOutcomeAuditor;
  let testExecution: TestExecution;

  beforeEach(() => {
    auditor = new TestOutcomeAuditor();
    testExecution = {
      testId: 't1',
      testName: 'Test',
      testSuite: 'Suite',
      environment: 'dev',
      startTime: Date.now(),
      status: 'running'
    };
  });

  it('should start and complete a test', () => {
    auditor.startTest(testExecution);
    expect(auditor.getActiveTests().length).toBe(1);
    auditor.completeTest('t1', 'passed', 'ok', {});
    expect(auditor.getActiveTests().length).toBe(0);
  });

  it('should throw if completeTest is called with unknown testId', () => {
    expect(() => auditor.completeTest('unknown', 'passed')).toThrow();
  });

  it('should log test decision', () => {
    const decision: TestDecision = {
      testId: 't1',
      decisionType: 'retry',
      reasoning: 'reason',
      selectedAction: 'action',
      timestamp: Date.now()
    };
    expect(auditor.logTestDecision(decision)).toBeDefined();
  });

  it('should log test outcome', () => {
    const outcome: TestOutcome = {
      testId: 't1',
      outcome: 'success',
      summary: 'sum',
      details: {},
      timestamp: Date.now()
    };
    expect(auditor.logTestOutcome(outcome)).toBeDefined();
  });

  it('should log test metrics', () => {
    const metrics: TestMetrics = {
      testId: 't1',
      metrics: { executionTime: 123 },
      timestamp: Date.now()
    };
    expect(auditor.logTestMetrics(metrics)).toBeDefined();
  });

  it('should log test failure', () => {
    expect(auditor.logTestFailure('t1', new Error('fail'))).toBeDefined();
  });

  it('should get test events and summaries', () => {
    expect(auditor.getTestEvents('t1')).toEqual([]);
    expect(auditor.getTestEventsByCorrelation('corr-1')).toEqual([]);
    expect(auditor.getTestSummary('t1')).toHaveProperty('testId', 't1');
  });

  it('should get test outcomes', () => {
    expect(auditor.getTestOutcomes()).toEqual([]);
  });

  it('should export test outcomes with all filters', async () => {
    await expect(auditor.exportTestOutcomes({
      testSuite: 'Suite',
      status: 'passed',
      testId: 't1',
      startTime: 0,
      endTime: Date.now()
    })).resolves.toEqual([]);
  });

  // Cobertura de métodos privados de mapeo
  it('should map all test status to severity', () => {
    // @ts-expect-error
    expect(auditor.mapTestStatusToSeverity('failed')).toBeDefined();
    // @ts-expect-error
    expect(auditor.mapTestStatusToSeverity('timeout')).toBeDefined();
    // @ts-expect-error
    expect(auditor.mapTestStatusToSeverity('skipped')).toBeDefined();
    // @ts-expect-error
    expect(auditor.mapTestStatusToSeverity('passed')).toBeDefined();
    // @ts-expect-error
    expect(auditor.mapTestStatusToSeverity('other')).toBeDefined();
  });

  it('should map all decision types to severity', () => {
    // @ts-expect-error
    expect(auditor.mapDecisionTypeToSeverity('abort')).toBeDefined();
    // @ts-expect-error
    expect(auditor.mapDecisionTypeToSeverity('retry')).toBeDefined();
    // @ts-expect-error
    expect(auditor.mapDecisionTypeToSeverity('modify')).toBeDefined();
    // @ts-expect-error
    expect(auditor.mapDecisionTypeToSeverity('skip')).toBeDefined();
    // @ts-expect-error
    expect(auditor.mapDecisionTypeToSeverity('continue')).toBeDefined();
    // @ts-expect-error
    expect(auditor.mapDecisionTypeToSeverity('other')).toBeDefined();
  });

  it('should map all outcomes to severity', () => {
    // @ts-expect-error
    expect(auditor.mapOutcomeToSeverity('failure')).toBeDefined();
    // @ts-expect-error
    expect(auditor.mapOutcomeToSeverity('partial')).toBeDefined();
    // @ts-expect-error
    expect(auditor.mapOutcomeToSeverity('inconclusive')).toBeDefined();
    // @ts-expect-error
    expect(auditor.mapOutcomeToSeverity('success')).toBeDefined();
    // @ts-expect-error
    expect(auditor.mapOutcomeToSeverity('other')).toBeDefined();
  });

  it('should cover all .find branches in getTestSummary', () => {
    
    jest.spyOn(auditor, 'getTestEvents').mockImplementation(() => [
      { type: AuditEventType.TEST_STARTED },
      { type: AuditEventType.TEST_COMPLETED },
      { type: AuditEventType.TEST_OUTCOME }
    ]);
    const summary = auditor.getTestSummary('any');
    expect(summary.startEvent).toBeDefined();
    expect(summary.completeEvent).toBeDefined();
    expect(summary.outcomeEvent).toBeDefined();
  });

  it('should cover the if (!testId) return; branch in getTestOutcomes', () => {
    // @ts-expect-error
    auditor.auditService.getAllEvents = jest.fn(() => [
      { type: AuditEventType.TEST_COMPLETED, context: {} }
    ]);
    expect(auditor.getTestOutcomes()).toEqual([]);
  });

  it('should filter by testSuite in exportTestOutcomes', async () => {
    // Mock getTestOutcomes para devolver un outcome con testSuite diferente
    jest.spyOn(auditor, 'getTestOutcomes').mockReturnValue([
      { testSuite: 'A', status: 'ok', testId: 'id', startTime: 1, endTime: 2 }
    ]);
    const result = await auditor.exportTestOutcomes({ testSuite: 'B' });
    expect(result).toEqual([]);
  });

  it('should filter by status in exportTestOutcomes', async () => {
    jest.spyOn(auditor, 'getTestOutcomes').mockReturnValue([
      { testSuite: 'A', status: 'fail', testId: 'id', startTime: 1, endTime: 2 }
    ]);
    const result = await auditor.exportTestOutcomes({ status: 'ok' });
    expect(result).toEqual([]);
  });

  it('should filter by testId in exportTestOutcomes', async () => {
    jest.spyOn(auditor, 'getTestOutcomes').mockReturnValue([
      { testSuite: 'A', status: 'ok', testId: 'id1', startTime: 1, endTime: 2 }
    ]);
    const result = await auditor.exportTestOutcomes({ testId: 'id2' });
    expect(result).toEqual([]);
  });

  it('should filter by startTime in exportTestOutcomes', async () => {
    jest.spyOn(auditor, 'getTestOutcomes').mockReturnValue([
      { testSuite: 'A', status: 'ok', testId: 'id', startTime: 1, endTime: 2 }
    ]);
    const result = await auditor.exportTestOutcomes({ startTime: 10 });
    expect(result).toEqual([]);
  });

  it('should filter by endTime in exportTestOutcomes', async () => {
    jest.spyOn(auditor, 'getTestOutcomes').mockReturnValue([
      { testSuite: 'A', status: 'ok', testId: 'id', startTime: 1, endTime: 20 }
    ]);
    const result = await auditor.exportTestOutcomes({ endTime: 10 });
    expect(result).toEqual([]);
  });
}); 