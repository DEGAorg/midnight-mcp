// IMPORTANT: Mock wallet utils before any other imports
jest.mock('../../../src/wallet/utils');
jest.mock('../../../src/integrations/marketplace/api.js', () => require('../__mocks__/marketplace-api.ts'));

import { describe, it, beforeEach, jest, expect } from '@jest/globals';
import { WalletManager } from '../../../src/wallet/index';
import { TransactionState } from '../../../src/types/wallet.js';
import { NetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { Subject } from 'rxjs';
import * as utils from '../../../src/wallet/utils';

// Mock dependencies
jest.mock('@midnight-ntwrk/wallet');
jest.mock('@midnight-ntwrk/ledger');
jest.mock('@midnight-ntwrk/midnight-js-network-id');
jest.mock('../../../src/logger');
jest.mock('../../../src/utils/file-manager');
jest.mock('../../../src/wallet/db/TransactionDatabase');

// Import shared mocks
const { __mockWallet: mockWallet } = require('@midnight-ntwrk/wallet');
const { __mockTransactionDb: mockTransactionDb } = require('../../../src/wallet/db/TransactionDatabase');

describe('Event Parsing and Transaction History', () => {
    let walletManager: WalletManager;
    let walletStateSubject: Subject<any>;

    beforeEach(async () => {
        jest.clearAllMocks();
        walletStateSubject = new Subject<any>();

        if (mockWallet.state) {
            mockWallet.state.mockReturnValue(walletStateSubject.asObservable());
        }

        const walletBuilder = require('@midnight-ntwrk/wallet').WalletBuilder;
        if (walletBuilder.buildFromSeed) {
            walletBuilder.buildFromSeed.mockResolvedValue(mockWallet);
        }

        // Mock database error during transaction creation
        mockTransactionDb.createTransaction.mockImplementation(() => {
            throw new Error('Failed to create transaction record');
        });

        // Mock convertBigIntToDecimal to work correctly
        (utils.convertBigIntToDecimal as jest.Mock).mockImplementation((amount: any) => {
            if (typeof amount === 'bigint') {
                const amountString = amount.toString().padStart(7, '0');
                const wholePart = amountString.slice(0, -6) || '0';
                const decimalPart = amountString.slice(-6).replace(/0+$/, '');
                return decimalPart ? `${wholePart}.${decimalPart}` : wholePart;
            }
            return '0';
        });

        // Mock convertDecimalToBigInt
        (utils.convertDecimalToBigInt as jest.Mock).mockImplementation((amount: any) => {
            const num = parseFloat(amount);
            return BigInt(Math.floor(num * 1000000));
        });

        walletManager = new WalletManager(NetworkId.TestNet, 'test-seed', 'test-wallet', {
            useExternalProofServer: true,
            indexer: '',
            indexerWS: '',
            node: '',
            proofServer: ''
        });

        // Set wallet as ready for testing
        (walletManager as any).ready = true;
        (walletManager as any).wallet = mockWallet;
        (walletManager as any).walletBalances = { balance: 1000000000n, pendingBalance: 0n };

        // Set the transactionDb to the mock directly
        (walletManager as any).transactionDb = mockTransactionDb;
    });

    describe('TransactionHistoryEntry Parsing', () => {
        it('should parse valid TransactionHistoryEntry with multiple identifiers', () => {

            const mockHistoryEntry = {
                applyStage: 'applied',
                deltas: { 'native-token-id': 1000000n, 'custom-token': 500000n },
                identifiers: ['tx-hash-1', 'tx-hash-2'],
                transactionHash: 'blockchain-hash-123',
                transaction: { __wbg_ptr: 12345 }
            };

            (walletManager as any).walletState = {
                transactionHistory: [mockHistoryEntry]
            };


            const result = walletManager.hasReceivedTransactionByIdentifier('tx-hash-1');


            expect(result.exists).toBe(true);
            expect(result.transactionAmount).toBe('1');
            expect(result.syncStatus.isFullySynced).toBeDefined();
        });

        it('should handle TransactionHistoryEntry with empty identifiers array', () => {
            const mockHistoryEntry = {
                applyStage: 'applied',
                deltas: { 'native-token-id': 1000000n },
                identifiers: [],
                transactionHash: 'blockchain-hash-123',
                transaction: { __wbg_ptr: 12345 }
            };

            (walletManager as any).walletState = {
                transactionHistory: [mockHistoryEntry]
            };

            const result = walletManager.hasReceivedTransactionByIdentifier('any-identifier');

            expect(result.exists).toBe(false);
            expect(result.transactionAmount).toBe('0');
        });

        it('should handle TransactionHistoryEntry with null identifiers', () => {
            const mockHistoryEntry = {
                applyStage: 'applied',
                deltas: { 'native-token-id': 1000000n },
                identifiers: null,
                transactionHash: 'blockchain-hash-123',
                transaction: { __wbg_ptr: 12345 }
            };

            (walletManager as any).walletState = {
                transactionHistory: [mockHistoryEntry]
            };

            const result = walletManager.hasReceivedTransactionByIdentifier('any-identifier');

            expect(result.exists).toBe(false);
            expect(result.transactionAmount).toBe('0');
        });

        it('should parse TransactionHistoryEntry with zero amount delta', () => {
            const mockHistoryEntry = {
                applyStage: 'applied',
                deltas: { 'native-token-id': 0n },
                identifiers: ['tx-hash-zero'],
                transactionHash: 'blockchain-hash-123',
                transaction: { __wbg_ptr: 12345 }
            };

            (walletManager as any).walletState = {
                transactionHistory: [mockHistoryEntry]
            };

            const result = walletManager.hasReceivedTransactionByIdentifier('tx-hash-zero');

            expect(result.exists).toBe(true);
            expect(result.transactionAmount).toBe('0');
        });

        it('should handle TransactionHistoryEntry with missing native token delta', () => {
            const mockHistoryEntry = {
                applyStage: 'applied',
                deltas: { 'custom-token': 1000000n }, // No native token delta
                identifiers: ['tx-hash-custom'],
                transactionHash: 'blockchain-hash-123',
                transaction: { __wbg_ptr: 12345 }
            };

            (walletManager as any).walletState = {
                transactionHistory: [mockHistoryEntry]
            };

            const result = walletManager.hasReceivedTransactionByIdentifier('tx-hash-custom');

            expect(result.exists).toBe(true);
            expect(result.transactionAmount).toBe('0'); // No native token delta, so 0
        });

        it('should handle malformed TransactionHistoryEntry gracefully', () => {
            const malformedEntry = {
                applyStage: 'applied',
                // Missing deltas
                identifiers: ['tx-hash-malformed'],
                transactionHash: 'blockchain-hash-123',
                transaction: { __wbg_ptr: 12345 }
            };

            (walletManager as any).walletState = {
                transactionHistory: [malformedEntry]
            };

            expect(() => {
                walletManager.hasReceivedTransactionByIdentifier('tx-hash-malformed');
            }).toThrow();
        });
    });

    describe('Event Stream Handling', () => {
        it('should handle wallet state updates through event stream', () => {
            const mockWalletState = {
                address: 'mdnt1test123',
                balances: { 'native-token-id': 1000000000n },
                pendingCoins: [],
                syncProgress: { lag: { applyGap: 0n, sourceGap: 0n }, synced: true },
                transactionHistory: [
                    {
                        applyStage: 'applied',
                        deltas: { 'native-token-id': 500000n },
                        identifiers: ['new-tx-hash'],
                        transactionHash: 'blockchain-hash-new',
                        transaction: { __wbg_ptr: 12345 }
                    }
                ]
            };

            // Simulate wallet state update through event stream
            (walletManager as any).walletState = mockWalletState;

            const result = walletManager.hasReceivedTransactionByIdentifier('new-tx-hash');

            expect(result.exists).toBe(true);
            expect(result.transactionAmount).toBe('0.5'); // 500000n converts to '0.5'
        });

        it('should handle partial sync state in event stream', () => {
            const partialSyncState = {
                address: 'mdnt1test123',
                balances: { 'native-token-id': 1000000000n },
                pendingCoins: [],
                syncProgress: { lag: { applyGap: 5n, sourceGap: 2n }, synced: false },
                transactionHistory: []
            };

            (walletManager as any).walletState = partialSyncState;
            (walletManager as any).applyGap = 5n;
            (walletManager as any).sourceGap = 2n;

            const result = walletManager.hasReceivedTransactionByIdentifier('any-identifier');

            expect(result.exists).toBe(false);
            expect(result.syncStatus.lag.applyGap).toBe('5');
            expect(result.syncStatus.lag.sourceGap).toBe('2');
            expect(result.syncStatus.isFullySynced).toBe(false);
        });

        it('should handle wallet state with large transaction history', () => {
            const largeHistory = Array.from({ length: 1000 }, (_, i) => ({
                applyStage: 'applied',
                deltas: { 'native-token-id': 1000000n },
                identifiers: [`tx-hash-${i}`],
                transactionHash: `blockchain-hash-${i}`,
                transaction: { __wbg_ptr: i }
            }));

            (walletManager as any).walletState = {
                transactionHistory: largeHistory
            };

            const result = walletManager.hasReceivedTransactionByIdentifier('tx-hash-999');

            expect(result.exists).toBe(true);
            expect(result.transactionAmount).toBe('1'); // 1000000n converts to '1'
        });
    });

    describe('Edge Cases and Error Handling', () => {
        it('should handle wallet state with corrupted transaction history', () => {
            const corruptedState = {
                transactionHistory: [
                    null,
                    undefined,
                    { invalid: 'entry' },
                    {
                        applyStage: 'applied',
                        deltas: { 'native-token-id': 1000000n },
                        identifiers: ['valid-tx-hash'],
                        transactionHash: 'blockchain-hash-valid',
                        transaction: { __wbg_ptr: 12345 }
                    }
                ]
            };

            (walletManager as any).walletState = corruptedState;

            const result = walletManager.hasReceivedTransactionByIdentifier('valid-tx-hash');

            expect(result.exists).toBe(true);
            expect(result.transactionAmount).toBe('1'); 
        });

        it('should handle extremely large BigInt values in deltas', () => {
            const largeBigInt = 999999999999999999999999n;
            const mockHistoryEntry = {
                applyStage: 'applied',
                deltas: { 'native-token-id': largeBigInt },
                identifiers: ['tx-hash-bigint'],
                transactionHash: 'blockchain-hash-bigint',
                transaction: { __wbg_ptr: 12345 }
            };

            (walletManager as any).walletState = {
                transactionHistory: [mockHistoryEntry]
            };

            const result = walletManager.hasReceivedTransactionByIdentifier('tx-hash-bigint');

            expect(result.exists).toBe(true);
            expect(result.transactionAmount).toBe('999999999999999999.999999');
        });

        it('should handle negative BigInt values in deltas', () => {
            const negativeBigInt = -1000000n;
            const mockHistoryEntry = {
                applyStage: 'applied',
                deltas: { 'native-token-id': negativeBigInt },
                identifiers: ['tx-hash-negative'],
                transactionHash: 'blockchain-hash-negative',
                transaction: { __wbg_ptr: 12345 },
            };

            (walletManager as any).walletState = {
                transactionHistory: [mockHistoryEntry]
            };

            const result = walletManager.hasReceivedTransactionByIdentifier('tx-hash-negative');

            expect(result.exists).toBe(true);
            expect(result.transactionAmount).toBe('-1'); // -1000000n converts to '-1'
        });

        it('should handle concurrent access to transaction history', () => {
            const concurrentHistory = [
                {
                    applyStage: 'applied',
                    deltas: { 'native-token-id': 1000000n },
                    identifiers: ['tx-hash-1'],
                    transactionHash: 'blockchain-hash-1',
                    transaction: { __wbg_ptr: 1 }
                },
                {
                    applyStage: 'applied',
                    deltas: { 'native-token-id': 2000000n },
                    identifiers: ['tx-hash-2'],
                    transactionHash: 'blockchain-hash-2',
                    transaction: { __wbg_ptr: 2 }
                },
                {
                    applyStage: 'applied',
                    deltas: { 'native-token-id': 3000000n },
                    identifiers: ['tx-hash-3'],
                    transactionHash: 'blockchain-hash-3',
                    transaction: { __wbg_ptr: 3 }
                }
            ];

            (walletManager as any).walletState = {
                transactionHistory: concurrentHistory
            };

            const results = [
                walletManager.hasReceivedTransactionByIdentifier('tx-hash-1'),
                walletManager.hasReceivedTransactionByIdentifier('tx-hash-2'),
                walletManager.hasReceivedTransactionByIdentifier('tx-hash-3')
            ];

            expect(results[0].exists).toBe(true);
            expect(results[1].exists).toBe(true);
            expect(results[2].exists).toBe(true);
            expect(results[0].transactionAmount).toBe('1'); // 1000000n converts to '1'
            expect(results[1].transactionAmount).toBe('2'); // 2000000n converts to '2'
            expect(results[2].transactionAmount).toBe('3'); // 3000000n converts to '3'
        });
    });
}); 