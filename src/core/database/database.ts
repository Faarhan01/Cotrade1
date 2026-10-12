import { DatabaseAdapter } from './databaseAdapter.ts';
import { SqlJsAdapter } from './sqlJsAdapter.ts';

/**
 * Database factory and unified access point
 * Supports multiple database backends via configuration
 */
export class Database {
  private static instance: DatabaseAdapter | null = null;
  private static initialized = false;

  private constructor() {}

  /**
   * Initialize the database with the configured backend.
   * Backend is selected via DB_TYPE env var (sqljs | better-sqlite3).
   * Falls back to sql.js if the selected backend is unavailable.
   */
  static async initialize(options?: DatabaseOptions): Promise<DatabaseAdapter> {
    if (Database.initialized && Database.instance) {
      return Database.instance;
    }

    const config: DatabaseConfig = {
      type: process.env.DB_TYPE || 'sqljs',
      path: process.env.DB_PATH || './data/mt5_bridge.sqlite',
      options,
    };

    Database.instance = await Database.createAdapter(config.type);
    Database.initialized = true;
    return Database.instance;
  }

  /**
   * Get the initialized database instance.
   */
  static getInstance(): DatabaseAdapter {
    if (!Database.instance) {
      throw new Error('Database not initialized. Call Database.initialize() first.');
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

  private static async createAdapter(type: string): Promise<DatabaseAdapter> {
    switch (type) {
      case 'better-sqlite3':
        try {
          // dynamic import keeps better-sqlite3 optional
          const mod = await import('./betterSqlite3Adapter.ts');
          const Adapter = (mod as any).BetterSqlite3Adapter;
          if (Adapter) {
            return new Adapter();
          }
          console.warn('better-sqlite3 adapter unavailable, falling back to sql.js');
          return new SqlJsAdapter();
        } catch (error) {
          console.warn('better-sqlite3 not available, falling back to sql.js:', error);
          return new SqlJsAdapter();
        }
      case 'sqljs':
      default:
        return new SqlJsAdapter();
    }
  }

  // Convenience delegation methods
  static async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    return Database.getInstance().query(sql, params);
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
