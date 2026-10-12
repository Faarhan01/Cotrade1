import { Request, Response } from 'express';
import { connectorManager } from '@features/mt5';
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
    const connector = connectorManager.getConnector();
    const symbols = await connector.getSymbols();
    // Fall back to tradeStore's cached symbols if needed
    const allSymbols = symbols.length > 0 ? symbols : tradeStore.getAllSymbols();
    res.json({
      success: true,
      count: allSymbols.length,
      symbols: allSymbols,
    });
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

  // Get OHLCV candlestick chart data
  public static async getCandles(req: Request, res: Response) {
    const symbol = normalizeSymbol(String(req.query.symbol || tradeStore.getCurrentChart()?.symbol || 'EURUSD'));
    const timeframe = String(req.query.timeframe || 'M1');
    const count = Number(req.query.count) || 100;

    const connector = connectorManager.getConnector();
    let candles = await connector.getCandles(symbol, timeframe, count);
    if (!candles || candles.length === 0) {
      candles = tradeStore.getChartHistory();
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
}
