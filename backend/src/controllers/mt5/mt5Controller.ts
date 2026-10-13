import { Request, Response } from 'express';
import { connectorManager, MT5PackageDetector } from '@/gateway';
import { tradeStore } from '@services/tradeStore';
import { normalizeSymbol } from '@core/utils';

export class MT5Controller {
  // Connection and Engine Status
  public static async getStatus(req: Request, res: Response) {
    const connector = connectorManager.getConnector();
    const status = connector.getStatus();
    const account = tradeStore.getAccount();
    const terminal = await connector.getTerminalInfo();

    res.json({
      status: 'ok',
      provider: connectorManager.getProviderName(),
      connected: status.connected,
      terminalConnected: status.terminalConnected ?? status.connected,
      packageAvailable: status.packageAvailable ?? false,
      packageVersion: status.packageVersion || '5.0.6231',
      engine: status.engine,
      isNative: status.isNative,
      server: status.server || account.server,
      login: status.login || account.login,
      lastPingMs: status.lastPingMs,
      message: status.message,
      account: status.connected ? account : null,
      terminal,
      timestamp: Date.now(),
    });
  }

  // Connect to MT5 with optional credentials
  public static async connect(req: Request, res: Response) {
    const { login, password, server, path } = req.body;
    const connector = connectorManager.getConnector();
    const result = await connector.connect({ login, password, server, path });
    res.json(result);
  }

  // Disconnect from MT5
  public static async disconnect(req: Request, res: Response) {
    const connector = connectorManager.getConnector();
    const result = await connector.disconnect();
    res.json(result);
  }

  // Switch Provider (Peron, Simulation, Remote)
  public static async switchProvider(req: Request, res: Response) {
    const { provider, config } = req.body;
    if (!provider) {
      return res.status(400).json({ success: false, message: 'Provider name is required' });
    }
    const success = await connectorManager.setProvider(provider, config);
    res.json({
      success,
      provider: connectorManager.getProviderName(),
      status: connectorManager.getConnector().getStatus(),
    });
  }

  // Get dynamic broker symbols directly from MT5 package (preserving casing)
  public static async getSymbols(req: Request, res: Response) {
    const group = req.query.group ? String(req.query.group).trim() : undefined;
    const connector = connectorManager.getConnector();
    const symbols = await connector.getSymbols(group);
    // Fall back to tradeStore's cached symbols if needed
    const allSymbols = symbols.length > 0 ? symbols : tradeStore.getAllSymbols();
    res.json({
      success: true,
      count: allSymbols.length,
      symbols: allSymbols,
    });
  }

  // Select or unselect symbol in MT5 MarketWatch
  public static async selectSymbol(req: Request, res: Response) {
    const { symbol, enable = true } = req.body;
    if (!symbol) {
      return res.status(400).json({ success: false, message: 'Symbol is required' });
    }
    const connector = connectorManager.getConnector();
    if (connector.selectSymbol) {
      const result = await connector.selectSymbol(normalizeSymbol(symbol), Boolean(enable));
      return res.json(result);
    }
    res.json({ success: true, symbol: normalizeSymbol(symbol), selected: Boolean(enable) });
  }

  // Get market ticks
  public static async getTicks(req: Request, res: Response) {
    const { symbols } = req.query;
    const connector = connectorManager.getConnector();
    const symList = symbols ? String(symbols).split(',').map((s) => s.trim()) : undefined;
    const ticks = await connector.getTicks(symList);
    res.json({
      success: true,
      count: ticks.length,
      ticks: ticks.length > 0 ? ticks : tradeStore.getTicks(),
    });
  }

  // Get deep tick-level historical data from MT5
  public static async getTicksHistory(req: Request, res: Response) {
    const symbol = normalizeSymbol(String(req.query.symbol || 'EURUSD'));
    const count = Number(req.query.count) || 500;
    const dateFrom = req.query.from ? Number(req.query.from) : undefined;
    const dateTo = req.query.to ? Number(req.query.to) : undefined;
    const connector = connectorManager.getConnector();
    let ticks: any[] = [];
    if (connector.getTicksHistory) {
      ticks = await connector.getTicksHistory(symbol, dateFrom, dateTo, count);
    }
    if (!ticks || ticks.length === 0) {
      const { dbGetTicksHistory } = await import('@core/database/db.ts');
      ticks = await dbGetTicksHistory(symbol, count);
    }
    res.json({
      success: true,
      symbol,
      count: ticks.length,
      ticks,
    });
  }

