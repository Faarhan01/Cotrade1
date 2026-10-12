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
   * Initialize the database with configured backend
   */
  static async initialize(options?: DatabaseOptions): Promise<DatabaseAdapter> {
    if (Database.initialized && Database.instance) {
      return Database.instance;
    }

    const config = Database.getConfig(options);
    Database.instance = await Database.createAdapter(config);
    Database.initialized = true;
    return Database.instance;
  }

  /**
   * Get the initialized database instance
   */
  static getInstance(): DatabaseAdapter {
    if (!Database.instance) {
      throw new Error('Database not initialized. Call Database.initialize() first.');
    }
    return Database.instance;
  }

  /**
   * Reset and reinitialize database
   */
  static async reset(): Promise<void> {
    if (Database.instance) {
      await Database.instance.close();
    }
    Database.instance = null;
    Database.initialized = false;
  }

  private static getConfig(options?: DatabaseOptions): DatabaseConfig {
    const envType = process.env.DB_TYPE || process.env.DATABASE_TYPE || 'sqljs';
    const envNative = process.env.USE_NATIVE_SQLITE === 'true';

    // If explicitly set to native/sqlite, prefer better-sqlite3 if available
    if (envNative && envType === 'native' || envType === 'sqlite' || envType === 'better-sqlite3') {
      return {
        type: 'better-sqlite3',
        path: process.env.DB_PATH || './data/mt5_bridge.sqlite',
        ...options,
      };
    }

    return {
      type: 'sqljs',
      path: process.env.DB_PATH || './data/mt5_bridge.sqlite',
      ...options,
    };
  }

  private static async createAdapter(config: DatabaseConfig): Promise<DatabaseAdapter> {
    switch (config.type) {
      case 'sqljs':
        return new SqlJsAdapter();
      case 'better-sqlite3':
        try {
          const { BetterSqlite3Adapter } = await import('./betterSqlite3Adapter.ts');
          return new BetterSqlite3Adapter();
        } catch (error) {
          console.warn('better-sqlite3 not available, falling back to sql.js:', error);
          return new SqlJsAdapter();
        }
      default:
        console.warn(`Unknown DB type ${config.type}, falling back to sql.js`);
        return new SqlJsAdapter();
    }
  }

  // Delegate methods for convenience when initialized
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

export interface DatabaseConfig {
  type: 'sqljs' | 'better-sqlite3' | string;
  path?: string;
  options?: any;
}

export interface DatabaseOptions extends Partial<DatabaseConfig> {}
