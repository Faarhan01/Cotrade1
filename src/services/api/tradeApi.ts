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