  // Get OHLCV candlestick chart data (supports count or date range)
  public static async getCandles(req: Request, res: Response) {
    const symbol = normalizeSymbol(String(req.query.symbol || tradeStore.getCurrentChart()?.symbol || 'EURUSD'));
    const timeframe = String(req.query.timeframe || 'M1');
    const count = Number(req.query.count) || 100;
    const dateFrom = req.query.from ? Number(req.query.from) : undefined;
    const dateTo = req.query.to ? Number(req.query.to) : undefined;

    const connector = connectorManager.getConnector();
    let candles = await connector.getCandles(symbol, timeframe, count, dateFrom, dateTo);

    // If fetched from connector, cache asynchronously in SQLite
    if (candles && candles.length > 0) {
      import('@core/database/db.ts').then(({ dbInsertCandles }) => {
        dbInsertCandles(symbol, timeframe, candles).catch(() => {});
      }).catch(() => {});
    } else {
      // Try local database cache if connector didn't return candles
      const { dbGetCandles } = await import('@core/database/db.ts');
      const dbCandles = await dbGetCandles(symbol, timeframe, count);
      if (dbCandles && dbCandles.length > 0) {
        candles = dbCandles;
      } else {
        candles = tradeStore.getChartHistory();
      }
    }

    res.json({
      success: true,
      symbol,
      timeframe,
      count: candles.length,
      candles,
    });
  }

  // Get open positions
  public static async getPositions(req: Request, res: Response) {
    const symbol = req.query.symbol ? normalizeSymbol(String(req.query.symbol)) : undefined;
    const connector = connectorManager.getConnector();
    const positions = await connector.getPositions(symbol);
    res.json({
      success: true,
      count: positions.length,
      positions: positions.length > 0 ? positions : tradeStore.getPositions(),
    });
  }

  // Get pending orders
  public static async getOrders(req: Request, res: Response) {
    const symbol = req.query.symbol ? normalizeSymbol(String(req.query.symbol)) : undefined;
    const connector = connectorManager.getConnector();
    const orders = await connector.getOrders(symbol);
    res.json({
      success: true,
      count: orders.length,
      orders: orders.length > 0 ? orders : tradeStore.getState().pendingOrders,
    });
  }

  // Get account info
  public static async getAccount(req: Request, res: Response) {
    const connector = connectorManager.getConnector();
    const acc = await connector.getAccountInfo();
    res.json({
      success: true,
      account: acc || tradeStore.getAccount(),
    });
  }

  // Get terminal info
  public static async getTerminal(req: Request, res: Response) {
    const connector = connectorManager.getConnector();
    const terminal = await connector.getTerminalInfo();
    res.json({
      success: true,
      terminal,
    });
  }

  // Get real executed history deals from MT5
  public static async getHistoryDeals(req: Request, res: Response) {
    const dateFrom = req.query.from ? Number(req.query.from) : undefined;
    const dateTo = req.query.to ? Number(req.query.to) : undefined;
    const count = req.query.count ? Number(req.query.count) : 100;
    const connector = connectorManager.getConnector();
    const deals = await connector.getHistoryDeals({ dateFrom, dateTo, count });
    res.json({
      success: true,
      count: deals.length,
      deals,
    });
  }

  // Get historical orders from MT5
  public static async getHistoryOrders(req: Request, res: Response) {
    const dateFrom = req.query.from ? Number(req.query.from) : undefined;
    const dateTo = req.query.to ? Number(req.query.to) : undefined;
    const count = req.query.count ? Number(req.query.count) : 100;
    const connector = connectorManager.getConnector();
    const orders = await connector.getHistoryOrders({ dateFrom, dateTo, count });
    res.json({
      success: true,
      count: orders.length,
      orders,
    });
  }

  // Calculate required margin in account currency
  public static async calcMargin(req: Request, res: Response) {
    const { action, orderType, symbol, volume, price } = req.body;
    const connector = connectorManager.getConnector();
    const result = await connector.calcMargin(
      action || orderType || 'BUY',
      normalizeSymbol(symbol || 'EURUSD'),
      Number(volume) || 0.1,
      price ? Number(price) : undefined
    );
    res.json(result);
  }

