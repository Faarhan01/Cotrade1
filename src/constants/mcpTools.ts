import { MCPToolDefinition } from "@/types";
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
    description: 'Retrieve real-time details of the active chart and symbol from MetaTrader 5 (symbol, timeframe, spread, bid, ask, digits, contract size, min/max lot sizes).',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'mt5_get_all_symbols',
    description: 'Retrieve all symbols available from MetaTrader 5 with real-time market quotes and broker specifications.',
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
      properties: {},
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
    description: 'Trigger an on-demand historical candle pull from MetaTrader 5 for any symbol, timeframe (M1, M5, M15, H1, etc.), and count using the MetaTrader 5 package API.',
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
      required: ['name', 'symbol'],
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
      required: ['strategyId'],
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
      required: ['title', 'content'],
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
      required: ['ticket'],
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
      required: ['symbol', 'volume'],
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
      required: ['symbol', 'volume', 'priceOpen', 'priceClose'],
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
      required: ['symbol', 'volume'],
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
      required: ['symbol'],
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
      required: ['symbol'],
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
          description: 'Trailing step in broker points (e.g. 30 points)',
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
  {
    name: 'mt5_daemon_dispatch',
    description: 'Send high-level autonomous directives to the background MT5 trading daemon. Controls trades, risk rules, and triggers strategy tests or knowledge base operations.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: 'Directive action (e.g. BUY, SELL, CLOSE_POSITION, CLOSE_ALL, MODIFY_POSITION, CREATE_STRATEGY, RECORD_OBSERVATION, RUN_BACKTEST, EMERGENCY_HALT, RESUME)',
        },
        symbol: {
          type: 'string',
          description: 'Symbol ticker (e.g. EURUSD, XAUUSD)',
        },
        volume: {
          type: 'number',
          description: 'Lot volume',
        },
        price: {
          type: 'number',
          description: 'Target price',
        },
        sl: {
          type: 'number',
          description: 'Stop loss price level or points',
        },
        tp: {
          type: 'number',
          description: 'Take profit price level or points',
        },
        ticket: {
          type: 'number',
          description: 'Order or position ticket ID',
        },
        reason: {
          type: 'string',
          description: 'Quantitative rationale behind the AI directive',
        },
        confidence: {
          type: 'number',
          description: 'AI model confidence score between 0.0 and 1.0',
        },
      },
      required: ['action'],
    },
  },
  {
    name: 'mt5_daemon_status',
    description: 'Check active AI daemon operational status, watchdog heartbeat, background tasks, and active watchlist.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'mt5_daemon_heartbeat',
    description: 'Register external AI agent session heartbeat to keep autonomous watchdog active.',
    inputSchema: {
      type: 'object',
      properties: {
        aiName: {
          type: 'string',
          description: 'External AI agent identification (e.g. Claude Quant, Cursor Agent, Custom Copilot)',
        },
        sessionId: {
          type: 'string',
          description: 'Session identifier',
        },
      },
    },
  },
  {
    name: 'mt5_bot_list',
    description: 'List all automated trading bots, their execution status (RUNNING, PAUSED, STOPPED), bound strategy, symbol, win rate, and realized P&L.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'mt5_bot_create',
    description: 'Deploy a new automated algorithmic trading bot bound to a Knowledge Base strategy. Configures symbol, timeframe, lot size, daily loss limit, and execution mode (LIVE or PAPER).',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Bot name' },
        strategyId: { type: 'string', description: 'Strategy ID from Knowledge Base' },
        symbol: { type: 'string', description: 'Symbol to trade (e.g. EURUSD, XAUUSD)' },
        timeframe: { type: 'string', description: 'Timeframe: M1, M5, M15, H1' },
        lotSize: { type: 'number', description: 'Lot size (e.g. 0.05, 0.1)' },
        maxDailyLoss: { type: 'number', description: 'Max daily loss USD before auto-pausing' },
        executionMode: { type: 'string', enum: ['LIVE', 'PAPER', 'DRY_RUN'], description: 'LIVE or PAPER' },
      },
      required: ['name', 'symbol'],
    },
  },
  {
    name: 'mt5_bot_control',
    description: 'Control an automated trading bot instance: start, pause, stop, or delete.',
    inputSchema: {
      type: 'object',
      properties: {
        botId: { type: 'string', description: 'Bot identifier' },
        action: { type: 'string', enum: ['START', 'PAUSE', 'STOP', 'DELETE'], description: 'Action to execute' },
      },
      required: ['botId', 'action'],
    },
  },
  {
    name: 'mt5_bot_evaluate',
    description: 'Trigger immediate algorithmic signal calculation for a bot and retrieve indicator readings.',
    inputSchema: {
      type: 'object',
      properties: {
        botId: { type: 'string', description: 'Bot identifier' },
      },
      required: ['botId'],
    },
  },
  {
    name: 'mt5_bot_close_positions',
    description: 'Close all open positions currently managed by a specific automated trading bot.',
    inputSchema: {
      type: 'object',
      properties: {
        botId: { type: 'string', description: 'Bot identifier' },
        reason: { type: 'string', description: 'Reason for closure' },
      },
      required: ['botId'],
    },
  },
];
