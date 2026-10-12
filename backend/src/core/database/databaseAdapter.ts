// Database abstraction layer interface
export interface DatabaseAdapter {
  // Query execution methods
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
  execute(sql: string, params?: any[]): Promise<{ changes: number; lastInsertRowid: number }>;
  prepare(sql: string): Statement;
   
  // Transaction methods
  transaction<T>(callback: (db: DatabaseAdapter) => Promise<T>): Promise<T>;
   
  // Utility methods
  close(): Promise<void>;
}
 
// Statement interface for prepared statements
export interface Statement {
  bind(params: any[]): void;
  reset(): void;
  finalize(): void;
  get(params?: any[]): any;
  all(params?: any[]): any[];
  run(params?: any[]): { changes: number; lastInsertRowid: number };
}