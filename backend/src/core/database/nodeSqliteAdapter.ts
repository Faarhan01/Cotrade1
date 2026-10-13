/**
 * NodeSQLite Adapter (built-in node:sqlite)
 *
 * Uses the built-in node:sqlite module available in Node.js 22+
 * High-performance, zero native external dependencies, ACID compliant SQLite.
 */

import { DatabaseAdapter, Statement } from './databaseAdapter.ts';
import sqlite from 'node:sqlite';
import fs from 'fs';
import path from 'path';

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  symbol TEXT,
  order_type TEXT,
  volume REAL,
  price REAL,
  sl REAL,
  tp REAL,
  ticket INTEGER,
  magic INTEGER,
  comment TEXT,
  status TEXT NOT NULL,
  source TEXT NOT NULL,
  deal_ticket INTEGER,
  execution_price REAL,
  execution_time_ms INTEGER,
  error_code INTEGER,
  error_message TEXT,
  created_at INTEGER NOT NULL,
  executed_at INTEGER
);

CREATE TABLE IF NOT EXISTS positions_history (
  ticket INTEGER PRIMARY KEY,
  symbol TEXT NOT NULL,
  type TEXT NOT NULL,
  volume REAL NOT NULL,
  open_price REAL NOT NULL,
  close_price REAL,
  sl REAL,
  tp REAL,
  profit REAL,
  swap REAL,
  magic INTEGER,
  comment TEXT,
  open_time INTEGER NOT NULL,
  close_time INTEGER,
  status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS account_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  login INTEGER NOT NULL,
  balance REAL NOT NULL,
  equity REAL NOT NULL,
  margin REAL NOT NULL,
  free_margin REAL NOT NULL,
  margin_level REAL NOT NULL,
  profit REAL NOT NULL,
  currency TEXT,
  server TEXT,
  created_at INTEGER NOT NULL,
  created_at_iso TEXT
);

CREATE TABLE IF NOT EXISTS candles_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  time INTEGER NOT NULL,
  open REAL NOT NULL,
  high REAL NOT NULL,
  low REAL NOT NULL,
  close REAL NOT NULL,
  volume REAL NOT NULL,
  time_iso TEXT,
  UNIQUE(symbol, timeframe, time)
);

CREATE TABLE IF NOT EXISTS ticks_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  bid REAL NOT NULL,
  ask REAL NOT NULL,
  spread INTEGER NOT NULL,
  timestamp INTEGER NOT NULL,
  time_iso TEXT
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  timestamp INTEGER NOT NULL,
  level TEXT NOT NULL,
  title TEXT NOT NULL,
  details TEXT NOT NULL,
  source TEXT NOT NULL,
  ticket INTEGER
);

