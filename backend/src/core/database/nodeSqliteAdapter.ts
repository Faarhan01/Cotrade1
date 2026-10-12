/**
 * NodeSQLite Adapter (built-in)
 *
 * Used when DB_TYPE=node:sqlite. Uses the built-in node:sqlite module
 * available in Node.js 22+ for better performance without external dependencies.
 */

import { DatabaseAdapter, Statement } from './databaseAdapter.ts';
import sqlite from 'node:sqlite';
import fs from 'fs';
import path from 'path';

export class NodeSqliteAdapter implements DatabaseAdapter {
  public dbInstance: sqlite.DatabaseSync | null = null;
  private readonly dbFilePath: string;
  private readonly dataDir: string;

  constructor(dbFilePath: string = 'mt5_bridge.sqlite', dataDir: string = './data') {
    this.dbFilePath = dbFilePath;
    this.dataDir = dataDir;
  }

  private initialize(): sqlite.DatabaseSync {
    if (this.dbInstance) return this.dbInstance;

    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    const dbFile = path.join(this.dataDir, this.dbFilePath);
    this.dbInstance = new sqlite.DatabaseSync(dbFile);
    return this.dbInstance;
  }

  public getDbInstance(): sqlite.DatabaseSync {
    if (!this.dbInstance) {
      throw new Error('Database not initialized');
    }
    return this.dbInstance;
  }

  public convertParamsToObject(params: any[]): Record<string, any> {
    const obj: Record<string, any> = {};
    for (let i = 0; i < params.length; i++) {
      obj[`:${i}`] = params[i];
    }
    return obj;
  }

  async query(sql: string, params: any[] = []): Promise<any[]> {
    const db = this.initialize();
    try {
      // Handle SELECT statements to return all rows
      if (sql.toUpperCase().trim().startsWith('SELECT')) {
        const stmt = db.prepare(sql);
        try {
          if (params.length > 0) {
            const paramObj = this.convertParamsToObject(params);
            return stmt.all(paramObj) as any[];
          } else {
            return stmt.all() as any[];
          }
        } finally {
          // StatementSync doesn't require explicit finalization in node:sqlite
          // Resources are managed automatically, but we null out our reference
          // to prevent potential memory leaks in long-running processes
          // @ts-ignore: We're accessing a private property for cleanup
          stmt.free && stmt.free();
        }
      } else {
        // For non-SELECT statements, execute and return empty array (consistent with sql.js adapter)
        if (params.length > 0) {
          const paramObj = this.convertParamsToObject(params);
          // @ts-ignore: exec method signature may not be correctly typed in definitions
          (db as any).exec(sql, paramObj);
        } else {
          // @ts-ignore: exec method signature may not be correctly typed in definitions
          (db as any).exec(sql);
        }
        return [];
      }
    } catch (error) {
      console.error('Error executing query:', error);
      throw error;
    }
  }

  async execute(sql: string, params: any[] = []): Promise<{ changes: number; lastInsertRowid: number }> {
    const db = this.initialize();
    try {
      const stmt = db.prepare(sql);
      try {
        if (params.length > 0) {
          const paramObj = this.convertParamsToObject(params);
          const result = stmt.run(paramObj);
          return { 
            changes: Number(result.changes), 
            lastInsertRowid: Number(result.lastInsertRowid) 
          };
        } else {
          const result = stmt.run();
          return { 
            changes: Number(result.changes), 
            lastInsertRowid: Number(result.lastInsertRowid) 
          };
        }
      } finally {
        // StatementSync doesn't require explicit finalization in node:sqlite
        // Resources are managed automatically, but we null out our reference
        // to prevent potential memory leaks in long-running processes
        // @ts-ignore: We're accessing a private property for cleanup
        stmt.free && stmt.free();
      }
    } catch (error) {
      console.error('Error executing statement:', error);
      throw error;
    }
  }

  prepare(sql: string): Statement {
    return new NodeSqliteStatementWrapper(sql, this);
  }

  async transaction<T>(callback: (db: DatabaseAdapter) => Promise<T>): Promise<T> {
    // For node:sqlite, we can use the synchronous transaction mechanism
    // but we'll keep it simple and just call the callback
    return callback(this);
  }

  async close(): Promise<void> {
    // node:sqlite DatabaseSync doesn't have an explicit close method
    // The instance is garbage collected when no longer referenced
    this.dbInstance = null;
  }
}

// Wrapper for node:sqlite StatementSync to match our Statement interface
class NodeSqliteStatementWrapper implements Statement {
  private stmt: sqlite.StatementSync | null = null;
  private sql: string;
  private adapter: NodeSqliteAdapter;

  constructor(sql: string, adapter: NodeSqliteAdapter) {
    this.sql = sql;
    this.adapter = adapter;
  }

  private initializeStatement(): sqlite.StatementSync {
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
    // In node:sqlite, parameters are passed directly to execution methods
    // This method is kept for interface compatibility but does nothing
    // Actual parameter binding happens in get/all/run methods
  }

  reset(): void {
    // StatementSync doesn't have a reset method, but it can be reused without explicit reset
    // This method is kept for interface compatibility but does nothing
  }

  finalize(): void {
    // StatementSync doesn't have an explicit free/finalize method
    // Resources are managed automatically, but we can null out our reference
    this.stmt = null;
  }

  get(params?: any[]): any {
    const stmt = this.initializeStatement();
    if (params && params.length > 0) {
      const paramObj = this.adapter.convertParamsToObject(params);
      return stmt.get(paramObj);
    }
    return stmt.get();
  }

  all(params?: any[]): any[] {
    const stmt = this.initializeStatement();
    if (params && params.length > 0) {
      const paramObj = this.adapter.convertParamsToObject(params);
      return stmt.all(paramObj) as any[];
    }
    return stmt.all() as any[];
  }

  run(params?: any[]): { changes: number; lastInsertRowid: number } {
    const stmt = this.initializeStatement();
    if (params && params.length > 0) {
      const paramObj = this.adapter.convertParamsToObject(params);
      const result = stmt.run(paramObj);
      return { 
        changes: Number(result.changes), 
        lastInsertRowid: Number(result.lastInsertRowid) 
      };
    } else {
      const result = stmt.run();
      return { 
        changes: Number(result.changes), 
        lastInsertRowid: Number(result.lastInsertRowid) 
      };
    }
  }
}