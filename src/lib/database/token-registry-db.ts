/* istanbul ignore file */

import Database from 'better-sqlite3';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../../logger/index.js';
import { TokenInfo } from '../../types/wallet.js';
import { config } from '../../config.js';

/**
 * Service for managing token registry records in SQLite
 */
export class TokenRegistryDatabase {
  private db: Database.Database;
  private logger = createLogger('token-registry-db');
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
    
    const finalDbPath = dbPath || path.join(dbDirectory, 'token-registry.db');
    
    this.logger.info(`Initializing token registry database at ${finalDbPath}`);
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
      
      // Create tokens table if it doesn't exist
      const createTableSql = `
        CREATE TABLE IF NOT EXISTS tokens (
          id TEXT PRIMARY KEY,
          name TEXT UNIQUE NOT NULL,
          symbol TEXT NOT NULL,
          contractAddress TEXT NOT NULL,
          domainSeparator TEXT NOT NULL,
          tokenTypeHex TEXT,
          description TEXT,
          decimals INTEGER DEFAULT 6,
          createdAt INTEGER NOT NULL,
          updatedAt INTEGER NOT NULL
        )
      `;
      
      this.db.exec(createTableSql);
      
      // Create index on name for faster lookups
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_tokens_name ON tokens(name)');
      
      // Create index on symbol for faster lookups
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_tokens_symbol ON tokens(symbol)');
      
      // Create index on contractAddress for faster lookups
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_tokens_contractAddress ON tokens(contractAddress)');
      
      // Create index on tokenTypeHex for faster lookups
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_tokens_tokenTypeHex ON tokens(tokenTypeHex)');
      
