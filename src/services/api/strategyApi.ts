import { request } from './client';

export const strategyApi = {
  getStrategies(symbol?: string): Promise<{ success: boolean; count: number; strategies: any[] }> {
    const url = symbol ? `/api/strategies?symbol=${encodeURIComponent(symbol.trim())}` : '/api/strategies';
    return request(url);
  },

  saveStrategy(strategy: any): Promise<{ success: boolean; strategy: any }> {
    return request('/api/strategies', {
      method: 'POST',
      body: JSON.stringify(strategy),
    });
  },

  deleteStrategy(id: string): Promise<{ success: boolean; message: string }> {
    return request(`/api/strategies/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  runBacktest(params: {
    strategy?: any;
    symbol?: string;
    timeframe?: string;
    candleCount?: number;
    initialDeposit?: number;
    fixedLot?: number;
  }): Promise<{ success: boolean; result: any }> {
    return request('/api/strategies/backtest', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  getBacktestHistory(strategyId?: string): Promise<{ success: boolean; count: number; results: any[] }> {
    const url = strategyId ? `/api/strategies/backtest/history?strategyId=${encodeURIComponent(strategyId)}` : '/api/strategies/backtest/history';
    return request(url);
  },

  getObservations(category?: string): Promise<{ success: boolean; count: number; observations: any[] }> {
    const url = category && category !== 'all' ? `/api/observations?category=${encodeURIComponent(category)}` : '/api/observations';
    return request(url);
  },

  saveObservation(obs: any): Promise<{ success: boolean; observation: any }> {
    return request('/api/observations', {
      method: 'POST',
      body: JSON.stringify(obs),
    });
  },

  deleteObservation(id: string): Promise<{ success: boolean; message: string }> {
    return request(`/api/observations/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },
};
