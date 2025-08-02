import { AuditTrailService } from './audit-trail-service.js';
import { AuditEventType, AuditSeverity } from './types.js';
import { createLogger } from '../logger/index.js';

export interface AgentDecision {
  agentId: string;
  decisionType: 'transaction' | 'validation' | 'recovery' | 'configuration' | 'custom';
  input: any;
  reasoning: string;
  confidence?: number;
  alternatives?: any[];
  selectedAction: any;
  expectedOutcome?: string;
  riskAssessment?: 'low' | 'medium' | 'high';
}

export interface AgentAction {
  agentId: string;
  actionType: string;
  target: string;
  parameters: Record<string, any>;
  timestamp: number;
  correlationId?: string;
}

export interface AgentReasoning {
  agentId: string;
  context: string;
  analysis: string;
  factors: string[];
  conclusion: string;
  confidence: number;
}

export class AgentDecisionLogger {
  private auditService: AuditTrailService;
  private logger = createLogger('agent-decision');

  constructor(auditService?: AuditTrailService) {
    this.auditService = auditService || AuditTrailService.getInstance();
  }

  /**
   * Log an agent decision
   */
  public logDecision(decision: AgentDecision, correlationId?: string): string {
    const message = `Agent ${decision.agentId} made ${decision.decisionType} decision`;
    
    const severity = this.mapDecisionToSeverity(decision);
    
    const eventId = this.auditService.logEvent(
      AuditEventType.AGENT_DECISION,
      message,
      severity,
      {
        correlationId,
        agentId: decision.agentId,
        source: 'agent-decision-logger'
      },
      {
        agentId: decision.agentId,
        decisionType: decision.decisionType,
        input: decision.input,
        reasoning: decision.reasoning,
        confidence: decision.confidence,
        alternatives: decision.alternatives,
        selectedAction: decision.selectedAction,
        expectedOutcome: decision.expectedOutcome,
        riskAssessment: decision.riskAssessment
      }
    );

    this.logger.info(`Agent decision logged: ${decision.agentId} - ${decision.decisionType}`, {
      eventId,
      correlationId,
      confidence: decision.confidence,
      riskAssessment: decision.riskAssessment
    });

    return eventId;
  }

  /**
   * Log an agent action
   */
  public logAction(action: AgentAction): string {
    const message = `Agent ${action.agentId} performed ${action.actionType} on ${action.target}`;
    
    const eventId = this.auditService.logEvent(
      AuditEventType.AGENT_ACTION,
      message,
      AuditSeverity.MEDIUM,
      {
        correlationId: action.correlationId,
        agentId: action.agentId,
        source: 'agent-decision-logger'
      },
      {
        actionType: action.actionType,
        target: action.target,
        parameters: action.parameters,
        timestamp: action.timestamp
      }
    );

    this.logger.info(`Agent action logged: ${action.agentId} - ${action.actionType}`, {
      eventId,
      correlationId: action.correlationId,
      target: action.target
    });

    return eventId;
  }

  /**
   * Log agent reasoning process
   */
  public logReasoning(reasoning: AgentReasoning, correlationId?: string): string {
    const message = `Agent ${reasoning.agentId} analyzed context: ${reasoning.context}`;
    
    const severity = this.mapConfidenceToSeverity(reasoning.confidence);
    
    const eventId = this.auditService.logEvent(
      AuditEventType.AGENT_REASONING,
      message,
      severity,
      {
        correlationId,
        agentId: reasoning.agentId,
        source: 'agent-decision-logger'
      },
      {
        context: reasoning.context,
        analysis: reasoning.analysis,
        factors: reasoning.factors,
        conclusion: reasoning.conclusion,
        confidence: reasoning.confidence
      }
    );

    this.logger.info(`Agent reasoning logged: ${reasoning.agentId} - confidence: ${reasoning.confidence}`, {
      eventId,
      correlationId,
      confidence: reasoning.confidence
    });

    return eventId;
  }

  /**
   * Log a transaction decision specifically
   */
  public logTransactionDecision(
    agentId: string,
    transactionId: string,
    decision: 'approve' | 'reject' | 'hold',
    reasoning: string,
    amount?: string,
    recipient?: string,
    correlationId?: string
  ): string {
    const decisionData: AgentDecision = {
      agentId,
      decisionType: 'transaction',
      input: { transactionId, amount, recipient },
      reasoning,
      selectedAction: decision,
      expectedOutcome: decision === 'approve' ? 'Transaction will be processed' : 'Transaction will be blocked',
      riskAssessment: decision === 'approve' ? 'medium' : 'low'
    };

    return this.logDecision(decisionData, correlationId);
  }

  /**
   * Log a recovery decision
   */
  public logRecoveryDecision(
    agentId: string,
    recoveryType: string,
    reasoning: string,
    actions: string[],
    correlationId?: string
  ): string {
    const decisionData: AgentDecision = {
      agentId,
      decisionType: 'recovery',
      input: { recoveryType },
      reasoning,
      selectedAction: actions,
      expectedOutcome: 'System recovery',
      riskAssessment: 'high'
    };

    return this.logDecision(decisionData, correlationId);
  }

  /**
   * Get all decisions for a specific agent
   */
  public getAgentDecisions(agentId: string): any[] {
    const events = this.auditService.getEventsByType(AuditEventType.AGENT_DECISION);
    return events.filter(event => event.context.agentId === agentId);
  }

  /**
   * Get all actions for a specific agent
   */
  public getAgentActions(agentId: string): any[] {
    const events = this.auditService.getEventsByType(AuditEventType.AGENT_ACTION);
    return events.filter(event => event.context.agentId === agentId);
  }

  /**
   * Get decision history for a correlation ID
   */
  public getDecisionHistory(correlationId: string): any[] {
    return this.auditService.getEventsByCorrelationId(correlationId);
  }

  /**
   * Export agent decisions with filtering
   */
  public async exportDecisions(filters?: {
    agentId?: string;
    decisionType?: string;
    startTime?: number;
    endTime?: number;
  }): Promise<any[]> {
    const allEvents = this.auditService.getEventsByType(AuditEventType.AGENT_DECISION);
    
    return allEvents.filter(event => {
      if (filters?.agentId && event.context.agentId !== filters.agentId) {
        return false;
      }
      if (filters?.decisionType && (!event.data || event.data.decisionType !== filters.decisionType)) {
        return false;
      }
      if (filters?.startTime && event.createdAt < filters.startTime) {
        return false;
      }
      if (filters?.endTime && event.createdAt > filters.endTime) {
        return false;
      }
      return true;
    }).map(event => ({
      agentId: event.context.agentId,
      decisionType: event.data?.decisionType,
      reasoning: event.data?.reasoning,
      selectedAction: event.data?.selectedAction,
      confidence: event.data?.confidence,
      timestamp: event.createdAt,
      correlationId: event.context.correlationId
    }));
  }

  private mapDecisionToSeverity(decision: AgentDecision): AuditSeverity {
    if (decision.riskAssessment === 'high') return AuditSeverity.HIGH;
    if (decision.riskAssessment === 'medium') return AuditSeverity.MEDIUM;
    if (decision.decisionType === 'transaction') return AuditSeverity.MEDIUM;
    return AuditSeverity.LOW;
  }

  private mapConfidenceToSeverity(confidence: number): AuditSeverity {
    if (confidence < 0.5) return AuditSeverity.HIGH;
    if (confidence < 0.8) return AuditSeverity.MEDIUM;
    return AuditSeverity.LOW;
  }
} 