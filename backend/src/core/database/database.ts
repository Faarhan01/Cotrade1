import { DatabaseAdapter } from './databaseAdapter.ts';
import { NodeSqliteAdapter } from './nodeSqliteAdapter.ts';

/**
 * Database factory and unified access point
 * Powered by high-performance built-in node:sqlite (Node.js 22+)
 */
export class Database {
  private static instance: DatabaseAdapter | null = null;
  private static initialized = false;

  private constructor() {}

  /**
   * Initialize the database with node:sqlite backend.
   */
  static async initialize(options?: DatabaseOptions): Promise<DatabaseAdapter> {
    if (Database.initialized && Database.instance) {
      return Database.instance;
    }

    const dbPath = process.env.DB_PATH || 'mt5_bridge.sqlite';
    const dataDir = process.env.DATA_DIR || './data';

    const adapter = new NodeSqliteAdapter(dbPath, dataDir);
    adapter.initialize();

    Database.instance = adapter;
    Database.initialized = true;
    return Database.instance;
  }

  /**
   * Get the initialized database instance.
   */
  static getInstance(): DatabaseAdapter {
    if (!Database.instance) {
      const dbPath = process.env.DB_PATH || 'mt5_bridge.sqlite';
      const dataDir = process.env.DATA_DIR || './data';
      const adapter = new NodeSqliteAdapter(dbPath, dataDir);
      adapter.initialize();
      Database.instance = adapter;
      Database.initialized = true;
    }
    return Database.instance;
  }

  /**
   * Reset and reinitialize the database.
   */
  static async reset(): Promise<void> {
    if (Database.instance) {
      await Database.instance.close();
    }
    Database.instance = null;
    Database.initialized = false;
  }

  // Convenience delegation methods
  static async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    return Database.getInstance().query<T>(sql, params);
  }

  static async execute(sql: string, params?: any[]): Promise<{ changes: number; lastInsertRowid: number }> {
    return Database.getInstance().execute(sql, params);
  }

  static prepare(sql: string): any {
    return Database.getInstance().prepare(sql);
  }

  static async transaction<T>(callback: (db: DatabaseAdapter) => Promise<T>): Promise<T> {
    return Database.getInstance().transaction(callback);
  }
}

export interface DatabaseOptions {
  [key: string]: any;
}

export interface DatabaseConfig {
  type: string;
  path?: string;
  options?: DatabaseOptions;
}