import { AuditTrailService } from './audit-trail-service.js';
import { AuditEventType, AuditSeverity } from './types.js';
import { createLogger } from '../logger/index.js';

export interface TestExecution {
  testId: string;
  testName: string;
  testSuite: string;
  agentId?: string;
  environment: string;
  startTime: number;
  endTime?: number;
  status: 'running' | 'passed' | 'failed' | 'skipped' | 'timeout';
  duration?: number;
  correlationId?: string;
}

export interface TestDecision {
  testId: string;
  decisionType: 'retry' | 'skip' | 'continue' | 'abort' | 'modify';
  reasoning: string;
  agentId?: string;
  confidence?: number;
  alternatives?: string[];
  selectedAction: string;
  timestamp: number;
  correlationId?: string;
}

export interface TestOutcome {
  testId: string;
  outcome: 'success' | 'failure' | 'partial' | 'inconclusive';
  summary: string;
  details: any;
  recommendations?: string[];
  nextSteps?: string[];
  timestamp: number;
  correlationId?: string;
}

export interface TestMetrics {
  testId: string;
  metrics: {
    executionTime: number;
    memoryUsage?: number;
    cpuUsage?: number;
    networkCalls?: number;
    databaseQueries?: number;
    errors?: number;
    warnings?: number;
  };
  timestamp: number;
}

export class TestOutcomeAuditor {
  private auditService: AuditTrailService;
  private logger = createLogger('test-outcome-auditor');
  private activeTests: Map<string, TestExecution> = new Map();

  constructor(auditService?: AuditTrailService) {
    this.auditService = auditService || AuditTrailService.getInstance();
  }

  /**
   * Start tracking a test execution
   */
  public startTest(testExecution: TestExecution): string {
    const correlationId = testExecution.correlationId || this.auditService.generateCorrelationId();
    testExecution.correlationId = correlationId;
    
    this.activeTests.set(testExecution.testId, testExecution);
    
    const message = `Test started: ${testExecution.testName} (${testExecution.testSuite})`;
    
    const eventId = this.auditService.logEvent(
      AuditEventType.TEST_STARTED,
      message,
      AuditSeverity.LOW,
      {
        correlationId,
        testId: testExecution.testId,
        agentId: testExecution.agentId,
        source: 'test-outcome-auditor'
      },
      {
        testName: testExecution.testName,
        testSuite: testExecution.testSuite,
        environment: testExecution.environment,
        startTime: testExecution.startTime
      }
    );

    this.logger.info(`Test execution started: ${testExecution.testName}`, {
      eventId,
      correlationId,
      testId: testExecution.testId
    });

    return testExecution.testId;
  }

  /**
   * Complete a test execution
   */
  public completeTest(
    testId: string, 
    status: 'passed' | 'failed' | 'skipped' | 'timeout',
    summary?: string,
    details?: any
  ): string {
    const testExecution = this.activeTests.get(testId);
    if (!testExecution) {
      throw new Error(`Test ${testId} not found in active tests`);
    }

    const endTime = Date.now();
    const duration = endTime - testExecution.startTime;
    
    testExecution.endTime = endTime;
    testExecution.status = status;
    testExecution.duration = duration;
    
    this.activeTests.delete(testId);
    
    const message = `Test completed: ${testExecution.testName} - ${status}`;
    const severity = this.mapTestStatusToSeverity(status);
    
    const eventId = this.auditService.logEvent(
      AuditEventType.TEST_COMPLETED,
      message,
      severity,
      {
        correlationId: testExecution.correlationId,
        testId: testExecution.testId,
        agentId: testExecution.agentId,
        source: 'test-outcome-auditor'
      },
      {
        testName: testExecution.testName,
        testSuite: testExecution.testSuite,
        status,
        duration,
        summary,
        details,
        startTime: testExecution.startTime,
        endTime: endTime
      }
    );

    this.logger.info(`Test execution completed: ${testExecution.testName} - ${status}`, {
      eventId,
      correlationId: testExecution.correlationId,
      testId: testExecution.testId,
      duration
    });

    return eventId;
  }

  /**
   * Log a test decision
   */
  public logTestDecision(decision: TestDecision): string {
    const message = `Test decision made: ${decision.testId} - ${decision.decisionType}`;
    
    const severity = this.mapDecisionTypeToSeverity(decision.decisionType);
    
    const eventId = this.auditService.logEvent(
      AuditEventType.TEST_DECISION,
      message,
      severity,
      {
        correlationId: decision.correlationId,
        testId: decision.testId,
        agentId: decision.agentId,
        source: 'test-outcome-auditor'
      },
      {
        decisionType: decision.decisionType,
        reasoning: decision.reasoning,
        confidence: decision.confidence,
        alternatives: decision.alternatives,
        selectedAction: decision.selectedAction,
        timestamp: decision.timestamp
      }
    );

    this.logger.info(`Test decision logged: ${decision.testId} - ${decision.decisionType}`, {
      eventId,
      correlationId: decision.correlationId,
      confidence: decision.confidence
    });

    return eventId;
  }

  /**
   * Log test outcome
   */
  public logTestOutcome(outcome: TestOutcome): string {
    const message = `Test outcome: ${outcome.testId} - ${outcome.outcome}`;
    
    const severity = this.mapOutcomeToSeverity(outcome.outcome);
    
    const eventId = this.auditService.logEvent(
      AuditEventType.TEST_OUTCOME,
      message,
      severity,
      {
        correlationId: outcome.correlationId,
        testId: outcome.testId,
        source: 'test-outcome-auditor'
      },
      {
        outcome: outcome.outcome,
        summary: outcome.summary,
        details: outcome.details,
        recommendations: outcome.recommendations,
        nextSteps: outcome.nextSteps,
        timestamp: outcome.timestamp
      }
    );

    this.logger.info(`Test outcome logged: ${outcome.testId} - ${outcome.outcome}`, {
      eventId,
      correlationId: outcome.correlationId
    });

    return eventId;
  }

