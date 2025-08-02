jest.mock('../../../src/utils/file-manager');
jest.mock('../../../src/integrations/marketplace/api.js', () => require('../__mocks__/marketplace-api.ts'));

import { describe, it, beforeEach, jest, expect } from '@jest/globals';
import {
  AuditTrailService,
  TransactionTraceLogger,
  AgentDecisionLogger,
  TestOutcomeAuditor,
  AuditIntegrationExample
} from '../../../src/audit/index.js';
import { AuditEventType, AuditSeverity } from '../../../src/audit/types.js';
// Import FileManager and FileType directly, as moduleNameMapper handles the mock file
import { FileManager, FileType } from '../../../src/utils/file-manager';
import mockLogger from '../__mocks__/logger';


describe('Audit Trail System', () => {
  let auditService: AuditTrailService;
  let transactionLogger: TransactionTraceLogger;
  let agentLogger: AgentDecisionLogger;
  let testAuditor: TestOutcomeAuditor;

  beforeEach(() => {
    jest.clearAllMocks();
    // AuditTrailService.resetInstance(); // Keep if you use this internally in your service
    auditService = AuditTrailService.getInstance();
    transactionLogger = new TransactionTraceLogger(auditService);
    agentLogger = new AgentDecisionLogger(auditService);
    testAuditor = new TestOutcomeAuditor(auditService);

    auditService.clearEvents();

    // Reset FileManager using the mock's resetInstance
    FileManager.resetInstance();
  });

  describe('AuditTrailService', () => {
    it('should be a singleton', () => {
      const instance1 = AuditTrailService.getInstance();
      const instance2 = AuditTrailService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should log audit events', () => {
      const eventId = auditService.logEvent(
        AuditEventType.AGENT_DECISION,
        'Test audit event',
        AuditSeverity.MEDIUM,
        { source: 'test', agentId: 'test-agent' }
      );

      expect(eventId).toBeDefined();
      expect(eventId.length).toBeGreaterThan(0);

      const events = auditService.getAllEvents();
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe(AuditEventType.AGENT_DECISION);
      expect(events[0].message).toBe('Test audit event');
    });

    it('should generate correlation IDs', () => {
      const correlationId1 = auditService.generateCorrelationId();
      const correlationId2 = auditService.generateCorrelationId();

      expect(correlationId1).toBeDefined();
      expect(correlationId2).toBeDefined();
      expect(correlationId1).not.toBe(correlationId2);
    });

    it('should get events by correlation ID', () => {
      const correlationId = auditService.generateCorrelationId();

      auditService.logEvent(
        AuditEventType.AGENT_DECISION,
        'Event 1',
        AuditSeverity.MEDIUM,
        { correlationId, source: 'test' }
      );

      auditService.logEvent(
        AuditEventType.TRANSACTION_INITIATED,
        'Event 2',
        AuditSeverity.MEDIUM,
        { correlationId, source: 'test' }
      );

      const events = auditService.getEventsByCorrelationId(correlationId);
      expect(events).toHaveLength(2);
      expect(events[0].context.correlationId).toBe(correlationId);
      expect(events[1].context.correlationId).toBe(correlationId);
    });

    it('should get events by type', () => {
      auditService.logEvent(
        AuditEventType.AGENT_DECISION,
        'Agent decision event',
        AuditSeverity.MEDIUM,
        { source: 'test' }
      );

      auditService.logEvent(
        AuditEventType.TRANSACTION_INITIATED,
        'Transaction event',
        AuditSeverity.MEDIUM,
        { source: 'test' }
      );

      const agentEvents = auditService.getEventsByType(AuditEventType.AGENT_DECISION);
      expect(agentEvents).toHaveLength(1);
      expect(agentEvents[0].type).toBe(AuditEventType.AGENT_DECISION);

      const transactionEvents = auditService.getEventsByType(AuditEventType.TRANSACTION_INITIATED);
      expect(transactionEvents).toHaveLength(1);
      expect(transactionEvents[0].type).toBe(AuditEventType.TRANSACTION_INITIATED);
    });

    it('should get events by time range', () => {
      const startTime = Date.now();

      auditService.logEvent(
        AuditEventType.AGENT_DECISION,
        'Event in range',
        AuditSeverity.MEDIUM,
        { source: 'test' }
      );

      const endTime = Date.now();

      const events = auditService.getEventsByTimeRange(startTime, endTime);
      expect(events).toHaveLength(1);
      expect(events[0].createdAt).toBeGreaterThanOrEqual(startTime);
      expect(events[0].createdAt).toBeLessThanOrEqual(endTime);
    });

    it('should not log when disabled', () => {
      AuditTrailService.resetInstance();
      const disabledService = AuditTrailService.getInstance({ enabled: false });
      const result = disabledService.logEvent(
        AuditEventType.AGENT_DECISION,
        'Should not log',
        AuditSeverity.MEDIUM,
        { source: 'test' }
      );
      expect(typeof result).toBe('string');
      expect(disabledService.getAllEvents()).toHaveLength(0);
    });

    it('should set data to undefined if includeMetadata is false', () => {
      AuditTrailService.resetInstance();
      const service = AuditTrailService.getInstance({ includeMetadata: false });
      service.clearEvents();
      service.logEvent(
        AuditEventType.AGENT_DECISION,
        'No metadata',
        AuditSeverity.MEDIUM,
        { source: 'test' },
        { foo: 'bar' }
      );
      const events = service.getAllEvents();
      expect(events[0].data).toBeUndefined();
    });

    it('should fallback to "unknown" source if not provided', () => {
      auditService.clearEvents();
      auditService.logEvent(
        AuditEventType.AGENT_DECISION,
        'Missing source',
        AuditSeverity.MEDIUM,
        {} // no source
      );
      const events = auditService.getAllEvents();
      expect(events[0].context.source).toBe('unknown');
    });

    it('should use default severity and context', () => {
      auditService.clearEvents();
      auditService.logEvent(
        AuditEventType.AGENT_DECISION,
        'Defaults test'
      );
      const events = auditService.getAllEvents();
      expect(events[0].severity).toBe(AuditSeverity.MEDIUM);
      expect(events[0].context).toBeDefined();
    });

    it('should export audit trail to file', () => {
      // Arrange: Add an event to ensure there is something to export
      auditService.logEvent(
        AuditEventType.AGENT_DECISION,
        'Export test event',
        AuditSeverity.MEDIUM,
        { source: 'test' }
      );

      // Act: Call exportToFile
      const filePath = auditService.exportToFile('test-audit-export.json');

      // Assert: The returned file path should be correct
      expect(filePath).toContain('test-audit-export.json');

    });

    it('should export audit trail to file without providing filename', () => {
      // Arrange: Add an event to ensure there is something to export
      auditService.logEvent(
        AuditEventType.AGENT_DECISION,
        'Export test event',
        AuditSeverity.MEDIUM,
        { source: 'test' }
      );

      // Act: Call exportToFile
      const filePath = auditService.exportToFile();

      // Assert: The returned file path should be correct
      expect(filePath).toContain('audit-trail');

    });

    it('should filter by eventTypes in queryAuditTrail', async () => {
      AuditTrailService.resetInstance();
      const service = AuditTrailService.getInstance();
      service.clearEvents();
      service.logEvent(AuditEventType.AGENT_DECISION, 'msg1');
      service.logEvent(AuditEventType.TRANSACTION_INITIATED, 'msg2');
      const result = await service.queryAuditTrail({ eventTypes: [AuditEventType.AGENT_DECISION] });
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe(AuditEventType.AGENT_DECISION);
    });

    it('should filter by timeRange in queryAuditTrail', async () => {
      AuditTrailService.resetInstance();
      const service = AuditTrailService.getInstance();
      service.clearEvents();
      const now = Date.now();
      service.logEvent(AuditEventType.AGENT_DECISION, 'msg1');
      const result = await service.queryAuditTrail({ timeRange: { start: now - 1000, end: now + 1000 } });
      expect(result.length).toBeGreaterThan(0);
    });

    it('should filter by custom filters (top-level) in queryAuditTrail', async () => {
      AuditTrailService.resetInstance();
      const service = AuditTrailService.getInstance();
      service.clearEvents();
      service.logEvent(AuditEventType.AGENT_DECISION, 'msg1');
      const result = await service.queryAuditTrail({ filters: { type: AuditEventType.AGENT_DECISION } });
      expect(result).toHaveLength(1);
    });

    it('should filter by custom filters (nested key with dot) in queryAuditTrail', async () => {
      AuditTrailService.resetInstance();
      const service = AuditTrailService.getInstance();
      service.clearEvents();
      service.logEvent(AuditEventType.AGENT_DECISION, 'msg1', AuditSeverity.MEDIUM, { source: 'test-source' });
      const result = await service.queryAuditTrail({ filters: { 'context.source': 'test-source' } });
      expect(result).toHaveLength(1);
      expect(result[0].context.source).toBe('test-source');
    });

    it('should apply offset and limit in queryAuditTrail', async () => {
      AuditTrailService.resetInstance();
      const service = AuditTrailService.getInstance();
      service.clearEvents();
      service.logEvent(AuditEventType.AGENT_DECISION, 'msg1');
      service.logEvent(AuditEventType.AGENT_DECISION, 'msg2');
      service.logEvent(AuditEventType.AGENT_DECISION, 'msg3');
      const result = await service.queryAuditTrail({ offset: 1, limit: 1 });
      expect(result).toHaveLength(1);
      expect(result[0].message).toBe('msg2');
    });

    it('should generate audit report with metrics', async () => {
      auditService.logEvent(AuditEventType.AGENT_DECISION, 'msg1', AuditSeverity.LOW);
      auditService.logEvent(AuditEventType.AGENT_DECISION, 'msg2', AuditSeverity.HIGH);
      const now = Date.now();
      const report = await auditService.generateAuditReport({
        timeRange: { start: now - 1000, end: now + 1000 },
        includeMetrics: true
      });
      expect(report.metrics).toBeDefined();
      expect(report.metrics.totalEvents).toBeGreaterThan(0);
      expect(report.metrics.eventTypeBreakdown).toBeDefined();
    });

    it('should recommend when no events found', async () => {
      AuditTrailService.resetInstance();
      const service = AuditTrailService.getInstance();
      service.clearEvents();
      const now = Date.now();
      const report = await service.generateAuditReport({
        timeRange: { start: now - 1000, end: now + 1000 },
        includeRecommendations: true
      });
      expect(report.recommendations).toContain('No audit events found in the specified time range');
    });

    it('should recommend high error rate', async () => {
      AuditTrailService.resetInstance();
      const service = AuditTrailService.getInstance();
      service.clearEvents();
      // Add 10 high severity events, 1 low severity event
      for (let i = 0; i < 1001; i++) {
        service.logEvent(AuditEventType.AGENT_DECISION, 'err', AuditSeverity.HIGH);
      }
      service.logEvent(AuditEventType.AGENT_DECISION, 'ok', AuditSeverity.LOW);
      const now = Date.now();
      const report = await service.generateAuditReport({
        timeRange: { start: now - 1000, end: now + 1000 },
        includeRecommendations: true
      });
      expect(report.recommendations).toContain('High error rate detected - review system health');
    });

    it('should recommend high event volume', async () => {
      const now = Date.now();
      const service = AuditTrailService.getInstance();
      service.clearEvents();
      // Add 1001 events
      for (let i = 0; i < 1001; i++) {
        service.logEvent(AuditEventType.AGENT_DECISION, 'msg', AuditSeverity.LOW);
      }
      const report = await service.generateAuditReport({
        timeRange: { start: now - 1000000, end: now + 1000000 },
        includeRecommendations: true
      });
      expect(report.recommendations).toContain('High event volume - consider log aggregation');
    });


    it('should not persist event when persistence is set to memory', () => {
      AuditTrailService.resetInstance();
      const service = AuditTrailService.getInstance({ persistence: 'memory' });
      // Spy on persistToFile to ensure they are not called
      const fileSpy = jest.spyOn(service as any, 'persistToFile').mockImplementation(() => { });
      const event = {
        id: 'test-id',
        type: AuditEventType.AGENT_DECISION,
        severity: AuditSeverity.LOW,
        message: 'test message',
        context: {
          timestamp: Date.now(),
          source: 'test-source'
        },
        createdAt: Date.now(),
        data: {}
      };
      // Should not throw and should not call persistToDatabase or persistToFile
      expect(() => service['persistEvent'](event)).not.toThrow();
      expect(fileSpy).not.toHaveBeenCalled();
    });

    it('should cleanup old events if over maxEvents', () => {
      AuditTrailService.resetInstance();
      const service = AuditTrailService.getInstance({ maxEvents: 2, retentionDays: 1 });
      // Add 3 events with old timestamps
      const now = Date.now();
      (service as any).events = [
        { createdAt: now - 100000000, context: {}, id: '1', type: AuditEventType.AGENT_DECISION, severity: AuditSeverity.LOW, message: '' },
        { createdAt: now - 100000000, context: {}, id: '2', type: AuditEventType.AGENT_DECISION, severity: AuditSeverity.LOW, message: '' },
        { createdAt: now, context: {}, id: '3', type: AuditEventType.AGENT_DECISION, severity: AuditSeverity.LOW, message: '' }
      ];
      const infoSpy = jest.spyOn((service as any).logger, 'info');
      (service as any).cleanup();
      expect((service as any).events.length).toBeLessThanOrEqual(2);
      expect(infoSpy).toHaveBeenCalled();
    });

    it('should not throw for unknown persistence mode in persistEvent', () => {
      AuditTrailService.resetInstance();
      const service = AuditTrailService.getInstance({ persistence: 'unknown' as any });
      // Should not throw
      expect(() => (service as any).persistEvent({
        id: 'id', type: AuditEventType.AGENT_DECISION, severity: AuditSeverity.LOW, message: '', context: { timestamp: 0, source: '' }, createdAt: 0
      })).not.toThrow();
    });

  });

  describe('TransactionTraceLogger', () => {
    it('should start and complete transaction traces', () => {
      const transactionId = 'tx-123';
      const correlationId = auditService.generateCorrelationId();

      transactionLogger.startTrace(transactionId, correlationId, {
        amount: '1.0',
        recipient: 'test-recipient',
        agentId: 'test-agent'
      });

      transactionLogger.completeTrace(transactionId, 'completed', 'Transaction successful');

      const traces = transactionLogger.getTraces();
      expect(traces).toHaveLength(1);
      expect(traces[0].transactionId).toBe(transactionId);
      expect(traces[0].status).toBe('completed');
      expect(traces[0].correlationId).toBe(correlationId);
    });

    it('should add and complete steps', () => {
      const transactionId = 'tx-123';
      const correlationId = auditService.generateCorrelationId();

      transactionLogger.startTrace(transactionId, correlationId, {});

      const stepId = transactionLogger.addStep(
        transactionId,
        'validation',
        'wallet-manager',
        { amount: '1.0' }
      );

      transactionLogger.completeStep(transactionId, stepId, { valid: true });

      // Complete the trace so getTraces() can find it
      transactionLogger.completeTrace(transactionId, 'completed', 'Transaction successful');

      const traces = transactionLogger.getTraces();
      expect(traces[0].steps).toHaveLength(1);
      expect(traces[0].steps[0].stepName).toBe('validation');
      expect(traces[0].steps[0].status).toBe('completed');
    });

    it('should log transaction sent events', () => {
      const transactionId = 'tx-123';
      const correlationId = auditService.generateCorrelationId();

      transactionLogger.logTransactionSent(transactionId, 'tx-hash-456', correlationId);

      const events = auditService.getEventsByType(AuditEventType.TRANSACTION_SENT);
      expect(events).toHaveLength(1);
      expect(events[0].data.transactionId).toBe(transactionId);
      expect(events[0].data.txIdentifier).toBe('tx-hash-456');
    });

    it('should log transaction failures', () => {
      const transactionId = 'tx-123';
      const correlationId = auditService.generateCorrelationId();
      const error = new Error('Transaction failed');

      transactionLogger.logTransactionFailure(
        transactionId,
        error,
        { amount: '1.0', recipient: 'test' },
        correlationId
      );

      const events = auditService.getEventsByType(AuditEventType.TRANSACTION_FAILED);
      expect(events).toHaveLength(1);
      expect(events[0].data.transactionId).toBe(transactionId);
      expect(events[0].data.error.message).toBe('Transaction failed');
    });
  });

  describe('AgentDecisionLogger', () => {
    it('should log agent decisions', () => {
      const correlationId = auditService.generateCorrelationId();

      agentLogger.logTransactionDecision(
        'test-agent',
        'decision-123',
        'approve',
        'Transaction approved',
        '1.0',
        'test-recipient',
        correlationId
      );

      const events = auditService.getEventsByType(AuditEventType.AGENT_DECISION);
      expect(events).toHaveLength(1);
      expect(events[0].data.agentId).toBe('test-agent');
      expect(events[0].data.decisionType).toBe('transaction');
      expect(events[0].data.selectedAction).toBe('approve');
      expect(events[0].data.reasoning).toBe('Transaction approved');
    });

    it('should export agent decisions', async () => {
      const correlationId = auditService.generateCorrelationId();

      agentLogger.logTransactionDecision(
        'test-agent',
        'decision-123',
        'approve',
        'Transaction approved',
        '1.0',
        'test-recipient',
        correlationId
      );

      const decisions = await agentLogger.exportDecisions({
        agentId: 'test-agent',
        decisionType: 'transaction'
      });

      expect(decisions).toHaveLength(1);
      expect(decisions[0].agentId).toBe('test-agent');
      expect(decisions[0].decisionType).toBe('transaction');
    });

    it('should log decisions with all riskAssessment values and missing optional fields', () => {
      const base = {
        agentId: 'agent-risk',
        decisionType: 'custom' as const,
        input: {},
        reasoning: '',
        selectedAction: ''
      };
      const high = agentLogger.logDecision({ ...base, riskAssessment: 'high' as const });
      const medium = agentLogger.logDecision({ ...base, riskAssessment: 'medium' as const });
      const low = agentLogger.logDecision({ ...base, riskAssessment: 'low' as const });
      const none = agentLogger.logDecision(base);
      expect(typeof high).toBe('string');
      expect(typeof medium).toBe('string');
      expect(typeof low).toBe('string');
      expect(typeof none).toBe('string');
    });

    it('should log reasoning with all confidence branches', () => {
      const base = {
        agentId: 'agent-conf',
        context: 'ctx',
        analysis: '',
        factors: [],
        conclusion: ''
      };
      const low = agentLogger.logReasoning({ ...base, confidence: 0.3 });
      const med = agentLogger.logReasoning({ ...base, confidence: 0.7 });
      const hi = agentLogger.logReasoning({ ...base, confidence: 0.9 });
      expect(typeof low).toBe('string');
      expect(typeof med).toBe('string');
      expect(typeof hi).toBe('string');
    });

    it('should handle exportDecisions with all filter branches', async () => {
      const now = Date.now();
      agentLogger.logTransactionDecision('agent-filt', 'tx-f', 'approve', 'ok', undefined, undefined, 'corr-f');
      // No filters
      const all = await agentLogger.exportDecisions();
      expect(all.length).toBeGreaterThan(0);
      // agentId
      const byAgent = await agentLogger.exportDecisions({ agentId: 'agent-filt' });
      expect(byAgent.length).toBeGreaterThan(0);
      // decisionType
      const byType = await agentLogger.exportDecisions({ decisionType: 'transaction' });
      expect(byType.length).toBeGreaterThan(0);
      // startTime (future, should be empty)
      const byStart = await agentLogger.exportDecisions({ startTime: now + 10000 });
      expect(byStart.length).toBe(0);
      // endTime (past, should be empty)
      const byEnd = await agentLogger.exportDecisions({ endTime: now - 10000 });
      expect(byEnd.length).toBe(0);
      // All filters (should match)
      const allFilt = await agentLogger.exportDecisions({
        agentId: 'agent-filt',
        decisionType: 'transaction',
        startTime: now - 1000,
        endTime: now + 1000
      });
      expect(allFilt.length).toBeGreaterThan(0);
    });

    it('should handle exportDecisions with no events', async () => {
      auditService.clearEvents();
      const none = await agentLogger.exportDecisions();
      expect(none.length).toBe(0);
    });

    it('should handle exportDecisions with missing data fields', async () => {
      // Manually add an event with missing data
      (auditService as any).events.push({
        type: AuditEventType.AGENT_DECISION,
        context: { agentId: 'missing-data' },
        createdAt: Date.now(),
        data: undefined
      });
      const res = await agentLogger.exportDecisions({ agentId: 'missing-data' });
      expect(res.length).toBe(1);
      expect(res[0].agentId).toBe('missing-data');
      expect(res[0].decisionType).toBeUndefined();
    });

    it('should handle getAgentDecisions, getAgentActions, getDecisionHistory with no events', () => {
      auditService.clearEvents();
      expect(agentLogger.getAgentDecisions('none').length).toBe(0);
      expect(agentLogger.getAgentActions('none').length).toBe(0);
      expect(agentLogger.getDecisionHistory('none').length).toBe(0);
    });

    it('should use AuditTrailService.getInstance() if no auditService is provided', () => {
      const logger = new AgentDecisionLogger(); // no argument
      expect(logger).toBeInstanceOf(AgentDecisionLogger);
    });

    it('should cover logAction code path', () => {
      const action = {
        agentId: 'cover-action',
        actionType: 'test',
        target: 'target',
        parameters: {},
        timestamp: Date.now()
      };
      const id = agentLogger.logAction(action);
      expect(typeof id).toBe('string');
    });

    it('should log a recovery decision', () => {
      const id = agentLogger.logRecoveryDecision(
        'agent-recovery',
        'type',
        'reason',
        ['action1', 'action2'],
        'corr-recovery'
      );
      expect(typeof id).toBe('string');
    });

    it('should cover the "Transaction will be blocked" branch in logTransactionDecision', () => {
      const id = agentLogger.logTransactionDecision(
        'agent-blocked',
        'tx-blocked',
        'reject', // or 'hold'
        'reason for rejection'
      );
      expect(typeof id).toBe('string');
      const events = auditService.getEventsByType(AuditEventType.AGENT_DECISION);
      expect(events[events.length - 1].data.expectedOutcome).toBe('Transaction will be blocked');
    });

    it('should filter out events with non-matching agentId in exportDecisions', async () => {
      // Add an event with a different agentId
      (auditService as any).events.push({
        type: AuditEventType.AGENT_DECISION,
        context: { agentId: 'not-matching' },
        createdAt: Date.now(),
        data: { decisionType: 'custom' }
      });
      const res = await agentLogger.exportDecisions({ agentId: 'some-other-agent' });
      expect(res.length).toBe(0);
    });

    it('should return empty array if no agent decisions match agentId', () => {
      // Add a decision for a different agent
      (auditService as any).events.push({
        type: AuditEventType.AGENT_DECISION,
        context: { agentId: 'not-matching' },
        createdAt: Date.now(),
        data: { decisionType: 'custom' }
      });
      const res = agentLogger.getAgentDecisions('some-other-agent');
      expect(res.length).toBe(0);
    });

    it('should return empty array if no agent actions match agentId', () => {
      // Add an action for a different agent
      (auditService as any).events.push({
        type: AuditEventType.AGENT_ACTION,
        context: { agentId: 'not-matching' },
        createdAt: Date.now(),
        data: { actionType: 'test', target: 'target', parameters: {}, timestamp: Date.now() }
      });
      const res = agentLogger.getAgentActions('some-other-agent');
      expect(res.length).toBe(0);
    });
  });

  describe('TestOutcomeAuditor', () => {
    it('should start and complete tests', () => {
      const testId = testAuditor.startTest({
        testId: 'test-123',
        testName: 'Test Transaction',
        testSuite: 'WalletManager',
        environment: 'test',
        startTime: Date.now(),
        status: 'running'
      });

      testAuditor.completeTest(testId, 'passed', 'Test completed successfully');

      const outcomes = testAuditor.getTestOutcomes();
      expect(outcomes).toHaveLength(1);
      expect(outcomes[0].testId).toBe('test-123');
      expect(outcomes[0].status).toBe('passed');
      expect(outcomes[0].testName).toBe('Test Transaction');
    });

    it('should log test decisions', () => {
      const testId = testAuditor.startTest({
        testId: 'test-123',
        testName: 'Test Transaction',
        testSuite: 'WalletManager',
        environment: 'test',
        startTime: Date.now(),
        status: 'running'
      });

      testAuditor.logTestDecision({
        testId,
        decisionType: 'continue',
        reasoning: 'Proceeding with test',
        confidence: 0.9,
        selectedAction: 'proceed',
        timestamp: Date.now()
      });

      testAuditor.completeTest(testId, 'passed', 'Test completed');

      const outcomes = testAuditor.getTestOutcomes();
      expect(outcomes[0].decisions).toHaveLength(1);
      expect(outcomes[0].decisions![0].decisionType).toBe('continue');
      expect(outcomes[0].decisions![0].confidence).toBe(0.9);
    });

    it('should export test outcomes', async () => {
      const testId = testAuditor.startTest({
        testId: 'test-123',
        testName: 'Test Transaction',
        testSuite: 'WalletManager',
        environment: 'test',
        startTime: Date.now(),
        status: 'running'
      });

      testAuditor.completeTest(testId, 'passed', 'Test completed successfully');

      const outcomes = await testAuditor.exportTestOutcomes({
        testSuite: 'WalletManager',
        status: 'passed'
      });

      expect(outcomes).toHaveLength(1);
      expect(outcomes[0].testSuite).toBe('WalletManager');
      expect(outcomes[0].status).toBe('passed');
    });

    it('should calculate test metrics', () => {
      const startTime = Date.now();

      const testId = testAuditor.startTest({
        testId: 'test-123',
        testName: 'Test Transaction',
        testSuite: 'WalletManager',
        environment: 'test',
        startTime,
        status: 'running'
      });

      testAuditor.completeTest(testId, 'passed', 'Test completed');

      const outcomes = testAuditor.getTestOutcomes();
      expect(outcomes[0].startTime).toBe(startTime);
      expect(outcomes[0].endTime).toBeGreaterThanOrEqual(startTime);
      expect(outcomes[0].duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Integration Example', () => {
    it('should run complete integration example', async () => {
      const example = new AuditIntegrationExample();

      // Mock the wallet manager to avoid actual wallet operations
      (example as any).walletManager = {
        sendFunds: jest.fn().mockImplementation(() => Promise.resolve({ txIdentifier: 'mock-tx-hash' }))
      };

      // Run the integration example
      await example.runCompleteTransactionWorkflow();

      // Verify audit trail was generated
      const auditService = (example as any).auditService;
      const events = auditService.getAllEvents();
      expect(events.length).toBeGreaterThan(0);

      // Verify transaction trace was created
      const transactionLogger = (example as any).transactionLogger;
      const traces = transactionLogger.getTraces();
      expect(traces.length).toBeGreaterThan(0);
    });

    it('should export and analyze audit trail data', async () => {
      const example = new AuditIntegrationExample();

      // Mock the wallet manager
      (example as any).walletManager = {
        sendFunds: jest.fn().mockImplementation(() => Promise.resolve({ txIdentifier: 'mock-tx-hash' }))
      };

      // Run workflow to generate data
      await example.runCompleteTransactionWorkflow();

      // Test export functionality
      await example.exportAuditTrailData();
      // This should not throw an error

      // Test analysis functionality
      await example.analyzeAuditTrail();
      // This should not throw an error
    });
  });

  describe('Audit Trail Performance', () => {
    it('should handle high volume of events', () => {
      const startTime = Date.now();

      // Generate many events quickly
      for (let i = 0; i < 100; i++) {
        auditService.logEvent(
          AuditEventType.AGENT_DECISION,
          `Event ${i}`,
          AuditSeverity.MEDIUM,
          { source: 'test' }
        );
      }

      const endTime = Date.now();
      const events = auditService.getAllEvents();

      expect(events).toHaveLength(100);
      expect(endTime - startTime).toBeGreaterThanOrEqual(0);
    });

    it('should maintain performance with concurrent operations', async () => {
      const promises = [];

      // Start multiple concurrent operations
      for (let i = 0; i < 10; i++) {
        promises.push(
          new Promise<void>((resolve) => {
            const testId = testAuditor.startTest({
              testId: `concurrent-test-${i}`,
              testName: `Concurrent Test ${i}`,
              testSuite: 'Performance',
              environment: 'test',
              startTime: Date.now(),
              status: 'running'
            });

            testAuditor.completeTest(testId, 'passed', 'Concurrent test completed');
            resolve();
          })
        );
      }

      await Promise.all(promises);

      const outcomes = testAuditor.getTestOutcomes();
      expect(outcomes).toHaveLength(10);
    });
  });
}); 