import { request } from './client';

export const databaseApi = {
  async getAnalytics(): Promise<any> {
    return request('/api/database/analytics');
  },

  async getOrders(limit = 100): Promise<{ orders: any[] }> {
    return request(`/api/database/orders?limit=${limit}`);
  },

  async getCandles(symbol: string, timeframe = 'M1', limit = 100): Promise<any> {
    return request(`/api/database/candles?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}&limit=${limit}`);
  },

  async getTicks(symbol?: string, limit = 100): Promise<any> {
    const qs = symbol ? `?symbol=${encodeURIComponent(symbol)}&limit=${limit}` : `?limit=${limit}`;
    return request(`/api/database/ticks${qs}`);
  },

  async getAccountHistory(limit = 100): Promise<any> {
    return request(`/api/database/account?limit=${limit}`);
  },

  async getTableData(table: string, limit = 100): Promise<{ columns: string[]; rows: any[]; total: number }> {
    switch (table) {
      case 'orders':
        return { columns: [], rows: await (await this.getOrders(limit)).orders, total: 0 };
      case 'candles_history':
        return this.getCandles('EURUSD', 'M1', limit);
      case 'ticks_history':
        return this.getTicks(undefined, limit);
      case 'account_history':
        return this.getAccountHistory(limit);
      default:
        return { columns: [], rows: [], total: 0 };
    }
  },

  async prune(): Promise<{ success: boolean; purgedUnexecutedOrders: number; message: string }> {
    return request('/api/database/prune', { method: 'POST' });
  },
};