  /**
   * Log test metrics
   */
  public logTestMetrics(metrics: TestMetrics): string {
    const message = `Test metrics: ${metrics.testId} - execution time: ${metrics.metrics.executionTime}ms`;
    
    const eventId = this.auditService.logEvent(
      AuditEventType.SYSTEM_EVENT,
      message,
      AuditSeverity.LOW,
      {
        testId: metrics.testId,
        source: 'test-outcome-auditor'
      },
      {
        metrics: metrics.metrics,
        timestamp: metrics.timestamp
      }
    );

    this.logger.debug(`Test metrics logged: ${metrics.testId}`, {
      eventId,
      executionTime: metrics.metrics.executionTime
    });

    return eventId;
  }

  /**
   * Log test failure with detailed error information
   */
  public logTestFailure(
    testId: string,
    error: Error,
    context?: any,
    correlationId?: string
  ): string {
    const message = `Test failure: ${testId} - ${error.message}`;
    
    const eventId = this.auditService.logEvent(
      AuditEventType.ERROR_EVENT,
      message,
      AuditSeverity.HIGH,
      {
        correlationId,
        testId,
        source: 'test-outcome-auditor'
      },
      {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        },
        context
      }
    );

    this.logger.error(`Test failure logged: ${testId}`, {
      eventId,
      correlationId,
      error: error.message
    });

    return eventId;
  }

  /**
   * Get all test events for a specific test
   */
  public getTestEvents(testId: string): any[] {
    const allEvents = this.auditService.getAllEvents();
    return allEvents.filter(event => event.context.testId === testId);
  }

  /**
   * Get all test events for a correlation ID
   */
  public getTestEventsByCorrelation(correlationId: string): any[] {
    return this.auditService.getEventsByCorrelationId(correlationId);
  }

  /**
   * Get active tests
   */
  public getActiveTests(): TestExecution[] {
    return Array.from(this.activeTests.values());
  }

  /**
   * Get test execution summary
   */
  public getTestSummary(testId: string): any {
    const events = this.getTestEvents(testId);
    const startEvent = events.find(e => e.type === AuditEventType.TEST_STARTED);
    const completeEvent = events.find(e => e.type === AuditEventType.TEST_COMPLETED);
    const outcomeEvent = events.find(e => e.type === AuditEventType.TEST_OUTCOME);
    
    return {
      testId,
      startEvent,
      completeEvent,
      outcomeEvent,
      totalEvents: events.length
    };
  }

  /**
   * Get all test outcomes (completed tests)
   */
  public getTestOutcomes(): any[] {
    const allEvents = this.auditService.getAllEvents();
    const completedTests = new Map<string, any>();
    
    // Find all test completion events
    allEvents.forEach(event => {
      if (event.type === AuditEventType.TEST_COMPLETED) {
        const testId = event.context.testId;
        if (!testId) return; // Skip if testId is undefined
        
        const testData = event.data;
        
        // Get all events for this test
        const testEvents = this.getTestEvents(testId);
        const decisions = testEvents.filter(e => e.type === AuditEventType.TEST_DECISION);
        
        completedTests.set(testId, {
          testId,
          testName: testData.testName,
          testSuite: testData.testSuite,
          status: testData.status,
          startTime: testData.startTime,
          endTime: testData.endTime,
          duration: testData.duration,
          summary: testData.summary,
          decisions: decisions.map(d => d.data),
          correlationId: event.context.correlationId
        });
      }
    });
    
    return Array.from(completedTests.values());
  }

  /**
   * Export test outcomes with filtering
   */
  public async exportTestOutcomes(filters?: {
    testSuite?: string;
    status?: string;
    testId?: string;
    startTime?: number;
    endTime?: number;
  }): Promise<any[]> {
    const allOutcomes = this.getTestOutcomes();
    
    return allOutcomes.filter(outcome => {
      if (filters?.testSuite && outcome.testSuite !== filters.testSuite) {
        return false;
      }
      if (filters?.status && outcome.status !== filters.status) {
        return false;
      }
      if (filters?.testId && outcome.testId !== filters.testId) {
        return false;
      }
      if (filters?.startTime && outcome.startTime < filters.startTime) {
        return false;
      }
      if (filters?.endTime && outcome.endTime > filters.endTime) {
        return false;
      }
      return true;
    });
  }

  private mapTestStatusToSeverity(status: string): AuditSeverity {
    switch (status) {
      case 'failed':
      case 'timeout':
        return AuditSeverity.HIGH;
      case 'skipped':
        return AuditSeverity.MEDIUM;
      case 'passed':
      default:
        return AuditSeverity.LOW;
    }
  }

  private mapDecisionTypeToSeverity(decisionType: string): AuditSeverity {
    switch (decisionType) {
      case 'abort':
        return AuditSeverity.HIGH;
      case 'retry':
      case 'modify':
        return AuditSeverity.MEDIUM;
      case 'skip':
      case 'continue':
      default:
        return AuditSeverity.LOW;
    }
  }

  private mapOutcomeToSeverity(outcome: string): AuditSeverity {
    switch (outcome) {
      case 'failure':
        return AuditSeverity.HIGH;
      case 'partial':
      case 'inconclusive':
        return AuditSeverity.MEDIUM;
      case 'success':
      default:
        return AuditSeverity.LOW;
    }
  }
} 