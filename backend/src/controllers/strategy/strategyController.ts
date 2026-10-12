import { Request, Response } from 'express';
import { dbGetStrategies, dbSaveStrategy, dbDeleteStrategy, dbGetObservations, dbSaveObservation, dbDeleteObservation, dbSaveBacktestResult, dbGetBacktestResults, dbGetCandles, dbInsertCandles } from '@features/database';
import { runStrategyBacktest, generateBenchmarkCandles } from '@features/strategies';
import { tradeStore } from '@services/tradeStore';
import { connectorManager } from '@features/mt5';
import { normalizeSymbol } from '@core/utils';

export class StrategyController {
  // List strategies
  public static async getStrategies(req: Request, res: Response) {
    const symbol = req.query.symbol ? normalizeSymbol(String(req.query.symbol)) : undefined;
    const strategies = await dbGetStrategies(symbol);
    res.json({ success: true, count: strategies.length, strategies });
  }

  // Create or update strategy
  public static async saveStrategy(req: Request, res: Response) {
    const strat = req.body;
    if (!strat || !strat.name) {
      return res.status(400).json({ success: false, message: 'Strategy name is required' });
    }

    const payload = {
      ...strat,
      id: strat.id || `strat-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      symbol: strat.symbol ? normalizeSymbol(strat.symbol) : 'EURUSD',
      timeframe: strat.timeframe ? strat.timeframe.trim() : 'M1',
    };

    await dbSaveStrategy(payload);
    tradeStore.addLog(
      'info',
      `Strategy Saved: ${payload.name}`,
      `Type: ${payload.type} | Symbol: ${payload.symbol} [${payload.timeframe}]`,
      'STRATEGY_ENGINE'
    );

    res.json({ success: true, strategy: payload });
  }

  // Delete strategy
  public static async deleteStrategy(req: Request, res: Response) {
    const { id } = req.params;
    if (!id) return res.status(400).json({ success: false, message: 'Strategy ID required' });
    await dbDeleteStrategy(id);
    res.json({ success: true, message: 'Strategy deleted successfully' });
  }

  // Run backtest over historical candles
  public static async runBacktest(req: Request, res: Response) {
    const {
      strategy,
      symbol = 'EURUSD',
      timeframe = 'M1',
      candleCount = 300,
      initialDeposit = 10000,
      fixedLot = 0.1,
    } = req.body;

    const normSym = normalizeSymbol(symbol);
    const normTf = timeframe.trim();

    const count = Number(candleCount) || 300;
    let candles: any[] = [];
    let dataSource = 'database_cache';

    // 1. Try querying connector for fresh / deeper chart history from MT5
    try {
      const connector = connectorManager.getConnector();
      const fetched = await connector.getCandles(normSym, normTf, count);
      if (fetched && fetched.length >= 20) {
        candles = fetched;
        dataSource = 'mt5_live';
        // Persist real MT5 candles to SQLite database
        dbInsertCandles(normSym, normTf, candles).catch(() => {});
      }
    } catch {}

    // 2. If connector didn't return enough candles, check local database
    if (candles.length < 20) {
      const stored = await dbGetCandles(normSym, normTf, count);
      if (stored && stored.length >= 20) {
        candles = stored;
        dataSource = 'database_cache';
      }
    }

    // 3. Resilient fallback: if neither MT5 nor DB has sufficient candles, generate benchmark candles so user can test offline
    if (candles.length < 20) {
      candles = generateBenchmarkCandles(normSym, normTf, count);
      dataSource = 'simulated_benchmark';
      dbInsertCandles(normSym, normTf, candles).catch(() => {});
    }

    const strategyObj = strategy || {
      id: 'adhoc-strat',
      name: 'Evaluation Strategy',
      type: 'MULTI_INDICATOR_CONSENSUS',
      symbol: normSym,
      timeframe: normTf,
      parameters: { lotSize: fixedLot },
    };

    const backtestResult = runStrategyBacktest(
      strategyObj,
      candles,
      Number(initialDeposit),
      0.0001
    );

    await dbSaveBacktestResult(backtestResult);

    tradeStore.addLog(
      'info',
      `Backtest Completed: ${strategyObj.name} (${dataSource})`,
      `Candles: ${candles.length} | Trades: ${backtestResult.totalTrades} | WinRate: ${backtestResult.winRatePct}% | P/L: $${backtestResult.netProfit}`,
      'STRATEGY_ENGINE'
    );

    res.json({
      success: true,
      result: backtestResult,
      dataSource,
      candleCount: candles.length,
    });
  }

  // Get backtest history
  public static async getBacktestHistory(req: Request, res: Response) {
    const { strategyId } = req.query;
    const history = await dbGetBacktestResults(strategyId ? String(strategyId) : undefined);
    res.json({ success: true, count: history.length, results: history });
  }

  // List observations / notes
  public static async getObservations(req: Request, res: Response) {
    const { category } = req.query;
    const observations = await dbGetObservations(category ? String(category) : undefined);
    res.json({ success: true, count: observations.length, observations });
  }

  // Save observation
  public static async saveObservation(req: Request, res: Response) {
    const obs = req.body;
    if (!obs || !obs.title) {
      return res.status(400).json({ success: false, message: 'Observation title is required' });
    }

    const payload = {
      ...obs,
      id: obs.id || `obs-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      symbol: obs.symbol ? normalizeSymbol(obs.symbol) : undefined,
      timeframe: obs.timeframe ? obs.timeframe.trim() : undefined,
    };

    await dbSaveObservation(payload);
    res.json({ success: true, observation: payload });
  }

  // Delete observation
  public static async deleteObservation(req: Request, res: Response) {
    const { id } = req.params;
    if (!id) return res.status(400).json({ success: false, message: 'Observation ID required' });
    await dbDeleteObservation(id);
    res.json({ success: true, message: 'Observation deleted' });
  }
}
