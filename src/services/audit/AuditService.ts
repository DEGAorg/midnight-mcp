/**
 * Audit Service
 *
 * Wrapper around audit trail components for easy integration
 * Provides transaction tracing, agent decision logging, and audit trail management
 */

import {
  AuditTrailService,
  TransactionTraceLogger,
  AgentDecisionLogger
} from '../../audit/index.js';
import { createLogger } from '../../lib/logger/index.js';
import type { Logger } from 'pino';

/**
 * AuditService provides a unified interface to audit trail functionality
 */
export class AuditService {
  private logger: Logger;
  private auditTrail: AuditTrailService;
  private transactionLogger: TransactionTraceLogger;
  private agentLogger: AgentDecisionLogger;

  constructor() {
    this.logger = createLogger('audit-service');

    // Initialize audit trail components
    this.auditTrail = AuditTrailService.getInstance();
    this.transactionLogger = new TransactionTraceLogger(this.auditTrail);
    this.agentLogger = new AgentDecisionLogger(this.auditTrail);

    this.logger.info('Audit service initialized');
  }

  // ==================== CORRELATION IDS ====================

  /**
   * Generate a unique correlation ID for tracking operations across services
   *
   * @returns Correlation ID string
   */
  generateCorrelationId(): string {
    return this.auditTrail.generateCorrelationId();
  }

  // ==================== TRANSACTION TRACING ====================

  /**
   * Start a new transaction trace
   *
   * @param transactionId Unique transaction identifier
   * @param correlationId Correlation ID for cross-service tracking
   * @param context Initial context data
   */
  startTransactionTrace(
    transactionId: string,
    correlationId: string,
    context: Record<string, any>
  ): void {
    this.transactionLogger.startTrace(transactionId, correlationId, context);
  }

  /**
   * Add a step to an ongoing transaction trace
   *
   * @param transactionId Transaction identifier
   * @param stepName Name of the step (e.g., 'validate_funds', 'generate_proof')
   * @param component Component executing the step
   * @param data Step-specific data
   * @returns Step ID for later completion
   */
  addTransactionStep(
    transactionId: string,
    stepName: string,
    component: string,
    data: Record<string, any>
  ): string {
    return this.transactionLogger.addStep(transactionId, stepName, component, data);
  }

  /**
   * Complete a transaction step
   *
   * @param transactionId Transaction identifier
   * @param stepId Step ID (from addTransactionStep)
   * @param result Step result data
   * @param error Optional error if step failed
   */
  completeTransactionStep(
    transactionId: string,
    stepId: string,
    result?: Record<string, any>,
    error?: Error
  ): void {
    this.transactionLogger.completeStep(transactionId, stepId, result, error);
  }

  /**
   * Complete a transaction trace
   *
   * @param transactionId Transaction identifier
   * @param status Final status ('completed' | 'failed')
   * @param message Completion message
   * @param metadata Optional metadata
   */
  completeTransactionTrace(
    transactionId: string,
    status: 'completed' | 'failed',
    message: string,
    metadata?: Record<string, any>
  ): void {
    this.transactionLogger.completeTrace(transactionId, status, message, metadata);
  }

  /**
   * Log a transaction sent to blockchain
   *
   * @param transactionId Transaction identifier
   * @param txIdentifier Blockchain transaction identifier
   * @param correlationId Correlation ID
   */
  logTransactionSent(
    transactionId: string,
    txIdentifier: string,
    correlationId: string
  ): void {
    this.transactionLogger.logTransactionSent(transactionId, txIdentifier, correlationId);
  }

  /**
   * Log a transaction failure
   *
   * @param transactionId Transaction identifier
   * @param error Error that occurred
   * @param context Context data
   * @param correlationId Correlation ID
   */
  logTransactionFailure(
    transactionId: string,
    error: Error,
    context: Record<string, any>,
    correlationId: string
  ): void {
    this.transactionLogger.logTransactionFailure(transactionId, error, context, correlationId);
  }

  // ==================== AGENT DECISION LOGGING ====================

  /**
   * Log an agent decision related to a transaction
   *
   * @param agentId Agent identifier
   * @param transactionId Transaction identifier
   * @param decision Decision made ('approve' | 'reject' | 'defer')
   * @param reasoning Reasoning for the decision
   * @param amount Transaction amount
   * @param recipient Transaction recipient
   * @param correlationId Correlation ID
   */
  logAgentDecision(
    agentId: string,
    transactionId: string,
    decision: string,
    reasoning: string,
    amount: string,
    recipient: string,
    correlationId: string
  ): void {
    this.agentLogger.logTransactionDecision(
      agentId,
      transactionId,
      decision,
      reasoning,
      amount,
      recipient,
      correlationId
    );
  }

  // ==================== AUDIT TRAIL ACCESS ====================

  /**
   * Get the underlying audit trail service
   * For advanced operations not covered by this wrapper
   */
  getAuditTrail(): AuditTrailService {
    return this.auditTrail;
  }

  /**
   * Get the transaction logger
   * For advanced transaction tracing operations
   */
  getTransactionLogger(): TransactionTraceLogger {
    return this.transactionLogger;
  }

  /**
   * Get the agent logger
   * For advanced agent decision logging
   */
  getAgentLogger(): AgentDecisionLogger {
    return this.agentLogger;
  }
}
