import {
  AccountInfo,
  CandleData,
  DetailedSymbolInfo,
  HistoryDeal,
  HistoryOrder,
  MarginCalcResult,
  OrderCheckResult,
  PendingOrder,
  Position,
  ProfitCalcResult,
  TickData,
  TradeCommand,
} from '@core/types';

export interface ExecutionResult {
  success: boolean;
  ticket?: number;
  dealTicket?: number;
  price?: number;
  executionPrice?: number;
  volume?: number;
  retcode?: number;
  message?: string;
  error?: string;
}

export interface ConnectionStatus {
  connected: boolean;
  terminalConnected?: boolean;
  packageAvailable?: boolean;
  packageVersion?: string;
  provider: string;
  engine: string;
  isNative: boolean;
  server: string;
  login?: number;
  lastPingMs: number;
  message?: string;
}

export interface ConnectParams {
  login?: number;
  password?: string;
  server?: string;
  path?: string;
}

/**
 * Common interface for all MT5 connection providers.
 * Allows effortless swapping between Peron Python package, direct gateway, REST bridge, or simulation.
 */
export interface IMT5Connector {
  readonly name: string;
  initialize(): Promise<boolean>;
  shutdown(): Promise<void>;
  getStatus(): ConnectionStatus;
  connect(params?: ConnectParams): Promise<{ success: boolean; message: string }>;
  disconnect(): Promise<{ success: boolean; message: string }>;
  getAccountInfo(): Promise<AccountInfo | null>;
  getTerminalInfo(): Promise<any>;
  getSymbols(group?: string): Promise<DetailedSymbolInfo[]>;
  getSymbolInfo(symbol: string): Promise<DetailedSymbolInfo | null>;
  getTicks(symbols?: string[]): Promise<TickData[]>;
  getCandles(symbol: string, timeframe: string, count: number, dateFrom?: number, dateTo?: number, startPos?: number): Promise<CandleData[]>;
  getTicksHistory?(symbol: string, dateFrom?: number, dateTo?: number, count?: number, flags?: string): Promise<TickData[]>;
  selectSymbol?(symbol: string, enable?: boolean): Promise<{ success: boolean; message?: string }>;
  getPositions(symbol?: string, ticket?: number): Promise<Position[]>;
  getOrders(symbol?: string, ticket?: number): Promise<PendingOrder[]>;
  executeOrder(cmd: TradeCommand): Promise<ExecutionResult>;
  closePosition(ticket: number, volume?: number): Promise<ExecutionResult>;
  modifyPosition(ticket: number, sl?: number, tp?: number): Promise<ExecutionResult>;
  modifyOrder(ticket: number, price?: number, sl?: number, tp?: number): Promise<ExecutionResult>;
  cancelOrder(ticket: number): Promise<ExecutionResult>;
  getHistoryDeals(params?: { dateFrom?: number; dateTo?: number; count?: number; ticket?: number; position?: number }): Promise<HistoryDeal[]>;
  getHistoryOrders(params?: { dateFrom?: number; dateTo?: number; count?: number; ticket?: number; position?: number }): Promise<HistoryOrder[]>;
  getHistoryTotals?(params?: { dateFrom?: number; dateTo?: number }): Promise<{
    success: boolean;
    dateFrom?: number;
    dateTo?: number;
    dealsTotal?: number;
    ordersTotal?: number;
    message?: string;
  }>;
  calcMargin(orderType: string, symbol: string, volume: number, price?: number): Promise<MarginCalcResult>;
  calcProfit(orderType: string, symbol: string, volume: number, priceOpen: number, priceClose: number): Promise<ProfitCalcResult>;
  checkOrder(cmd: Partial<TradeCommand>): Promise<OrderCheckResult>;
  getMarketDepth(symbol: string): Promise<{ bids: any[]; asks: any[] }>;
  getNativeDiagnostics?(): Promise<Record<string, any>>;
  getDetailedSymbol(symbol: string): Promise<DetailedSymbolInfo | null>;
  closeAllPositions?(): Promise<{ success: boolean; closedCount: number; results: any[] }>;
  cancelAllOrders?(): Promise<{ success: boolean; cancelledCount: number }>;
}
