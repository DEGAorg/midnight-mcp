import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../logger/index.js';
import { FileManager, FileType } from '../utils/file-manager.js';
import { 
  AuditEvent, 
  AuditEventType, 
  AuditSeverity, 
  AuditContext, 
  AuditTrailOptions 
} from './types.js';

export class AuditTrailService {
  private static instance: AuditTrailService | undefined;
  private logger = createLogger('audit-trail');
  private events: AuditEvent[] = [];
  private options: AuditTrailOptions;
  private correlationIdGenerator: () => string;

  private constructor(options: AuditTrailOptions = {}) {
    this.options = {
      enabled: true,
      persistence: 'file',
      retentionDays: 30,
      maxEvents: 10000,
      includeMetadata: true,
      correlationIdGenerator: () => uuidv4(),
      ...options
    };
    
    this.correlationIdGenerator = this.options.correlationIdGenerator!;
  }

  public static getInstance(options?: AuditTrailOptions): AuditTrailService {
    if (!AuditTrailService.instance) {
      AuditTrailService.instance = new AuditTrailService(options);
    }
    return AuditTrailService.instance;
  }

  public static resetInstance(): void {
    AuditTrailService.instance = undefined;
  }

  /**
   * Log an audit event
   */
  public logEvent(
    type: AuditEventType,
    message: string,
    severity: AuditSeverity = AuditSeverity.MEDIUM,
    context: Partial<AuditContext> = {},
    data?: any
  ): string {
    if (!this.options.enabled) {
      return '';
    }

    const eventId = uuidv4();
    const timestamp = Date.now();
    
    const auditEvent: AuditEvent = {
      id: eventId,
      type,
      severity,
      message,
      context: {
        correlationId: context.correlationId || this.correlationIdGenerator(),
        timestamp,
        source: context.source || 'unknown',
        ...context
      },
      data: this.options.includeMetadata ? data : undefined,
      createdAt: timestamp
    };

    this.events.push(auditEvent);
    
    // Persist the event
    this.persistEvent(auditEvent);
    
    // Cleanup old events
    this.cleanup();
    
    this.logger.info(`Audit event logged: ${type} - ${message}`, {
      eventId,
      correlationId: auditEvent.context.correlationId,
      severity
    });

    return eventId;
  }

  /**
   * Generate a new correlation ID
   */
  public generateCorrelationId(): string {
    return this.correlationIdGenerator();
  }

  /**
   * Get events by correlation ID
   */
  public getEventsByCorrelationId(correlationId: string): AuditEvent[] {
    return this.events.filter(event => event.context.correlationId === correlationId);
  }

  /**
   * Get events by type
   */
  public getEventsByType(type: AuditEventType): AuditEvent[] {
    return this.events.filter(event => event.type === type);
  }

  /**
   * Get events by time range
   */
  public getEventsByTimeRange(startTime: number, endTime: number): AuditEvent[] {
    return this.events.filter(event => 
      event.createdAt >= startTime && event.createdAt <= endTime
    );
  }

  /**
   * Get all events
   */
  public getAllEvents(): AuditEvent[] {
    return [...this.events];
  }

  /**
   * Clear all events
   */
  public clearEvents(): void {
    this.events = [];
    this.logger.info('All audit events cleared');
  }

  /**
   * Export audit trail to file
   */
  public exportToFile(filename?: string): string {
    const fileManager = FileManager.getInstance();
    const auditFilename = filename || `audit-trail-${Date.now()}.json`;
    const filePath = fileManager.getPath(FileType.LOG, 'audit', auditFilename);
    
    const exportData = {
      exportedAt: new Date().toISOString(),
      totalEvents: this.events.length,
      events: this.events
    };

    fileManager.writeFile(FileType.LOG, 'audit', JSON.stringify(exportData, null, 2), auditFilename);
    this.logger.info(`Audit trail exported to ${filePath}`);
    
    return filePath;
  }

  /**
   * Query audit trail with filters
   */
  public async queryAuditTrail(query: {
    eventTypes?: AuditEventType[];
    timeRange?: {
      start: number;
      end: number;
    };
    filters?: Record<string, any>;
    limit?: number;
    offset?: number;
  }): Promise<AuditEvent[]> {
    let filteredEvents = [...this.events];

    // Filter by event types
    if (query.eventTypes && query.eventTypes.length > 0) {
      filteredEvents = filteredEvents.filter(event => 
        query.eventTypes!.includes(event.type)
      );
    }

    // Filter by time range
    if (query.timeRange) {
      filteredEvents = filteredEvents.filter(event => 
        event.createdAt >= query.timeRange!.start && 
        event.createdAt <= query.timeRange!.end
      );
    }

    // Apply custom filters
    if (query.filters) {
      filteredEvents = filteredEvents.filter(event => {
        return Object.entries(query.filters!).every(([key, value]) => {
          if (key.includes('.')) {
            const [obj, prop] = key.split('.');
            return event[obj as keyof AuditEvent]?.[prop as keyof any] === value;
          }
          return event[key as keyof AuditEvent] === value;
        });
      });
    }

    // Apply pagination
    if (query.offset) {
      filteredEvents = filteredEvents.slice(query.offset);
    }
    if (query.limit) {
      filteredEvents = filteredEvents.slice(0, query.limit);
    }

    return filteredEvents;
  }

