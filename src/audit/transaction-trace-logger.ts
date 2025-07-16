import { AuditTrailService } from './audit-trail-service.js';
import { AuditEventType, AuditSeverity } from './types.js';
import { createLogger } from '../logger/index.js';

export interface TransactionTrace {
  transactionId: string;
  correlationId: string;
  startTime: number;
  endTime?: number;
  status: 'initiated' | 'processing' | 'completed' | 'failed' | 'cancelled';
  steps: TransactionStep[];
  metadata?: Record<string, any>;
}

export interface TransactionStep {
  stepId: string;
  stepName: string;
  component: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'started' | 'completed' | 'failed' | 'skipped';
  input?: any;
  output?: any;
  error?: Error;
  metadata?: Record<string, any>;
}

export interface TransactionContext {
  transactionId: string;
  correlationId: string;
  agentId?: string;
  userId?: string;
  sessionId?: string;
  source: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export class TransactionTraceLogger {
  private auditService: AuditTrailService;
  private logger = createLogger('transaction-trace');
  private activeTraces: Map<string, TransactionTrace> = new Map();

  constructor(auditService?: AuditTrailService) {
    this.auditService = auditService || AuditTrailService.getInstance();
  }

  /**
   * Start tracing a transaction
   */
  public startTrace(
    transactionId: string,
    correlationId?: string,
    metadata?: Record<string, any>
  ): string {
    const traceCorrelationId = correlationId || this.auditService.generateCorrelationId();
    const startTime = Date.now();
    
    const trace: TransactionTrace = {
      transactionId,
      correlationId: traceCorrelationId,
      startTime,
      status: 'initiated',
      steps: [],
      metadata
    };
    
    this.activeTraces.set(transactionId, trace);
    
    const message = `Transaction trace started: ${transactionId}`;
    
    const eventId = this.auditService.logEvent(
      AuditEventType.TRANSACTION_INITIATED,
      message,
      AuditSeverity.MEDIUM,
      {
        correlationId: traceCorrelationId,
        transactionId,
        source: 'transaction-trace-logger'
      },
      {
        startTime,
        metadata
      }
    );

    this.logger.info(`Transaction trace started: ${transactionId}`, {
      eventId,
      correlationId: traceCorrelationId,
      transactionId
    });

    return eventId;
  }

  /**
   * Add a step to the transaction trace
   */
  public addStep(
    transactionId: string,
    stepName: string,
    component: string,
    input?: any,
    metadata?: Record<string, any>
  ): string {
    const trace = this.activeTraces.get(transactionId);
    if (!trace) {
      throw new Error(`Transaction trace ${transactionId} not found`);
    }

    const stepId = `${component}-${stepName}-${Date.now()}`;
    const startTime = Date.now();
    
    const step: TransactionStep = {
      stepId,
      stepName,
      component,
      startTime,
      status: 'started',
      input,
      metadata
    };
    
    trace.steps.push(step);
    trace.status = 'processing';
    
    const message = `Transaction step started: ${stepName} (${component})`;
    
    const eventId = this.auditService.logEvent(
      AuditEventType.TRANSACTION_TRACE,
      message,
      AuditSeverity.LOW,
      {
        correlationId: trace.correlationId,
        transactionId,
        source: 'transaction-trace-logger'
      },
      {
        stepId,
        stepName,
        component,
        startTime,
        input,
        metadata
      }
    );

    this.logger.debug(`Transaction step started: ${stepName}`, {
      eventId,
      correlationId: trace.correlationId,
      transactionId,
      stepId
    });

    return stepId;
  }

  /**
   * Complete a transaction step
   */
  public completeStep(
    transactionId: string,
    stepId: string,
    output?: any,
    error?: Error
  ): void {
    const trace = this.activeTraces.get(transactionId);
    if (!trace) {
      throw new Error(`Transaction trace ${transactionId} not found`);
    }

    const step = trace.steps.find(s => s.stepId === stepId);
    if (!step) {
      throw new Error(`Step ${stepId} not found in transaction ${transactionId}`);
    }

    const endTime = Date.now();
    const duration = endTime - step.startTime;
    
    step.endTime = endTime;
    step.duration = duration;
    step.output = output;
    step.error = error;
    step.status = error ? 'failed' : 'completed';
    
    const message = `Transaction step completed: ${step.stepName} (${step.component})`;
    const severity = error ? AuditSeverity.HIGH : AuditSeverity.LOW;
    
    const eventId = this.auditService.logEvent(
      AuditEventType.TRANSACTION_TRACE,
      message,
      severity,
      {
        correlationId: trace.correlationId,
        transactionId,
        source: 'transaction-trace-logger'
      },
      {
        stepId,
        stepName: step.stepName,
        component: step.component,
        endTime,
        duration,
        output,
        error: error ? {
          name: error.name,
          message: error.message,
          stack: error.stack
        } : undefined
      }
    );

    this.logger.debug(`Transaction step completed: ${step.stepName}`, {
      eventId,
      correlationId: trace.correlationId,
      transactionId,
      stepId,
      duration,
      hasError: !!error
    });
  }

  /**
   * Complete a transaction trace
   */
  public completeTrace(
    transactionId: string,
    status: 'completed' | 'failed' | 'cancelled',
    summary?: string,
    metadata?: Record<string, any>
  ): string {
    const trace = this.activeTraces.get(transactionId);
    if (!trace) {
      throw new Error(`Transaction trace ${transactionId} not found`);
    }

    const endTime = Date.now();
    const totalDuration = endTime - trace.startTime;
    
    trace.endTime = endTime;
    trace.status = status;
    if (metadata) {
      trace.metadata = { ...trace.metadata, ...metadata };
    }
    
    this.activeTraces.delete(transactionId);
    
    const message = `Transaction trace completed: ${transactionId} - ${status}`;
    const severity = this.mapTransactionStatusToSeverity(status);
    
    const eventId = this.auditService.logEvent(
      this.mapStatusToEventType(status),
      message,
      severity,
      {
        correlationId: trace.correlationId,
        transactionId,
        source: 'transaction-trace-logger'
      },
      {
        status,
        startTime: trace.startTime,
        endTime,
        totalDuration,
        totalSteps: trace.steps.length,
        summary,
        metadata: trace.metadata,
        steps: trace.steps
      }
    );

    this.logger.info(`Transaction trace completed: ${transactionId} - ${status}`, {
      eventId,
      correlationId: trace.correlationId,
      transactionId,
      totalDuration,
      totalSteps: trace.steps.length
    });

    return eventId;
  }

  /**
   * Log transaction sent to blockchain
   */
  public logTransactionSent(
    transactionId: string,
    txIdentifier: string,
    correlationId?: string
  ): string {
    const message = `Transaction sent to blockchain: ${transactionId} - ${txIdentifier}`;
    
    const eventId = this.auditService.logEvent(
      AuditEventType.TRANSACTION_SENT,
      message,
      AuditSeverity.MEDIUM,
      {
        correlationId,
        transactionId,
        source: 'transaction-trace-logger'
      },
      {
        transactionId,
        txIdentifier,
        timestamp: Date.now()
      }
    );

    this.logger.info(`Transaction sent to blockchain: ${transactionId}`, {
      eventId,
      correlationId,
      transactionId,
      txIdentifier
    });

    return eventId;
  }

  /**
   * Log transaction failure
   */
  public logTransactionFailure(
    transactionId: string,
    error: Error,
    context?: any,
    correlationId?: string
  ): string {
    const message = `Transaction failed: ${transactionId} - ${error.message}`;
    
    const eventId = this.auditService.logEvent(
      AuditEventType.TRANSACTION_FAILED,
      message,
      AuditSeverity.HIGH,
      {
        correlationId,
        transactionId,
        source: 'transaction-trace-logger'
      },
      {
        transactionId,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        },
        context,
        timestamp: Date.now()
      }
    );

    this.logger.error(`Transaction failed: ${transactionId}`, {
      eventId,
      correlationId,
      transactionId,
      error: error.message
    });

    return eventId;
  }

