import { AuditEventType, AuditSeverity } from '../../../src/audit/types';
import { TransactionTraceLogger } from '../../../src/audit/transaction-trace-logger';

describe('TransactionTraceLogger exportTraces filters', () => {
    let logger: TransactionTraceLogger;

    beforeEach(() => {
        logger = new TransactionTraceLogger();
        // @ts-ignore
        logger.logger = { error: jest.fn(), info: jest.fn(), debug: jest.fn() };
        // @ts-ignore
        logger.auditService = {
            getAllEvents: jest.fn(() => []),
            logEvent: jest.fn(() => 'event-id'),
            generateCorrelationId: jest.fn(() => 'corr-id')
        };
    });

    it('should filter by status', async () => {
        jest.spyOn(logger, 'getTraces').mockReturnValue([
            { status: 'completed', startTime: 1, endTime: 2, transactionId: 'id' }
        ]);
        const result = await logger.exportTraces({ status: 'failed' });
        expect(result).toEqual([]);
    });

    it('should filter by startTime', async () => {
        jest.spyOn(logger, 'getTraces').mockReturnValue([
            { status: 'completed', startTime: 1, endTime: 2, transactionId: 'id' }
        ]);
        const result = await logger.exportTraces({ startTime: 10 });
        expect(result).toEqual([]);
    });

    it('should filter by endTime', async () => {
        jest.spyOn(logger, 'getTraces').mockReturnValue([
            { status: 'completed', startTime: 1, endTime: 20, transactionId: 'id' }
        ]);
        const result = await logger.exportTraces({ endTime: 10 });
        expect(result).toEqual([]);
    });

    it('should filter by transactionId', async () => {
        jest.spyOn(logger, 'getTraces').mockReturnValue([
            { status: 'completed', startTime: 1, endTime: 2, transactionId: 'id1' }
        ]);
        const result = await logger.exportTraces({ transactionId: 'id2' });
        expect(result).toEqual([]);
    });

    it('should call generateCorrelationId if correlationId is not provided', () => {

        const mockGenerateCorrelationId = jest.fn(() => 'mock-corr-id');
        // @ts-ignore
        logger.auditService = {
            generateCorrelationId: mockGenerateCorrelationId,
            logEvent: jest.fn(() => 'event-id')
        };
        // Mock logger to avoid errors
        // @ts-ignore
        logger.logger = { info: jest.fn() };

        const transactionId = 'tx-1';
        logger.startTrace(transactionId); // No pass correlationId

        expect(mockGenerateCorrelationId).toHaveBeenCalled();
    });

    it('should throw if transaction trace does not exist in addStep', () => {
        // No add any trace to activeTraces, so the get will return undefined
        expect(() => {
            logger.addStep('nonexistent-tx', 'step', 'component', {});
        }).toThrow('Transaction trace nonexistent-tx not found');
    });

    it('should throw if transaction trace does not exist in completeStep', () => {
        expect(() => {
            logger.completeStep('nonexistent-tx', 'step1');
        }).toThrow('Transaction trace nonexistent-tx not found');
    });

    it('should throw if step does not exist in completeStep', () => {
        // Prepare a valid trace but without steps
        // @ts-ignore
        logger.activeTraces.set('tx1', { steps: [] });
        expect(() => {
            logger.completeStep('tx1', 'missing-step');
        }).toThrow('Step missing-step not found in transaction tx1');
    });

    it('should complete step as completed when no error', () => {
        // Prepare a valid trace with a valid step
        const step = { stepId: 'step1', startTime: 1, status: 'started' };
        // @ts-ignore
        logger.activeTraces.set('tx2', { steps: [step], correlationId: 'corr', });
        // Mock logger and auditService
        // @ts-ignore
        logger.logger = { debug: jest.fn() };
        // @ts-ignore
        logger.auditService = { logEvent: jest.fn() };
        logger.completeStep('tx2', 'step1', 'output');
        expect(step.status).toBe('completed');
    });

    it('should complete step as failed when error is provided', () => {
        const step = { stepId: 'step2', startTime: 1, status: 'started' };
        // @ts-ignore
        logger.activeTraces.set('tx3', { steps: [step], correlationId: 'corr', });
        // @ts-ignore
        logger.logger = { debug: jest.fn() };
        // @ts-ignore
        logger.auditService = { logEvent: jest.fn() };
        const error = new Error('fail');
        logger.completeStep('tx3', 'step2', 'output', error);
        expect(step.status).toBe('failed');
    });

    it('should throw if transaction trace does not exist in completeTrace', () => {
        expect(() => {
            logger.completeTrace('nonexistent-tx', 'completed', 'summary');
        }).toThrow('Transaction trace nonexistent-tx not found');
    });

    it('should return a transaction trace if it exists', () => {
        // @ts-ignore
        logger.activeTraces.set('tx1', { id: 'tx1' });
        expect(logger.getTransactionTrace('tx1')).toBeDefined();
    });

    it('should return undefined if transaction trace does not exist', () => {
        expect(logger.getTransactionTrace('nope')).toBeUndefined();
    });

    it('should filter transaction events by correlationId and type', () => {
        // @ts-ignore
        logger.auditService = {
            getAllEvents: jest.fn(() => [
                { id: '1', context: { correlationId: 'corr1', timestamp: 0, source: 'source' }, type: AuditEventType.TRANSACTION_INITIATED, severity: AuditSeverity.LOW, message: '', createdAt: 0 },
                { id: '2', context: { correlationId: 'corr2', timestamp: 0, source: 'source' }, type: AuditEventType.TRANSACTION_COMPLETED, severity: AuditSeverity.LOW, message: '', createdAt: 0 },
            ])
        };
        const events = logger.getTransactionEvents('corr1');
        expect(events.length).toBe(1);
        expect(events[0].type).toBe(AuditEventType.TRANSACTION_INITIATED);
    });

    it('should return null if transaction trace does not exist in getTransactionSummary', () => {
        expect(logger.getTransactionSummary('nope')).toBeNull();
    });

    it('should return a summary for an existing transaction trace', () => {
        const trace = {
            correlationId: 'corr1',
            status: 'completed',
            startTime: 1,
            endTime: 2,
            steps: [
                { status: 'completed' },
                { status: 'failed' }
            ],
            metadata: {}
        };
        // @ts-ignore
        logger.activeTraces.set('tx2', trace);
        // Mock getTransactionEvents
        jest.spyOn(logger, 'getTransactionEvents').mockReturnValue([{ type: 'TRANSACTION_INITIATED' }]);
        const summary = logger.getTransactionSummary('tx2');
        expect(summary.completedSteps).toBe(1);
        expect(summary.failedSteps).toBe(1);
        expect(summary.totalEvents).toBe(1);
        expect(summary.transactionId).toBe('tx2');
    });

    it('should return all active traces', () => {
        // @ts-ignore
        logger.activeTraces.set('tx1', {});
        expect(logger.getActiveTraces().length).toBeGreaterThan(0);
    });

    it('getTransactionEvents should handle events with missing context or type', () => {
        // @ts-ignore
        logger.auditService.getAllEvents = jest.fn(() => [
            { context: undefined, type: 'transaction_initiated' },
            { context: { correlationId: 'corr1' }, type: undefined },
            { context: { correlationId: 'corr1' }, type: 'not_transaction' }
        ]);
        expect(logger.getTransactionEvents('corr1')).toEqual([]);
    });

    it('getTransactionSummary should return totalDuration as undefined if endTime is missing', () => {
        // @ts-ignore
        logger.activeTraces.set('tx1', {
            correlationId: 'corr1',
            status: 'completed',
            startTime: 1,
            steps: [],
            metadata: {}
        });
        jest.spyOn(logger, 'getTransactionEvents').mockReturnValue([]);
        const summary = logger.getTransactionSummary('tx1');
        expect(summary.totalDuration).toBeUndefined();
    });

    it('getTransactionSummary should handle empty steps and events', () => {
        // @ts-ignore
        logger.activeTraces.set('tx1', {
            correlationId: 'corr1',
            status: 'completed',
            startTime: 1,
            endTime: 2,
            steps: [],
            metadata: {}
        });
        jest.spyOn(logger, 'getTransactionEvents').mockReturnValue([]);
        const summary = logger.getTransactionSummary('tx1');
        expect(summary.completedSteps).toBe(0);
        expect(summary.failedSteps).toBe(0);
        expect(summary.totalEvents).toBe(0);
    });

    it('logTransactionFailure should call logger and auditService', () => {
        const error = new Error('fail');
        // @ts-ignore
        const spy = jest.spyOn(logger.logger, 'error');
        const eventId = logger.logTransactionFailure('tx1', error, { foo: 'bar' }, 'corr1');
        expect(eventId).toBe('event-id');
        // @ts-ignore
        expect(logger.auditService.logEvent).toHaveBeenCalled();
        expect(spy).toHaveBeenCalled();
    });

    it('getTraces should skip events with missing transactionId', () => {
        // @ts-ignore
        logger.auditService.getAllEvents = jest.fn(() => [
            { type: 'transaction_completed', context: {}, data: {} }
        ]);
        expect(logger.getTraces()).toEqual([]);
    });

    it('getTraces should skip events with wrong type', () => {
        // @ts-ignore
        logger.auditService.getAllEvents = jest.fn(() => [
            { type: 'not_transaction', context: { transactionId: 'id' }, data: {} }
        ]);
        expect(logger.getTraces()).toEqual([]);
    });

    it('getTransactionEvents should skip events where type is not a string', () => {
        // @ts-ignore
        logger.auditService.getAllEvents = jest.fn(() => [
            { context: { correlationId: 'corr1' }, type: undefined },
            { context: { correlationId: 'corr1' }, type: null },
            { context: { correlationId: 'corr1' }, type: 123 },
            { context: { correlationId: 'corr1' }, type: {} },
            { context: { correlationId: 'corr1' }, type: ['transaction_initiated'] }
        ]);
        expect(logger.getTransactionEvents('corr1')).toEqual([]);
    });

    it('completeTrace should use HIGH severity for failed status', () => {
        // @ts-ignore
        logger.activeTraces.set('tx-failed', {
            correlationId: 'corr',
            status: 'processing',
            startTime: 1,
            steps: [],
            metadata: {}
        });
        // @ts-ignore
        logger.logger = { info: jest.fn() };
        // @ts-ignore
        logger.auditService = { logEvent: jest.fn(() => 'event-id') };
        logger.completeTrace('tx-failed', 'failed', 'summary');
        // @ts-ignore
        expect(logger.auditService.logEvent).toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            'high', // AuditSeverity.HIGH
            expect.anything(),
            expect.anything()
        );
    });

    it('completeTrace should use MEDIUM severity for cancelled status', () => {
        // @ts-ignore
        logger.activeTraces.set('tx-cancelled', {
            correlationId: 'corr',
            status: 'processing',
            startTime: 1,
            steps: [],
            metadata: {}
        });
        // @ts-ignore
        logger.logger = { info: jest.fn() };
        // @ts-ignore
        logger.auditService = { logEvent: jest.fn(() => 'event-id') };
        logger.completeTrace('tx-cancelled', 'cancelled', 'summary');
        // @ts-ignore
        expect(logger.auditService.logEvent).toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            'medium', // AuditSeverity.MEDIUM
            expect.anything(),
            expect.anything()
        );
    });

    it('completeTrace should use LOW severity for completed status', () => {
        // @ts-ignore
        logger.activeTraces.set('tx-completed', {
            correlationId: 'corr',
            status: 'processing',
            startTime: 1,
            steps: [],
            metadata: {}
        });
        // @ts-ignore
        logger.logger = { info: jest.fn() };
        // @ts-ignore
        logger.auditService = { logEvent: jest.fn(() => 'event-id') };
        logger.completeTrace('tx-completed', 'completed', 'summary');
        // @ts-ignore
        expect(logger.auditService.logEvent).toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            'low', // AuditSeverity.LOW
            expect.anything(),
            expect.anything()
        );
    });

    it('completeTrace should use LOW severity for unknown status', () => {
        // @ts-ignore
        logger.activeTraces.set('tx-unknown', {
            correlationId: 'corr',
            status: 'processing',
            startTime: 1,
            steps: [],
            metadata: {}
        });
        // @ts-ignore
        logger.logger = { info: jest.fn() };
        // @ts-ignore
        logger.auditService = { logEvent: jest.fn(() => 'event-id') };
        logger.completeTrace('tx-unknown', 'unknown' as any, 'summary');
        // @ts-ignore
        expect(logger.auditService.logEvent).toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            'low', // AuditSeverity.LOW
            expect.anything(),
            expect.anything()
        );
    });

    it('completeTrace should use TRANSACTION_COMPLETED event type for completed status', () => {
        // @ts-ignore
        logger.activeTraces.set('tx-completed', {
            correlationId: 'corr',
            status: 'processing',
            startTime: 1,
            steps: [],
            metadata: {}
        });
        // @ts-ignore
        logger.logger = { info: jest.fn() };
        // @ts-ignore
        logger.auditService = { logEvent: jest.fn(() => 'event-id') };
        logger.completeTrace('tx-completed', 'completed', 'summary');
        // @ts-ignore
        expect(logger.auditService.logEvent).toHaveBeenCalledWith(
            'transaction_completed', // AuditEventType.TRANSACTION_COMPLETED
            expect.anything(),
            expect.anything(),
            expect.anything(),
            expect.anything()
        );
    });

    it('completeTrace should use TRANSACTION_FAILED event type for failed status', () => {
        // @ts-ignore
        logger.activeTraces.set('tx-failed', {
            correlationId: 'corr',
            status: 'processing',
            startTime: 1,
            steps: [],
            metadata: {}
        });
        // @ts-ignore
        logger.logger = { info: jest.fn() };
        // @ts-ignore
        logger.auditService = { logEvent: jest.fn(() => 'event-id') };
        logger.completeTrace('tx-failed', 'failed', 'summary');
        // @ts-ignore
        expect(logger.auditService.logEvent).toHaveBeenCalledWith(
            'transaction_failed', // AuditEventType.TRANSACTION_FAILED
            expect.anything(),
            expect.anything(),
            expect.anything(),
            expect.anything()
        );
    });

    it('completeTrace should use TRANSACTION_FAILED event type for cancelled status', () => {
        // @ts-ignore
        logger.activeTraces.set('tx-cancelled', {
            correlationId: 'corr',
            status: 'processing',
            startTime: 1,
            steps: [],
            metadata: {}
        });
        // @ts-ignore
        logger.logger = { info: jest.fn() };
        // @ts-ignore
        logger.auditService = { logEvent: jest.fn(() => 'event-id') };
        logger.completeTrace('tx-cancelled', 'cancelled', 'summary');
        // @ts-ignore
        expect(logger.auditService.logEvent).toHaveBeenCalledWith(
            'transaction_failed', // AuditEventType.TRANSACTION_FAILED
            expect.anything(),
            expect.anything(),
            expect.anything(),
            expect.anything()
        );
    });

    it('completeTrace should use TRANSACTION_TRACE event type for unknown status', () => {
        // @ts-ignore
        logger.activeTraces.set('tx-unknown', {
            correlationId: 'corr',
            status: 'processing',
            startTime: 1,
            steps: [],
            metadata: {}
        });
        // @ts-ignore
        logger.logger = { info: jest.fn() };
        // @ts-ignore
        logger.auditService = { logEvent: jest.fn(() => 'event-id') };
        logger.completeTrace('tx-unknown', 'unknown' as any, 'summary');
        // @ts-ignore
        expect(logger.auditService.logEvent).toHaveBeenCalledWith(
            'transaction_trace', // AuditEventType.TRANSACTION_TRACE
            expect.anything(),
            expect.anything(),
            expect.anything(),
            expect.anything()
        );
    });
}); 