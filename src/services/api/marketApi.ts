import { request } from './client';
import { CandleData, DetailedSymbolInfo, TickData } from '../../types';

export const marketApi = {
  // Discovered broker symbols directly from MT5 Python package
  getSymbols(): Promise<{ success: boolean; count: number; symbols: DetailedSymbolInfo[] }> {
    return request('/api/symbols');
  },

  // Live ticks (preserving symbol casing)
  getTicks(symbols?: string[]): Promise<{ success: boolean; count: number; ticks: TickData[] }> {
    const qs = symbols && symbols.length ? `?symbols=${encodeURIComponent(symbols.join(','))}` : '';
    return request(`/api/ticks${qs}`);
  },

  // OHLCV Candlesticks
  getCandles(symbol: string, timeframe = 'M1', count = 100): Promise<{
    success: boolean;
    symbol: string;
    timeframe: string;
    count: number;
    candles: CandleData[];
  }> {
    const sym = symbol ? symbol.trim() : 'EURUSD';
    return request(`/api/candles?symbol=${encodeURIComponent(sym)}&timeframe=${encodeURIComponent(timeframe)}&count=${count}`);
  },

  // Account Snapshot
  getAccount(): Promise<{ success: boolean; account: any }> {
    return request('/api/account');
  },

  // Terminal details
  getTerminal(): Promise<{ success: boolean; terminal: any }> {
    return request('/api/terminal');
  },

  // Level 2 Market Depth (Order Book)
  getMarketDepth(symbol: string): Promise<{ success: boolean; symbol: string; depth: { bids: any[]; asks: any[] } }> {
    return request(`/api/market-depth?symbol=${encodeURIComponent(symbol)}`);
  },

  // Detailed Symbol Specifications
  getDetailedSymbol(symbol: string): Promise<{ success: boolean; symbol: string; spec: DetailedSymbolInfo | null }> {
    return request(`/api/symbols/${encodeURIComponent(symbol)}`);
  },

  // External AI Stream Statistics
  getStreamStats(): Promise<{ status: string; wsClientsCount: number; sseClientsCount: number; totalEventsBroadcasted: number }> {
    return request('/api/stream/stats');
  },
};