  /**
   * Get transaction trace by ID
   */
  public getTransactionTrace(transactionId: string): TransactionTrace | undefined {
    return this.activeTraces.get(transactionId);
  }

  /**
   * Get all transaction events for a correlation ID
   */
  public getTransactionEvents(correlationId: string): any[] {
    const allEvents = this.auditService.getAllEvents();
    return allEvents.filter(event =>
      event.context &&
      event.context.correlationId === correlationId &&
      typeof event.type === 'string' &&
      event.type.startsWith('transaction_')
    );
  }

  /**
   * Get transaction trace summary
   */
  public getTransactionSummary(transactionId: string): any {
    const trace = this.getTransactionTrace(transactionId);
    if (!trace) {
      return null;
    }

    const events = this.getTransactionEvents(trace.correlationId);
    const completedSteps = trace.steps.filter(s => s.status === 'completed');
    const failedSteps = trace.steps.filter(s => s.status === 'failed');
    
    return {
      transactionId,
      correlationId: trace.correlationId,
      status: trace.status,
      startTime: trace.startTime,
      endTime: trace.endTime,
      totalDuration: trace.endTime ? trace.endTime - trace.startTime : undefined,
      totalSteps: trace.steps.length,
      completedSteps: completedSteps.length,
      failedSteps: failedSteps.length,
      totalEvents: events.length,
      steps: trace.steps,
      metadata: trace.metadata
    };
  }

