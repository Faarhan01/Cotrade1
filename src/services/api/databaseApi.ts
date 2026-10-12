import { request } from './client';

export const databaseApi = {
  getAnalytics(): Promise<{ success: boolean; analytics: any }> {
    return request('/api/database/analytics');
  },

  getOrders(limit = 100): Promise<{ success: boolean; count: number; orders: any[] }> {
    return request(`/api/database/orders?limit=${limit}`);
  },

  getCandles(symbol = 'EURUSD', timeframe = 'M1', limit = 100): Promise<{
    success: boolean;
    symbol: string;
    timeframe: string;
    count: number;
    candles: any[];
  }> {
    return request(`/api/database/candles?symbol=${encodeURIComponent(symbol.trim())}&timeframe=${encodeURIComponent(timeframe)}&limit=${limit}`);
  },

  getTicks(symbol?: string, limit = 100): Promise<{ success: boolean; count: number; ticks: any[] }> {
    const qs = symbol ? `?symbol=${encodeURIComponent(symbol.trim())}&limit=${limit}` : `?limit=${limit}`;
    return request(`/api/database/ticks${qs}`);
  },

  prune(): Promise<{ success: boolean; purgedUnexecutedOrders: number; message: string }> {
    return request('/api/database/prune', { method: 'POST' });
  },
};
