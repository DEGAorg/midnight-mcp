/* istanbul ignore file */

/**
 * Comprehensive Integration Example
 * 
 * This file demonstrates how to integrate all audit trail components
 * with wallet operations and testing scenarios.
 */

import { 
  AuditTrailService, 
  TransactionTraceLogger, 
  AgentDecisionLogger, 
  TestOutcomeAuditor 
} from './index.js';
import { WalletManager } from '../wallet/index.js';
import { NetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { AuditEventType } from './types.js';

/**
 * Example class demonstrating comprehensive audit trail integration
 */
export class AuditIntegrationExample {
  private auditService: AuditTrailService;
  private transactionLogger: TransactionTraceLogger;
  private agentLogger: AgentDecisionLogger;
  private testAuditor: TestOutcomeAuditor;
  private walletManager: WalletManager;

  constructor() {
    // Initialize all audit trail components
    this.auditService = AuditTrailService.getInstance();
    this.transactionLogger = new TransactionTraceLogger(this.auditService);
    this.agentLogger = new AgentDecisionLogger(this.auditService);
    this.testAuditor = new TestOutcomeAuditor(this.auditService);

    // Initialize wallet manager with audit trail integration
    this.walletManager = new WalletManager(
      NetworkId.TestNet,
      'test-seed-123',
      'audit-demo-wallet',
      { 
        useExternalProofServer: true,
        indexer: 'https://indexer.testnet-02.midnight.network/api/v1/graphql',
        indexerWS: 'wss://indexer.testnet-02.midnight.network/api/v1/graphql/ws',
        node: 'https://rpc.testnet-02.midnight.network',
        proofServer: 'http://127.0.0.1:6300'
      }
    );
  }

  /**
   * Example: Complete transaction workflow with full audit trail
   */
  async runCompleteTransactionWorkflow() {
    const correlationId = this.auditService.generateCorrelationId();
    const testId = this.testAuditor.startTest({
      testId: `complete-workflow-${Date.now()}`,
      testName: 'Complete Transaction Workflow',
      testSuite: 'Integration',
      environment: 'demo',
      startTime: Date.now(),
      status: 'running'
    });

    let transactionId = `tx-${Date.now()}`;

    try {
      // Step 1: Agent decision to initiate transaction
      this.agentLogger.logTransactionDecision(
        'demo-agent',
        'workflow-init',
        'approve',
        'Starting complete transaction workflow',
        '1.0',
        'demo-recipient',
        correlationId
      );

      // Step 2: Start transaction trace
      this.transactionLogger.startTrace(transactionId, correlationId, {
        amount: '1.0',
        recipient: 'demo-recipient',
        agentId: 'demo-agent',
        operation: 'completeWorkflow'
      });

      // Step 3: Log test decision
      this.testAuditor.logTestDecision({
        testId,
        decisionType: 'continue',
        reasoning: 'Workflow initiated successfully',
        confidence: 0.95,
        selectedAction: 'proceed',
        timestamp: Date.now()
      });

      // Step 4: Simulate wallet operation (in real scenario, this would be actual wallet call)
      const walletStepId = this.transactionLogger.addStep(
        transactionId,
        'wallet_operation',
        'wallet-manager',
        { operation: 'sendFunds', amount: '1.0' }
      );

      // Simulate wallet processing
      await this.simulateWalletOperation();

      // Complete wallet step
      this.transactionLogger.completeStep(transactionId, walletStepId, {
        success: true,
        txHash: 'simulated-tx-hash-123'
      });

      // Step 5: Log transaction sent
      this.transactionLogger.logTransactionSent(transactionId, 'simulated-tx-hash-123', correlationId);

      // Step 6: Complete transaction trace
      this.transactionLogger.completeTrace(transactionId, 'completed', 'Workflow completed successfully', {
        txHash: 'simulated-tx-hash-123',
        finalStatus: 'success'
      });

      // Step 7: Complete test
      this.testAuditor.completeTest(testId, 'passed', 'Complete workflow executed successfully');

      console.log('✅ Complete transaction workflow executed with full audit trail');

    } catch (error) {
      // Log failure in audit trail
      this.transactionLogger.logTransactionFailure(transactionId, error as Error, {
        amount: '1.0',
        recipient: 'demo-recipient',
        agentId: 'demo-agent'
      }, correlationId);

      this.testAuditor.completeTest(testId, 'failed', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Example: Test scenario with multiple decision points
   */
  async runTestScenarioWithDecisions() {
    const testId = this.testAuditor.startTest({
      testId: `test-scenario-${Date.now()}`,
      testName: 'Test Scenario with Multiple Decisions',
      testSuite: 'Integration',
      environment: 'demo',
      startTime: Date.now(),
      status: 'running'
    });

    try {
      // Decision point 1: Should we proceed with the test?
      this.testAuditor.logTestDecision({
        testId,
        decisionType: 'continue',
        reasoning: 'Initial test validation passed',
        confidence: 0.8,
        selectedAction: 'proceed',
        timestamp: Date.now()
      });

      // Decision point 2: Which test path to take?
      this.testAuditor.logTestDecision({
        testId,
        decisionType: 'modify',
        reasoning: 'Selecting high-value transaction path',
        confidence: 0.9,
        selectedAction: 'high_value_path',
        timestamp: Date.now()
      });

      // Decision point 3: Risk assessment
      this.testAuditor.logTestDecision({
        testId,
        decisionType: 'continue',
        reasoning: 'Risk level acceptable for test scenario',
        confidence: 0.85,
        selectedAction: 'proceed_with_caution',
        timestamp: Date.now()
      });

      // Simulate test execution
      await this.simulateTestExecution();

      // Decision point 4: Final validation
      this.testAuditor.logTestDecision({
        testId,
        decisionType: 'continue',
        reasoning: 'All test criteria met successfully',
        confidence: 0.95,
        selectedAction: 'complete',
        timestamp: Date.now()
      });

      this.testAuditor.completeTest(testId, 'passed', 'Test scenario completed with all decisions logged');

      console.log('✅ Test scenario completed with multiple decision points tracked');

    } catch (error) {
      this.testAuditor.completeTest(testId, 'failed', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Example: Agent decision workflow
   */
  async runAgentDecisionWorkflow() {
    const correlationId = this.auditService.generateCorrelationId();

    // Decision 1: Transaction approval
    this.agentLogger.logTransactionDecision(
      'smart-agent-1',
      'tx-approval-1',
      'approve',
      'Transaction meets all security criteria',
      '5.0',
      'recipient-123',
      correlationId
    );

    // Decision 2: Risk assessment
    this.agentLogger.logTransactionDecision(
      'risk-agent-1',
      'risk-assessment-1',
      'approve',
      'Risk level: LOW - Transaction amount within limits',
      '5.0',
      'recipient-123',
      correlationId
    );

    // Decision 3: Compliance check
    this.agentLogger.logTransactionDecision(
      'compliance-agent-1',
      'compliance-check-1',
      'approve',
      'Transaction complies with all regulatory requirements',
      '5.0',
      'recipient-123',
      correlationId
    );

    // Decision 4: Final execution decision
    this.agentLogger.logTransactionDecision(
      'execution-agent-1',
      'execution-decision-1',
      'approve',
      'All checks passed - proceeding with transaction execution',
      '5.0',
      'recipient-123',
      correlationId
    );

    console.log('✅ Agent decision workflow completed with full audit trail');
  }

  /**
   * Example: Export audit trail data
   */
  async exportAuditTrailData() {
    try {
      // Export all audit trail data
      const auditData = await this.auditService.exportAuditTrail({
        startTime: Date.now() - (24 * 60 * 60 * 1000), // Last 24 hours
        endTime: Date.now(),
        includeTransactions: true,
        includeAgentDecisions: true,
        includeTestOutcomes: true
      });

      console.log('📊 Audit trail data exported:', {
        totalEvents: auditData.events.length,
        transactions: auditData.transactions.length,
        agentDecisions: auditData.agentDecisions.length,
        testOutcomes: auditData.testOutcomes.length
      });

      // Export specific transaction traces
      const transactionTraces = await this.transactionLogger.exportTraces({
        startTime: Date.now() - (60 * 60 * 1000), // Last hour
        status: 'completed'
      });

      console.log('📈 Transaction traces exported:', transactionTraces.length);

      // Export agent decisions
      const agentDecisions = await this.agentLogger.exportDecisions({
        agentId: 'demo-agent',
        decisionType: 'approve'
      });

      console.log('🤖 Agent decisions exported:', agentDecisions.length);

      // Export test outcomes
      const testOutcomes = await this.testAuditor.exportTestOutcomes({
        testSuite: 'Integration',
        status: 'passed'
      });

      console.log('🧪 Test outcomes exported:', testOutcomes.length);

    } catch (error) {
      console.error('❌ Error exporting audit trail data:', error);
      throw error;
    }
  }

  /**
   * Example: Query and analyze audit trail
   */
  async analyzeAuditTrail() {
    try {
      // Query recent transactions
      const recentTransactions = await this.auditService.queryAuditTrail({
        eventTypes: [AuditEventType.TRANSACTION_INITIATED, AuditEventType.TRANSACTION_COMPLETED],
        timeRange: {
          start: Date.now() - (60 * 60 * 1000), // Last hour
          end: Date.now()
        }
      });

      console.log('🔍 Recent transactions found:', recentTransactions.length);

      // Query agent decisions by type
      const approvalDecisions = await this.auditService.queryAuditTrail({
        eventTypes: [AuditEventType.AGENT_DECISION],
        filters: {
          'decisionType': 'approve'
        }
      });

      console.log('✅ Approval decisions found:', approvalDecisions.length);

      // Query failed tests
      const failedTests = await this.auditService.queryAuditTrail({
        eventTypes: [AuditEventType.TEST_STARTED, AuditEventType.TEST_COMPLETED],
        filters: {
          'status': 'failed'
        }
      });

      console.log('❌ Failed tests found:', failedTests.length);

      // Generate audit report
      const report = await this.auditService.generateAuditReport({
        timeRange: {
          start: Date.now() - (24 * 60 * 60 * 1000), // Last 24 hours
          end: Date.now()
        },
        includeMetrics: true,
        includeRecommendations: true
      });

      console.log('📋 Audit report generated:', {
        totalEvents: report.metrics.totalEvents,
        successRate: report.metrics.successRate,
        recommendations: report.recommendations.length
      });

    } catch (error) {
      console.error('❌ Error analyzing audit trail:', error);
      throw error;
    }
  }

  /**
   * Simulate wallet operation for demo purposes
   */
  private async simulateWalletOperation(): Promise<void> {
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Simulate test execution for demo purposes
   */
  private async simulateTestExecution(): Promise<void> {
    // Simulate test processing time
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  /**
   * Run all integration examples
   */
  async runAllExamples() {
    console.log('🚀 Starting comprehensive audit trail integration examples...\n');

    try {
      // Run complete transaction workflow
      await this.runCompleteTransactionWorkflow();
      console.log('');

      // Run test scenario with decisions
      await this.runTestScenarioWithDecisions();
      console.log('');

      // Run agent decision workflow
      await this.runAgentDecisionWorkflow();
      console.log('');

      // Export audit trail data
      await this.exportAuditTrailData();
      console.log('');

      // Analyze audit trail
      await this.analyzeAuditTrail();
      console.log('');

      console.log('🎉 All integration examples completed successfully!');

    } catch (error) {
      console.error('💥 Error running integration examples:', error);
      throw error;
    }
  }
}

/**
 * Utility function to run the integration example
 */
export async function runAuditIntegrationExample() {
  const example = new AuditIntegrationExample();
  await example.runAllExamples();
}

// Export for use in other modules
export default AuditIntegrationExample; 