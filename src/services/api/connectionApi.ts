import { request } from './client';

export const connectionApi = {
  async pingHealth(url = '/health'): Promise<{ ok: boolean; data?: any; latencyMs: number }> {
    const start = performance.now();
    try {
      const data = await request(url);
      return { ok: true, data, latencyMs: Math.round(performance.now() - start) };
    } catch (err: any) {
      return { ok: false, latencyMs: Math.round(performance.now() - start), data: { error: err?.message } };
    }
  },

  async getStatus(): Promise<any> {
    return request('/api/status');
  },

  async connect(params: { login?: number; password?: string; server?: string; path?: string }): Promise<any> {
    return request('/api/connection/connect', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  async disconnect(): Promise<any> {
    return request('/api/connection/disconnect', { method: 'POST' });
  },

  async switchProvider(provider: string, config?: any): Promise<any> {
    return request('/api/connection/provider', {
      method: 'POST',
      body: JSON.stringify({ provider, config }),
    });
  },
};