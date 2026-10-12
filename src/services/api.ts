import { AppState, MCPToolDefinition, RiskGuardConfig, TradeCommand } from '../types';
import {
  connectionApi,
  marketApi,
  tradeApi,
  strategyApi,
  databaseApi,
  mcpApi,
} from './api/index';

export * from './api/index';

export const api = {
  async getState(): Promise<AppState> {
    const res = await fetch('/api/state');
    if (!res.ok) throw new Error('Failed to fetch state');
    return res.json();
  },

  async sendCommand(command: {
    action: TradeCommand['action'];
    symbol?: string;
    orderType?: TradeCommand['orderType'];
    volume?: number;
    price?: number;
    sl?: number;
    tp?: number;
    ticket?: number;
    magic?: number;
    comment?: string;
    source?: TradeCommand['source'];
  }): Promise<{ success: boolean; commandId?: string; ticket?: number; price?: number; message?: string; error?: string }> {
    return tradeApi.executeTrade({
      action: command.action,
      symbol: command.symbol || 'EURUSD',
      orderType: command.orderType || 'BUY',
      volume: command.volume || 0.1,
      price: command.price,
      sl: command.sl,
      tp: command.tp,
      ticket: command.ticket,
      magic: command.magic,
      comment: command.comment,
      source: command.source,
    });
  },

  async updateRisk(risk: Partial<RiskGuardConfig>): Promise<{ status: string; riskGuard: RiskGuardConfig }> {
    return tradeApi.updateRisk(risk);
  },

  async toggleKillSwitch(active: boolean): Promise<{ status: string; emergencyKillSwitch: boolean }> {
    const res = await tradeApi.toggleKillSwitch(active);
    return { status: res.status, emergencyKillSwitch: res.killSwitch };
  },

  async getMcpTools(): Promise<{ tools: MCPToolDefinition[] }> {
    return mcpApi.getTools();
  },

  async executeMcpTool(name: string, args: Record<string, any>): Promise<any> {
    return mcpApi.executeTool(name, args);
  },

  async callMcpJsonRpc(body: any): Promise<any> {
    return mcpApi.sendJsonRpc(body);
  },

  async getEaCode(): Promise<{ code: string }> {
    const res = await fetch('/api/ea/code');
    if (!res.ok) return { code: '' };
    return res.json();
  },

  async checkBridgeHealth(url = '/health'): Promise<{ ok: boolean; data?: any; latencyMs: number }> {
    return connectionApi.pingHealth(url);
  },

  async simulateTick(symbol: string, bid?: number, ask?: number) {
    const res = await fetch('/api/simulate-tick', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol, bid, ask }),
    });
    return res.json();
  },

  // Connection Management
  async getConnectionStatus() {
    return connectionApi.getStatus();
  },

  async connect(params: { login?: number; password?: string; server?: string; path?: string }) {
    return connectionApi.connect(params);
  },

  async disconnect() {
    return connectionApi.disconnect();
  },

  async switchProvider(provider: string, config?: any) {
    return connectionApi.switchProvider(provider, config);
  },

  // Database Management
  async getDatabaseAnalytics(): Promise<any> {
    const res = await databaseApi.getAnalytics();
    return res.analytics;
  },

  async getDatabaseOrders(limit = 100): Promise<{ orders: any[] }> {
    return databaseApi.getOrders(limit);
  },

  async pruneDatabase(): Promise<{ success: boolean; purgedUnexecutedOrders: number; message: string }> {
    return databaseApi.prune();
  },

  // Strategies Knowledge Base
  async getStrategies(symbol?: string): Promise<{ strategies: any[] }> {
    const res = await strategyApi.getStrategies(symbol);
    return { strategies: res.strategies || [] };
  },

  async saveStrategy(strategy: any): Promise<{ success: boolean; strategy: any }> {
    return strategyApi.saveStrategy(strategy);
  },

  async deleteStrategy(id: string): Promise<{ success: boolean }> {
    const res = await strategyApi.deleteStrategy(id);
    return { success: res.success };
  },

  async runBacktest(strategyId: string, options?: { candleLimit?: number; initialDeposit?: number }): Promise<{ success: boolean; result: any }> {
    return strategyApi.runBacktest({
      strategy: { id: strategyId },
      candleCount: options?.candleLimit,
      initialDeposit: options?.initialDeposit,
    });
  },

  // Observations Knowledge Base
  async getObservations(category?: string): Promise<{ observations: any[] }> {
    const res = await strategyApi.getObservations(category);
    return { observations: res.observations || [] };
  },

  async saveObservation(obs: any): Promise<{ success: boolean; observation: any }> {
    return strategyApi.saveObservation(obs);
  },

  async deleteObservation(id: string): Promise<{ success: boolean }> {
    const res = await strategyApi.deleteObservation(id);
    return { success: res.success };
  },

  // Backtest Results
  async getBacktestHistory(strategyId?: string): Promise<{ results: any[] }> {
    const res = await strategyApi.getBacktestHistory(strategyId);
    return { results: res.results || [] };
  },
};
