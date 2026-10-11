import { Request, Response } from 'express';
import {
  dbGetAnalytics,
  dbGetOrders,
  dbGetCandles,
  dbGetTicksHistory,
  dbGetAccountHistory,
  pruneDatabase,
} from '../database/db.js';
import { normalizeSymbol } from '../utils/symbolUtils.js';

export class DatabaseController {
  // Database summary analytics
  public static async getAnalytics(req: Request, res: Response) {
    const analytics = await dbGetAnalytics();
    res.json({ success: true, analytics });
  }

  // Prune database and purge unexecuted orders older than 24 hours
  public static async pruneDatabase(req: Request, res: Response) {
    const result = await pruneDatabase();
    res.json(result);
  }

  // Query order audit logs
  public static async getOrders(req: Request, res: Response) {
    const limit = Number(req.query.limit) || 100;
    const orders = await dbGetOrders(limit);
    res.json({ success: true, count: orders.length, orders });
  }

  // Query historical OHLCV candles
  public static async getCandles(req: Request, res: Response) {
    const symbol = normalizeSymbol(String(req.query.symbol || 'EURUSD'));
    const timeframe = String(req.query.timeframe || 'M1');
    const limit = Number(req.query.limit) || 100;

    const candles = await dbGetCandles(symbol, timeframe, limit);
    res.json({ success: true, symbol, timeframe, count: candles.length, candles });
  }

  // Query historical ticks
  public static async getTicks(req: Request, res: Response) {
    const symbol = req.query.symbol ? normalizeSymbol(String(req.query.symbol)) : undefined;
    const limit = Number(req.query.limit) || 100;

    const ticks = await dbGetTicksHistory(symbol, limit);
    res.json({ success: true, count: ticks.length, ticks });
  }

  // Query account balance snapshots
  public static async getAccountHistory(req: Request, res: Response) {
    const limit = Number(req.query.limit) || 100;
    const history = await dbGetAccountHistory(limit);
    res.json({ success: true, count: history.length, history });
  }
}
