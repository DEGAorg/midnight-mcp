import { AuditEventType } from '../../../src/audit/types';
import { TestOutcomeAuditor, TestExecution, TestDecision, TestOutcome, TestMetrics } from '../../../src/audit/test-outcome-auditor';

jest.mock('../../../src/audit/audit-trail-service', () => {
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
    // @ts-ignore
    expect(auditor.mapTestStatusToSeverity('failed')).toBeDefined();
    // @ts-ignore
    expect(auditor.mapTestStatusToSeverity('timeout')).toBeDefined();
    // @ts-ignore
    expect(auditor.mapTestStatusToSeverity('skipped')).toBeDefined();
    // @ts-ignore
    expect(auditor.mapTestStatusToSeverity('passed')).toBeDefined();
    // @ts-ignore
    expect(auditor.mapTestStatusToSeverity('other')).toBeDefined();
  });

  it('should map all decision types to severity', () => {
    // @ts-ignore
    expect(auditor.mapDecisionTypeToSeverity('abort')).toBeDefined();
    // @ts-ignore
    expect(auditor.mapDecisionTypeToSeverity('retry')).toBeDefined();
    // @ts-ignore
    expect(auditor.mapDecisionTypeToSeverity('modify')).toBeDefined();
    // @ts-ignore
    expect(auditor.mapDecisionTypeToSeverity('skip')).toBeDefined();
    // @ts-ignore
    expect(auditor.mapDecisionTypeToSeverity('continue')).toBeDefined();
    // @ts-ignore
    expect(auditor.mapDecisionTypeToSeverity('other')).toBeDefined();
  });

  it('should map all outcomes to severity', () => {
    // @ts-ignore
    expect(auditor.mapOutcomeToSeverity('failure')).toBeDefined();
    // @ts-ignore
    expect(auditor.mapOutcomeToSeverity('partial')).toBeDefined();
    // @ts-ignore
    expect(auditor.mapOutcomeToSeverity('inconclusive')).toBeDefined();
    // @ts-ignore
    expect(auditor.mapOutcomeToSeverity('success')).toBeDefined();
    // @ts-ignore
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
    // @ts-ignore
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