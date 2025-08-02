export enum AuditEventType {
  // Agent events
  AGENT_DECISION = 'agent_decision',
  AGENT_ACTION = 'agent_action',
  AGENT_REASONING = 'agent_reasoning',
  
  // Transaction events
  TRANSACTION_INITIATED = 'transaction_initiated',
  TRANSACTION_SENT = 'transaction_sent',
  TRANSACTION_COMPLETED = 'transaction_completed',
  TRANSACTION_FAILED = 'transaction_failed',
  TRANSACTION_TRACE = 'transaction_trace',
  
  // Test events
  TEST_STARTED = 'test_started',
  TEST_COMPLETED = 'test_completed',
  TEST_DECISION = 'test_decision',
  TEST_OUTCOME = 'test_outcome',
  
  // System events
  SYSTEM_EVENT = 'system_event',
  ERROR_EVENT = 'error_event',
  SECURITY_EVENT = 'security_event'
}

export enum AuditSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface AuditContext {
  correlationId?: string;
  agentId?: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  transactionId?: string;
  testId?: string;
  environment?: string;
  timestamp: number;
  source: string;
  metadata?: Record<string, any>;
}

export interface AuditEvent {
  id: string;
  type: AuditEventType;
  severity: AuditSeverity;
  message: string;
  context: AuditContext;
  data?: any;
  createdAt: number;
}

export interface AuditTrailOptions {
  enabled?: boolean;
  persistence?: 'memory' | 'file' ;
  retentionDays?: number;
  maxEvents?: number;
  includeMetadata?: boolean;
  correlationIdGenerator?: () => string;
}

// Additional types for audit trail queries and exports
export interface AuditTrailQuery {
  eventTypes?: AuditEventType[];
  timeRange?: {
    start: number;
    end: number;
  };
  filters?: Record<string, any>;
  limit?: number;
  offset?: number;
}

export interface AuditTrailExport {
  startTime: number;
  endTime: number;
  includeTransactions?: boolean;
  includeAgentDecisions?: boolean;
  includeTestOutcomes?: boolean;
  events: AuditEvent[];
  transactions?: any[];
  agentDecisions?: any[];
  testOutcomes?: any[];
}

export interface AuditReport {
  timeRange: {
    start: number;
    end: number;
  };
  metrics: {
    totalEvents: number;
    successRate: number;
    errorRate: number;
    averageResponseTime: number;
  };
  recommendations: string[];
  summary: string;
} 