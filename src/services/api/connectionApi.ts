import { request } from './client';

export interface ConnectionStatusResponse {
  status: string;
  provider: string;
  connected: boolean;
  terminalConnected?: boolean;
  packageAvailable?: boolean;
  packageVersion?: string;
  engine: string;
  isNative: boolean;
  server: string;
  login?: number;
  lastPingMs: number;
  message?: string;
  account: any;
  terminal: any;
  timestamp: number;
}

export const connectionApi = {
  getStatus(): Promise<ConnectionStatusResponse> {
    return request<ConnectionStatusResponse>('/api/connection/status');
  },

  connect(params: { login?: number; password?: string; server?: string; path?: string }) {
    return request<{ success: boolean; message: string }>('/api/connection/connect', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  disconnect() {
    return request<{ success: boolean; message: string }>('/api/connection/disconnect', {
      method: 'POST',
    });
  },

  switchProvider(provider: string, config?: any) {
    return request<{ success: boolean; provider: string; status: any }>('/api/connection/provider', {
      method: 'POST',
      body: JSON.stringify({ provider, config }),
    });
  },

  async pingHealth(url = '/health'): Promise<{ ok: boolean; data?: any; latencyMs: number }> {
    const start = performance.now();
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      const latencyMs = Math.round(performance.now() - start);
      if (res.ok) {
        const data = await res.json();
        return { ok: true, data, latencyMs };
      }
      return { ok: false, latencyMs };
    } catch {
      return { ok: false, latencyMs: Math.round(performance.now() - start) };
    }
  },
};
