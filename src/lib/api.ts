import { AppState, MCPToolDefinition, RiskGuardConfig, TradeCommand } from '@/types';
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

  async simulateChartBatch(symbol: string, count = 40, pattern = 'wave') {
    const res = await fetch('/api/charts/simulate-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol, count, pattern }),
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

  async getTableData(table: string, limit = 100): Promise<{ columns: string[]; rows: any[]; total: number }> {
    return databaseApi.getTableData(table, limit);
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

  // MT5 Historical Deals & Orders
  async getHistoryDeals(params?: { from?: number; to?: number; count?: number }) {
    return tradeApi.getHistoryDeals(params);
  },

  async getHistoryOrders(params?: { from?: number; to?: number; count?: number }) {
    return tradeApi.getHistoryOrders(params);
  },

  async closePosition(ticket: number, volume?: number) {
    return tradeApi.closePosition(ticket, volume);
  },

  async modifyPosition(ticket: number, sl?: number, tp?: number) {
    return tradeApi.modifyPosition(ticket, sl, tp);
  },

  async modifyPendingOrder(ticket: number, price?: number, sl?: number, tp?: number) {
    return tradeApi.modifyOrder(ticket, price, sl, tp);
  },

  async checkOrder(order: any) {
    return tradeApi.checkOrder(order);
  },

  async calcMargin(data: { action?: string; orderType?: string; symbol: string; volume: number; price?: number }) {
    return tradeApi.calcMargin(data);
  },

  async calcProfit(data: { action?: string; orderType?: string; symbol: string; volume: number; priceOpen: number; priceClose: number }) {
    return tradeApi.calcProfit(data);
  },

  async getMarketDepth(symbol: string) {
    return marketApi.getMarketDepth(symbol);
  },

  async getSymbols(group?: string) {
    return marketApi.getSymbols(group);
  },

  async getDetailedSymbol(symbol: string) {
    return marketApi.getDetailedSymbol(symbol);
  },

  async getCandles(symbol: string, timeframe = 'M1', count = 100, from?: number, to?: number) {
    return marketApi.getCandles(symbol, timeframe, count, from, to);
  },

  async getTicksHistory(symbol: string, from?: number, to?: number, count = 500) {
    return marketApi.getTicksHistory(symbol, from, to, count);
  },

  async selectSymbol(symbol: string, enable = true) {
    return marketApi.selectSymbol(symbol, enable);
  },

  async getTickHistory(): Promise<{ success: boolean; history: Record<string, { time: number; bid: number; ask: number }[]> }> {
    const res = await fetch('/api/tick-history');
    if (!res.ok) throw new Error('Failed to fetch tick history');
    return res.json();
  },

  async getStreamStats() {
    return marketApi.getStreamStats();
  },

  // Daemon API
  async getDaemonStatus() {
    const res = await fetch('/api/daemon/status');
    return res.json();
  },

  async sendDaemonHeartbeat(aiName?: string, sessionId?: string, metadata?: any) {
    const res = await fetch('/api/daemon/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aiName, sessionId, metadata }),
    });
    return res.json();
  },

  async dispatchDaemonCommand(command: any) {
    const res = await fetch('/api/daemon/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(command),
    });
    return res.json();
  },

  async getDaemonEvents(options: { limit?: number; type?: string; startTime?: number; endTime?: number } = {}) {
    const params = new URLSearchParams();
    if (options.limit) params.set('limit', String(options.limit));
    if (options.type) params.set('type', options.type);
    if (options.startTime) params.set('startTime', String(options.startTime));
    if (options.endTime) params.set('endTime', String(options.endTime));
    const res = await fetch(`/api/daemon/events?${params.toString()}`);
    return res.json();
  },

  async postDaemonEvent(type: string, payload: any) {
    const res = await fetch('/api/daemon/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, payload }),
    });
    return res.json();
  },

  async clearDaemonEvents() {
    const res = await fetch('/api/daemon/clear', { method: 'POST' });
    return res.json();
  },

  async updateDaemonConfig(config: any) {
    const res = await fetch('/api/daemon/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    return res.json();
  },

  async updateDaemonWatchlist(symbols: string[]) {
    const res = await fetch('/api/daemon/watchlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbols }),
    });
    return res.json();
  },

  // Gateway Diagnostics & Bulk Operations
  async getGatewayDiagnostics() {
    const res = await fetch('/api/gateway/diagnostics');
    return res.json();
  },

  async getSymbolGroups() {
    const res = await fetch('/api/symbols-groups');
    return res.json();
  },

  async closeAllPositions() {
    const res = await fetch('/api/positions/close-all', { method: 'POST' });
    return res.json();
  },

  async cancelAllOrders() {
    const res = await fetch('/api/orders/cancel-all', { method: 'POST' });
    return res.json();
  },

  // Automated Algorithmic Bots API
  async getBots() {
    const res = await fetch('/api/bots');
    return res.json();
  },

  async getBot(id: string) {
    const res = await fetch(`/api/bots/${id}`);
    return res.json();
  },

  async createBot(data: any) {
    const res = await fetch('/api/bots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async updateBot(id: string, data: any) {
    const res = await fetch(`/api/bots/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async startBot(id: string) {
    const res = await fetch(`/api/bots/${id}/start`, { method: 'POST' });
    return res.json();
  },

  async pauseBot(id: string) {
    const res = await fetch(`/api/bots/${id}/pause`, { method: 'POST' });
    return res.json();
  },

  async stopBot(id: string) {
    const res = await fetch(`/api/bots/${id}/stop`, { method: 'POST' });
    return res.json();
  },

  async deleteBot(id: string) {
    const res = await fetch(`/api/bots/${id}`, { method: 'DELETE' });
    return res.json();
  },

  async evaluateBot(id: string) {
    const res = await fetch(`/api/bots/${id}/evaluate`, { method: 'POST' });
    return res.json();
  },

  async closeBotPositions(id: string, reason?: string) {
    const res = await fetch(`/api/bots/${id}/close-positions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    return res.json();
  },

  async getBotExecutions(id: string, limit = 50) {
    const res = await fetch(`/api/bots/${id}/executions?limit=${limit}`);
    return res.json();
  },

  async getBotLogs(id: string, limit = 50) {
    const res = await fetch(`/api/bots/${id}/logs?limit=${limit}`);
    return res.json();
  },

  async getBotPositions(id: string) {
    const res = await fetch(`/api/bots/${id}/positions`);
    return res.json();
  },

  async forceBotSignal(id: string, signal: 'BUY' | 'SELL') {
    const res = await fetch(`/api/bots/${id}/force-signal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signal }),
    });
    return res.json();
  },

  async closeByPositions(ticket: number, oppositeTicket: number) {
    const res = await fetch('/api/positions/close-by', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket, oppositeTicket }),
    });
    return res.json();
  },

  async closePositionsBatch(filter: { symbol?: string; magic?: number; type?: string }) {
    const res = await fetch('/api/positions/close-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(filter),
    });
    return res.json();
  },

  async cancelOrdersBatch(filter: { symbol?: string; magic?: number; type?: string }) {
    const res = await fetch('/api/orders/cancel-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(filter),
    });
    return res.json();
  },

  async getJournal(limit = 100) {
    const res = await fetch(`/api/journal?limit=${limit}`);
    return res.json();
  },

  async saveJournal(entry: any) {
    const res = await fetch('/api/journal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    return res.json();
  },

  async deleteJournal(id: string) {
    const res = await fetch(`/api/journal/${id}`, { method: 'DELETE' });
    return res.json();
  },

  async exportDatabase() {
    const res = await fetch('/api/database/export');
    return res.json();
  },
};
