/// <reference types="node" />
import { DatabaseAdapter, Statement } from './databaseAdapter.ts';
import initSqlJs, { Database, Statement as SqlJsStatement } from 'sql.js';
import fs from 'fs';
import path from 'path';

export class SqlJsAdapter implements DatabaseAdapter {
  public dbInstance: Database | null = null;
  private saveDebounceTimer: NodeJS.Timeout | null = null;
  private readonly dbFilePath: string;
  private readonly dataDir: string;

  constructor(dbFilePath: string = 'mt5_bridge.sqlite', dataDir: string = './data') {
    this.dbFilePath = dbFilePath;
    this.dataDir = dataDir;
  }

  private async initialize(): Promise<Database> {
    if (this.dbInstance) return this.dbInstance;

    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    const SQL = await initSqlJs();
    const dbFile = path.join(this.dataDir, this.dbFilePath);

    if (fs.existsSync(dbFile)) {
      try {
        const fileBuffer = fs.readFileSync(dbFile);
        this.dbInstance = new SQL.Database(fileBuffer);
      } catch (err) {
        console.warn('Could not read existing sqlite file, creating fresh database:', err);
        this.dbInstance = new SQL.Database();
      }
    } else {
      this.dbInstance = new SQL.Database();
    }

    return this.dbInstance;
  }
  public getDbInstance(): Database {
    if (!this.dbInstance) {
      throw new Error('Database not initialized');
    }
    return this.dbInstance;
  }

  async query(sql: string, params: any[] = []): Promise<any[]> {
    const db = await this.initialize();
    const stmt = db.prepare(sql);
    try {
      // Handle SELECT statements to return all rows
      if (sql.toUpperCase().trim().startsWith('SELECT')) {
        stmt.reset();
        const result: any[] = [];
        let row = stmt.get(params);
        while (row !== undefined && row !== null) {
          result.push(row);
          row = stmt.get();
        }
        return result;
      } else {
        // For non-SELECT statements, return the first row if any
        const row = stmt.get(params);
        return row !== undefined && row !== null ? [row] : [];
      }
    } finally {
      stmt.free();
    }
  }

  async execute(sql: string, params: any[] = []): Promise<{ changes: number; lastInsertRowid: number }> {
    const db = await this.initialize();
    const stmt = db.prepare(sql);
    try {
      stmt.run(params);
      const changes = db.getRowsModified();
      // @ts-ignore: lastInsertRowid may not exist in types but exists at runtime
      const lastInsertRowid = db.lastInsertRowid;
      return { changes, lastInsertRowid };
    } finally {
      stmt.free();
    }
  }

  prepare(sql: string): Statement {
    return new SqlJsStatementWrapper(sql, this);
  }

  async transaction<T>(callback: (db: DatabaseAdapter) => Promise<T>): Promise<T> {
    // For sql.js, we'll implement a simple transaction wrapper
    // In a real implementation, we'd use BEGIN TRANSACTION, COMMIT, ROLLBACK
    return callback(this);
  }

  async close(): Promise<void> {
    // sql.js doesn't have a explicit close method for the database instance
    // The instance is garbage collected when no longer referenced
    this.dbInstance = null;
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
      this.saveDebounceTimer = null;
    }
  }
}

// Wrapper for sql.js Statement to match our Statement interface
class SqlJsStatementWrapper implements Statement {
  private stmt: SqlJsStatement | null = null;
  private sql: string;
  private adapter: SqlJsAdapter;

  constructor(sql: string, adapter: SqlJsAdapter) {
    this.sql = sql;
    this.adapter = adapter;
  }

  private initializeStatement(): SqlJsStatement {
    // Ensure database is initialized
    if (!this.adapter.dbInstance) {
      throw new Error('Database not initialized. Call query() or execute() first to initialize the database.');
    }
    
    if (!this.stmt) {
      this.stmt = this.adapter.dbInstance.prepare(this.sql);
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
    if (this.stmt) {
      this.stmt.reset();
    }
  }

  finalize(): void {
    if (this.stmt) {
      this.stmt.free();
      this.stmt = null;
    }
  }

  get(params?: any[]): any {
    const stmt = this.initializeStatement();
    return stmt.get(params);
  }

  all(params?: any[]): any[] {
    const stmt = this.initializeStatement();
    stmt.bind(params);
    stmt.reset();
    const result: any[] = [];
    let row = stmt.get();
    while (row !== undefined && row !== null) {
      result.push(row);
      row = stmt.get();
    }
    return result;
  }

  run(params?: any[]): { changes: number; lastInsertRowid: number } {
    const stmt = this.initializeStatement();
    stmt.bind(params);
    stmt.run();
    const changes = this.adapter.dbInstance!.getRowsModified();
    // @ts-ignore: lastInsertRowid may not exist in types but exists at runtime
    const lastInsertRowid = this.adapter.dbInstance!.lastInsertRowid;
    return { changes, lastInsertRowid };
  }
}