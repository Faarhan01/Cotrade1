import { request } from './client';
import { RiskGuardConfig, TradeCommand } from '../../types';

export const tradeApi = {
  executeTrade(command: {
    action?: TradeCommand['action'];
    symbol: string;
    orderType: TradeCommand['orderType'];
    volume: number;
    price?: number;
    sl?: number;
    tp?: number;
    ticket?: number;
    magic?: number;
    comment?: string;
    source?: TradeCommand['source'];
  }): Promise<{ success: boolean; commandId?: string; ticket?: number; price?: number; message?: string; error?: string }> {
    return request('/api/commands', {
      method: 'POST',
      body: JSON.stringify(command),
    });
  },

  closePosition(ticket: number, volume?: number) {
    return request<{ success: boolean; message: string; ticket: number }>(`/api/positions/${ticket}/close`, {
      method: 'POST',
      body: JSON.stringify({ volume }),
    });
  },

  modifyPosition(ticket: number, sl?: number, tp?: number) {
    return request<{ success: boolean; message: string; ticket: number }>(`/api/positions/${ticket}/modify`, {
      method: 'POST',
      body: JSON.stringify({ sl, tp }),
    });
  },

  cancelOrder(ticket: number) {
    return request<{ success: boolean; message: string; ticket: number }>(`/api/orders/${ticket}/cancel`, {
      method: 'POST',
    });
  },

  modifyOrder(ticket: number, price?: number, sl?: number, tp?: number) {
    return request<{ success: boolean; message: string; ticket: number }>(`/api/orders/${ticket}/modify`, {
      method: 'POST',
      body: JSON.stringify({ price, sl, tp }),
    });
  },

  checkOrder(order: any) {
    return request<{ feasible: boolean; retcode?: number; margin?: number; profit?: number; message?: string }>('/api/orders/check', {
      method: 'POST',
      body: JSON.stringify(order),
    });
  },

  calcMargin(data: { action?: string; orderType?: string; symbol: string; volume: number; price?: number }) {
    return request<{ success: boolean; margin: number; currency: string; message?: string }>('/api/tools/calc-margin', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  calcProfit(data: { action?: string; orderType?: string; symbol: string; volume: number; priceOpen: number; priceClose: number }) {
    return request<{ success: boolean; profit: number; currency: string; message?: string }>('/api/tools/calc-profit', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getHistoryDeals(params?: { from?: number; to?: number; count?: number }) {
    const qs = new URLSearchParams();
    if (params?.from) qs.set('from', String(params.from));
    if (params?.to) qs.set('to', String(params.to));
    if (params?.count) qs.set('count', String(params.count));
    return request<{ success: boolean; count: number; deals: any[] }>(`/api/history/deals?${qs.toString()}`);
  },

  getHistoryOrders(params?: { from?: number; to?: number; count?: number }) {
    const qs = new URLSearchParams();
    if (params?.from) qs.set('from', String(params.from));
    if (params?.to) qs.set('to', String(params.to));
    if (params?.count) qs.set('count', String(params.count));
    return request<{ success: boolean; count: number; orders: any[] }>(`/api/history/orders?${qs.toString()}`);
  },

  updateRisk(risk: Partial<RiskGuardConfig>): Promise<{ status: string; riskGuard: RiskGuardConfig }> {
    return request('/api/risk', {
      method: 'POST',
      body: JSON.stringify(risk),
    });
  },

  toggleKillSwitch(active: boolean): Promise<{ status: string; killSwitch: boolean }> {
    return request('/api/kill-switch', {
      method: 'POST',
      body: JSON.stringify({ active }),
    });
  },
};
