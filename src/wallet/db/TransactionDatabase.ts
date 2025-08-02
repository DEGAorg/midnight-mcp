/* istanbul ignore file */

import Database from 'better-sqlite3';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../../logger/index.js';
import { TransactionRecord, TransactionState } from '../../types/wallet.js';
import { config } from '../../config.js';

/**
 * Service for managing transaction records in SQLite
 */
export class TransactionDatabase {
  private db: Database.Database;
  private logger = createLogger('transaction-db');
  private initialized = false;

  /**
   * Constructor initializes the database connection
   * @param dbPath Path to the SQLite database file
   */
  constructor(dbPath?: string) {
    // Use provided path or create one in the wallet backup folder
    const dbDirectory = dbPath 
      ? path.dirname(dbPath) 
      : path.resolve(config.walletBackupFolder);
    
    // Ensure directory exists
    if (!fs.existsSync(dbDirectory)) {
      fs.mkdirSync(dbDirectory, { recursive: true });
    }
    
    const finalDbPath = dbPath || path.join(dbDirectory, 'transactions.db');
    
    this.logger.info(`Initializing transaction database at ${finalDbPath}`);
    this.db = new Database(finalDbPath);
    
    // Initialize database schema
    this.initialize();
  }
  
  /**
   * Initialize database schema if it doesn't exist
   */
  private initialize(): void {
    if (this.initialized) return;
    
    try {
      // Enable WAL journal mode for better concurrent performance
      this.db.pragma('journal_mode = WAL');
      
      // Create transactions table if it doesn't exist
      const createTableSql = `
        CREATE TABLE IF NOT EXISTS transactions (
          id TEXT PRIMARY KEY,
          state TEXT NOT NULL,
          fromAddress TEXT NOT NULL,
          toAddress TEXT NOT NULL,
          amount TEXT NOT NULL,
          txIdentifier TEXT,
          createdAt INTEGER NOT NULL,
          updatedAt INTEGER NOT NULL,
          errorMessage TEXT
        )
      `;
      
      this.db.exec(createTableSql);
      
      // Create index on state for faster queries
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_transactions_state ON transactions(state)');
      
      // Create index on txIdentifier for faster lookups
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_transactions_txIdentifier ON transactions(txIdentifier)');
      
      this.initialized = true;
      this.logger.info('Transaction database initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize transaction database', error);
      throw error;
    }
  }
  
