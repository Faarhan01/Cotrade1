import { request } from './client';
import { CandleData, DetailedSymbolInfo, TickData } from '@/types';

export const marketApi = {
  // Discovered broker symbols directly from MT5 Python package
  getSymbols(group?: string): Promise<{ success: boolean; count: number; symbols: DetailedSymbolInfo[] }> {
    const qs = group ? `?group=${encodeURIComponent(group)}` : '';
    return request(`/api/symbols${qs}`);
  },

  // Select/Unselect symbol in MarketWatch
  selectSymbol(symbol: string, enable = true): Promise<{ success: boolean; symbol: string; selected: boolean; message?: string }> {
    return request('/api/symbols/select', {
      method: 'POST',
      body: JSON.stringify({ symbol: symbol.trim(), enable }),
    });
  },

  // Live ticks (preserving symbol casing)
  getTicks(symbols?: string[]): Promise<{ success: boolean; count: number; ticks: TickData[] }> {
    const qs = symbols && symbols.length ? `?symbols=${encodeURIComponent(symbols.join(','))}` : '';
    return request(`/api/ticks${qs}`);
  },

  // Deep tick-level historical data from MT5
  getTicksHistory(symbol: string, from?: number, to?: number, count = 500): Promise<{
    success: boolean;
    symbol: string;
    count: number;
    ticks: TickData[];
  }> {
    const qs = new URLSearchParams();
    qs.set('symbol', symbol ? symbol.trim() : 'EURUSD');
    qs.set('count', String(count));
    if (from) qs.set('from', String(from));
    if (to) qs.set('to', String(to));
    return request(`/api/ticks/history?${qs.toString()}`);
  },

  // OHLCV Candlesticks (supports count and optional date range)
  getCandles(symbol: string, timeframe = 'M1', count = 100, from?: number, to?: number, startPos?: number): Promise<{
    success: boolean;
    symbol: string;
    timeframe: string;
    count: number;
    candles: CandleData[];
  }> {
    const qs = new URLSearchParams();
    qs.set('symbol', symbol ? symbol.trim() : 'EURUSD');
    qs.set('timeframe', timeframe);
    qs.set('count', String(count));
    if (from) qs.set('from', String(from));
    if (to) qs.set('to', String(to));
    if (startPos !== undefined) qs.set('startPos', String(Math.max(0, startPos)));
    return request(`/api/candles?${qs.toString()}`);
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
