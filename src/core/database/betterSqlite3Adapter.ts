import { DatabaseAdapter, Statement } from './databaseAdapter.ts';
import Database, { Database as BetterSqlite3Database } from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

export class BetterSqlite3Adapter implements DatabaseAdapter {
  protected dbInstance: BetterSqlite3Database | null = null;
  protected readonly dbFilePath: string;
  protected readonly dataDir: string;

  constructor(dbFilePath: string = 'mt5_bridge.sqlite', dataDir: string = './data') {
    this.dbFilePath = dbFilePath;
    this.dataDir = dataDir;
  }

  protected initialize(): BetterSqlite3Database {
    if (this.dbInstance) return this.dbInstance;

    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    const dbFile = path.join(this.dataDir, this.dbFilePath);
    this.dbInstance = new Database(dbFile, {
      // Enable WAL mode for better concurrency
      // Note: better-sqlite3 doesn't directly support WAL in constructor,
      // but we can set it via pragma
    });

    // Enable WAL mode and foreign key constraints
    this.dbInstance.pragma('journal_mode = WAL');
    this.dbInstance.pragma('foreign_keys = ON');

    return this.dbInstance;
  }

  public ensureInitialized(): BetterSqlite3Database {
    if (!this.dbInstance) {
      return this.initialize();
    }
    return this.dbInstance;
  }

  public getDbInstance(): BetterSqlite3Database {
    const db = this.ensureInitialized();
    if (!db) {
      throw new Error('Failed to initialize database');
    }
    return db;
  }

  async query(sql: string, params: any[] = []): Promise<any[]> {
    const db = this.initialize();
    try {
      // better-sqlite3's all() method returns all rows for SELECT statements
      const result = db.prepare(sql).all(params);
      return result;
    } catch (error) {
      console.error('Error executing query:', error);
      throw error;
    }
  }

  async execute(sql: string, params: any[] = []): Promise<{ changes: number; lastInsertRowid: number }> {
    const db = this.initialize();
    try {
      const result = db.prepare(sql).run(params);
      return { changes: Number(result.changes), lastInsertRowid: Number(result.lastInsertRowid) };
    } catch (error) {
      console.error('Error executing statement:', error);
      throw error;
    }
  }

  prepare(sql: string): Statement {
    return new BetterSqlite3StatementWrapper(sql, this);
  }

  async transaction<T>(callback: (db: DatabaseAdapter) => Promise<T>): Promise<T> {
    const db = this.initialize();
    // Begin transaction
    db.transaction(() => {
      return callback(this);
    });
    // Note: better-sqlite3's transaction method automatically commits or rolls back
    // based on whether the callback throws an error
    return callback(this);
  }

  async close(): Promise<void> {
    if (this.dbInstance) {
      this.dbInstance.close();
      this.dbInstance = null;
    }
  }
}

// Wrapper for better-sqlite3 Statement to match our Statement interface
class BetterSqlite3StatementWrapper implements Statement {
  private stmt: ReturnType<BetterSqlite3Database['prepare']> | null = null;
  private sql: string;
  private adapter: BetterSqlite3Adapter;

  constructor(sql: string, adapter: BetterSqlite3Adapter) {
    this.sql = sql;
    this.adapter = adapter;
  }

  private getStmt(): ReturnType<BetterSqlite3Database['prepare']> {
    // Ensure database is initialized
    if (!this.stmt) {
      const db = this.adapter.getDbInstance();
      this.stmt = db.prepare(this.sql);
    }
    if (!this.stmt) {
      throw new Error('Failed to initialize statement');
    }
    return this.stmt;
  }

  bind(params: any[]): void {
    if (this.stmt) {
      this.stmt.bind(params);
    }
  }

  reset(): void {
    // better-sqlite3 Statement does not have a reset method; it's a no-op
    // To reuse the statement, simply call bind again with new parameters.
  }

  finalize(): void {
    if (this.stmt) {
      // better-sqlite3 statements are finalized automatically when garbage collected
      // But we can explicitly nullify our reference
      this.stmt = null;
    }
  }

  get(params?: any[]): any {
    const stmt = this.getStmt();
    return stmt.get(params ?? []);
  }

  all(params?: any[]): any[] {
    const stmt = this.getStmt();
    return stmt.all(params ?? []);
  }

  run(params?: any[]): { changes: number; lastInsertRowid: number } {
    const stmt = this.getStmt();
    const result = stmt.run(params ?? []);
    return { changes: Number(result.changes), lastInsertRowid: Number(result.lastInsertRowid) };
  }
}
