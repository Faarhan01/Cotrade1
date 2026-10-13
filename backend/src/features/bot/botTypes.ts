export type BotStatus = 'IDLE' | 'RUNNING' | 'PAUSED' | 'STOPPED' | 'ERROR';
export type BotExecutionMode = 'LIVE' | 'PAPER' | 'DRY_RUN';

export interface BotAllocation {
  lotSize: number;
  maxPositions: number;
  maxDailyLoss: number;
  targetDailyProfit?: number;
  stopLossPoints?: number;
  takeProfitPoints?: number;
}

export interface BotTrailingStop {
  enabled: boolean;
  distancePoints: number;
  stepPoints: number;
}

export interface BotSignalResult {
  signal: 'BUY' | 'SELL' | 'HOLD' | 'CLOSE';
  confidence: number;
  reason: string;
  price: number;
  indicatorValues: Record<string, any>;
  timestamp: number;
}

export interface BotStats {
  tradesExecuted: number;
  winningTrades: number;
  losingTrades: number;
  realizedPnl: number;
  unrealizedPnl: number;
  lastSignal?: 'BUY' | 'SELL' | 'HOLD' | 'CLOSE';
  lastSignalTime?: number;
  lastSignalReason?: string;
  lastExecutionTime?: number;
  lastError?: string | null;
}

export interface BotInstance {
  id: string;
  name: string;
  strategyId: string;
  strategyName: string;
  strategyType: string;
  symbol: string;
  timeframe: string;
  status: BotStatus;
  executionMode: BotExecutionMode;
  magicNumber: number;
  allocation: BotAllocation;
  trailingStop: BotTrailingStop;
  cooldownSeconds: number;
  lastTradeTimestamp?: number;
  createdAt: number;
  updatedAt: number;
  stats: BotStats;
  parametersOverride?: Record<string, any>;
}

export interface BotExecutionRecord {
  id: string;
  botId: string;
  symbol: string;
  orderType: 'BUY' | 'SELL';
  volume: number;
  entryPrice: number;
  exitPrice?: number;
  sl?: number;
  tp?: number;
  ticket?: number;
  dealTicket?: number;
  pnl?: number;
  status: 'PENDING' | 'OPEN' | 'CLOSED' | 'CANCELLED' | 'FAILED';
  executionMode: BotExecutionMode;
  openedAt: number;
  closedAt?: number;
  reason: string;
  magicNumber: number;
}

export interface BotLogEntry {
  id: string;
  botId: string;
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'signal' | 'trade';
  message: string;
  data?: any;
}
