import { CommandDefinition } from './types.ts';
import { dbGetAccountHistory, dbGetAnalytics, dbGetCandles, dbGetOrders, dbGetTicksHistory } from '@core/database/db.ts';
import { tradeStore } from '@services/tradeStore';
import { calculateIndicators } from '@services/indicatorEngine';

export const mt5InsightCommands: CommandDefinition[] = [
  {
    name: 'GET_CURRENT_CHART',
    mcpAliases: ['mt5_get_current_chart'],
    category: 'market',
    description: 'Get the active MetaTrader chart symbol and timeframe.',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => tradeStore.getCurrentChart() || {
      status: 'awaiting_terminal',
      message: 'No active chart has been reported by the terminal.',
    },
  },
  {
    name: 'GET_EXECUTION_QUEUE',
    mcpAliases: ['mt5_get_execution_queue'],
    category: 'trading',
    description: 'Inspect recent queued, dispatched, executed, and failed trade commands.',
    inputSchema: { type: 'object', properties: { limit: { type: 'number' } } },
    handler: async (params) => {
      const queue = tradeStore.getState().commandQueue;
      const limit = Math.max(1, Math.min(500, Number(params.limit) || 50));
      return { count: Math.min(queue.length, limit), commands: queue.slice(0, limit) };
    },
  },
  {
    name: 'GET_TRADE_HISTORY',
    mcpAliases: ['mt5_query_trade_history'],
    category: 'account',
    description: 'Retrieve locally persisted order and execution history.',
    inputSchema: { type: 'object', properties: { limit: { type: 'number' } } },
    handler: async (params) => {
      const orders = await dbGetOrders(Math.max(1, Math.min(1000, Number(params.limit) || 100)));
      return { count: orders.length, orders };
    },
  },
  {
    name: 'GET_PERFORMANCE_ANALYTICS',
    mcpAliases: ['mt5_get_performance_analytics'],
    category: 'account',
    description: 'Get persisted trade, market-history, strategy, observation, and backtest totals.',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => dbGetAnalytics(),
  },
  {
    name: 'GET_CHART_HISTORY',
    mcpAliases: ['mt5_get_chart_history'],
    category: 'market',
    description: 'Retrieve stored OHLCV bars and optional technical indicators for a symbol and timeframe.',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: { type: 'string' },
        timeframe: { type: 'string' },
        limit: { type: 'number' },
        includeIndicators: { type: 'boolean' },
      },
    },
    handler: async (params) => {
      const chart = tradeStore.getCurrentChart();
      const symbol = String(params.symbol || chart?.symbol || 'EURUSD').trim();
      const timeframe = String(params.timeframe || chart?.timeframe || 'M1').toUpperCase();
      const limit = Math.max(1, Math.min(5000, Number(params.limit) || 500));
      let candles = await dbGetCandles(symbol, timeframe, limit);
      if (!candles.length && (!params.symbol || symbol === chart?.symbol)) {
        candles = tradeStore.getChartHistory().slice(-limit);
      }
      return {
        symbol,
        timeframe,
        count: candles.length,
        candles,
        indicators: params.includeIndicators === false ? undefined : calculateIndicators(candles, symbol, timeframe),
      };
    },
  },
  {
    name: 'GET_TECHNICAL_INDICATORS',
    mcpAliases: ['mt5_get_technical_indicators'],
    category: 'market',
    description: 'Calculate RSI, EMA, SMA, MACD, Bollinger bands, ATR, and the current technical summary.',
    inputSchema: {
      type: 'object',
      properties: { symbol: { type: 'string' }, timeframe: { type: 'string' } },
    },
    handler: async (params) => {
      const chart = tradeStore.getCurrentChart();
      const symbol = String(params.symbol || chart?.symbol || 'EURUSD').trim();
      const timeframe = String(params.timeframe || chart?.timeframe || 'M1').toUpperCase();
      const candles = await dbGetCandles(symbol, timeframe, 500);
      const indicators = calculateIndicators(candles.length ? candles : tradeStore.getChartHistory(), symbol, timeframe);
      if (!indicators) return { success: false, message: 'At least five candles are required to calculate indicators.', symbol, timeframe };
      return indicators;
    },
  },
  {
    name: 'GET_ACCOUNT_HISTORY',
    mcpAliases: ['mt5_get_account_history'],
    category: 'account',
    description: 'Retrieve persisted account snapshots.',
    inputSchema: { type: 'object', properties: { limit: { type: 'number' } } },
    handler: async (params) => {
      const history = await dbGetAccountHistory(Math.max(1, Math.min(1000, Number(params.limit) || 100)));
      return { count: history.length, history };
    },
  },
  {
    name: 'GET_TICK_HISTORY',
    mcpAliases: ['mt5_get_tick_history'],
    category: 'market',
    description: 'Retrieve persisted high-resolution ticks for a symbol.',
    inputSchema: {
      type: 'object',
      properties: { symbol: { type: 'string' }, limit: { type: 'number' } },
      required: ['symbol'],
    },
    handler: async (params) => {
      if (!params.symbol) return { success: false, message: 'Symbol is required.' };
      const ticks = await dbGetTicksHistory(String(params.symbol).trim(), Math.max(1, Math.min(5000, Number(params.limit) || 500)));
      return { count: ticks.length, ticks };
    },
  },
  {
    name: 'REQUEST_CHART_HISTORY',
    mcpAliases: ['mt5_request_chart_history'],
    category: 'market',
    description: 'Request a symbol/timeframe history refresh from the connected terminal.',
    inputSchema: {
      type: 'object',
      properties: { symbol: { type: 'string' }, timeframe: { type: 'string' }, count: { type: 'number' } },
      required: ['symbol'],
    },
    handler: async (params) => {
      if (!params.symbol) return { success: false, message: 'Symbol is required.' };
      const result = tradeStore.requestHistoryFromEA(String(params.symbol), params.timeframe || 'M1', Number(params.count) || 100);
      return { ...result, message: `History request queued for ${params.symbol} [${params.timeframe || 'M1'}]` };
    },
  },
  {
    name: 'GET_LIVE_STREAM_INFO',
    mcpAliases: ['mt5_get_live_stream_info'],
    category: 'system',
    description: 'Get live SSE/WebSocket endpoints and subscriber telemetry.',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => {
      const { getStreamStats } = await import('@services/websocketServer');
      return {
        protocol: 'SSE & WebSocket (JSON format)',
        liveMarketSseUrl: '/api/stream/live',
        daemonEventsSseUrl: '/api/daemon/stream',
        mcpSseUrl: '/api/mcp/sse',
        websocketUrl: '/ws',
        stats: getStreamStats(),
      };
    },
  },
  {
    name: 'DAEMON_STATUS',
    mcpAliases: ['mt5_daemon_status'],
    category: 'system',
    description: 'Get daemon connection, bot, watchlist, and service status.',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => {
      const { daemonService } = await import('@features/daemon/daemonService.ts');
      return daemonService.getStatus();
    },
  },
  {
    name: 'DAEMON_HEARTBEAT',
    mcpAliases: ['mt5_daemon_heartbeat'],
    category: 'system',
    description: 'Register an external AI client heartbeat with the daemon.',
    inputSchema: {
      type: 'object',
      properties: { aiName: { type: 'string' }, sessionId: { type: 'string' }, metadata: { type: 'object' } },
    },
    handler: async (params) => {
      const { daemonService } = await import('@features/daemon/daemonService.ts');
      return daemonService.registerHeartbeat(params.aiName, params.sessionId, params.metadata);
    },
  },
  {
    name: 'DAEMON_DISPATCH',
    mcpAliases: ['mt5_daemon_dispatch'],
    category: 'system',
    description: 'Dispatch a named unified command through the daemon.',
    inputSchema: {
      type: 'object',
      properties: { action: { type: 'string' }, params: { type: 'object' } },
      required: ['action'],
    },
    handler: async (params) => {
      if (!params.action) return { success: false, message: 'Action is required.' };
      const { daemonService } = await import('@features/daemon/daemonService.ts');
      return daemonService.dispatchAICommand({ action: params.action, ...(params.params || {}) });
    },
  },
];