  /**
   * Create a new transaction record
   * @param fromAddress Sender wallet address
   * @param toAddress Recipient wallet address
   * @param amount Amount of funds to send
   * @returns The created transaction record
   */
  public createTransaction(
    fromAddress: string,
    toAddress: string,
    amount: string
  ): TransactionRecord {
    try {
      const now = Date.now();
      const id = uuidv4();
      
      const transaction: TransactionRecord = {
        id,
        state: TransactionState.INITIATED,
        fromAddress,
        toAddress,
        amount,
        createdAt: now,
        updatedAt: now
      };
      
      const stmt = this.db.prepare(`
        INSERT INTO transactions (
          id, state, fromAddress, toAddress, amount, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        transaction.id,
        transaction.state,
        transaction.fromAddress,
        transaction.toAddress,
        transaction.amount,
        transaction.createdAt,
        transaction.updatedAt
      );
      
      this.logger.info(`Created transaction record: ${transaction.id}`);
      return transaction;
    } catch (error) {
      this.logger.error('Failed to create transaction record', error);
      throw error;
    }
  }
  
  /**
   * Update transaction state to SENT with txIdentifier
   * @param id Transaction ID
   * @param txIdentifier Blockchain transaction identifier
   * @returns Updated transaction record
   */
  public markTransactionAsSent(id: string, txIdentifier: string): TransactionRecord | null {
    try {
      const now = Date.now();
      
      const stmt = this.db.prepare(`
        UPDATE transactions
        SET state = ?, txIdentifier = ?, updatedAt = ?
        WHERE id = ?
      `);
      
      const result = stmt.run(
        TransactionState.SENT,
        txIdentifier,
        now,
        id
      );
      
      if (result.changes === 0) {
        this.logger.warn(`No transaction found with ID: ${id}`);
        return null;
      }
      
      this.logger.info(`Updated transaction ${id} to SENT with txIdentifier ${txIdentifier}`);
      return this.getTransactionById(id);
    } catch (error) {
      this.logger.error(`Failed to update transaction ${id} to SENT`, error);
      throw error;
    }
  }
  
  /**
   * Update transaction state to COMPLETED
   * @param txIdentifier Blockchain transaction identifier
   * @returns Updated transaction record
   */
  public markTransactionAsCompleted(txIdentifier: string): TransactionRecord | null {
    try {
      const now = Date.now();
      
      const stmt = this.db.prepare(`
        UPDATE transactions
        SET state = ?, updatedAt = ?
        WHERE txIdentifier = ? AND state = ?
      `);
      
      const result = stmt.run(
        TransactionState.COMPLETED,
        now,
        txIdentifier,
        TransactionState.SENT
      );
      
      if (result.changes === 0) {
        this.logger.warn(`No SENT transaction found with txIdentifier: ${txIdentifier}`);
        return null;
      }
      
      this.logger.info(`Marked transaction with txIdentifier ${txIdentifier} as COMPLETED`);
      return this.getTransactionByTxIdentifier(txIdentifier);
    } catch (error) {
      this.logger.error(`Failed to mark transaction ${txIdentifier} as COMPLETED`, error);
      throw error;
    }
  }
  
  /**
   * Update transaction state to FAILED with error message
   * @param id Transaction ID
   * @param errorMessage Error message explaining the failure
   * @returns Updated transaction record
   */
  public markTransactionAsFailed(id: string, errorMessage: string): TransactionRecord | null {
    try {
      const now = Date.now();
      
      const stmt = this.db.prepare(`
        UPDATE transactions
        SET state = ?, errorMessage = ?, updatedAt = ?
        WHERE id = ?
      `);
      
      const result = stmt.run(
        TransactionState.FAILED,
        errorMessage,
        now,
        id
      );
      
      if (result.changes === 0) {
        this.logger.warn(`No transaction found with ID: ${id}`);
        return null;
      }
      
      this.logger.info(`Marked transaction ${id} as FAILED: ${errorMessage}`);
      return this.getTransactionById(id);
    } catch (error) {
      this.logger.error(`Failed to mark transaction ${id} as FAILED`, error);
      throw error;
    }
  }
  
  /**
   * Get a transaction by its ID
   * @param id Transaction ID
   * @returns Transaction record or null if not found
   */
  public getTransactionById(id: string): TransactionRecord | null {
    try {
      const stmt = this.db.prepare('SELECT * FROM transactions WHERE id = ?');
      const row = stmt.get(id) as TransactionRecord | undefined;
      
      return row || null;
    } catch (error) {
      this.logger.error(`Failed to get transaction with ID: ${id}`, error);
      throw error;
    }
  }
  
  /**
   * Get a transaction by its blockchain txIdentifier
   * @param txIdentifier Blockchain transaction identifier
   * @returns Transaction record or null if not found
   */
  public getTransactionByTxIdentifier(txIdentifier: string): TransactionRecord | null {
    try {
      const stmt = this.db.prepare('SELECT * FROM transactions WHERE txIdentifier = ?');
      const row = stmt.get(txIdentifier) as TransactionRecord | undefined;
      
      return row || null;
    } catch (error) {
      this.logger.error(`Failed to get transaction with txIdentifier: ${txIdentifier}`, error);
      throw error;
    }
  }
  
  /**
   * Get all transactions with a specific state
   * @param state Transaction state
   * @returns Array of transaction records
   */
  public getTransactionsByState(state: TransactionState): TransactionRecord[] {
    try {
      const stmt = this.db.prepare('SELECT * FROM transactions WHERE state = ? ORDER BY updatedAt DESC');
      const rows = stmt.all(state) as TransactionRecord[];
      
      return rows;
    } catch (error) {
      this.logger.error(`Failed to get transactions with state: ${state}`, error);
      throw error;
    }
  }
  
  /**
   * Get all transactions
   * @returns Array of all transaction records
   */
  public getAllTransactions(): TransactionRecord[] {
    try {
      const stmt = this.db.prepare('SELECT * FROM transactions ORDER BY updatedAt DESC');
      const rows = stmt.all() as TransactionRecord[];
      
      return rows;
    } catch (error) {
      this.logger.error('Failed to get all transactions', error);
      throw error;
    }
  }
  
  /**
   * Get pending transactions (INITIATED or SENT)
   * @returns Array of pending transaction records
   */
  public getPendingTransactions(): TransactionRecord[] {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM transactions 
        WHERE state IN (?, ?) 
        ORDER BY updatedAt DESC
      `);
      
      const rows = stmt.all(
        TransactionState.INITIATED,
        TransactionState.SENT
      ) as TransactionRecord[];
      
      return rows;
    } catch (error) {
      this.logger.error('Failed to get pending transactions', error);
      throw error;
    }
  }
  
  /**
   * Close the database connection
   */
  public close(): void {
    try {
      this.db.close();
      this.logger.info('Transaction database connection closed');
    } catch (error) {
      this.logger.error('Error closing transaction database connection', error);
      throw error;
    }
  }
}

export default TransactionDatabase; 