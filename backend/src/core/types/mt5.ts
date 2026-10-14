export type OrderType = 'BUY' | 'SELL';
export type PendingOrderType = 'BUY_LIMIT' | 'SELL_LIMIT' | 'BUY_STOP' | 'SELL_STOP' | 'BUY_STOP_LIMIT' | 'SELL_STOP_LIMIT';
export type TradeOrderType = OrderType | PendingOrderType;
export type CommandStatus = 'pending' | 'dispatched' | 'executed' | 'failed' | 'cancelled';
export type OrderAction = 'EXECUTE_TRADE' | 'MODIFY_POSITION' | 'CLOSE_POSITION' | 'CLOSE_ALL' | 'CANCEL_PENDING' | 'FETCH_HISTORY' | 'SET_RISK_GUARD';

export interface AccountInfo {
  login: number;
  tradeMode: string; // 'DEMO' | 'REAL' | 'CONTEST'
  tradeModeCode?: number;
  balance: number;
  credit?: number;
  equity: number;
  margin: number;
  freeMargin: number;
  marginLevel: number; // percentage
  marginCallLevel?: number;
  stopOutLevel?: number;
  marginStopOutMode?: number;
  marginMode?: number;
  leverage: number;
  limitOrders?: number;
  tradeAllowed?: boolean;
  tradeExpert?: boolean;
  fifoClose?: boolean;
  currencyDigits?: number;
  currency: string;
  server: string;
  company: string;
  profit: number;
  assets?: number;
  liabilities?: number;
  commissionBlocked?: number;
  lastUpdate: number;
}

export interface TickData {
  symbol: string;
  bid: number;
  ask: number;
  spread: number;
  last: number;
  volume: number;
  time: number;
  timeMsc?: number;
  time_msc?: number;
  timeIso?: string;
  flags?: number;
  volumeReal?: number;
  high24h?: number;
  low24h?: number;
}

export interface Position {
  ticket: number;
  symbol: string;
  type: OrderType;
  volume: number;
  openPrice: number;
  currentPrice: number;
  sl: number;
  tp: number;
  profit: number;
  swap: number;
  magic: number;
  comment: string;
  openTime: number;
  openTimeMsc?: number;
  updateTime?: number;
  updateTimeMsc?: number;
  identifier?: number;
  reason?: number;
  externalId?: string;
  trailingEnabled?: boolean;
  trailingDistance?: number;
  trailingStep?: number;
}

export interface TradeCommand {
  id: string;
  action: OrderAction;
  symbol?: string;
  orderType?: TradeOrderType;
  volume?: number;
  price?: number;
  stopLimitPrice?: number;
  typeTime?: 'GTC' | 'DAY' | 'SPECIFIED' | 'SPECIFIED_DAY';
  expiration?: number;
  typeFilling?: 'FOK' | 'IOC' | 'RETURN' | 'BOC';
  deviation?: number;
  sl?: number;
  tp?: number;
  ticket?: number;
  magic?: number;
  comment?: string;
  slippage?: number;
  status: CommandStatus;
  createdAt: number;
  dispatchedAt?: number;
  executedAt?: number;
  source: 'AI_MCP' | 'MANUAL_UI' | 'RISK_GUARD' | 'API' | 'BOT';
  result?: {
    success: boolean;
    dealTicket?: number;
    orderTicket?: number;
    executionPrice?: number;
    comment?: string;
    errorCode?: number;
    errorMessage?: string;
    executionTimeMs?: number;
  };
}

export interface RiskGuardConfig {
  globalTakeProfitUSD: number; // 0 = disabled
  globalStopLossUSD: number; // 0 = disabled
  maxDrawdownPercent: number; // 0 = disabled
  emergencyKillSwitch: boolean;
  trailingStopEnabled: boolean;
  trailingStopDistancePoints: number; // in points
  trailingStopStepPoints: number; // in points
  maxLotSizePerTrade: number;
  maxOpenPositions: number;
  allowedSymbols: string[];
  autoCloseOnMarginLevelBelow: number; // e.g. 50%
}

export interface ExecutionLog {
  id: string;
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'trade';
  title: string;
  details: string;
  source: string;
  ticket?: number;
}

export interface ChartSymbolInfo {
  symbol: string;
  timeframe: string;
  digits: number;
  point: number;
  bid: number;
  ask: number;
  spread: number;
  minLot: number;
  maxLot: number;
  lotStep: number;
  contractSize: number;
  tickValue: number;
  tradeAllowed: boolean;
  sessionOpen?: number;
  sessionHigh?: number;
  sessionLow?: number;
  sessionVolume?: number;
  description?: string;
  currencyBase?: string;
  currencyProfit?: string;
}

