import { CommandDefinition } from './types.ts';
import {
  dbGetStrategies,
  dbSaveStrategy,
  dbDeleteStrategy,
  dbGetObservations,
  dbSaveObservation,
  dbDeleteObservation,
  dbDeleteJournalEntry,
  dbSaveBacktestResult,
  dbGetBacktestResults,
  dbGetCandles,
  dbGetSyntheticCandles,
  dbGetAnalytics,
  pruneDatabase,
} from '@features/database';
import { runStrategyBacktest } from '@/services/strategyEngine';
import { connectorManager } from '@features/mt5';
import { normalizeSymbol } from '@core/utils';
import { tradeStore } from '@services/tradeStore';
import { botStore } from '@features/bot';

export const knowledgeCommands: CommandDefinition[] = [
  {
    name: 'GET_STRATEGIES',
    aliases: ['LIST_STRATEGIES'],
    mcpAliases: ['mt5_list_strategies'],
    category: 'knowledge',
    description: 'Retrieve quantitative trading strategies stored in the persistent knowledge base.',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: 'Filter by symbol (optional)' },
      },
    },
    handler: async (params) => {
      const sym = params.symbol ? normalizeSymbol(params.symbol) : undefined;
      const strategies = await dbGetStrategies(sym);
      return { success: true, count: strategies.length, strategies };
    },
  },
  {
    name: 'SAVE_STRATEGY',
    aliases: ['CREATE_STRATEGY'],
    mcpAliases: ['mt5_create_strategy'],
    category: 'knowledge',
    description: 'Create or update an algorithmic strategy definition in the knowledge base.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Strategy display name' },
        description: { type: 'string', description: 'Rules and thesis' },
        type: { type: 'string', description: 'Strategy type (e.g. MULTI_INDICATOR_CONSENSUS, RSI_REVERSAL)' },
        symbol: { type: 'string', description: 'Target symbol (e.g. EURUSD)' },
        timeframe: { type: 'string', description: 'Timeframe (default M1)' },
        parameters: { type: 'object', description: 'Parameters (periods, lot size, stops)' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Tags' },
        author: { type: 'string', description: 'Author' },
        notes: { type: 'string', description: 'Notes' },
      },
      required: ['name'],
    },
    handler: async (params, context) => {
      const stratData = params.strategy || params;
      if (!stratData.name) return { success: false, message: 'Strategy name is required' };

      const newStrat = {
        id: stratData.id || `strat-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name: stratData.name,
        description: stratData.description || `${context.source} Algorithmic Strategy`,
        type: stratData.type || 'MULTI_INDICATOR_CONSENSUS',
        symbol: normalizeSymbol(stratData.symbol || 'EURUSD'),
        timeframe: (stratData.timeframe || 'M1').toUpperCase(),
        parameters: stratData.parameters || {
          rsiOversold: 30,
          rsiOverbought: 70,
          fastEmaPeriod: 9,
          slowEmaPeriod: 21,
          stopLossPoints: 300,
          takeProfitPoints: 600,
          lotSize: 0.1,
        },
        status: stratData.status || 'active',
        tags: stratData.tags || [context.source, 'Autonomous'],
        author: stratData.author || context.aiName || 'Quant Engine',
        notes: stratData.notes || params.reason || '',
      };

      await dbSaveStrategy(newStrat as any);
      context.notify?.('STRATEGY_SAVED', { strategy: newStrat });
      tradeStore.addLog(
        'info',
        `Strategy Saved: ${newStrat.name}`,
        `Symbol: ${newStrat.symbol} [${newStrat.timeframe}] by ${newStrat.author}`,
        'KNOWLEDGE_BASE'
      );
      return { success: true, strategy: newStrat };
    },
  },
  {
    name: 'DELETE_STRATEGY',
    category: 'knowledge',
    description: 'Delete a strategy by ID from the persistent knowledge base.',
    inputSchema: {
      type: 'object',
      properties: {
        strategyId: { type: 'string', description: 'Strategy ID to delete' },
      },
      required: ['strategyId'],
    },
    handler: async (params, context) => {
      const stratId = params.strategyId || params.id;
      if (!stratId) return { success: false, message: 'Strategy ID is required' };
      await dbDeleteStrategy(stratId);
      context.notify?.('STRATEGY_DELETED', { strategyId: stratId });
      return { success: true, message: `Strategy ${stratId} deleted` };
    },
  },
  {
    name: 'SEARCH_STRATEGIES',
    category: 'knowledge',
    description: 'Full-text query across stored strategies by name, tags, or description.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search keywords' },
      },
    },
    handler: async (params) => {
      const { dbSearchStrategies } = await import('@core/database/db.ts');
      const query = params.query || params.search || '';
      const results = await dbSearchStrategies(query);
      return { success: true, count: results.length, strategies: results };
    },
  },
  {
    name: 'RUN_BACKTEST',
    mcpAliases: ['mt5_backtest_strategy'],
    category: 'knowledge',
    description: 'Run an algorithmic backtest of a strategy against MT5 candlestick history.',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: 'Symbol to backtest (e.g. EURUSD)' },
        timeframe: { type: 'string', description: 'Timeframe (default M1)' },
        candleCount: { type: 'number', description: 'Number of candles (default 300)' },
        initialDeposit: { type: 'number', description: 'Starting capital (default 10000)' },
        strategyId: { type: 'string', description: 'Optional strategy ID to run' },
        parameters: { type: 'object', description: 'Optional parameter overrides' },
        includeSynthetic: { type: 'boolean', description: 'Use explicitly seeded synthetic candles instead of broker history' },
      },
      required: ['symbol'],
    },
    handler: async (params, context) => {
      const { dbGetStrategyById } = await import('@core/database/db.ts');
      const savedStrategy = params.strategyId ? await dbGetStrategyById(params.strategyId) : null;
      if (params.strategyId && !savedStrategy) {
        return { success: false, message: `Strategy ${params.strategyId} was not found.` };
      }
      const sym = normalizeSymbol(params.symbol || savedStrategy?.symbol || 'EURUSD');
      const tf = String(params.timeframe || savedStrategy?.timeframe || 'M1').toUpperCase();
      const candleCount = Number(params.candleCount) || 300;
      const initialDeposit = Number(params.initialDeposit) || 10000;
      const connector = connectorManager.getConnector();

      let dataSource = params.includeSynthetic ? 'synthetic_test_data' : 'database_cache';
      let candles = params.includeSynthetic
        ? await dbGetSyntheticCandles(sym, tf, candleCount)
        : await dbGetCandles(sym, tf, candleCount);
      if (candles.length < 20 && !params.includeSynthetic) {
        const fetched = await connector.getCandles(sym, tf, candleCount);
        if (fetched && fetched.length >= 20) {
          candles = fetched;
          dataSource = 'mt5_live';
        } else {
          return {
            success: false,
            message: `Insufficient historical candles for ${sym} [${tf}]. Need at least 20, got ${candles.length}.`,
          };
        }
      }

      const stratObj = params.strategy || (savedStrategy ? {
        ...savedStrategy,
        symbol: sym,
        timeframe: tf,
        parameters: { ...(savedStrategy.parameters || {}), ...(params.parameters || {}) },
      } : {
        id: params.strategyId || 'adhoc-strat',
        name: params.strategyName || 'Quantitative Evaluation',
        type: params.strategyType || 'MULTI_INDICATOR_CONSENSUS',
        symbol: sym,
        timeframe: tf,
        parameters: params.parameters || {},
      });

      const [symbolInfo, accountInfo] = await Promise.all([
        connector.getDetailedSymbol(sym),
        connector.getAccountInfo(),
      ]);
      const valuation = symbolInfo && accountInfo ? {
        point: symbolInfo.point,
        tickSize: symbolInfo.tickSize,
        tickValueProfit: symbolInfo.tickValueProfit ?? symbolInfo.tickValue,
        tickValueLoss: symbolInfo.tickValueLoss ?? symbolInfo.tickValue,
        currency: accountInfo.currency,
      } : undefined;
      const result = runStrategyBacktest(stratObj, candles, initialDeposit, 0.0001, valuation);
      result.dataSource = dataSource;
      await dbSaveBacktestResult(result);

      context.notify?.('BACKTEST_COMPLETED', { result });
      tradeStore.addLog(
        'info',
        `Backtest Finished: ${result.strategyName}`,
        `Win Rate: ${result.winRatePct}% | Net Profit (${result.profitCurrency}): ${result.netProfit} | Trades: ${result.totalTrades}`,
        'BACKTEST_ENGINE'
      );
      return { success: true, result };
    },
  },
  {
    name: 'GET_BACKTEST_RESULTS',
    mcpAliases: ['mt5_get_backtest_history'],
    category: 'knowledge',
    description: 'Retrieve stored backtest run results and equity curve metrics from SQLite.',
    inputSchema: {
      type: 'object',
      properties: {
        strategyId: { type: 'string', description: 'Filter by strategy ID' },
        limit: { type: 'number', description: 'Limit records (default 20)' },
      },
    },
    handler: async (params) => {
      const results = await dbGetBacktestResults(params.strategyId, params.limit || 20);
      return { success: true, count: results.length, results };
    },
  },
  {
    name: 'GET_OBSERVATIONS',
    aliases: ['LIST_OBSERVATIONS'],
    mcpAliases: ['mt5_list_observations'],
    category: 'knowledge',
    description: 'Retrieve qualitative trading observations and notes from the knowledge base.',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Optional category filter' },
      },
    },
    handler: async (params) => {
      const obs = await dbGetObservations(params.category);
      return { success: true, count: obs.length, observations: obs };
    },
  },
  {
    name: 'SAVE_OBSERVATION',
    aliases: ['RECORD_OBSERVATION'],
    mcpAliases: ['mt5_record_observation'],
    category: 'knowledge',
    description: 'Record a market observation, session notes, or trade pattern insight.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Observation headline' },
        content: { type: 'string', description: 'Detailed observations text' },
        symbol: { type: 'string', description: 'Target symbol (optional)' },
        category: { type: 'string', description: 'Category (market_insight, setup, failure)' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Tags' },
      },
      required: ['title', 'content'],
    },
    handler: async (params, context) => {
      const obsData = params.observation || params;
      if (!obsData.title || !obsData.content) {
        return { success: false, message: 'Observation title and content are required' };
      }

      const newObs = {
        id: obsData.id || `obs-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        title: obsData.title,
        content: obsData.content,
        symbol: obsData.symbol ? normalizeSymbol(obsData.symbol) : undefined,
        timeframe: obsData.timeframe ? obsData.timeframe.toUpperCase() : undefined,
        strategyId: obsData.strategyId,
        category: obsData.category || 'market_insight',
        tags: obsData.tags || [context.source],
        metrics: obsData.metrics,
      };

      await dbSaveObservation(newObs as any);
      context.notify?.('OBSERVATION_SAVED', { observation: newObs });
      return { success: true, observation: newObs };
    },
  },
  {
    name: 'DELETE_OBSERVATION',
    category: 'knowledge',
    description: 'Delete an observation by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        observationId: { type: 'string', description: 'Observation ID to delete' },
      },
      required: ['observationId'],
    },
    handler: async (params, context) => {
      const obsId = params.observationId || params.id;
      if (!obsId) return { success: false, message: 'Observation ID is required' };
      await dbDeleteObservation(obsId);
      context.notify?.('OBSERVATION_DELETED', { observationId: obsId });
      return { success: true, message: `Observation ${obsId} deleted` };
    },
  },
  {
    name: 'SEARCH_OBSERVATIONS',
    category: 'knowledge',
    description: 'Full-text search across stored observations and market notes.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Keywords to search' },
      },
    },
    handler: async (params) => {
      const { dbSearchObservations } = await import('@core/database/db.ts');
      const query = params.query || params.search || '';
      const results = await dbSearchObservations(query);
      return { success: true, count: results.length, observations: results };
    },
  },
  {
    name: 'GET_KNOWLEDGE_SUMMARY',
    category: 'knowledge',
    description: 'Retrieve high-level overview of strategies, observations, backtests, and active bots.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: async () => {
      const [strats, obs, bts] = await Promise.all([
        dbGetStrategies(),
        dbGetObservations(),
        dbGetBacktestResults(undefined, 50),
      ]);
      const bots = botStore.getAllBots();
      return {
        success: true,
        summary: {
          totalStrategies: strats.length,
          totalObservations: obs.length,
          totalBacktests: bts.length,
          totalBots: bots.length,
          activeBots: bots.filter((b) => b.status === 'RUNNING').length,
          strategies: strats.map((s) => ({ id: s.id, name: s.name, type: s.type, symbol: s.symbol, timeframe: s.timeframe })),
          bots: bots.map((b) => ({ id: b.id, name: b.name, status: b.status, symbol: b.symbol })),
        },
      };
    },
  },
  {
    name: 'SAVE_JOURNAL',
    aliases: ['JOURNAL_CREATE'],
    category: 'knowledge',
    description: 'Save a trader reflection or research insight into the trade journal.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Journal entry title' },
        content: { type: 'string', description: 'Journal content' },
        tags: { type: 'array', items: { type: 'string' } },
      },
      required: ['title', 'content'],
    },
    handler: async (params, context) => {
      const { dbSaveJournalEntry } = await import('@core/database/db.ts');
      const entry = await dbSaveJournalEntry(params.entry || params);
      context.notify?.('JOURNAL_SAVED', { entryId: entry.id });
      return { success: true, entry };
    },
  },
  {
    name: 'GET_JOURNAL',
    aliases: ['JOURNAL_LIST'],
    category: 'knowledge',
    description: 'Retrieve trade journal entries from SQLite.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Maximum entries (default: 50)' },
      },
    },
    handler: async (params) => {
      const { dbGetJournalEntries } = await import('@core/database/db.ts');
      const entries = await dbGetJournalEntries(params.limit || 50);
      return { success: true, count: entries.length, entries };
    },
  },
  {
    name: 'DELETE_JOURNAL',
    category: 'knowledge',
    description: 'Delete a trade journal entry by ID.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    handler: async ({ id }) => ({
      success: await dbDeleteJournalEntry(id),
      message: `Journal entry ${id} deleted`,
    }),
  },
  {
    name: 'GET_DATABASE_ANALYTICS',
    category: 'knowledge',
    description: 'Retrieve database storage analytics, order success rates, and row counts.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: async () => {
      const analytics = await dbGetAnalytics();
      return { success: true, analytics };
    },
  },
  {
    name: 'PRUNE_DATABASE',
    category: 'knowledge',
    description: 'Prune stale unexecuted orders and enforce retention caps across SQLite tables.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: async () => {
      await pruneDatabase();
      return { success: true, message: 'Database pruned and capped successfully' };
    },
  },
  {
    name: 'EXPORT_DATABASE',
    category: 'knowledge',
    description: 'Generate a full JSON export of the entire database.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: async () => {
      const { dbExportAllData } = await import('@core/database/db.ts');
      const backup = await dbExportAllData();
      return { success: true, backup };
    },
  },
];
