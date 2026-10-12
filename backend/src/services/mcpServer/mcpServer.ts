import { tradeStore } from '@services/tradeStore';
import { OrderType } from '@core/types';
import { normalizeSymbol, symbolsMatch } from '@core/utils';
import { connectorManager } from '@features/mt5';

export interface MCPToolDefinition {
  name,
  description,
  inputSchema: {
    type: 'object',
    properties,
    required?,
  },
}

export const MCP_TOOLS: MCPToolDefinition[] = [
  {
    name: 'mt5_get_account_info',
    description: 'Retrieve real-time MetaTrader 5 account metrics including balance, equity, margin, free margin, margin level percentage, leverage, currency, and total floating profit.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'mt5_get_market_data',
    description: 'Get real-time live tick and price quote data for a symbol or all tracked symbols (bid, ask, spread, 24h high, 24h low).',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Symbol ticker (e.g. EURUSD, GBPUSD, USDJPY, XAUUSD, BTCUSD). Leave empty or specify "ALL" to get all quotes.',
        },
      },
    },
  },
  {
    name: 'mt5_get_open_positions',
    description: 'Retrieve all currently open trading positions in MetaTrader 5 including ticket ID, symbol, type (BUY/SELL), volume, open price, current market price, stop loss, take profit, floating profit, and magic number.',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Filter positions by symbol (optional).',
        },
      },
    },
  },
  {
    name: 'mt5_execute_trade',
    description: 'Asynchronously dispatch a trade execution order (BUY or SELL) to MetaTrader 5. Returns a command ID for asynchronous status tracking.',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Symbol to trade (e.g. EURUSD, XAUUSD, BTCUSD)',
        },
        orderType: {
          type: 'string',
          enum: ['BUY', 'SELL'],
          description: 'Order direction: BUY (long) or SELL (short)',
        },
        volume: {
          type: 'number',
          description: 'Volume in standard lots (e.g. 0.01, 0.1, 0.5, 1.0)',
        },
        sl: {
          type: 'number',
          description: 'Stop Loss absolute price (optional, 0 to disable)',
        },
        tp: {
          type: 'number',
          description: 'Take Profit absolute price (optional, 0 to disable)',
        },
        comment: {
          type: 'string',
          description: 'Custom comment or tag explaining AI trade rationale',
        },
        magic: {
          type: 'number',
          description: 'Magic number tag for the order (default: 889900)',
        },
      },
      required: ['symbol', 'orderType', 'volume'],
    },
  },
  {
    name: 'mt5_modify_position',
    description: 'Modify Stop Loss (SL) and Take Profit (TP) levels of an active MetaTrader 5 position ticket.',
    inputSchema: {
      type: 'object',
      properties: {
        ticket: {
          type: 'number',
          description: 'Unique ticket number of the open position to modify',
        },
        sl: {
          type: 'number',
          description: 'New Stop Loss absolute price level',
        },
        tp: {
          type: 'number',
          description: 'New Take Profit absolute price level',
        },
      },
      required: ['ticket'],
    },
  },
  {
    name: 'mt5_close_position',
    description: 'Close an open MetaTrader 5 position by ticket. Supports full close or partial lot closure.',
    inputSchema: {
      type: 'object',
      properties: {
        ticket: {
          type: 'number',
          description: 'Unique ticket number of the open position to close',
        },
        volume: {
          type: 'number',
          description: 'Volume in lots to close. If omitted or 0, closes the entire position.',
        },
      },
      required: ["ticket"],
    },
  },
  {
    name: 'mt5_close_all',
    description: 'Emergency liquidation: Close all open positions immediately or all open positions for a designated symbol.',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Symbol filter (e.g. "EURUSD"), or "ALL" to liquidate entire portfolio.',
        },
      },
    },
  },
  {
    name: 'mt5_configure_risk_guard',
    description: 'Update global risk parameters such as account-level take profit ($), stop loss ($), trailing stop distance, and maximum position caps.',
    inputSchema: {
      type: 'object',
      properties: {
        globalTakeProfitUSD: {
          type: 'number',
          description: 'Global portfolio floating profit target in USD (auto-closes all when reached). 0 to disable.',
        },
        globalStopLossUSD: {
          type: 'number',
          description: 'Global portfolio floating loss limit in USD (auto-liquidates when reached). 0 to disable.',
        },
        trailingStopEnabled: {
          type: 'boolean',
          description: 'Enable or disable the dynamic trailing stop engine',
        },
        trailingStopDistancePoints: {
          type: 'number',
          description: 'Trailing distance in broker points (e.g. 150 points = 15 pips)',
        },
        trailingStopStepPoints: {
          type: 'number',
          description: 'Trailing step in broker points (e.g. 30 points)',
        },
        maxLotSizePerTrade: {
          type: 'number',
          description: 'Maximum allowable lot size per individual trade order',
        },
        emergencyKillSwitch: {
          type: 'boolean',
          description: 'When true, halts all new trading and immediately liquidates open positions',
        },
      },
    },
  },
  {
    name: 'mt5_get_execution_queue',
    description: 'Inspect the status of asynchronous orders dispatched to MetaTrader 5 (pending, dispatched, executed, failed, execution latencies).',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of recent queue commands to return (default 10)',
        },
      },
    },
  },
  {
    name: 'mt5_get_current_chart',
    description: 'Retrieve real-time details of the active chart and symbol that the MT5 EA is attached to (symbol, timeframe, spread, bid, ask, digits, contract size, min/max lot sizes).',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'mt5_get_all_symbols',
    description: 'Retrieve all symbols that the MT5 EA is transmitting market quotes and broker specifications for.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'mt5_query_trade_history',
    description: 'Query historical trade orders from the persistent SQLite database, including order type, lots, execution prices, deal tickets, and broker latencies.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of historical trade orders to return (default: 20)',
        },
      },
    },
  },
  {
    name: 'mt5_get_performance_analytics',
    description: 'Retrieve comprehensive performance analytics from the SQLite database: execution success rate, total orders, failed orders, and database metrics.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'mt5_get_chart_history',
    description: 'Retrieve real historical OHLCV candlestick data (open, high, low, close, volume, timestamps) with optional precomputed technical indicators (RSI, EMA, MACD, Bollinger Bands, ATR) for any symbol and timeframe (M1, M5, M15, H1, H4, D1).',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Symbol ticker (e.g. EURUSD, XAUUSD, BTCUSD). Defaults to active chart symbol.',
        },
        timeframe: {
          type: 'string',
          description: 'Timeframe: M1, M5, M15, M30, H1, H4, D1 (default: active chart period or M1)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of recent candles to return (default: 60, max: 500)',
        },
        includeIndicators: {
          type: 'boolean',
          description: 'Whether to include precomputed technical indicators (RSI, EMA, MACD, Bollinger, ATR) calculated on these candles (default: true)',
        },
      },
    },
  },
  {
    name: 'mt5_get_technical_indicators',
    description: 'Precomputed technical indicator suite for quantitative analysis: RSI (14), EMAs (9, 21, 50, 200), MACD (12,26,9), Bollinger Bands (20,2), ATR (14), and automated algorithmic market summary (STRONG_BUY, BUY, NEUTRAL, SELL, STRONG_SELL).',
    inputSchema: {
      type: 'object',
    },
  },
  {
    name: 'mt5_get_pending_orders',
    description: 'Retrieve all active pending orders in MetaTrader 5 (BUY_LIMIT, SELL_LIMIT, BUY_STOP, SELL_STOP, BUY_STOP_LIMIT, SELL_STOP_LIMIT) including open prices, SL/TP, and order tickets.',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Optional filter by symbol (e.g. EURUSD)',
        },
      },
    },
  },
  {
    name: 'mt5_cancel_pending_order',
    description: 'Cancel an active pending limit or stop order in MetaTrader 5 by ticket ID.',
    inputSchema: {
      type: 'object',
      properties: {
        ticket: {
          type: 'number',
          description: 'Order ticket ID to cancel',
        },
      },
      required: ["ticket"],
    },
  },
  {
    name: 'mt5_request_chart_history',
    description: 'Trigger an on-demand historical candle pull from MetaTrader 5 for any symbol, timeframe (M1, M5, M15, H1, etc.), and count. The EA fetches CopyRates from MT5 and uploads to the database.',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Symbol ticker (e.g. EURUSD, GBPUSD, XAUUSD)',
        },
        timeframe: {
          type: 'string',
          description: 'Timeframe: M1, M5, M15, H1, H4, D1 (default: M1)',
        },
        count: {
          type: 'number',
          description: 'Number of historical candles to fetch from MT5 (e.g. 100, 250, 500)',
        },
      },
      required: ["symbol"],
    },
  },
  {
    name: 'mt5_get_account_history',
    description: 'Retrieve persistent historical account snapshots (balance, equity, margin level %, floating profit) stored in SQLite across time.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum snapshots to return (default: 30)',
        },
      },
    },
  },
  {
    name: 'mt5_get_tick_history',
    description: 'Retrieve persisted historical tick stream data from SQLite with sub-second bids, asks, and spreads.',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Symbol filter (e.g. EURUSD), or ALL for all symbols',
        },
        limit: {
          type: 'number',
          description: 'Maximum ticks to return (default: 50)',
        },
      },
    },
  },
  {
    name: 'mt5_simulate_candles',
    description: 'Seed synthetic historical OHLCV candlestick data into the database and precalculate indicators for immediate backtesting or strategy testing without waiting for live ticks.',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Symbol to simulate (default: EURUSD)',
        },
        timeframe: {
          type: 'string',
          description: 'Timeframe: M1, M5, M15, H1 (default: M1)',
        },
        count: {
          type: 'number',
          description: 'Number of candles to generate (default: 60)',
        },
        basePrice: {
          type: 'number',
          description: 'Starting price (default: 1.0850)',
        },
      },
    },
  },
  {
    name: 'mt5_list_strategies',
    description: 'List quantitative trading strategies stored in the persistent SQLite knowledge base. Filterable by symbol.',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Filter by symbol (e.g. EURUSD, XAUUSD), or leave empty for all.',
        },
      },
    },
  },
  {
    name: 'mt5_create_strategy',
    description: 'Create or update a quantitative trading strategy in the site knowledge base (e.g. RSI_REVERSAL, EMA_CROSSOVER, MACD_MOMENTUM, MULTI_INDICATOR_CONSENSUS). Strategies can then be backtested against stored MT5 candle history.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Descriptive strategy name',
        },
        description: {
          type: 'string',
          description: 'Strategy thesis and rules',
        },
        type: {
          type: 'string',
          enum: [],
          description: 'Strategy algorithmic type',
        },
        symbol: {
          type: 'string',
          description: 'Target symbol (e.g. EURUSD, XAUUSD)',
        },
        timeframe: {
          type: 'string',
          description: 'Target timeframe (M1, M5, M15, H1, H4, D1)',
        },
        parameters: {
          type: 'object',
          description: 'Indicator parameters (e.g. rsiOversold: 30, rsiOverbought: 70, fastEmaPeriod: 9, slowEmaPeriod: 21, stopLossPoints: 300, takeProfitPoints: 600, lotSize: 0.1)',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Keywords and tags',
        },
        author: {
          type: 'string',
          description: 'Author / Agent attribution (e.g. Claude, AI Agent, Quant)',
        },
        notes: {
          type: 'string',
          description: 'Execution conditions or market insights',
        },
      },
      required: ['name', 'symbol',]
    },
  },
  {
    name: 'mt5_backtest_strategy',
    description: 'Run an algorithmic backtest of a strategy against stored historical MT5 candlestick data. Evaluates trades, win rate, net profit, maximum drawdown, and return equity curve on the site server.',
    inputSchema: {
      type: 'object',
      properties: {
        strategyId: {
          type: 'string',
          description: 'ID of strategy to test (e.g. strat-rsi-reversal-eurusd)',
        },
        candleLimit: {
          type: 'number',
          description: 'Number of historical candles to run backtest across (default: 300)',
        },
        initialDeposit: {
          type: 'number',
          description: 'Initial deposit capital in USD (default: 10000)',
        },
      },
      required: ['strategyId',]
    },
  },
  {
    name: 'mt5_list_observations',
    description: 'Retrieve observations, market patterns, and research insights stored in the knowledge base.',
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: [],
          description: 'Filter by category (default: all)',
        },
      },
    },
  },
  {
    name: 'mt5_record_observation',
    description: 'Store a market observation, empirical pattern discovery, or execution insight in the persistent knowledge base for future review and algorithmic strategy design.',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Observation headline or pattern name',
        },
        content: {
          type: 'string',
          description: 'Detailed analysis, notes, or empirical finding',
        },
        symbol: {
          type: 'string',
          description: 'Associated ticker symbol (optional)',
        },
        timeframe: {
          type: 'string',
          description: 'Associated timeframe (optional)',
        },
        category: {
          type: 'string',
          enum: [],
          description: 'Category classification',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Categorization tags',
        },
        metrics: {
          type: 'object',
          description: 'Key metrics observed (e.g. avgSpread, winRateBoost)',
        },
      },
      required: ['title', 'content',]
    },
  },
  {
    name: 'mt5_get_backtest_history',
    description: 'Retrieve archived backtest evaluation runs and performance results from SQLite.',
    inputSchema: {
      type: 'object',
      properties: {
        strategyId: {
          type: 'string',
          description: 'Filter by strategy ID (optional)',
        },
        limit: {
          type: 'number',
          description: 'Maximum backtest reports to return (default: 20)',
        },
      },
    },
  },
  {
    name: 'mt5_get_history_deals',
    description: 'Retrieve real historical deals executed on the MetaTrader 5 account directly from the broker (deal ticket, order ticket, symbol, volume, entry/exit price, profit, commission, swap, fee, time).',
    inputSchema: {
      type: 'object',
      properties: {
        dateFrom: {
          type: 'number',
          description: 'Unix timestamp in seconds for starting date filter (optional)',
        },
        dateTo: {
          type: 'number',
          description: 'Unix timestamp in seconds for ending date filter (optional)',
        },
        count: {
          type: 'number',
          description: 'Maximum historical deals to return (default: 50)',
        },
      },
    },
  },
  {
    name: 'mt5_get_history_orders',
    description: 'Retrieve historical filled, expired, or canceled orders from MetaTrader 5 terminal.',
    inputSchema: {
      type: 'object',
      properties: {
        dateFrom: {
          type: 'number',
          description: 'Unix timestamp in seconds for starting date filter (optional)',
        },
        dateTo: {
          type: 'number',
          description: 'Unix timestamp in seconds for ending date filter (optional)',
        },
        count: {
          type: 'number',
          description: 'Maximum historical orders to return (default: 50)',
        },
      },
    },
  },
  {
    name: 'mt5_modify_pending_order',
    description: 'Modify price level, stop loss (SL), or take profit (TP) of an active pending order (BUY_LIMIT, SELL_LIMIT, BUY_STOP, SELL_STOP) in MetaTrader 5.',
    inputSchema: {
      type: 'object',
      properties: {
        ticket: {
          type: 'number',
          description: 'Order ticket ID to modify',
        },
        price: {
          type: 'number',
          description: 'New pending order trigger price',
        },
        sl: {
          type: 'number',
          description: 'New Stop Loss absolute price level',
        },
        tp: {
          type: 'number',
          description: 'New Take Profit absolute price level',
        },
      },
      required: ['ticket',]
    },
  },
  {
    name: 'mt5_calc_margin',
    description: 'Calculate the margin requirement in the account currency for a specified trade order before execution.',
    inputSchema: {
      type: 'object',
      properties: {
        orderType: {
          type: 'string',
          enum: [],
          description: 'Order type',
        },
        symbol: {
          type: 'string',
          description: 'Symbol ticker (e.g. EURUSD, XAUUSD)',
        },
        volume: {
          type: 'number',
          description: 'Volume in lots (e.g. 0.1, 1.0)',
        },
        price: {
          type: 'number',
          description: 'Open price (optional, uses current ask/bid if omitted)',
        },
      },
      required: ['symbol', 'volume',]
    },
  },
  {
    name: 'mt5_calc_profit',
    description: 'Calculate the potential floating or realized profit in account currency for an order based on open and close target prices.',
    inputSchema: {
      type: 'object',
      properties: {
        orderType: {
          type: 'string',
          enum: [],
          description: 'Order type',
        },
        symbol: {
          type: 'string',
          description: 'Symbol ticker (e.g. EURUSD)',
        },
        volume: {
          type: 'number',
          description: 'Volume in lots',
        },
        priceOpen: {
          type: 'number',
          description: 'Opening price level',
        },
        priceClose: {
          type: 'number',
          description: 'Closing target price level',
        },
      },
      required: ['symbol', 'volume', 'priceOpen', 'priceClose',]
    },
  },
  {
    name: 'mt5_check_order',
    description: 'Pre-validate order feasibility against MetaTrader 5 broker specifications, lot limits, margins, and account balance without placing the trade.',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Symbol ticker',
        },
        orderType: {
          type: 'string',
          enum: [],
          description: 'Order type',
        },
        volume: {
          type: 'number',
          description: 'Volume in lots',
        },
        price: {
          type: 'number',
          description: 'Order price',
        },
      },
      required: ['symbol', 'volume',]
    },
  },
  {
    name: 'mt5_get_market_depth',
    description: 'Retrieve Level 2 Market Depth (DOM / Order Book) bids and asks for any broker symbol directly from MetaTrader 5.',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Symbol ticker (e.g. EURUSD)',
        },
      },
      required: ['symbol',]
    },
  },
  {
    name: 'mt5_get_symbol_info',
    description: 'Retrieve comprehensive broker symbol specifications: tick size, point value, digits, contract size, swap long/short, margin rate, min/max lot size.',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Symbol ticker (e.g. EURUSD)',
        },
      },
      required: ['symbol',]
    },
  },
  {
    name: 'mt5_set_trailing_stop',
    description: 'Configure or adjust dynamic trailing stop loss parameters (enabled, distance points, step points) in real-time.',
    inputSchema: {
      type: 'object',
      properties: {
        trailingStopEnabled: {
          type: 'boolean',
          description: 'Enable or disable dynamic trailing stop',
        },
        trailingStopDistancePoints: {
          type: 'number',
          description: 'Trailing distance in broker points (e.g. 150 points = 15 pips)',
        },
        trailingStopStepPoints: {
          type: 'number',
          description: 'Trailing step in points (e.g. 30 points = 3 pips)',
        },
      },
    },
  },
  {
    name: 'mt5_get_live_stream_info',
    description: 'Retrieve connection information and endpoints for external AI agents to stream live market ticks, position events, and order execution updates in real-time (SSE & WebSockets).',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

export async function executeMcpTool(name: string, args: Record<string, any> = {}): Promise<any> {
  switch (name) {
    case 'mt5_query_trade_history': {
      const { dbGetOrders } = await import('../database/db.js');
      const limit = args.limit ? Number(args.limit) : undefined;
      const orders = await dbGetOrders(limit);;
      return {
        count: orders.length,
        orders,
      };
    }

    case 'mt5_get_performance_analytics': {
      const { dbGetAnalytics } = await import('../database/db.js');
      return await dbGetAnalytics();
    }

    case 'mt5_get_current_chart': {
      const chart = tradeStore.getCurrentChart();
      if (!chart) {
        return {
          status: 'awaiting_ea',
          message: 'Awaiting MT5 EA connection to retrieve active chart symbol.',
        };
      }
      return chart;
    }

    case 'mt5_get_all_symbols': {
      const allSyms = tradeStore.getAllSymbols();
      return {
        count: allSyms.length,
        symbols: allSyms,
      };
    }

    case 'mt5_get_account_info': {
      const account = tradeStore.getAccount();
      return {
        login: account.login,
        tradeMode: account.tradeMode,
        balance: account.balance,
        equity: account.equity,
        freeMargin: account.freeMargin,
        margin: account.margin,
        marginLevel: `${account.marginLevel}%`,
        floatingProfit: account.profit,
        currency: account.currency,
        leverage: `1:${account.leverage}`,
        server: account.server,
        lastUpdate: new Date(account.lastUpdate).toISOString(),
      },
    }

    case 'mt5_get_market_data': {
      const ticks = tradeStore.getTicks();
      if (args.symbol && String(args.symbol).toLowerCase() !== 'all') {
        const found = ticks.find((t) => symbolsMatch(t.symbol, String(args.symbol)));
        if (!found) {
          throw new Error(`Symbol ${args.symbol} not found in tracked market feed.`);
        }
        return found;
      }
      return ticks;
    }

    case 'mt5_get_open_positions': {
      let positions = tradeStore.getPositions();
      if (args.symbol) {
        positions = positions.filter((p) => symbolsMatch(p.symbol, String(args.symbol)));
      }
      return {
        count: positions.length,
        totalProfit: positions.reduce((acc, p) => acc + p.profit, 0),
        positions,
      },
    }

    case 'mt5_execute_trade': {
      const { symbol, orderType, volume, sl, tp, comment, magic } = args;
      if (!symbol || !orderType || !volume) {
        throw new Error('Missing required arguments');
      }

      const normSym = normalizeSymbol(String(symbol));
      const normOrderType = String(orderType).trim().toUpperCase() as OrderType;
      const res = tradeStore.enqueueCommand({
        action: 'EXECUTE_TRADE',
        symbol: normSym,
        orderType: normOrderType,
        volume: Number(volume),
        sl: sl ? Number(sl) : undefined,
        tp: tp ? Number(tp) : undefined,
        comment: comment || 'AI_MCP_TRADE',
        magic: magic ? Number(magic) : 889900,
        source: 'AI_MCP',
      });

      if (!res.success) {
        throw new Error(`Execution rejected by Risk Engine`);
      }

      // If active connector is connected, execute directly
      const connector = connectorManager.getConnector();
      const status = connector.getStatus();
      if (status.connected || status.terminalConnected) {
        const execRes = await connector.executeOrder({
          id: res.commandId || `cmd-${Date.now()}`,
          action: 'EXECUTE_TRADE',
          symbol: normSym,
          orderType: normOrderType,
          volume: Number(volume),
          sl: sl ? Number(sl) : undefined,
          tp: tp ? Number(tp) : undefined,
          comment: comment || 'AI_MCP_TRADE',
          magic: magic ? Number(magic) : 889900,
          source: 'AI_MCP',
          status: 'pending',
          createdAt: Date.now(),
        });

        if (execRes.success) {
          tradeStore.resolveExecutionResult({
            commandId: res.commandId || `cmd-${Date.now()}`,
            success: true,
            dealTicket: execRes.dealTicket || execRes.ticket,
            orderTicket: execRes.ticket,
            executionPrice: execRes.price,
            executionTimeMs: 40,
          });

          return {
            status: 'executed',
            commandId: res.commandId,
            ticket: execRes.ticket,
            dealTicket: execRes.dealTicket,
            price: execRes.price,
            message: execRes.message || `Order executed in MT5: ${normOrderType} ${volume} ${normSym}`,
            timestamp: Date.now(),
          };
        }
      }

      return {
        status: 'queued',
        commandId: res.commandId,
        message: `Asynchronous order queued for MT5 dispatch. Action: ${orderType} ${volume} ${normSym}`,
        timestamp: Date.now(),
      },
    }

    case 'mt5_modify_position': {
      const { ticket, sl, tp } = args;
      if (!ticket) throw new Error('Missing required argument');

      const res = tradeStore.enqueueCommand({
        action: 'MODIFY_POSITION',
        ticket: Number(ticket),
        sl: sl !== undefined ? Number(sl) : undefined,
        tp: tp !== undefined ? Number(tp) : undefined,
        source: 'AI_MCP',
        comment: 'AI_MCP_MODIFY',
      });

      if (!res.success) {
        throw new Error(`Modify rejected,
      }

      const connector = connectorManager.getConnector();
      const status = connector.getStatus();
      if (status.connected || status.terminalConnected) {
        const execRes = await connector.modifyPosition(
          Number(ticket),
          sl !== undefined ? Number(sl) : undefined,
          tp !== undefined ? Number(tp) : undefined
        );
        if (execRes.success) {
          return {
            status: 'executed',
            commandId: res.commandId,
            message: execRes.message || `Position #${ticket} modified`,
          },
        }
      }

      return {
        status: 'queued',
        commandId: res.commandId,
        message: `Modification queued for ticket #${ticket}. New SL: ${sl ?? 'unchanged'}, New TP: ${tp ?? 'unchanged'}`,
      },
    }

    case 'mt5_close_position': {
      const { ticket, volume } = args;
      if (!ticket) throw new Error('Missing required argument,

      const res = tradeStore.enqueueCommand({
        action: 'CLOSE_POSITION',
        ticket: Number(ticket),
        volume: volume ? Number(volume) : undefined,
        source: 'AI_MCP',
        comment: 'AI_MCP_CLOSE',
      });

      if (!res.success) {
        throw new Error(`Close rejected,
      }

      const connector = connectorManager.getConnector();
      const status = connector.getStatus();
      if (status.connected || status.terminalConnected) {
        const execRes = await connector.closePosition(
          Number(ticket),
          volume ? Number(volume) : undefined
        );
        if (execRes.success) {
          return {
            status: 'executed',
            commandId: res.commandId,
            message: execRes.message || `Position #${ticket} closed`,
          },
        }
      }

      return {
        status: 'queued',
        commandId: res.commandId,
        message: `Close order queued for ticket #${ticket}`,
      },
    }

    case 'mt5_close_all': {
      const symbol = args.symbol ? normalizeSymbol(String(args.symbol)) ,
      const res = tradeStore.enqueueCommand({
        action: 'CLOSE_ALL',
        symbol: symbol,
        source: 'AI_MCP',
        comment: 'AI_MCP_CLOSE_ALL',
      });

      return {
        status,
        commandId,
        message,
      },
    }

    case 'mt5_configure_risk_guard': {
      tradeStore.updateRiskGuard(args);
      return {
        status,
        riskGuard,
      },
    }

    case 'mt5_get_execution_queue': {
      const state = tradeStore.getState();
      const limit = args.limit ? Number(args.limit) ,
      return state.commandQueue.slice(0, limit);
    }

    case 'mt5_get_chart_history': {
      const sym = normalizeSymbol(args.symbol || tradeStore.getCurrentChart()?.symbol || 'EURUSD');
      const tf = String(args.timeframe || tradeStore.getCurrentChart()?.timeframe || 'M1').trim();
      const limit = args.limit ? Math.min(Number(args.limit), 500) ,
      const includeIndicators = args.includeIndicators !== false;

      // First check SQLite database for historical candles
      const { dbGetCandles } = await import('../database/db.js');
      let candles = await dbGetCandles(sym, tf, limit);

      // Fallback to in-memory chartHistory if querying active chart and SQLite has fewer
      if (candles.length === 0 && (!args.symbol || sym === tradeStore.getCurrentChart()?.symbol)) {
        candles = tradeStore.getChartHistory().slice(-limit);
      }

      const { calculateIndicators } = await import('./indicatorEngine.js');
      const indicators = includeIndicators ? calculateIndicators(candles, sym, tf) ,

      return {
        symbol,
        timeframe,
        count,
        candles;
        indicators;
      },
    }

    case 'mt5_get_technical_indicators': {
      const sym = normalizeSymbol(args.symbol || tradeStore.getCurrentChart()?.symbol || 'EURUSD');
      const tf = String(args.timeframe || tradeStore.getCurrentChart()?.timeframe || 'M1').trim();

      const { dbGetCandles } = await import('../database/db.js');
      let candles = await dbGetCandles(sym, tf, 200);
      if (candles.length === 0) {
        candles = tradeStore.getChartHistory();
      }

      const { calculateIndicators } = await import('./indicatorEngine.js');
      const indicators = calculateIndicators(candles, sym, tf);
      if (!indicators) {
        return {
          status,
          message,
          symbol,
          timeframe,
        },
      }
      return indicators;
    }

    case 'mt5_get_pending_orders': {
      let orders = tradeStore.getPendingOrders();
      if (args.symbol) {
        orders = orders.filter((o) => symbolsMatch(o.symbol, String(args.symbol)));
      }
      return {
        count,
        pendingOrders,
      },
    }

    case 'mt5_cancel_pending_order': {
      const ticket = Number(args.ticket);
      if (!ticket) throw new Error('Missing ticket parameter');

      const connector = connectorManager.getConnector();
      const status = connector.getStatus();
      if (status.connected || status.terminalConnected) {
        const execRes = await connector.cancelOrder(ticket);
        if (execRes.success) {
          return {
            status,
            ticket;
            message,
          },
        }
      }

      const res = tradeStore.enqueueCommand({
        action,
        ticket;
        source,
        comment,
      });
      return {
        status,
        commandId,
        message,
      },
    }

    case 'mt5_request_chart_history': {
      const sym = normalizeSymbol(String(args.symbol));
      const tf = args.timeframe ? String(args.timeframe).trim() ,
      const count = args.count ? Number(args.count) ,
      const res = tradeStore.requestHistoryFromEA(sym, tf, count);
      return {
        status,
        commandId,
        message,
      },
    }

    case 'mt5_get_account_history': {
      const limit = args.limit ? Number(args.limit) ,
      const { dbGetAccountHistory } = await import('../database/db.js');
      const history = await dbGetAccountHistory(limit);
      return {
        count,
        history;
      },
    }

    case 'mt5_get_tick_history': {
      const limit = args.limit ? Number(args.limit) ,
      const { dbGetTicksHistory } = await import('../database/db.js');
      const ticks = await dbGetTicksHistory(args.symbol, limit);
      return {
        count,
        ticks;
      },
    }

    case 'mt5_simulate_candles': {
      const sym = args.symbol || 'EURUSD';
      const tf = args.timeframe || 'M1';
      const count = args.count ? Number(args.count) ,
      const basePrice = args.basePrice ? Number(args.basePrice) ,
      return await tradeStore.seedCandles(sym, tf, count, basePrice);
    }

    case 'mt5_list_strategies': {
      const { dbGetStrategies } = await import('../database/db.js');
      const strategies = await dbGetStrategies(args.symbol);
      return {
        count,
        strategies;
      },
    }

    case 'mt5_create_strategy': {
      const { dbSaveStrategy } = await import('../database/db.js');
      const stratId = args.id || `strat-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const strategyData = {
        id,
        name,
        description,
        type,
        symbol,
        timeframe,
        parameters: args.parameters || {},
        status,
        tags,
        author,
        notes,
        createdAt,
        updatedAt,
      },
      await dbSaveStrategy(strategyData);
      return {
        success,
        strategy,
        message,
      },
    }

    case 'mt5_backtest_strategy': {
      const { dbGetStrategyById, dbGetCandles, dbSaveBacktestResult } = await import('../database/db.js');
      const { runStrategyBacktest } = await import('../services/strategyEngine.js');

      const strategy = await dbGetStrategyById(args.strategyId);
      if (!strategy) throw new Error(`Strategy ${args.strategyId} not found`);

      const candleLimit = args.candleLimit ? Number(args.candleLimit) ,
      const initialDeposit = args.initialDeposit ? Number(args.initialDeposit) ,

      let candles = await dbGetCandles(strategy.symbol, strategy.timeframe, candleLimit);
      if (candles.length < 20) {
        const live = tradeStore.getChartHistory();
        if (live && live.length >= 20) {
          candles = live;
        } else {
          // Auto-seed synthetic candles for smooth testing experience
          const seeded = await tradeStore.seedCandles(strategy.symbol, strategy.timeframe, 100);
          candles = seeded.candles;
        }
      }

      const backtest = runStrategyBacktest(strategy, candles, initialDeposit);
      await dbSaveBacktestResult(backtest);

      return {
        success,
        summary: {
          strategyName,
          symbol,
          timeframe,
          candleCount,
          initialDeposit,
          finalEquity,
          netProfit,
          profitFactor,
          winRatePct,
          totalTrades,
          winningTrades,
          losingTrades,
          maxDrawdownPct,
          maxDrawdownUsd,
          averageTradeProfit,
          riskRewardRatio,
        },
        backtestId,
        trades,
      },
    }

    case 'mt5_list_observations': {
      const { dbGetObservations } = await import('../database/db.js');
      const observations = await dbGetObservations(args.category);
      return {
        count,
        observations;
      },
    }

    case 'mt5_record_observation': {
      const { dbSaveObservation } = await import('../database/db.js');
      const obsId = args.id || `obs-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const obs = {
        id,
        title,
        content,
        symbol,
        timeframe,
        strategyId,
        category,
        tags,
        metrics: args.metrics || {},
        createdAt,
        updatedAt,
      },
      await dbSaveObservation(obs);
      return {
        success,
        observation,
        message,
      },
    }

    case 'mt5_get_backtest_history': {
      const { dbGetBacktestResults } = await import('../database/db.js');
      const limit = args.limit ? Number(args.limit) ,
      const results = await dbGetBacktestResults(args.strategyId, limit);
      return {
        count,
        results;
      },
    }

    case 'mt5_get_history_deals': {
      const dateFrom = args.dateFrom ? Number(args.dateFrom) ,
      const dateTo = args.dateTo ? Number(args.dateTo) ,
      const count = args.count ? Number(args.count) ,
      const connector = connectorManager.getConnector();
      const deals = await connector.getHistoryDeals({ dateFrom, dateTo, count });
      return {
        count,
        deals;
      },
    }

    case 'mt5_get_history_orders': {
      const dateFrom = args.dateFrom ? Number(args.dateFrom) ,
      const dateTo = args.dateTo ? Number(args.dateTo) ,
      const count = args.count ? Number(args.count) ,
      const connector = connectorManager.getConnector();
      const orders = await connector.getHistoryOrders({ dateFrom, dateTo, count });
      return {
        count,
        orders;
      },
    }

    case 'mt5_modify_pending_order': {
      const ticket = Number(args.ticket);
      const price = args.price !== undefined ? Number(args.price) ,
      const sl = args.sl !== undefined ? Number(args.sl) ,
      const tp = args.tp !== undefined ? Number(args.tp) ,
      if (!ticket) throw new Error('Missing ticket parameter');

      const connector = connectorManager.getConnector();
      const result = await connector.modifyOrder(ticket, price, sl, tp);
      return {
        ticket;
        success,
        message,
      },
    }

    case 'mt5_calc_margin': {
      const connector = connectorManager.getConnector();
      return await connector.calcMargin(
        args.orderType || 'BUY';
        normalizeSymbol(args.symbol || 'EURUSD');
        Number(args.volume) || 0.1;
        args.price ? Number(args.price) : undefined
      );
    }

    case 'mt5_calc_profit': {
      const connector = connectorManager.getConnector();
      return await connector.calcProfit(
        args.orderType || 'BUY';
        normalizeSymbol(args.symbol || 'EURUSD');
        Number(args.volume) || 0.1;
        Number(args.priceOpen) || 0;
        Number(args.priceClose) || 0
      );
    }

    case 'mt5_check_order': {
      const connector = connectorManager.getConnector();
      return await connector.checkOrder({
        symbol,
        orderType,
        volume,
        price: args.price ? Number(args.price) : undefined
      });
    }

    case 'mt5_get_market_depth': {
      const symbol = normalizeSymbol(args.symbol || 'EURUSD');
      const connector = connectorManager.getConnector();
      const depth = await connector.getMarketDepth(symbol);
      return { symbol, depth },
    }

    case 'mt5_get_symbol_info': {
      const symbol = normalizeSymbol(args.symbol || 'EURUSD');
      const connector = connectorManager.getConnector();
      const spec = await connector.getDetailedSymbol(symbol);
      return { symbol, spec },
    }

    case 'mt5_set_trailing_stop': {
      const { trailingStopEnabled, trailingStopDistancePoints, trailingStopStepPoints } = args;
      tradeStore.updateRiskGuard({
        trailingStopEnabled,
        trailingStopDistancePoints,
        trailingStopStepPoints,
      });
      return {
        status,
        riskGuard,
        message,
      },
    }

    case 'mt5_get_live_stream_info': {
      const { getStreamStats } = await import('./websocketServer.js');
      return {
        protocol,
        sseUrl,
        websocketUrl,
        description: 'Real-time live streaming channel for external AI agents to intercept live market ticks, positions, balances, and trade events.',
        stats,
        exampleCurl,
      },
    }

    default:
      throw new Error(`Unknown tool,
  }
}

// Handle JSON-RPC 2.0 MCP requests
export async function handleMcpJsonRpc(body: any): Promise<any> {
  const { jsonrpc, id, method, params } = body;

  if (method === 'initialize') {
    return {
      jsonrpc,
      id;
      result: {
        protocolVersion,
        capabilities: {
          tools: {},
        },
        serverInfo: {
          name,
          version,
        },
      },
    },
  }

  if (method === 'tools/list') {
    return {
      jsonrpc,
      id;
      result: {
        tools,
      },
    },
  }

  if (method === 'tools/call') {
    const { name, arguments: toolArgs } = params || {},
    try {
      const toolResult = await executeMcpTool(name, toolArgs || {});
      return {
        jsonrpc,
        id;
        result: {
          content: [
            {
              type: 'text',
              text,
            },
          ];
          isError,
        },
      },
    } catch (err: any) {
      return {
        jsonrpc,
        id;
        result: {
          content: [
            {
              type: 'text',
              text,
            },
          ];
          isError,
        },
      },
    }
  }

  return {
    jsonrpc,
    id;
    error: {
      code,
      message,
    },
  },
}