export interface DetailedSymbolInfo {
  symbol: string;
  bid: number;
  ask: number;
  spread: number;
  digits: number;
  point: number;
  minLot: number;
  maxLot: number;
  lotStep: number;
  contractSize: number;
  tradeAllowed: boolean;
  canOpenBuy?: boolean;
  canOpenSell?: boolean;
  tradeMode?: number;
  tradeModeName?: string;
  tradeExecution?: number;
  tradeCalcMode?: number;
  orderMode?: number;
  fillingMode?: number;
  expirationMode?: number;
  volumeLimit?: number;
  tickSize?: number;
  tickValue?: number;
  tickValueProfit?: number;
  tickValueLoss?: number;
  stopsLevel?: number;
  freezeLevel?: number;
  swapMode?: number;
  swapLong?: number;
  swapShort?: number;
  swapRollover3Days?: number;
  marginInitial?: number;
  marginMaintenance?: number;
  marginHedged?: number;
  currencyBase?: string;
  currencyProfit?: string;
  currencyMargin?: string;
  spreadFloat?: boolean;
  sessionClose?: number;
  selected?: boolean;
  visible?: boolean;
  high24h?: number;
  low24h?: number;
  sessionOpen?: number;
  sessionHigh?: number;
  sessionLow?: number;
  sessionVolume?: number;
  volume?: number;
  time?: number;
  isCurrentChart?: boolean;
}

export interface CandleData {
  time: number;
  timeIso?: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  tickCount?: number;
  spread?: number;
}

export interface PendingOrder {
  ticket: number;
  symbol: string;
  type: PendingOrderType;
  volume: number;
  priceOpen: number;
  currentPrice?: number;
  sl: number;
  tp: number;
  magic: number;
  comment: string;
  timeSetup: number;
  timeSetupIso?: string;
  timeSetupMsc?: number;
  timeDone?: number;
  timeDoneMsc?: number;
  expiration?: number;
  typeTime?: number;
  typeFilling?: number;
  state?: string;
  reason?: number;
  positionId?: number;
  positionById?: number;
  volumeCurrent?: number;
  stopLimitPrice?: number;
  externalId?: string;
}

export interface MarketDepthItem {
  type: 'BUY' | 'SELL';
  price: number;
  volume: number;
}

export interface TechnicalIndicatorsResult {
  symbol: string;
  timeframe: string;
  timestamp: number;
  timestampIso: string;
  price: number;
  rsi14: number | null;
  ema9: number | null;
  ema21: number | null;
  ema50: number | null;
  ema200: number | null;
  sma20: number | null;
  sma50: number | null;
  macd: {
    macd: number;
    signal: number;
    histogram: number;
  } | null;
  bollinger: {
    upper: number;
    middle: number;
    lower: number;
    bandwidth: number;
    percentB: number;
  } | null;
  atr14: number | null;
  summary: 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL';
  signals: {
    rsiSignal: 'OVERBOUGHT' | 'OVERSOLD' | 'NEUTRAL';
    macdSignal: 'BULLISH_CROSS' | 'BEARISH_CROSS' | 'NEUTRAL';
    emaSignal: 'ABOVE_200' | 'BELOW_200' | 'NEUTRAL';
  };
}

export interface EASyncPayload {
  apiKey: string;
  account: AccountInfo;
  positions: Position[];
  pendingOrders?: PendingOrder[];
  ticks: TickData[];
  eaVersion: string;
  mt5Time: number;
  currentChart?: ChartSymbolInfo;
  allSymbols?: DetailedSymbolInfo[];
  chartHistory?: CandleData[];
  marketDepth?: Record<string, { bids: MarketDepthItem[]; asks: MarketDepthItem[] }>;
  historyPayload?: {
    symbol: string;
    timeframe: string;
    candles: CandleData[];
  };
  terminalName?: string;
  terminalCompany?: string;
  terminalBuild?: number;
  pendingExecutionResults?: {
    commandId: string;
    success: boolean;
    dealTicket?: number;
    orderTicket?: number;
    executionPrice?: number;
    errorCode?: number;
    errorMessage?: string;
    executionTimeMs?: number;
  }[];
}

export interface EASyncResponse {
  status: 'ok' | 'error';
  serverTime: number;
  commands: TradeCommand[];
  riskGuard: RiskGuardConfig;
  message?: string;
}

export interface HistoryDeal {
  ticket: number;
  order: number;
  time: number;
  timeMsc?: number;
  timeIso?: string;
  type: 'BUY' | 'SELL' | 'BALANCE' | 'CREDIT';
  entry: 'IN' | 'OUT' | 'INOUT';
  symbol: string;
  volume: number;
  price: number;
  commission: number;
  swap: number;
  profit: number;
  fee?: number;
  magic: number;
  positionId?: number;
  reason?: number;
  comment: string;
  externalId?: string;
}

export interface HistoryOrder {
  ticket: number;
  symbol: string;
  type: string;
  volumeInitial: number;
  volumeCurrent: number;
  priceOpen: number;
  priceCurrent?: number;
  sl: number;
  tp: number;
  state: 'FILLED' | 'CANCELLED' | 'REJECTED' | 'EXPIRED' | string;
  timeSetup: number;
  timeSetupMsc?: number;
  timeDone?: number;
  timeDoneMsc?: number;
  expiration?: number;
  typeTime?: number;
  typeFilling?: number;
  reason?: number;
  positionId?: number;
  stopLimitPrice?: number;
  magic: number;
  comment: string;
  externalId?: string;
}

export interface MarginCalcResult {
  margin: number;
  currency: string;
  success: boolean;
  message?: string;
}

export interface ProfitCalcResult {
  profit: number;
  currency: string;
  success: boolean;
  message?: string;
}

export interface OrderCheckResult {
  feasible: boolean;
  margin?: number;
  marginFree?: number;
  marginLevel?: number;
  balance?: number;
  equity?: number;
  retcode?: number;
  comment?: string;
  message?: string;
}
