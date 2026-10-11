/**
 * Database & Pruning Retention Configuration
 */

export interface DatabaseConfig {
  dbFilePath: string;
  maxOrdersRetention: number;
  maxTicksRetention: number;
  maxCandlesRetention: number;
  maxAuditLogsRetention: number;
  maxBacktestsRetention: number;
  unexecutedOrdersExpiryHours: number;
  pruneIntervalMs: number;
}

export const defaultDatabaseConfig: DatabaseConfig = {
  dbFilePath: process.env.DB_PATH || 'mt5_bridge.sqlite',
  maxOrdersRetention: 1000,
  maxTicksRetention: 5000,
  maxCandlesRetention: 2000,
  maxAuditLogsRetention: 500,
  maxBacktestsRetention: 200,
  unexecutedOrdersExpiryHours: 24, // Orders older than 24h that haven't executed are automatically purged
  pruneIntervalMs: 60 * 60 * 1000, // hourly prune
};
