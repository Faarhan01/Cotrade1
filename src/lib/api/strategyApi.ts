import { request } from './client';

export const strategyApi = {
  async getStrategies(symbol?: string): Promise<{ strategies: any[] }> {
    const qs = symbol ? `?symbol=${encodeURIComponent(symbol)}` : '';
    return request(`/api/strategies${qs}`);
  },

  async saveStrategy(strategy: any): Promise<{ success: boolean; strategy: any }> {
    return request('/api/strategies', {
      method: 'POST',
      body: JSON.stringify(strategy),
    });
  },

  async deleteStrategy(id: string): Promise<{ success: boolean }> {
    return request(`/api/strategies/${id}`, { method: 'DELETE' });
  },

  async runBacktest(params: { strategy: { id: string }; candleCount?: number; initialDeposit?: number }): Promise<{ success: boolean; result: any }> {
    return request('/api/strategies/backtest', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  async getBacktestHistory(strategyId?: string): Promise<{ results: any[] }> {
    const qs = strategyId ? `?strategyId=${encodeURIComponent(strategyId)}` : '';
    return request(`/api/strategies/backtest/history${qs}`);
  },

  async getObservations(category?: string): Promise<{ observations: any[] }> {
    const qs = category ? `?category=${encodeURIComponent(category)}` : '';
    return request(`/api/observations${qs}`);
  },

  async saveObservation(obs: any): Promise<{ success: boolean; observation: any }> {
    return request('/api/observations', {
      method: 'POST',
      body: JSON.stringify(obs),
    });
  },

  async deleteObservation(id: string): Promise<{ success: boolean }> {
    return request(`/api/observations/${id}`, { method: 'DELETE' });
  },
};