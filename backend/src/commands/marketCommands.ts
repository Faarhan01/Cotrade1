import { CommandDefinition } from './types.ts';
import { connectorManager } from '@features/mt5';
import { tradeStore } from '@services/tradeStore';
import { normalizeSymbol } from '@core/utils';
import { broadcast } from '@services/websocketServer';

export const marketCommands: CommandDefinition[] = [
  {
    name: 'GET_TICKS',
    mcpAliases: ['mt5_get_market_data'],
    category: 'market',
    description: 'Retrieve real-time market ticks (bid, ask, spread, time, last price) for tracked symbols.',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: 'Filter ticks by symbol (optional)' },
      },
    },
    handler: async (params) => {
      const ticks = tradeStore.getTicks();
      if (params.symbol) {
        const sym = normalizeSymbol(params.symbol);
        return ticks.filter((t) => t.symbol === sym);
      }
      return ticks;
    },
  },
  {
    name: 'GET_TICKS_HISTORY',
    mcpAliases: ['mt5_get_tick_history'],
    category: 'market',
    description: 'Pull high-precision historical tick records with microsecond timestamps directly from MT5.',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: 'Symbol to fetch ticks for (e.g. EURUSD)' },
        dateFrom: { type: 'number', description: 'Start timestamp in seconds (optional)' },
        dateTo: { type: 'number', description: 'End timestamp in seconds (optional)' },
        count: { type: 'number', description: 'Maximum ticks to fetch (default: 500)' },
        flags: { type: 'string', enum: ['ALL', 'INFO', 'TRADE'], description: 'Tick classes to copy from MT5 (default: ALL)' },
      },
      required: ['symbol'],
    },
    handler: async (params) => {
      const connector = connectorManager.getConnector();
      const sym = normalizeSymbol(params.symbol || 'EURUSD');
      if (connector.getTicksHistory) {
        return await connector.getTicksHistory(sym, params.dateFrom, params.dateTo, params.count || params.limit || 500, params.flags);
      }
      const { dbGetTicksHistory } = await import('@core/database/db.ts');
      return await dbGetTicksHistory(sym, params.count || params.limit || 500);
    },
  },
  {
    name: 'GET_CANDLES',
    aliases: ['FETCH_CANDLES'],
    category: 'market',
    description: 'Retrieve historical OHLCV candlestick data for any symbol and timeframe from MetaTrader 5.',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: 'Symbol ticker (e.g. EURUSD, XAUUSD)' },
        timeframe: { type: 'string', enum: ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M10', 'M12', 'M15', 'M20', 'M30', 'H1', 'H2', 'H3', 'H4', 'H6', 'H8', 'H12', 'D1', 'W1', 'MN1'], description: 'Timeframe period supported by MetaTrader 5' },
        count: { type: 'number', description: 'Number of historical candles to return (default: 100)' },
        dateFrom: { type: 'number', description: 'Start timestamp in seconds (optional)' },
        dateTo: { type: 'number', description: 'End timestamp in seconds (optional)' },
        startPos: { type: 'number', description: 'Start bar index from present when not using a date range (0 is the current bar)' },
      },
      required: ['symbol'],
    },
    handler: async (params) => {
      const connector = connectorManager.getConnector();
      const sym = normalizeSymbol(params.symbol || 'EURUSD');
      const tf = (params.timeframe || 'M1').toUpperCase();
      const count = Number(params.count) || 100;
      return await connector.getCandles(sym, tf, count, params.dateFrom, params.dateTo, params.startPos !== undefined ? Number(params.startPos) : undefined);
    },
  },
  {
    name: 'GET_SYMBOLS',
    mcpAliases: ['mt5_get_all_symbols'],
    category: 'market',
    description: 'Retrieve all tradable symbols available on the broker terminal with specifications.',
    inputSchema: {
      type: 'object',
      properties: {
        group: { type: 'string', description: 'Optional symbol group filter (e.g. *USD*, FOREX*)' },
      },
    },
    handler: async (params) => {
      const connector = connectorManager.getConnector();
      const symbols = await connector.getSymbols(params.group);
      return symbols.length > 0 ? symbols : tradeStore.getAllSymbols();
    },
  },
  {
    name: 'GET_SYMBOL_INFO',
    aliases: ['GET_SYMBOL_SPECIFICATION'],
    mcpAliases: ['mt5_get_symbol_info'],
    category: 'market',
    description: 'Retrieve detailed broker contract specifications for a symbol (digits, contract size, swap, stops level).',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: 'Symbol ticker (e.g. EURUSD)' },
      },
      required: ['symbol'],
    },
    handler: async (params) => {
      const connector = connectorManager.getConnector();
      const sym = normalizeSymbol(params.symbol || 'EURUSD');
      return await (connector as any).getDetailedSymbol(sym);
    },
  },
  {
    name: 'SELECT_SYMBOL',
    mcpAliases: ['mt5_select_symbol'],
    category: 'market',
    description: 'Add or remove a symbol from the active MarketWatch in MetaTrader 5.',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: 'Symbol ticker' },
        enable: { type: 'boolean', description: 'True to add, false to hide' },
      },
      required: ['symbol'],
    },
    handler: async (params) => {
      const connector = connectorManager.getConnector();
      const sym = normalizeSymbol(params.symbol);
      if (connector.selectSymbol) {
        return await connector.selectSymbol(sym, params.enable !== false);
      }
      return { success: true, symbol: sym, selected: params.enable !== false };
    },
  },
  {
    name: 'GET_MARKET_DEPTH',
    mcpAliases: ['mt5_get_market_depth'],
    category: 'market',
    description: 'Retrieve Level 2 Market Depth (order book bids and asks) for a symbol.',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: 'Symbol ticker' },
      },
      required: ['symbol'],
    },
    handler: async (params) => {
      const connector = connectorManager.getConnector();
      const sym = normalizeSymbol(params.symbol || 'EURUSD');
      return await connector.getMarketDepth(sym);
    },
  },
  {
    name: 'SIMULATE_TICK',
    mcpAliases: ['mt5_simulate_tick'],
    category: 'market',
    description: 'Inject a synthetic or custom price tick into the streaming feed for testing.',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: 'Symbol ticker' },
        bid: { type: 'number', description: 'Bid price' },
        ask: { type: 'number', description: 'Ask price' },
        spread: { type: 'number', description: 'Spread in broker points' },
      },
    },
    handler: async (params) => {
      const sym = normalizeSymbol(params.symbol || 'EURUSD');
      const now = Date.now();
      const currentTick = tradeStore.getTicks().find((t) => t.symbol === sym);
      const baseBid = params.bid !== undefined ? Number(params.bid) : (currentTick ? currentTick.bid + (Math.random() - 0.5) * 0.0004 : (sym === 'XAUUSD' ? 2650.0 : 1.0850));
      const calculatedSpread = params.spread !== undefined ? Number(params.spread) : (sym.includes('JPY') ? 15 : 12);
      const point = sym.includes('JPY') ? 0.001 : 0.0001;
      const calculatedAsk = params.ask !== undefined ? Number(params.ask) : (baseBid + calculatedSpread * point);

      const tick = {
        symbol: sym,
        bid: baseBid,
        ask: calculatedAsk,
        spread: calculatedSpread,
        last: baseBid,
        volume: 1,
        time: now,
      };

      tradeStore.updateTick(tick);
      broadcast({ type: 'tick', payload: tick });

      return { success: true, tick };
    },
  },
  {
    name: 'SIMULATE_CANDLES',
    mcpAliases: ['mt5_simulate_candles'],
    category: 'market',
    description: 'Seed synthetic historical candlestick bars into the database for immediate testing.',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: 'Symbol to seed' },
        timeframe: { type: 'string', description: 'Timeframe (default M1)' },
        count: { type: 'number', description: 'Number of candles (default 60)' },
        basePrice: { type: 'number', description: 'Starting base price' },
      },
    },
    handler: async (params) => {
      const sym = normalizeSymbol(params.symbol || 'EURUSD');
      const tf = params.timeframe || 'M1';
      const count = Number(params.count) || 60;
      const basePrice = Number(params.basePrice) || (sym === 'XAUUSD' ? 2650.0 : 1.0850);
      return await tradeStore.seedCandles(sym, tf, count, basePrice);
    },
  },
  {
    name: 'SIMULATE_CHART_BATCH',
    mcpAliases: ['mt5_simulate_chart_batch'],
    category: 'market',
    description: 'Simulate a sequential stream of ticks with trend patterns (wave, uptrend, random).',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: 'Symbol ticker' },
        count: { type: 'number', description: 'Number of ticks to simulate' },
        pattern: { type: 'string', enum: ['wave', 'uptrend', 'random'], description: 'Simulation pattern' },
      },
    },
    handler: async (params) => {
      const sym = normalizeSymbol(params.symbol || 'EURUSD');
      const count = Number(params.count) || 40;
      const pattern = params.pattern || 'wave';
      const basePrice = sym === 'XAUUSD' ? 2650.0 : sym === 'BTCUSD' ? 68500.0 : sym.includes('JPY') ? 154.5 : 1.0850;
      const step = sym === 'XAUUSD' ? 0.4 : sym === 'BTCUSD' ? 20.0 : sym.includes('JPY') ? 0.04 : 0.0002;
      const now = Date.now();
      const generated = [];

      for (let i = count; i >= 0; i--) {
        const time = now - i * 1500;
        const wave = pattern === 'wave' ? Math.sin(i / 4) * step * 2.5 : (Math.random() - 0.48) * step;
        const bid = basePrice + wave + (pattern === 'uptrend' ? (count - i) * step * 0.15 : 0);
        const spread = sym.includes('JPY') ? 15 : 12;
        const point = sym.includes('JPY') ? 0.001 : 0.0001;
        const ask = bid + spread * point;

        const tick = {
          symbol: sym,
          bid: Number(bid.toFixed(sym.includes('JPY') ? 3 : 5)),
          ask: Number(ask.toFixed(sym.includes('JPY') ? 3 : 5)),
          spread,
          last: Number(bid.toFixed(sym.includes('JPY') ? 3 : 5)),
          volume: 1,
          time,
        };
        tradeStore.updateTick(tick);
        generated.push(tick);
      }

      const latest = generated[generated.length - 1];
      broadcast({ type: 'tick', payload: latest });

      return {
        success: true,
        symbol: sym,
        count: generated.length,
        latest,
      };
    },
  },
];