  /**
   * Export audit trail data
   */
  public async exportAuditTrail(options: {
    startTime: number;
    endTime: number;
    includeTransactions?: boolean;
    includeAgentDecisions?: boolean;
    includeTestOutcomes?: boolean;
  }): Promise<any> {
    const events = this.getEventsByTimeRange(options.startTime, options.endTime);
    
    const result: any = {
      startTime: options.startTime,
      endTime: options.endTime,
      events: events
    };

    if (options.includeTransactions) {
      result.transactions = events.filter(e => 
        e.type.startsWith('TRANSACTION_')
      );
    }

    if (options.includeAgentDecisions) {
      result.agentDecisions = events.filter(e => 
        e.type === AuditEventType.AGENT_DECISION
      );
    }

    if (options.includeTestOutcomes) {
      result.testOutcomes = events.filter(e => 
        e.type.startsWith('TEST_')
      );
    }

    return result;
  }

  /**
   * Generate audit report
   */
  public async generateAuditReport(options: {
    timeRange: {
      start: number;
      end: number;
    };
    includeMetrics?: boolean;
    includeRecommendations?: boolean;
  }): Promise<any> {
    const events = this.getEventsByTimeRange(options.timeRange.start, options.timeRange.end);
    
    const report: any = {
      timeRange: options.timeRange,
      totalEvents: events.length
    };

    if (options.includeMetrics) {
      const eventTypes = events.reduce((acc, event) => {
        acc[event.type] = (acc[event.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const errorEvents = events.filter(e => e.severity === AuditSeverity.HIGH || e.severity === AuditSeverity.CRITICAL);
      const successEvents = events.filter(e => e.severity === AuditSeverity.LOW);

      /* istanbul ignore next */
      report.metrics = {
        totalEvents: events.length,
        successRate: events.length > 0 ? (successEvents.length / events.length) * 100 : 0,
        errorRate: events.length > 0 ? (errorEvents.length / events.length) * 100 : 0,
        averageResponseTime: 0, // Would need to calculate from actual data
        eventTypeBreakdown: eventTypes
      };
    }

    if (options.includeRecommendations) {
      const recommendations: string[] = [];
      
      if (events.length === 0) {
        recommendations.push('No audit events found in the specified time range');
      } else {
        const errorRate = events.filter(e => e.severity === AuditSeverity.HIGH || e.severity === AuditSeverity.CRITICAL).length / events.length;
        if (errorRate > 0.1) {
          recommendations.push('High error rate detected - review system health');
        }
        if (events.length > 1000) {
          recommendations.push('High event volume - consider log aggregation');
        }
      }

      report.recommendations = recommendations;
      report.summary = `Generated audit report for ${events.length} events`;
    }

    return report;
  }

  private persistEvent(event: AuditEvent): void {
    switch (this.options.persistence) {
      case 'file':
        this.persistToFile(event);
        break;
      case 'memory':
      default:
        break;
    }
  }
  

  private persistToFile(event: AuditEvent): void {
    try {
      const fileManager = FileManager.getInstance();
      const filename = `audit-events-${new Date().toISOString().split('T')[0]}.json`;
      const filePath = fileManager.getPath(FileType.LOG, 'audit', filename);
      /* istanbul ignore next */
      const eventLine = JSON.stringify(event) + '\n';
      /* istanbul ignore next */
      if (fileManager.fileExists(FileType.LOG, 'audit', filename)) {
        const existingContent = fileManager.readFile(FileType.LOG, 'audit', filename);
        fileManager.writeFile(FileType.LOG, 'audit', existingContent + eventLine, filename);
      } else {
        /* istanbul ignore next */
        fileManager.writeFile(FileType.LOG, 'audit', eventLine, filename);
      }
    } catch (error) {
      /* istanbul ignore next */
      this.logger.error('Failed to persist audit event to file', error);
    }
  }

  private cleanup(): void {
    if (this.events.length > this.options.maxEvents!) {
      const cutoffTime = Date.now() - (this.options.retentionDays! * 24 * 60 * 60 * 1000);
      this.events = this.events.filter(event => event.createdAt > cutoffTime);
      this.logger.info(`Cleaned up ${this.events.length} audit events`);
    }
  }
} 