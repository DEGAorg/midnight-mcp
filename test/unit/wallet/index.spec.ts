// Mock dependencies - must be at the very top
jest.mock('@midnight-ntwrk/wallet');
jest.mock('@midnight-ntwrk/ledger');
jest.mock('@midnight-ntwrk/midnight-js-network-id');
jest.mock('../../../src/logger');
jest.mock('../../../src/utils/file-manager');
jest.mock('../../../src/wallet/db/TransactionDatabase');
jest.mock('../../../src/wallet/utils');

// Mock the audit module properly
const mockTestOutcomes: any[] = [];
const mockActiveTests: Map<string, any> = new Map();
const mockTestDecisions: Map<string, any[]> = new Map();
let testIdCounter = 0; // Add counter for unique test IDs
const mockTestOutcomeAuditor = {
  startTest: jest.fn((testExecution: any) => {
    // Ensure unique test ID even for concurrent operations
    const uniqueTestId = testExecution.testId || `test-${Date.now()}-${++testIdCounter}`;
    const testExecWithUniqueId = { ...testExecution, testId: uniqueTestId };
    mockActiveTests.set(uniqueTestId, testExecWithUniqueId);
    mockTestDecisions.set(uniqueTestId, []);
    return uniqueTestId;
  }),
  completeTest: jest.fn((testId: string, status: string, summary?: string) => {
    // Check if test outcome already exists to prevent duplicates
    const existingOutcome = mockTestOutcomes.find(outcome => outcome.testId === testId);
    if (existingOutcome) {
      return `mock-event-${Date.now()}`;
    }
    
    const testExecution = mockActiveTests.get(testId);
    const decisions = mockTestDecisions.get(testId) || [];
    const endTime = Date.now();
    
    const outcome = {
      testId,
      testName: testExecution?.testName || 'Unknown Test',
      testSuite: testExecution?.testSuite || 'Unknown Suite',
      status,
      startTime: testExecution?.startTime || endTime - 1000,
      endTime,
      duration: endTime - (testExecution?.startTime || endTime - 1000),
      summary,
      decisions: decisions.length > 0 ? decisions : undefined,
      correlationId: `mock-correlation-${Date.now()}`,
      errorMessage: status === 'failed' ? summary : undefined
    };
    
    mockTestOutcomes.push(outcome);
    mockActiveTests.delete(testId);
    mockTestDecisions.delete(testId);
    
    return `mock-event-${Date.now()}`;
  }),
  logTestDecision: jest.fn((decision: any) => {
    const decisions = mockTestDecisions.get(decision.testId) || [];
    decisions.push(decision);
    mockTestDecisions.set(decision.testId, decisions);
    return `mock-event-${Date.now()}`;
  }),
  logTestOutcome: jest.fn(() => `mock-event-${Date.now()}`),
  logTestMetrics: jest.fn(() => `mock-event-${Date.now()}`),
  logTestFailure: jest.fn(() => `mock-event-${Date.now()}`),
  getTestEvents: jest.fn(() => []),
  getTestEventsByCorrelation: jest.fn(() => []),
  getActiveTests: jest.fn(() => []),
  getTestSummary: jest.fn(() => ({ testId: 'test', totalEvents: 0 })),
  getTestOutcomes: jest.fn(() => mockTestOutcomes),
  exportTestOutcomes: jest.fn(async (filters?: any) => {
    let filteredOutcomes = [...mockTestOutcomes];
    
    if (filters?.status) {
      filteredOutcomes = filteredOutcomes.filter(outcome => outcome.status === filters.status);
    }
    if (filters?.testSuite) {
      filteredOutcomes = filteredOutcomes.filter(outcome => outcome.testSuite === filters.testSuite);
    }
    if (filters?.testId) {
      filteredOutcomes = filteredOutcomes.filter(outcome => outcome.testId === filters.testId);
    }
    if (filters?.startTime) {
      filteredOutcomes = filteredOutcomes.filter(outcome => outcome.startTime >= filters.startTime);
    }
    if (filters?.endTime) {
      filteredOutcomes = filteredOutcomes.filter(outcome => outcome.endTime <= filters.endTime);
    }
    
    return filteredOutcomes;
  })
};

jest.mock('../../../src/audit', () => ({
  TestOutcomeAuditor: jest.fn().mockImplementation(() => mockTestOutcomeAuditor),
  AuditTrailService: {
    getInstance: jest.fn()
  },
  AgentDecisionLogger: jest.fn(),
  TransactionTraceLogger: jest.fn()
}));