  // Calculate projected trade profit
  public static async calcProfit(req: Request, res: Response) {
    const { action, orderType, symbol, volume, priceOpen, priceClose } = req.body;
    const connector = connectorManager.getConnector();
    const result = await connector.calcProfit(
      action || orderType || 'BUY',
      normalizeSymbol(symbol || 'EURUSD'),
      Number(volume) || 0.1,
      Number(priceOpen) || 0,
      Number(priceClose) || 0
    );
    res.json(result);
  }

  // Pre-check order feasibility against broker rules and margins
  public static async checkOrder(req: Request, res: Response) {
    const connector = connectorManager.getConnector();
    const result = await connector.checkOrder(req.body);
    res.json(result);
  }

  // Get Level 2 Market Depth (Order Book)
  public static async getMarketDepth(req: Request, res: Response) {
    const symbol = normalizeSymbol(String(req.query.symbol || 'EURUSD'));
    const connector = connectorManager.getConnector();
    const depth = await (connector as any).getMarketDepth(symbol);
    res.json({
      success: true,
      symbol,
      depth,
    });
  }

  // Get comprehensive symbol specifications
  public static async getDetailedSymbol(req: Request, res: Response) {
    const symbol = normalizeSymbol(String(req.params.symbol || req.query.symbol || 'EURUSD'));
    const connector = connectorManager.getConnector();
    const spec = await (connector as any).getDetailedSymbol(symbol);
    res.json({
      success: Boolean(spec),
      symbol,
      spec,
    });
  }

  // Get Gateway & MetaTrader5 Python Package Diagnostics
  public static async getGatewayDiagnostics(req: Request, res: Response) {
    try {
      const packageInfo = await MT5PackageDetector.inspect();
      const connector = connectorManager.getConnector();
      const status = connector.getStatus();
      const terminal = await connector.getTerminalInfo();
      res.json({
        success: true,
        package: packageInfo,
        connectorStatus: status,
        terminal,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  // Get Categorized Symbol Groups
  public static async getSymbolGroups(req: Request, res: Response) {
    const connector = connectorManager.getConnector();
    const allSymbols = await connector.getSymbols();
    const groups: Record<string, typeof allSymbols> = {
      Forex: [],
      Metals: [],
      Crypto: [],
      Indices: [],
      Other: [],
    };

    for (const s of allSymbols) {
      const upper = s.symbol.toUpperCase();
      if (upper.includes('XAU') || upper.includes('XAG') || upper.includes('GOLD') || upper.includes('SILV')) {
        groups.Metals.push(s);
      } else if (upper.includes('BTC') || upper.includes('ETH') || upper.includes('SOL') || upper.includes('CRYPTO')) {
        groups.Crypto.push(s);
      } else if (upper.includes('US30') || upper.includes('NAS') || upper.includes('SPX') || upper.includes('GER') || upper.includes('JP225')) {
        groups.Indices.push(s);
      } else if (upper.length === 6 && (upper.includes('USD') || upper.includes('EUR') || upper.includes('GBP') || upper.includes('JPY') || upper.includes('AUD') || upper.includes('CAD') || upper.includes('CHF') || upper.includes('NZD'))) {
        groups.Forex.push(s);
      } else {
        groups.Other.push(s);
      }
    }

    res.json({
      success: true,
      totalSymbols: allSymbols.length,
      groups,
    });
  }

  // Emergency Close All Positions
  public static async closeAllPositions(req: Request, res: Response) {
    const connector = connectorManager.getConnector();
    if (typeof (connector as any).closeAllPositions === 'function') {
      const result = await (connector as any).closeAllPositions();
      return res.json(result);
    }
    const positions = await connector.getPositions();
    const results: any[] = [];
    for (const p of positions) {
      const resClose = await connector.closePosition(p.ticket, p.volume);
      results.push({ ticket: p.ticket, ...resClose });
    }
    res.json({ success: true, closedCount: results.length, results });
  }

  // Cancel All Pending Orders
  public static async cancelAllOrders(req: Request, res: Response) {
    const connector = connectorManager.getConnector();
    if (typeof (connector as any).cancelAllOrders === 'function') {
      const result = await (connector as any).cancelAllOrders();
      return res.json(result);
    }
    const orders = await connector.getOrders();
    let count = 0;
    for (const o of orders) {
      const resCancel = await connector.cancelOrder(o.ticket);
      if (resCancel.success) count++;
    }
    res.json({ success: true, cancelledCount: count });
  }
}
