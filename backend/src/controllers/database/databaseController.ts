import { Request, Response } from 'express';
import { Database } from '@core/database';
import { normalizeSymbol } from '@core/utils';
import fs from 'fs';
import path from 'path';

export class DatabaseController {
  private static getDb() {
    return Database.getInstance();
  }

  // Database summary analytics
  public static async getAnalytics(req: Request, res: Response) {
    const db = this.getDb();
    try {
      // Initialize counters
      let totalOrders = 0;
      let executedOrders = 0;
      let failedOrders = 0;
      let totalLogs = 0;
      let totalCandles = 0;
      let totalTicks = 0;
      let totalAccountSnapshots = 0;
      let totalStrategies = 0;
      let totalObservations = 0;
      let totalBacktests = 0;
      let dbSizeBytes = 0;

      // Get total orders, executed, failed
      const totalOrdersRes = await db.query(`SELECT COUNT(*) as total, SUM(CASE WHEN status = 'executed' THEN 1 ELSE 0 END) as executed, SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed FROM orders`);
      if (totalOrdersRes.length > 0 && totalOrdersRes[0].length > 0) {
        const row = totalOrdersRes[0];
        totalOrders = Number(row.total) || 0;
        executedOrders = Number(row.executed) || 0;
        failedOrders = Number(row.failed) || 0;
      }

      // Get total logs
      const logsRes = await db.query(`SELECT COUNT(*) as total FROM audit_logs`);
      if (logsRes.length > 0 && logsRes[0].length > 0) {
        totalLogs = Number(logsRes[0].total) || 0;
      }

      // Get total candles
      const candlesRes = await db.query(`SELECT COUNT(*) as total FROM candles_history`);
      if (candlesRes.length > 0 && candlesRes[0].length > 0) {
        totalCandles = Number(candlesRes[0].total) || 0;
      }

      // Get total ticks
      const ticksRes = await db.query(`SELECT COUNT(*) as total FROM ticks_history`);
      if (ticksRes.length > 0 && ticksRes[0].length > 0) {
        totalTicks = Number(ticksRes[0].total) || 0;
      }

      // Get total account snapshots
      const accountRes = await db.query(`SELECT COUNT(*) as total FROM account_history`);
      if (accountRes.length > 0 && accountRes[0].length > 0) {
        totalAccountSnapshots = Number(accountRes[0].total) || 0;
      }

      // Get total strategies
      const stratRes = await db.query(`SELECT COUNT(*) as total FROM strategies`);
      if (stratRes.length > 0 && stratRes[0].length > 0) {
        totalStrategies = Number(stratRes[0].total) || 0;
      }

      // Get total observations
      const obsRes = await db.query(`SELECT COUNT(*) as total FROM observations`);
      if (obsRes.length > 0 && obsRes[0].length > 0) {
        totalObservations = Number(obsRes[0].total) || 0;
      }

      // Get total backtests
      const btRes = await db.query(`SELECT COUNT(*) as total FROM backtest_results`);
      if (btRes.length > 0 && btRes[0].length > 0) {
        totalBacktests = Number(btRes[0].total) || 0;
      }

      // Get database size
      try {
        const stats = await fs.promises.stat(path.join(process.cwd(), 'data', 'mt5_bridge.sqlite'));
        dbSizeBytes = stats.size;
      } catch (err) {
        // If file doesn't exist, size is 0
        dbSizeBytes = 0;
      }

      res.json({
        success: true,
        analytics: {
          databasePath: 'data/mt5_bridge.sqlite',
          databaseType: 'SQLite (Native BetterSQLite3)',
          dbSizeBytes,
          totalOrders,
          executedOrders,
          failedOrders,
          executionSuccessRate: totalOrders > 0 ? Number(((executedOrders / totalOrders) * 100).toFixed(1)) : 100,
          totalLogs,
          totalCandles,
          totalTicks,
          totalAccountSnapshots,
          totalStrategies,
          totalObservations,
          totalBacktests,
        }
      });
    } catch (error) {
      console.error('Error in getAnalytics:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // Prune database and purge unexecuted orders older than 24 hours
  public static async pruneDatabase(req: Request, res: Response) {
    const db = this.getDb();
    try {
      const now = Date.now();
      const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;
      const twoDaysAgoSec = Math.floor(now / 1000) - 48 * 3600;
      const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

      // 1. Delete all unexecuted orders older than 24 hours (pending or dispatched)
      const countBeforeRes = await db.query(`SELECT COUNT(*) as count FROM orders WHERE status IN ('pending', 'dispatched') AND created_at < ?`, [twentyFourHoursAgo]);
      const unexecutedCount = countBeforeRes.length > 0 && countBeforeRes[0].length > 0 ? Number(countBeforeRes[0].count) : 0;

      await db.execute(`DELETE FROM orders WHERE status IN ('pending', 'dispatched') AND created_at < ?`, [twentyFourHoursAgo]);

      // 2. Cap total archived orders (keep last 1,000 executed/failed orders)
      await db.execute(`DELETE FROM orders WHERE id NOT IN (SELECT id FROM orders ORDER BY created_at DESC LIMIT 1000)`);

      // 3. Cap ticks history (keep last 5,000 ticks or ticks within 48h)
      await db.execute(`DELETE FROM ticks_history WHERE timestamp < ? OR id NOT IN (SELECT id FROM ticks_history ORDER BY id DESC LIMIT 5000)`, [twoDaysAgoSec]);

      // 4. Cap account history snapshots (keep last 1,000 entries)
      await db.execute(`DELETE FROM account_history WHERE created_at < ? OR id NOT IN (SELECT id FROM account_history ORDER BY id DESC LIMIT 1000)`, [sevenDaysAgo]);

      // 5. Cap candles history (keep last 2,000 candles)
      await db.execute(`DELETE FROM candles_history WHERE id NOT IN (SELECT id FROM candles_history ORDER BY time DESC LIMIT 2000)`);

      // 6. Cap audit logs (keep last 500 logs)
      await db.execute(`DELETE FROM audit_logs WHERE timestamp < ? OR id NOT IN (SELECT id FROM audit_logs ORDER BY timestamp DESC LIMIT 500)`, [sevenDaysAgo]);

      // 7. Cap backtest results history (keep last 200 backtests)
      await db.execute(`DELETE FROM backtest_results WHERE id NOT IN (SELECT id FROM backtest_results ORDER BY evaluated_at DESC LIMIT 200)`);

      res.json({ success: true, purgedUnexecutedOrders: unexecutedCount, message: `Database pruned successfully. Purged ${unexecutedCount} expired unexecuted orders older than 24h.` });
    } catch (error) {
      console.error('Error in pruneDatabase:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // Query order audit logs
  public static async getOrders(req: Request, res: Response) {
    const db = this.getDb();
    const limit = Number(req.query.limit) || 100;
    const orders = await db.query(`SELECT * FROM orders ORDER BY created_at DESC LIMIT ?`, [limit]);
    res.json({ success: true, count: orders.length, orders });
  }

  // Query historical OHLCV candles
  public static async getCandles(req: Request, res: Response) {
    const db = this.getDb();
    const symbol = normalizeSymbol(String(req.query.symbol || 'EURUSD'));
    const timeframe = String(req.query.timeframe || 'M1');
    const limit = Number(req.query.limit) || 100;

    const candles = await db.query(`SELECT * FROM candles_history WHERE symbol = ? AND timeframe = ? ORDER BY time DESC LIMIT ?`, [symbol, timeframe, limit]);
    res.json({ success: true, symbol, timeframe, count: candles.length, candles });
  }

  // Query historical ticks
  public static async getTicks(req: Request, res: Response) {
    const db = this.getDb();
    const symbol = req.query.symbol ? normalizeSymbol(String(req.query.symbol)) : undefined;
    const limit = Number(req.query.limit) || 100;

    const ticks = await db.query(`SELECT * FROM ticks_history WHERE symbol = ? ORDER BY timestamp DESC LIMIT ?`, [symbol, limit]);
    res.json({ success: true, count: ticks.length, ticks });
  }

  // Query account balance snapshots
  public static async getAccountHistory(req: Request, res: Response) {
    const db = this.getDb();
    const limit = Number(req.query.limit) || 100;
    const history = await db.query(`SELECT * FROM account_history ORDER BY created_at DESC LIMIT ?`, [limit]);
    res.json({ success: true, count: history.length, history });
  }

  // Full Database Export
  public static async exportDatabase(req: Request, res: Response) {
    try {
      const { dbExportAllData } = await import('@core/database/db.ts');
      const backup = await dbExportAllData();
      res.json({ success: true, backup });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  // Journal endpoints
  public static async getJournal(req: Request, res: Response) {
    try {
      const { dbGetJournalEntries } = await import('@core/database/db.ts');
      const limit = Number(req.query.limit) || 100;
      const entries = await dbGetJournalEntries(limit);
      res.json({ success: true, count: entries.length, entries });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async saveJournal(req: Request, res: Response) {
    try {
      const { dbSaveJournalEntry } = await import('@core/database/db.ts');
      const entry = await dbSaveJournalEntry(req.body);
      res.json({ success: true, entry });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async deleteJournal(req: Request, res: Response) {
    try {
      const { dbDeleteJournalEntry } = await import('@core/database/db.ts');
      const { id } = req.params;
      await dbDeleteJournalEntry(id);
      res.json({ success: true, message: `Journal entry ${id} deleted` });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
}
