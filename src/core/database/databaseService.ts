import { DatabaseAdapter } from './databaseAdapter.ts';
import { Database } from './database.ts';

/**
 * Database service that provides a unified interface for database operations
 * Supports switching between sql.js (WASM) and better-sqlite3 based on environment
 */
export class DatabaseService {
  private static instance: DatabaseService;
  private adapter: DatabaseAdapter;

  private constructor() {
    this.adapter = Database.getInstance();
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    return this.adapter.query(sql, params);
  }

  async execute(sql: string, params?: any[]): Promise<{ changes: number; lastInsertRowid: number }> {
    return this.adapter.execute(sql, params);
  }

  prepare(sql: string): any {
    return this.adapter.prepare(sql);
  }

  async transaction<T>(callback: (db: DatabaseAdapter) => Promise<T>): Promise<T> {
    return this.adapter.transaction(callback);
  }

  async close(): Promise<void> {
    return this.adapter.close();
  }
}