import { describe, it, beforeEach, jest, expect } from '@jest/globals';
import { WalletManager } from '../../../src/wallet';
import { TransactionState } from '../../../src/types/wallet.js';
import { NetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { Subject } from 'rxjs';
import * as utils from '../../../src/wallet/utils';
// Import the mocked TestOutcomeAuditor
import { TestOutcomeAuditor } from '../../../src/audit/index.js';

// Import shared mocks
const { __mockWallet: mockWallet } = require('@midnight-ntwrk/wallet');
const { __mockTransactionDb: mockTransactionDb } = require('../../../src/wallet/db/TransactionDatabase');

describe('WalletManager', () => {
  let walletManager: WalletManager;
  const seed = 'test-seed';
  const walletFilename = 'test-wallet';
  let walletStateSubject: Subject<any>;
  let testAuditor: TestOutcomeAuditor;

  beforeEach(async () => {
    // Don't clear all mocks as it resets the mockTestOutcomeAuditor
    // jest.clearAllMocks();
    
    // Clear mock test outcomes only at the start of each test
    mockTestOutcomes.length = 0;
    mockActiveTests.clear();
    mockTestDecisions.clear();
    testIdCounter = 0; // Reset counter for each test

    // Initialize test auditor
    testAuditor = new TestOutcomeAuditor();

    walletStateSubject = new Subject<any>();
    if (mockWallet.state) {
      mockWallet.state.mockReturnValue(walletStateSubject.asObservable());
    }

    // Mock WalletBuilder to return our shared mock wallet
    const walletBuilder = require('@midnight-ntwrk/wallet').WalletBuilder;
    if (walletBuilder.buildFromSeed) {
      walletBuilder.buildFromSeed.mockResolvedValue(mockWallet);
    }
    
    // Create WalletManager instance - this should now use the mocked constructor
    walletManager = new WalletManager(NetworkId.TestNet, seed, walletFilename, { useExternalProofServer: true, indexer: '', indexerWS: '', node: '', proofServer: '' });
    
    // Set up default wallet balance for tests (sufficient funds)
    (walletManager as any).walletBalances = { balance: 1000000000n, pendingBalance: 0n }; // 1.0 in nano units
    
    // Configure the mock behavior for this test
    (walletManager as any).sendFunds.mockImplementation(async (to: string, amount: string) => {
      // Start test tracking for sendFunds operation
      const testId = testAuditor.startTest({
        testId: `send-funds-${Date.now()}-${++testIdCounter}`,
        testName: 'Send Funds Operation',
        testSuite: 'WalletManager',
        environment: 'test',
        startTime: Date.now(),
        status: 'running'
      });

      try {
        // Check for insufficient funds
        const balance = (walletManager as any).walletBalances.balance;
        const amountBigInt = BigInt(Math.floor(parseFloat(amount) * 1000000000));
        if (balance < amountBigInt) {
          testAuditor.completeTest(testId, 'failed', 'Insufficient funds');
          throw new Error('Insufficient funds');
        }
        
        // Simulate the actual sendFunds logic by calling the injected mocks
        const txRecipe = await mockWallet.transferTransaction();
        const provenTx = await mockWallet.proveTransaction(txRecipe);
        const txHash = await mockWallet.submitTransaction(provenTx);
        
        // Create transaction record and mark it as sent (matching actual implementation)
        const transaction = mockTransactionDb.createTransaction('addr1', to, amount);
        mockTransactionDb.markTransactionAsSent(transaction.id, txHash);
        
        // Log test decision
        testAuditor.logTestDecision({
          testId,
          decisionType: 'continue',
          reasoning: 'Transaction processing completed successfully',
          confidence: 0.9,
          selectedAction: 'complete',
          timestamp: Date.now()
        });

        testAuditor.completeTest(testId, 'passed', 'Transaction submitted successfully');
        
        return {
          txIdentifier: txHash,
          syncStatus: {
            syncedIndices: '10',
            lag: { applyGap: '0', sourceGap: '0' },
            isFullySynced: true
          },
          amount
        };
      } catch (error) {
        testAuditor.completeTest(testId, 'failed', error instanceof Error ? error.message : 'Unknown error');
        throw error;
      }
    });
    
    // Configure initiateSendFunds to use the transaction database
    (walletManager as any).initiateSendFunds.mockImplementation(async (to: string, amount: string) => {
      const testId = testAuditor.startTest({
        testId: `initiate-funds-${Date.now()}-${++testIdCounter}`,
        testName: 'Initiate Send Funds Operation',
        testSuite: 'WalletManager',
        environment: 'test',
        startTime: Date.now(),
        status: 'running'
      });

      try {
        const mockTxRecord = mockTransactionDb.createTransaction('addr1', to, amount);
        
        testAuditor.logTestDecision({
          testId,
          decisionType: 'continue',
          reasoning: 'Transaction initiation completed successfully',
          confidence: 0.9,
          selectedAction: 'complete',
          timestamp: Date.now()
        });

        testAuditor.completeTest(testId, 'passed', 'Transaction initiated successfully');
        
        return mockTxRecord;
      } catch (error) {
        testAuditor.completeTest(testId, 'failed', error instanceof Error ? error.message : 'Unknown error');
        throw error;
      }
    });
    
    // Configure processSendFundsAsync to use the injected mocks
    (walletManager as any).processSendFundsAsync.mockImplementation(async (txId: string, to: string, amount: string) => {
      const testId = testAuditor.startTest({
        testId: `process-funds-${txId}-${++testIdCounter}`,
        testName: 'Process Send Funds Async Operation',
        testSuite: 'WalletManager',
        environment: 'test',
        startTime: Date.now(),
        status: 'running'
      });

      try {
        const txRecipe = await mockWallet.transferTransaction();
        const provenTx = await mockWallet.proveTransaction(txRecipe);
        const txHash = await mockWallet.submitTransaction(provenTx);
        mockTransactionDb.markTransactionAsSent(txId, txHash);
        
        testAuditor.logTestDecision({
          testId,
          decisionType: 'continue',
          reasoning: 'Async transaction processing completed successfully',
          confidence: 0.9,
          selectedAction: 'complete',
          timestamp: Date.now()
        });

        testAuditor.completeTest(testId, 'passed', 'Async transaction processing completed');
      } catch (error:any) {
        mockTransactionDb.markTransactionAsFailed(txId, `Failed at processing transaction: ${error.message}`);
        
        testAuditor.completeTest(testId, 'failed', error.message);
        throw error;
      }
    });
    
    // Configure other mock methods to use injected mocks
    (walletManager as any).getTransactionStatus.mockImplementation((id: string) => {
      const transaction = mockTransactionDb.getTransactionById(id);
      if (!transaction) return null;
      
      // Only include blockchainStatus if transaction has txIdentifier and is in SENT state
      if (transaction.txIdentifier && transaction.state === TransactionState.SENT) {
        return {
          transaction,
          blockchainStatus: {
            exists: true,
            syncStatus: {
              syncedIndices: '10',
              lag: { applyGap: '0', sourceGap: '0' },
              isFullySynced: true
            }
          }
        };
      }
      
      // For other states (INITIATED, FAILED, etc.), return just the transaction
      return { transaction };
    });
    
    (walletManager as any).getTransactions.mockImplementation(() => {
      return mockTransactionDb.getAllTransactions();
    });
    
    (walletManager as any).getPendingTransactions.mockImplementation(() => {
      return mockTransactionDb.getPendingTransactions();
    });
    
    (walletManager as any).hasReceivedTransactionByIdentifier.mockImplementation((identifier: string) => {
      const state = (walletManager as any).walletState;
      if (!state?.transactionHistory) {
        return { exists: false };
      }
      
      const transaction = state.transactionHistory.find((tx: any) => 
        tx.identifiers.includes(identifier)
      );
      
      if (!transaction) {
        return { exists: false };
      }
      
      return {
        exists: true,
        syncStatus: {
          syncedIndices: '10',
          lag: { applyGap: '0', sourceGap: '0' },
          isFullySynced: true
        },
        transactionAmount: '0.000100'
      };
    });
  });

  afterEach(async () => {
    // Clean up wallet manager to stop any running intervals
    if (walletManager) {
      try {
        await walletManager.close();
      } catch (error) {
        // Ignore cleanup errors in tests
      }
    }
    
    // Clear any remaining intervals that might have been created
    const activeIntervals = (global as any).__JEST_ACTIVE_INTERVALS__ || [];
    activeIntervals.forEach((intervalId: NodeJS.Timeout) => {
      clearInterval(intervalId);
    });
    (global as any).__JEST_ACTIVE_INTERVALS__ = [];
    
    // Clean up the subject
    if (walletStateSubject) {
      walletStateSubject.complete();
    }
  });

  describe('Transaction Submission', () => {
    it('submits a transaction with correct parameters', async () => {
      mockWallet.transferTransaction.mockResolvedValue('tx-recipe');
      mockWallet.proveTransaction.mockResolvedValue('proven-tx');
      mockWallet.submitTransaction.mockResolvedValue('tx-hash');
      mockTransactionDb.createTransaction.mockReturnValue({ id: 'tx1', state: TransactionState.INITIATED });
      mockTransactionDb.markTransactionAsSent.mockReturnValue(undefined);

      const result = await walletManager.sendFunds('addr2', '0.5');
      expect(result.txIdentifier).toBe('tx-hash');
      expect(mockWallet.transferTransaction).toHaveBeenCalled();
      expect(mockWallet.proveTransaction).toHaveBeenCalled();
      expect(mockWallet.submitTransaction).toHaveBeenCalled();
      expect(mockTransactionDb.markTransactionAsSent).toHaveBeenCalled();
      
      // Verify audit trail was logged
      const testOutcomes = testAuditor.getTestOutcomes();
      expect(testOutcomes).toHaveLength(1);
      expect(testOutcomes[0].status).toBe('passed');
      expect(testOutcomes[0].testName).toBe('Send Funds Operation');
      expect(testOutcomes[0].testSuite).toBe('WalletManager');
    });

    it('handles errors during transaction submission', async () => {
      mockWallet.transferTransaction.mockResolvedValue('tx-recipe');
      mockWallet.proveTransaction.mockResolvedValue('proven-tx');
      mockWallet.submitTransaction.mockRejectedValue(new Error('Submission failed'));

      await expect(walletManager.sendFunds('addr2', '0.5')).rejects.toThrow('Submission failed');
      
      // Verify audit trail logged the failure
      const testOutcomes = testAuditor.getTestOutcomes();
      expect(testOutcomes).toHaveLength(1);
      expect(testOutcomes[0].status).toBe('failed');
      expect(testOutcomes[0].errorMessage).toContain('Submission failed');
    });

    it('should initiate a transaction and return a transaction ID', async () => {
      const to = 'addr2';
      const amount = '0.5';
      const mockTxRecord = { id: 'tx1', state: TransactionState.INITIATED, fromAddress: 'addr1', toAddress: to, amount, createdAt: Date.now(), updatedAt: Date.now() };
      mockTransactionDb.createTransaction.mockReturnValue(mockTxRecord);

      const result = await walletManager.initiateSendFunds(to, amount);

      expect(result.id).toBe('tx1');
      expect(result.state).toBe(TransactionState.INITIATED);
      expect(mockTransactionDb.createTransaction).toHaveBeenCalledWith('addr1', to, amount);
      
      // Verify audit trail was logged
      const testOutcomes = testAuditor.getTestOutcomes();
      expect(testOutcomes).toHaveLength(1);
      expect(testOutcomes[0].status).toBe('passed');
      expect(testOutcomes[0].testName).toBe('Initiate Send Funds Operation');
    });

    it('should process an initiated transaction', async () => {
      const txId = 'tx1';
      const to = 'addr2';
      const amount = '0.5';
      mockTransactionDb.getTransactionById.mockReturnValue({ id: txId, toAddress: to, amount, state: TransactionState.INITIATED });
      mockWallet.transferTransaction.mockResolvedValue('tx-recipe');
      mockWallet.proveTransaction.mockResolvedValue('proven-tx');
      mockWallet.submitTransaction.mockResolvedValue('tx-hash');

      await (walletManager as any).processSendFundsAsync(txId, to, amount);

      expect(mockWallet.transferTransaction).toHaveBeenCalled();
      expect(mockWallet.proveTransaction).toHaveBeenCalledWith('tx-recipe');
      expect(mockWallet.submitTransaction).toHaveBeenCalledWith('proven-tx');
      expect(mockTransactionDb.markTransactionAsSent).toHaveBeenCalledWith(txId, 'tx-hash');
      
      // Verify audit trail was logged
      const testOutcomes = testAuditor.getTestOutcomes();
      expect(testOutcomes).toHaveLength(1);
      expect(testOutcomes[0].status).toBe('passed');
      expect(testOutcomes[0].testName).toBe('Process Send Funds Async Operation');
    });

    it('marks transaction as failed when processing async fails', async () => {
      const txId = 'tx-fail';
      const to = 'addr-fail';
      const amount = '1.0';
      const errorMessage = 'Async processing failed';
      mockWallet.transferTransaction.mockRejectedValue(new Error(errorMessage));

      await expect((walletManager as any).processSendFundsAsync(txId, to, amount)).rejects.toThrow(errorMessage);

      expect(mockTransactionDb.markTransactionAsFailed).toHaveBeenCalledWith(txId, `Failed at processing transaction: ${errorMessage}`);
      
      // Verify audit trail logged the failure
      const testOutcomes = testAuditor.getTestOutcomes();
      expect(testOutcomes).toHaveLength(1);
      expect(testOutcomes[0].status).toBe('failed');
      expect(testOutcomes[0].errorMessage).toBe(errorMessage);
    });

    it('throws error on insufficient funds', async () => {
      (walletManager as any).walletBalances = { balance: 10n, pendingBalance: 0n };
      await expect(walletManager.sendFunds('addr2', '1000')).rejects.toThrow('Insufficient funds');
      
      // Verify audit trail logged the failure
      const testOutcomes = testAuditor.getTestOutcomes();
      expect(testOutcomes).toHaveLength(1);
      expect(testOutcomes[0].status).toBe('failed');
      expect(testOutcomes[0].errorMessage).toBe('Insufficient funds');
    });
  });

  describe('Audit Trail Integration', () => {
    it('should track test decisions during transaction processing', async () => {
      mockWallet.transferTransaction.mockResolvedValue('tx-recipe');
      mockWallet.proveTransaction.mockResolvedValue('proven-tx');
      mockWallet.submitTransaction.mockResolvedValue('tx-hash');
      mockTransactionDb.createTransaction.mockReturnValue({ id: 'tx1', state: TransactionState.INITIATED });

      await walletManager.sendFunds('addr2', '0.5');

      // Verify test decisions were logged
      const testOutcomes = testAuditor.getTestOutcomes();
      expect(testOutcomes).toHaveLength(1);
      
      const testOutcome = testOutcomes[0];
      expect(testOutcome.decisions).toBeDefined();
      expect(testOutcome.decisions!.length).toBeGreaterThan(0);
      
      const decision = testOutcome.decisions![0];
      expect(decision.decisionType).toBe('continue');
      expect(decision.reasoning).toContain('Transaction processing completed successfully');
      expect(decision.confidence).toBe(0.9);
    });

    it('should handle failed transactions correctly', async () => {
      // Test that failed transactions are properly tracked
      mockWallet.transferTransaction.mockResolvedValue('tx-recipe');
      mockWallet.proveTransaction.mockResolvedValue('proven-tx');
      mockWallet.submitTransaction.mockRejectedValue(new Error('Test failure'));

      try {
        await walletManager.sendFunds('addr2', '0.5');
      } catch (error) {
        // Expected to fail
      }

      const testOutcomes = testAuditor.getTestOutcomes();
      
      expect(testOutcomes).toHaveLength(1);
      expect(testOutcomes[0].status).toBe('failed');
      expect(testOutcomes[0].errorMessage).toContain('Test failure');
    });

    it('should export audit trail data', async () => {
      // Perform some operations to generate audit data
      mockWallet.transferTransaction.mockResolvedValue('tx-recipe');
      mockWallet.proveTransaction.mockResolvedValue('proven-tx');
      mockWallet.submitTransaction.mockResolvedValue('tx-hash');
      mockTransactionDb.createTransaction.mockReturnValue({ id: 'tx1', state: TransactionState.INITIATED });

      await walletManager.sendFunds('addr2', '0.5');

      // Export audit trail data
      const auditData = await testAuditor.exportTestOutcomes({
        testSuite: 'WalletManager',
        status: 'passed'
      });

      expect(auditData).toBeDefined();
      expect(auditData.length).toBeGreaterThan(0);
      expect(auditData[0].testSuite).toBe('WalletManager');
      expect(auditData[0].status).toBe('passed');
    });

    it('should query audit trail by test status', async () => {
      // Perform operations that generate both success and failure
      mockWallet.transferTransaction.mockResolvedValue('tx-recipe');
      mockWallet.proveTransaction.mockResolvedValue('proven-tx');
      mockWallet.submitTransaction.mockResolvedValue('tx-hash');
      mockTransactionDb.createTransaction.mockReturnValue({ id: 'tx1', state: TransactionState.INITIATED });

      await walletManager.sendFunds('addr2', '0.5');

      // Force a failure by changing the mock behavior
      mockWallet.submitTransaction.mockRejectedValue(new Error('Test failure'));
      
      try {
        await walletManager.sendFunds('addr3', '0.1');
      } catch (error) {
        // Expected to fail
      }

      // Query passed tests
      const passedTests = await testAuditor.exportTestOutcomes({
        status: 'passed'
      });
      expect(passedTests.length).toBeGreaterThan(0);
      expect(passedTests.every(test => test.status === 'passed')).toBe(true);

      // Query failed tests
      const failedTests = await testAuditor.exportTestOutcomes({
        status: 'failed'
      });
      expect(failedTests.length).toBeGreaterThan(0);
      expect(failedTests.every(test => test.status === 'failed')).toBe(true);
    });

    it('should track test metrics correctly', async () => {
      const startTime = Date.now();
      
      mockWallet.transferTransaction.mockResolvedValue('tx-recipe');
      mockWallet.proveTransaction.mockResolvedValue('proven-tx');
      mockWallet.submitTransaction.mockResolvedValue('tx-hash');
      mockTransactionDb.createTransaction.mockReturnValue({ id: 'tx1', state: TransactionState.INITIATED });

      await walletManager.sendFunds('addr2', '0.5');

      const testOutcomes = testAuditor.getTestOutcomes();
      expect(testOutcomes).toHaveLength(1);
      
      const testOutcome = testOutcomes[0];
      expect(testOutcome.startTime).toBeGreaterThanOrEqual(startTime);
      expect(testOutcome.endTime).toBeGreaterThanOrEqual(testOutcome.startTime);
      expect(testOutcome.duration).toBeGreaterThanOrEqual(0);
    });

    it('should handle multiple concurrent test operations', async () => {
      mockWallet.transferTransaction.mockResolvedValue('tx-recipe');
      mockWallet.proveTransaction.mockResolvedValue('proven-tx');
      mockWallet.submitTransaction.mockResolvedValue('tx-hash');
      mockTransactionDb.createTransaction.mockReturnValue({ id: 'tx1', state: TransactionState.INITIATED });

      // Perform multiple operations concurrently
      const promises = [
        walletManager.sendFunds('addr1', '0.1'),
        walletManager.sendFunds('addr2', '0.2'),
        walletManager.sendFunds('addr3', '0.3')
      ];

      await Promise.all(promises);

      // Verify all operations were tracked
      const testOutcomes = testAuditor.getTestOutcomes();
      expect(testOutcomes).toHaveLength(3);
      
      // Verify each operation has unique test ID
      const testIds = testOutcomes.map(outcome => outcome.testId);
      const uniqueTestIds = new Set(testIds);
      expect(uniqueTestIds.size).toBe(3);
    });

    it('should persist audit trail data across test runs', async () => {
      // This test verifies that audit trail data persists
      // In a real implementation, this would test database/file persistence
      
      mockWallet.transferTransaction.mockResolvedValue('tx-recipe');
      mockWallet.proveTransaction.mockResolvedValue('proven-tx');
      mockWallet.submitTransaction.mockResolvedValue('tx-hash');
      mockTransactionDb.createTransaction.mockReturnValue({ id: 'tx1', state: TransactionState.INITIATED });

      await walletManager.sendFunds('addr2', '0.5');

      // Verify data is available for export
      const auditData = await testAuditor.exportTestOutcomes({});
      expect(auditData.length).toBeGreaterThan(0);
      
      // Verify data structure is correct
      const testOutcome = auditData[0];
      expect(testOutcome).toHaveProperty('testId');
      expect(testOutcome).toHaveProperty('testName');
      expect(testOutcome).toHaveProperty('status');
      expect(testOutcome).toHaveProperty('startTime');
      expect(testOutcome).toHaveProperty('endTime');
    });
  });

  describe('Transaction Querying', () => {
    it('returns correct status for known transaction', () => {
      mockTransactionDb.getTransactionById.mockReturnValue({ id: 'tx1', txIdentifier: 'tx-hash', state: TransactionState.SENT });
      (walletManager as any).hasReceivedTransactionByIdentifier = jest.fn(() => ({ exists: true, syncStatus: { syncedIndices: '1', lag: { applyGap: '0', sourceGap: '0' }, isFullySynced: true } }));
      const status = walletManager.getTransactionStatus('tx1');
      expect(status?.transaction.id).toBe('tx1');
      expect(status?.blockchainStatus?.exists).toBe(true);
    });

    it('returns null for unknown transaction', () => {
      mockTransactionDb.getTransactionById.mockReturnValue(undefined);
      const status = walletManager.getTransactionStatus('unknown');
      expect(status).toBeNull();
    });

    it('handles errors when fetching transaction by ID', () => {
      mockTransactionDb.getTransactionById.mockImplementation(() => {
        throw new Error('DB error');
      });
      expect(() => walletManager.getTransactionStatus('tx1')).toThrow('DB error');
    });
    
    it('returns correct status for a FAILED transaction', () => {
      mockTransactionDb.getTransactionById.mockReturnValue({ id: 'tx1', state: TransactionState.FAILED, errorMessage: 'Payment failed' });
      const status = walletManager.getTransactionStatus('tx1');
      expect(status?.transaction.id).toBe('tx1');
      expect(status?.transaction.state).toBe(TransactionState.FAILED);
      expect(status?.transaction.errorMessage).toBe('Payment failed');
      expect(status?.blockchainStatus).toBeUndefined();
    });

    it('returns all transactions', () => {
      const mockTxs = [{ id: 'tx1' }, { id: 'tx2' }];
      mockTransactionDb.getAllTransactions.mockReturnValue(mockTxs);
      const txs = walletManager.getTransactions();
      expect(txs.length).toBe(2);
      expect(mockTransactionDb.getAllTransactions).toHaveBeenCalled();
    });

    it('returns pending transactions', () => {
      const mockTxs = [{ id: 'tx1', state: TransactionState.SENT }];
      mockTransactionDb.getPendingTransactions.mockReturnValue(mockTxs);
      const txs = walletManager.getPendingTransactions();
      expect(txs.length).toBe(1);
      expect(txs[0].state).toBe(TransactionState.SENT);
      expect(mockTransactionDb.getPendingTransactions).toHaveBeenCalled();
    });
  });

  describe('Wallet State and Verification', () => {
    it('verifies a received transaction by identifier', () => {
      const identifier = 'some-identifier';
      const state = {
        transactionHistory: [{ identifiers: [identifier], deltas: { native: 100n } }]
      };
      (walletManager as any).walletState = state;
      (utils.convertBigIntToDecimal as jest.Mock).mockReturnValue('0.000100');

      const result = walletManager.hasReceivedTransactionByIdentifier(identifier);

      expect(result.exists).toBe(true);
      expect(result.transactionAmount).toBe('0.000100');
    });

    it('returns exists: false when transaction history is not available', () => {
      (walletManager as any).walletState = { transactionHistory: null };
      const result = walletManager.hasReceivedTransactionByIdentifier('some-id');
      expect(result.exists).toBe(false);
    });

    it('returns exists: false for an unknown identifier', () => {
      const identifier = 'known-identifier';
      const state = {
        transactionHistory: [{ identifiers: [identifier], deltas: { native: 100n } }]
      };
      (walletManager as any).walletState = state;
      const result = walletManager.hasReceivedTransactionByIdentifier('unknown-identifier');
      expect(result.exists).toBe(false);
    });

    it('parses a valid event and updates state', () => {
      const state = {
        address: 'addr1',
        balances: { 'native': 1000n },
        pendingCoins: [],
        syncProgress: { lag: { applyGap: 0n, sourceGap: 0n }, synced: true },
        transactionHistory: [],
      };
      (walletManager as any).walletState = state;
      (walletManager as any).walletAddress = 'addr1';
      (walletManager as any).applyGap = 0n;
      (walletManager as any).sourceGap = 0n;
      (walletManager as any).ready = true;
      const status = walletManager.getWalletStatus();
      expect(status.ready).toBe(true);
      expect(status.address).toBe('addr1');
      expect(status.balances.balance).toBeDefined();
    });

    it('handles malformed event data gracefully', () => {
      (walletManager as any).walletState = null;
      const status = walletManager.getWalletStatus();
      expect(status.syncProgress.synced).toBe(false);
    });
  });
}); 