CREATE TABLE IF NOT EXISTS risk_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  global_tp_usd REAL NOT NULL,
  global_sl_usd REAL NOT NULL,
  max_drawdown_pct REAL NOT NULL,
  kill_switch INTEGER NOT NULL,
  trailing_enabled INTEGER NOT NULL,
  trailing_distance INTEGER NOT NULL,
  trailing_step INTEGER NOT NULL,
  max_lot_size REAL NOT NULL,
  max_open_positions INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS strategies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL,
  symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  parameters_json TEXT NOT NULL,
  status TEXT NOT NULL,
  tags_json TEXT,
  author TEXT,
  notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS observations (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  symbol TEXT,
  timeframe TEXT,
  strategy_id TEXT,
  category TEXT NOT NULL,
  tags_json TEXT,
  metrics_json TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS backtest_results (
  id TEXT PRIMARY KEY,
  strategy_id TEXT NOT NULL,
  strategy_name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  candle_count INTEGER NOT NULL,
  start_time INTEGER NOT NULL,
  start_time_iso TEXT,
  end_time INTEGER NOT NULL,
  end_time_iso TEXT,
  initial_deposit REAL NOT NULL,
  final_equity REAL NOT NULL,
  net_profit REAL NOT NULL,
  profit_factor REAL NOT NULL,
  win_rate_pct REAL NOT NULL,
  total_trades INTEGER NOT NULL,
  winning_trades INTEGER NOT NULL,
  losing_trades INTEGER NOT NULL,
  max_drawdown_pct REAL NOT NULL,
  max_drawdown_usd REAL NOT NULL,
  average_trade_profit REAL NOT NULL,
  average_win REAL NOT NULL,
  average_loss REAL NOT NULL,
  risk_reward_ratio REAL NOT NULL,
  trades_json TEXT NOT NULL,
  equity_curve_json TEXT NOT NULL,
  evaluated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS bots (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  strategy_id TEXT NOT NULL,
  strategy_name TEXT NOT NULL,
  strategy_type TEXT NOT NULL,
  symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  status TEXT NOT NULL,
  execution_mode TEXT NOT NULL,
  magic_number INTEGER NOT NULL,
  allocation_json TEXT NOT NULL,
  trailing_stop_json TEXT NOT NULL,
  cooldown_seconds INTEGER NOT NULL,
  parameters_override_json TEXT,
  stats_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS bot_executions (
  id TEXT PRIMARY KEY,
  bot_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  order_type TEXT NOT NULL,
  volume REAL NOT NULL,
  entry_price REAL NOT NULL,
  exit_price REAL,
  sl REAL,
  tp REAL,
  ticket INTEGER,
  deal_ticket INTEGER,
  pnl REAL,
  status TEXT NOT NULL,
  execution_mode TEXT NOT NULL,
  opened_at INTEGER NOT NULL,
  closed_at INTEGER,
  reason TEXT,
  magic_number INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS bot_logs (
  id TEXT PRIMARY KEY,
  bot_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  data_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_candles_lookup ON candles_history(symbol, timeframe, time);
CREATE INDEX IF NOT EXISTS idx_ticks_lookup ON ticks_history(symbol, timestamp);
CREATE INDEX IF NOT EXISTS idx_strategies_symbol ON strategies(symbol, status);
CREATE INDEX IF NOT EXISTS idx_backtest_strategy ON backtest_results(strategy_id, evaluated_at);
CREATE INDEX IF NOT EXISTS idx_observations_cat ON observations(category, created_at);
CREATE INDEX IF NOT EXISTS idx_account_created ON account_history(created_at);
CREATE INDEX IF NOT EXISTS idx_bots_status ON bots(status, symbol);
CREATE INDEX IF NOT EXISTS idx_bot_exec_bot ON bot_executions(bot_id, opened_at);
CREATE INDEX IF NOT EXISTS idx_bot_logs_time ON bot_logs(bot_id, timestamp);
`;

function sanitizeParams(params?: any[] | any): any[] {
  if (params === undefined || params === null) return [];
  if (Array.isArray(params)) {
    return params.map((p) => (p === undefined ? null : p));
  }
  return [params === undefined ? null : params];
}

export class NodeSqliteAdapter implements DatabaseAdapter {
  public dbInstance: sqlite.DatabaseSync | null = null;
  private readonly dbFilePath: string;
  private readonly dataDir: string;
  private isSchemaInitialized = false;

  constructor(dbFilePath: string = 'mt5_bridge.sqlite', dataDir: string = './data') {
    this.dbFilePath = dbFilePath;
    this.dataDir = dataDir;
  }

  public initialize(): sqlite.DatabaseSync {
    if (this.dbInstance) return this.dbInstance;

    const resolvedDataDir = path.resolve(process.cwd(), this.dataDir);
    if (!fs.existsSync(resolvedDataDir)) {
      fs.mkdirSync(resolvedDataDir, { recursive: true });
    }

    const fullDbPath = path.isAbsolute(this.dbFilePath)
      ? this.dbFilePath
      : path.join(resolvedDataDir, path.basename(this.dbFilePath));

    this.dbInstance = new sqlite.DatabaseSync(fullDbPath);

    // Performance & integrity pragmas
    try {
      this.dbInstance.exec(`
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        PRAGMA foreign_keys = ON;
      `);
    } catch {
      // Pragmas may vary per environment
    }

    // Auto-initialize tables and schema
    if (!this.isSchemaInitialized) {
      this.initSchema();
      this.isSchemaInitialized = true;
    }

    return this.dbInstance;
  }

  public initSchema(): void {
    if (!this.dbInstance) {
      this.initialize();
      return;
    }
    try {
      this.dbInstance.exec(SCHEMA_SQL);

      // Safe schema migrations for existing installations
      try {
        this.dbInstance.exec('ALTER TABLE account_history ADD COLUMN created_at_iso TEXT;');
      } catch {
        // column exists or new table
      }

      // Initialize default risk settings if not present
      const existingRisk = this.dbInstance.prepare('SELECT id FROM risk_settings WHERE id = 1').get();
      if (!existingRisk) {
        this.dbInstance.prepare(`
          INSERT INTO risk_settings (
            id, global_tp_usd, global_sl_usd, max_drawdown_pct, kill_switch,
            trailing_enabled, trailing_distance, trailing_step, max_lot_size,
            max_open_positions, updated_at
          ) VALUES (1, 500, 250, 10, 0, 1, 15, 5, 2.0, 5, ?)
        `).run(Date.now());
      }
    } catch (err: any) {
      console.error('[NodeSqliteAdapter] Schema init error:', err.message);
    }
  }

  public getDbInstance(): sqlite.DatabaseSync {
    if (!this.dbInstance) {
      return this.initialize();
    }
    return this.dbInstance;
  }

  async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    const db = this.initialize();
    const cleanParams = sanitizeParams(params);
    const trimmed = sql.trim().toUpperCase();

    try {
      if (trimmed.startsWith('SELECT') || trimmed.startsWith('PRAGMA') || trimmed.startsWith('WITH')) {
        const stmt = db.prepare(sql);
        const rows = (stmt.all(...cleanParams) || []) as any[];
        return rows as T[];
      } else {
        const stmt = db.prepare(sql);
        stmt.run(...cleanParams);
        return [];
      }
    } catch (error: any) {
      console.error('[NodeSqliteAdapter] Query error:', error.message, 'SQL:', sql);
      throw error;
    }
  }

  async execute(sql: string, params?: any[]): Promise<{ changes: number; lastInsertRowid: number }> {
    const db = this.initialize();
    const cleanParams = sanitizeParams(params);
    try {
      const stmt = db.prepare(sql);
      const result = stmt.run(...cleanParams);
      return {
        changes: Number(result.changes),
        lastInsertRowid: Number(result.lastInsertRowid),
      };
    } catch (error: any) {
      console.error('[NodeSqliteAdapter] Execute error:', error.message, 'SQL:', sql);
      throw error;
    }
  }

  prepare(sql: string): Statement {
    return new NodeSqliteStatementWrapper(sql, this);
  }

  async transaction<T>(callback: (db: DatabaseAdapter) => Promise<T>): Promise<T> {
    const db = this.initialize();
    db.exec('BEGIN TRANSACTION');
    try {
      const result = await callback(this);
      db.exec('COMMIT');
      return result;
    } catch (err) {
      try {
        db.exec('ROLLBACK');
      } catch {
        // Rollback failed
      }
      throw err;
    }
  }

  async close(): Promise<void> {
    this.dbInstance = null;
    this.isSchemaInitialized = false;
  }
}

// Wrapper for node:sqlite StatementSync to match application Statement interface
export class NodeSqliteStatementWrapper implements Statement {
  private stmt: sqlite.StatementSync | null = null;
  private sql: string;
  private adapter: NodeSqliteAdapter;
  private boundParams: any[] = [];

  constructor(sql: string, adapter: NodeSqliteAdapter) {
    this.sql = sql;
    this.adapter = adapter;
  }

  private getStatement(): sqlite.StatementSync {
    if (!this.stmt) {
      const db = this.adapter.getDbInstance();
      this.stmt = db.prepare(this.sql);
    }
    return this.stmt;
  }

  bind(params: any[]): void {
    this.boundParams = sanitizeParams(params);
  }

  reset(): void {
    this.boundParams = [];
  }

  finalize(): void {
    this.stmt = null;
    this.boundParams = [];
  }

  get(params?: any[] | any): any {
    const stmt = this.getStatement();
    const clean = params !== undefined ? sanitizeParams(params) : this.boundParams;
    return stmt.get(...clean);
  }

  all(params?: any[] | any): any[] {
    const stmt = this.getStatement();
    const clean = params !== undefined ? sanitizeParams(params) : this.boundParams;
    return stmt.all(...clean) as any[];
  }

  run(params?: any[] | any): { changes: number; lastInsertRowid: number } {
    const stmt = this.getStatement();
    const clean = params !== undefined ? sanitizeParams(params) : this.boundParams;
    const result = stmt.run(...clean);
    return {
      changes: Number(result.changes),
      lastInsertRowid: Number(result.lastInsertRowid),
    };
  }
}