      this.initialized = true;
      this.logger.info('Token registry database initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize token registry database', error);
      throw error;
    }
  }
  
  /**
   * Register a new token
   * @param tokenInfo Token information
   * @returns The created token record
   */
  public registerToken(tokenInfo: TokenInfo): TokenInfo {
    try {
      const now = Date.now();
      const id = uuidv4();
      
      const token: TokenInfo & { id: string; createdAt: number; updatedAt: number } = {
        id,
        ...tokenInfo,
        createdAt: now,
        updatedAt: now
      };
      
      const stmt = this.db.prepare(`
        INSERT INTO tokens (
          id, name, symbol, contractAddress, domainSeparator, tokenTypeHex, description, decimals, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        token.id,
        token.name,
        token.symbol,
        token.contractAddress,
        token.domainSeparator,
        token.tokenTypeHex,
        token.description,
        token.decimals || 6,
        token.createdAt,
        token.updatedAt
      );
      
      this.logger.info(`Registered token: ${token.name} (${token.symbol})`);
      return tokenInfo;
    } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
        throw new Error(`Token with name '${tokenInfo.name}' is already registered`);
      }
      this.logger.error('Failed to register token', error);
      throw error;
    }
  }
  
  /**
   * Get a token by its name
   * @param name Token name
   * @returns Token information or null if not found
   */
  public getTokenByName(name: string): TokenInfo | null {
    try {
      const stmt = this.db.prepare('SELECT * FROM tokens WHERE name = ?');
      const row = stmt.get(name) as (TokenInfo & { id: string; createdAt: number; updatedAt: number }) | undefined;
      
      if (!row) {
        return null;
      }
      
      // Return only the TokenInfo fields, excluding database-specific fields
      const { id, createdAt, updatedAt, ...tokenInfo } = row;
      return tokenInfo;
    } catch (error) {
      this.logger.error(`Failed to get token with name: ${name}`, error);
      throw error;
    }
  }
  
  /**
   * Get a token by its symbol
   * @param symbol Token symbol
   * @returns Token information or null if not found
   */
  public getTokenBySymbol(symbol: string): TokenInfo | null {
    try {
      const stmt = this.db.prepare('SELECT * FROM tokens WHERE symbol = ?');
      const row = stmt.get(symbol) as (TokenInfo & { id: string; createdAt: number; updatedAt: number }) | undefined;
      
      if (!row) {
        return null;
      }
      
      // Return only the TokenInfo fields, excluding database-specific fields
      const { id, createdAt, updatedAt, ...tokenInfo } = row;
      return tokenInfo;
    } catch (error) {
      this.logger.error(`Failed to get token with symbol: ${symbol}`, error);
      throw error;
    }
  }

  /**
   * Get a token by its contract address
   * @param contractAddress Contract address
   * @returns Token information or null if not found
   */
  public getTokenByContractAddress(contractAddress: string): TokenInfo | null {
    try {
      const stmt = this.db.prepare('SELECT * FROM tokens WHERE contractAddress = ?');
      const row = stmt.get(contractAddress) as (TokenInfo & { id: string; createdAt: number; updatedAt: number }) | undefined;
      
      if (!row) {
        return null;
      }
      
      // Return only the TokenInfo fields, excluding database-specific fields
      const { id, createdAt, updatedAt, ...tokenInfo } = row;
      return tokenInfo;
    } catch (error) {
      this.logger.error(`Failed to get token with contract address: ${contractAddress}`, error);
      throw error;
    }
  }
  
  /**
   * Get a token by its token type hex
   * @param tokenTypeHex Token type hex
   * @returns Token information or null if not found
   */
  public getTokenByTokenTypeHex(tokenTypeHex: string): TokenInfo | null {
    try {
      const stmt = this.db.prepare('SELECT * FROM tokens WHERE tokenTypeHex = ?');
      const row = stmt.get(tokenTypeHex) as (TokenInfo & { id: string; createdAt: number; updatedAt: number }) | undefined;
      
      if (!row) {
        return null;
      }
      
      // Return only the TokenInfo fields, excluding database-specific fields
      const { id, createdAt, updatedAt, ...tokenInfo } = row;
      return tokenInfo;
    } catch (error) {
      this.logger.error(`Failed to get token with token type hex: ${tokenTypeHex}`, error);
      throw error;
    }
  }
  
  /**
   * Get all registered tokens
   * @returns Array of all token records
   */
  public getAllTokens(): TokenInfo[] {
    try {
      const stmt = this.db.prepare('SELECT * FROM tokens ORDER BY createdAt DESC');
      const rows = stmt.all() as (TokenInfo & { id: string; createdAt: number; updatedAt: number })[];
      
      // Return only the TokenInfo fields, excluding database-specific fields
      return rows.map(({ id, createdAt, updatedAt, ...tokenInfo }) => tokenInfo);
    } catch (error) {
      this.logger.error('Failed to get all tokens', error);
      throw error;
    }
  }
  
  /**
   * Check if a token is registered by name
   * @param name Token name
   * @returns True if token is registered
   */
  public isTokenRegistered(name: string): boolean {
    try {
      const stmt = this.db.prepare('SELECT COUNT(*) as count FROM tokens WHERE name = ?');
      const result = stmt.get(name) as { count: number };
      return result.count > 0;
    } catch (error) {
      this.logger.error(`Failed to check if token is registered: ${name}`, error);
      throw error;
    }
  }
  
  /**
   * Update token information
   * @param name Token name
   * @param updates Partial token information to update
   * @returns Updated token information or null if not found
   */
  public updateToken(name: string, updates: Partial<Omit<TokenInfo, 'name'>>): TokenInfo | null {
    try {
      const now = Date.now();
      
      // Build dynamic update query
      const updateFields = [];
      const values = [];
      
      if (updates.symbol !== undefined) {
        updateFields.push('symbol = ?');
        values.push(updates.symbol);
      }
      if (updates.contractAddress !== undefined) {
        updateFields.push('contractAddress = ?');
        values.push(updates.contractAddress);
      }
      if (updates.domainSeparator !== undefined) {
        updateFields.push('domainSeparator = ?');
        values.push(updates.domainSeparator);
      }
      if (updates.tokenTypeHex !== undefined) {
        updateFields.push('tokenTypeHex = ?');
        values.push(updates.tokenTypeHex);
      }
      if (updates.description !== undefined) {
        updateFields.push('description = ?');
        values.push(updates.description);
      }
      if (updates.decimals !== undefined) {
        updateFields.push('decimals = ?');
        values.push(updates.decimals);
      }
      
      if (updateFields.length === 0) {
        return this.getTokenByName(name);
      }
      
      updateFields.push('updatedAt = ?');
      values.push(now);
      values.push(name);
      
      const stmt = this.db.prepare(`
        UPDATE tokens
        SET ${updateFields.join(', ')}
        WHERE name = ?
      `);
      
      const result = stmt.run(...values);
      
      if (result.changes === 0) {
        this.logger.warn(`No token found with name: ${name}`);
        return null;
      }
      
      this.logger.info(`Updated token: ${name}`);
      return this.getTokenByName(name);
    } catch (error) {
      this.logger.error(`Failed to update token: ${name}`, error);
      throw error;
    }
  }
  
  /**
   * Remove a token from registry
   * @param name Token name
   * @returns True if token was removed
   */
  public unregisterToken(name: string): boolean {
    try {
      const stmt = this.db.prepare('DELETE FROM tokens WHERE name = ?');
      const result = stmt.run(name);
      
      if (result.changes === 0) {
        this.logger.warn(`No token found with name: ${name}`);
        return false;
      }
      
      this.logger.info(`Unregistered token: ${name}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to unregister token: ${name}`, error);
      throw error;
    }
  }
  
  /**
   * Get registry statistics
   * @returns Registry statistics
   */
  public getRegistryStats(): { totalTokens: number; tokensBySymbol: Record<string, number> } {
    try {
      // Get total count
      const countStmt = this.db.prepare('SELECT COUNT(*) as total FROM tokens');
      const countResult = countStmt.get() as { total: number };
      
      // Get tokens by symbol
      const symbolStmt = this.db.prepare('SELECT symbol, COUNT(*) as count FROM tokens GROUP BY symbol');
      const symbolResults = symbolStmt.all() as { symbol: string; count: number }[];
      
      const tokensBySymbol: Record<string, number> = {};
      symbolResults.forEach(result => {
        tokensBySymbol[result.symbol] = result.count;
      });
      
      return {
        totalTokens: countResult.total,
        tokensBySymbol
      };
    } catch (error) {
      this.logger.error('Failed to get registry statistics', error);
      throw error;
    }
  }
  
  /**
   * Close the database connection
   */
  public close(): void {
    try {
      this.db.close();
      this.logger.info('Token registry database connection closed');
    } catch (error) {
      this.logger.error('Error closing token registry database connection', error);
      throw error;
    }
  }
}

export default TokenRegistryDatabase;