  /**
   * Get all active transaction traces
   */
  public getActiveTraces(): TransactionTrace[] {
    return Array.from(this.activeTraces.values());
  }

  /**
   * Get all transaction traces (including completed ones)
   */
  public getTraces(): any[] {
    const allEvents = this.auditService.getAllEvents();
    const completedTraces = new Map<string, any>();
    
    // Find all transaction completion events
    allEvents.forEach(event => {
      if (event.type === AuditEventType.TRANSACTION_COMPLETED || 
          event.type === AuditEventType.TRANSACTION_FAILED) {
        const transactionId = event.context.transactionId;
        if (!transactionId) return; // Skip if transactionId is undefined
        const traceData = event.data;
        
        completedTraces.set(transactionId, {
          transactionId,
          status: traceData.status,
          startTime: traceData.startTime,
          endTime: traceData.endTime,
          totalDuration: traceData.totalDuration,
          totalSteps: traceData.totalSteps,
          summary: traceData.summary,
          metadata: traceData.metadata,
          steps: traceData.steps,
          correlationId: event.context.correlationId
        });
      }
    });
    
    return Array.from(completedTraces.values());
  }

  /**
   * Export transaction traces with filtering
   */
  public async exportTraces(filters?: {
    status?: string;
    startTime?: number;
    endTime?: number;
    transactionId?: string;
  }): Promise<any[]> {
    const allTraces = this.getTraces();
    
    return allTraces.filter(trace => {
      if (filters?.status && trace.status !== filters.status) {
        return false;
      }
      if (filters?.startTime && trace.startTime < filters.startTime) {
        return false;
      }
      if (filters?.endTime && trace.endTime > filters.endTime) {
        return false;
      }
      if (filters?.transactionId && trace.transactionId !== filters.transactionId) {
        return false;
      }
      return true;
    });
  }

  private mapTransactionStatusToSeverity(status: string): AuditSeverity {
    switch (status) {
      case 'failed':
        return AuditSeverity.HIGH;
      case 'cancelled':
        return AuditSeverity.MEDIUM;
      case 'completed':
      default:
        return AuditSeverity.LOW;
    }
  }

  private mapStatusToEventType(status: string): AuditEventType {
    switch (status) {
      case 'completed':
        return AuditEventType.TRANSACTION_COMPLETED;
      case 'failed':
        return AuditEventType.TRANSACTION_FAILED;
      case 'cancelled':
        return AuditEventType.TRANSACTION_FAILED; // Treat cancelled as failed for audit purposes
      default:
        return AuditEventType.TRANSACTION_TRACE;
    }
  }
} 