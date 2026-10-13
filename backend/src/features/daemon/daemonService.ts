import { appendEvent } from '@services/eventBuffer';
import { tradeStore } from '@services/tradeStore';
import { connectorManager } from '@features/mt5';
import { broadcast } from '@services/websocketServer';
import { Response } from 'express';
import { normalizeSymbol } from '@core/utils';
import {
  dbGetStrategies,
  dbSaveStrategy,
  dbDeleteStrategy,
  dbGetObservations,
  dbSaveObservation,
  dbDeleteObservation,
  dbSaveBacktestResult,
  dbGetBacktestResults,
  dbGetCandles,
  dbGetAnalytics,
  pruneDatabase,
} from '@features/database';
import { runStrategyBacktest } from '@features/strategies';
import { botStore, botEngine } from '@features/bot';

export interface DaemonConfig {
  heartbeatTimeoutMs: number;
  autoRiskGuard: boolean;
  maxSlippagePoints: number;
  allowedSymbols: string[];
  maxOpenPositions: number;
  aiControlMode: 'autonomous' | 'supervised' | 'manual_approval';
}

export interface DaemonTask {
  id: string;
  name: string;
  intervalMs: number;
  lastRun: number;
  status: 'active' | 'paused';
  action: string;
}

export class DaemonService {
  private static instance: DaemonService;
  private isRunning: boolean = true;
  private startedAt: number = Date.now();
  private lastPulse: number = Date.now();
  private aiName: string = 'External AI Quantitative Agent';
  private aiLastHeartbeat: number = 0;
  private aiSessionId: string | null = null;
  private processedEventsCount: number = 0;
  private sseClients: Set<Response> = new Set();
  private pulseTimer: NodeJS.Timeout | null = null;

  private config: DaemonConfig = {
    heartbeatTimeoutMs: 30000,
    autoRiskGuard: true,
    maxSlippagePoints: 20,
    allowedSymbols: ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'BTCUSD'],
    maxOpenPositions: 10,
    aiControlMode: 'autonomous',
  };

  private watchlist: string[] = ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'BTCUSD'];
  private tasks: DaemonTask[] = [
    {
      id: 'task-risk-guard',
      name: 'Dynamic Risk & Margin Monitor',
      intervalMs: 5000,
      lastRun: Date.now(),
      status: 'active',
      action: 'CHECK_RISK',
    },
    {
      id: 'task-tick-eval',
      name: 'High-Frequency Tick & Spread Validator',
      intervalMs: 2000,
      lastRun: Date.now(),
      status: 'active',
      action: 'EVALUATE_TICKS',
    },
    {
      id: 'task-ai-heartbeat',
      name: 'External AI Watchdog & Failsafe',
      intervalMs: 10000,
      lastRun: Date.now(),
      status: 'active',
      action: 'CHECK_AI_HEARTBEAT',
    },
  ];

  private constructor() {
    this.startDaemonLoop();
  }

  public static getInstance(): DaemonService {
    if (!DaemonService.instance) {
      DaemonService.instance = new DaemonService();
    }
    return DaemonService.instance;
  }

  private startDaemonLoop(): void {
    if (this.pulseTimer) clearInterval(this.pulseTimer);
    this.pulseTimer = setInterval(() => {
      this.pulse();
    }, 2000);
  }

  private pulse(): void {
    if (!this.isRunning) return;
    this.lastPulse = Date.now();
    const now = Date.now();

    for (const task of this.tasks) {
      if (task.status === 'active' && now - task.lastRun >= task.intervalMs) {
        task.lastRun = now;
        this.runTask(task);
      }
    }
  }

  private runTask(task: DaemonTask): void {
    if (task.action === 'CHECK_RISK') {
      const state = tradeStore.getState();
      const account = state.account;
      if (account.login > 0 && account.marginLevel > 0 && account.marginLevel < 100) {
        this.notify('DAEMON_RISK_ALERT', {
          level: 'CRITICAL',
          message: `Margin level dropped to ${account.marginLevel.toFixed(1)}%! Emergency risk guard active.`,
        });
      }
    } else if (task.action === 'EVALUATE_TICKS') {
      const ticks = tradeStore.getTicks();
      for (const t of ticks) {
        if (t.spread > 50 && this.watchlist.includes(t.symbol)) {
          this.notify('DAEMON_MARKET_ANOMALY', {
            symbol: t.symbol,
            spread: t.spread,
            time: t.time || Date.now(),
            note: 'High spread detected; orders may experience slippage',
          });
        }
      }
    }
  }

  public notify(type: string, payload: any): void {
    this.processedEventsCount++;
    const event = { ts: Date.now(), type, payload };
    appendEvent(event);

    // Broadcast to SSE clients
    const msg = `event: daemon\ndata: ${JSON.stringify(event)}\n\n`;
    for (const client of this.sseClients) {
      try {
        client.write(msg);
      } catch {
        this.sseClients.delete(client);
      }
    }

    // Broadcast to App WebSockets
    broadcast({
      type: 'daemon:event',
      payload: event,
    });
  }

  // AI Registration & Heartbeat
  public registerHeartbeat(aiName?: string, sessionId?: string, metadata?: any): {
    success: boolean;
    acknowledgedAt: number;
    daemonStatus: string;
    aiControlMode: string;
  } {
    if (aiName) this.aiName = aiName;
    if (sessionId) this.aiSessionId = sessionId;
    this.aiLastHeartbeat = Date.now();

    this.notify('AI_HEARTBEAT', {
      aiName: this.aiName,
      sessionId: this.aiSessionId,
      metadata,
    });

    return {
      success: true,
      acknowledgedAt: this.aiLastHeartbeat,
      daemonStatus: this.isRunning ? 'RUNNING' : 'PAUSED',
      aiControlMode: this.config.aiControlMode,
    };
  }

  // External AI Dispatches Full Action Suite (Trading, Terminal Control & Knowledge Base)
  public async dispatchAICommand(command: {
    action: string;
    symbol?: string;
    orderType?: string;
    volume?: number;
    price?: number;
    sl?: number;
    tp?: number;
    ticket?: number;
    reason?: string;
    confidence?: number;
    comment?: string;
    magic?: number;
    timeframe?: string;
    count?: number;
    dateFrom?: number;
    dateTo?: number;
    priceOpen?: number;
    priceClose?: number;
    strategy?: any;
    observation?: any;
    strategyId?: string;
    observationId?: string;
    category?: string;
    params?: any;
    [key: string]: any;
  }): Promise<any> {
    const connector = connectorManager.getConnector();
    const actionUpper = (command.action || '').toUpperCase().trim();

    this.notify('AI_DISPATCH_RECEIVED', {
      action: actionUpper,
      command,
      timestamp: Date.now(),
    });

    // ==========================================
    // 1. MetaTrader 5 Trade Execution & Orders
    // ==========================================
    if (actionUpper === 'BUY' || actionUpper === 'SELL' || actionUpper === 'EXECUTE_ORDER' || actionUpper === 'PLACE_ORDER') {
      const sym = normalizeSymbol(command.symbol || 'EURUSD');
      const orderTypeVal = command.orderType
        ? command.orderType.toUpperCase()
        : actionUpper === 'SELL'
        ? 'SELL'
        : 'BUY';

      const orderData = {
        action: 'EXECUTE_TRADE' as const,
        symbol: sym,
        orderType: orderTypeVal as any,
        volume: Number(command.volume) || 0.1,
        price: command.price ? Number(command.price) : undefined,
        sl: command.sl ? Number(command.sl) : undefined,
        tp: command.tp ? Number(command.tp) : undefined,
        source: 'AI_MCP' as const,
        comment: command.comment || `AI_${command.confidence ? Math.round(command.confidence * 100) : 90}%`,
        magic: command.magic || 889900,
      };

      const queueResult = tradeStore.enqueueCommand(orderData);
      const execResult = await connector.executeOrder(orderData as any);

      this.notify('AI_ORDER_EXECUTED', {
        success: execResult.success,
        ticket: execResult.ticket,
        dealTicket: execResult.dealTicket,
        price: execResult.price,
        message: execResult.message,
        commandId: queueResult.commandId,
      });

      return {
        success: execResult.success,
        ticket: execResult.ticket,
        dealTicket: execResult.dealTicket,
        price: execResult.price,
        message: execResult.message,
        commandId: queueResult.commandId,
      };
    }

    if (actionUpper === 'MODIFY_POSITION') {
      const ticket = Number(command.ticket);
      if (!ticket) return { success: false, message: 'Ticket number is required to modify position' };
      const res = await connector.modifyPosition(ticket, command.sl, command.tp);
      this.notify('AI_POSITION_MODIFIED', { ticket, ...res });
      return res;
    }

    if (actionUpper === 'CLOSE_POSITION') {
      const ticket = Number(command.ticket);
      if (!ticket) return { success: false, message: 'Ticket number is required to close position' };
      const res = await connector.closePosition(ticket, command.volume);
      this.notify('AI_POSITION_CLOSED', { ticket, ...res });
      return res;
    }

    if (actionUpper === 'CLOSE_ALL') {
      const positions = tradeStore.getPositions();
      const targetSym = command.symbol ? normalizeSymbol(command.symbol) : null;
      const results = [];
      for (const p of positions) {
        if (!targetSym || p.symbol === targetSym) {
          const res = await connector.closePosition(p.ticket, p.volume);
          results.push({ ticket: p.ticket, symbol: p.symbol, ...res });
        }
      }
      this.notify('AI_CLOSE_ALL_COMPLETED', { closedCount: results.length, results });
      return { success: true, closedCount: results.length, closedPositions: results };
    }

    if (actionUpper === 'MODIFY_ORDER') {
      const ticket = Number(command.ticket);
      if (!ticket) return { success: false, message: 'Ticket number is required to modify pending order' };
      const res = await connector.modifyOrder(ticket, command.price, command.sl, command.tp);
      this.notify('AI_ORDER_MODIFIED', { ticket, ...res });
      return res;
    }

    if (actionUpper === 'CANCEL_ORDER' || actionUpper === 'DELETE_ORDER') {
      const ticket = Number(command.ticket);
      if (!ticket) return { success: false, message: 'Ticket number is required to cancel pending order' };
      const res = await connector.cancelOrder(ticket);
      this.notify('AI_ORDER_CANCELLED', { ticket, ...res });
      return res;
    }

    // ==========================================
    // 2. MT5 Calculations, Pre-Checks & Depth
    // ==========================================
    if (actionUpper === 'CALC_MARGIN') {
      const sym = normalizeSymbol(command.symbol || 'EURUSD');
      return await connector.calcMargin(
        command.orderType || 'BUY',
        sym,
        Number(command.volume) || 0.1,
        command.price ? Number(command.price) : undefined
      );
    }

    if (actionUpper === 'CALC_PROFIT') {
      const sym = normalizeSymbol(command.symbol || 'EURUSD');
      return await connector.calcProfit(
        command.orderType || 'BUY',
        sym,
        Number(command.volume) || 0.1,
        Number(command.priceOpen || 0),
        Number(command.priceClose || 0)
      );
    }

    if (actionUpper === 'CHECK_ORDER') {
      const sym = normalizeSymbol(command.symbol || 'EURUSD');
      return await connector.checkOrder({
        symbol: sym,
        orderType: (command.orderType || 'BUY') as any,
        volume: Number(command.volume) || 0.1,
        price: command.price ? Number(command.price) : undefined,
      });
    }

    if (actionUpper === 'GET_MARKET_DEPTH') {
      const sym = normalizeSymbol(command.symbol || 'EURUSD');
      return await connector.getMarketDepth(sym);
    }

    // ==========================================
    // 3. MT5 Data & Terminal Telemetry Queries
    // ==========================================
    if (actionUpper === 'GET_ACCOUNT' || actionUpper === 'ACCOUNT_INFO') {
      return tradeStore.getAccount();
    }

    if (actionUpper === 'GET_POSITIONS') {
      const pos = tradeStore.getPositions();
      return command.symbol ? pos.filter((p) => p.symbol === normalizeSymbol(command.symbol!)) : pos;
    }

    if (actionUpper === 'GET_ORDERS' || actionUpper === 'GET_PENDING_ORDERS') {
      return tradeStore.getPendingOrders();
    }

    if (actionUpper === 'GET_TICKS') {
      const ticks = tradeStore.getTicks();
      if (command.symbol) {
        return ticks.filter((t) => t.symbol === normalizeSymbol(command.symbol!));
      }
      return ticks;
    }

    if (actionUpper === 'GET_CANDLES' || actionUpper === 'FETCH_CANDLES') {
      const sym = normalizeSymbol(command.symbol || 'EURUSD');
      const tf = (command.timeframe || 'M1').toUpperCase();
      const count = Number(command.count) || 100;
      return await connector.getCandles(sym, tf, count);
    }

    if (actionUpper === 'GET_HISTORY_DEALS') {
      return await connector.getHistoryDeals({
        dateFrom: command.dateFrom,
        dateTo: command.dateTo,
        count: command.count || 50,
      });
    }

    if (actionUpper === 'GET_HISTORY_ORDERS') {
      return await connector.getHistoryOrders({
        dateFrom: command.dateFrom,
        dateTo: command.dateTo,
        count: command.count || 50,
      });
    }

    if (actionUpper === 'CONNECT_MT5') {
      const res = await connector.connect({
        login: command.login,
        password: command.password,
        server: command.server,
        path: command.path,
      });
      this.notify('AI_CONNECT_MT5', res);
      return res;
    }

    if (actionUpper === 'DISCONNECT_MT5') {
      const res = await connector.disconnect();
      this.notify('AI_DISCONNECT_MT5', res);
      return res;
    }

    if (actionUpper === 'CONFIGURE_RISK') {
      if (command.params) {
        tradeStore.updateRiskGuard(command.params);
      }
      return { success: true, riskGuard: tradeStore.getRiskGuard() };
    }

    // ==========================================
    // 4. Knowledge Base & Strategy Interactions
    // ==========================================
    if (actionUpper === 'CREATE_STRATEGY' || actionUpper === 'SAVE_STRATEGY') {
      const stratData = command.strategy || command;
      if (!stratData.name) {
        return { success: false, message: 'Strategy name is required' };
      }

      const newStrat = {
        id: stratData.id || `strat-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name: stratData.name,
        description: stratData.description || 'AI Created Strategy',
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
        tags: stratData.tags || ['AI_Agent', 'Autonomous'],
        author: stratData.author || this.aiName,
        notes: stratData.notes || command.reason || '',
      };

      await dbSaveStrategy(newStrat as any);
      this.notify('AI_STRATEGY_SAVED', { strategy: newStrat });
      tradeStore.addLog(
        'info',
        `AI Created Strategy: ${newStrat.name}`,
        `Symbol: ${newStrat.symbol} [${newStrat.timeframe}] by ${newStrat.author}`,
        'AI_AGENT'
      );
      return { success: true, strategy: newStrat };
    }

    if (actionUpper === 'GET_STRATEGIES' || actionUpper === 'LIST_STRATEGIES') {
      const sym = command.symbol ? normalizeSymbol(command.symbol) : undefined;
      const strategies = await dbGetStrategies(sym);
      return { success: true, count: strategies.length, strategies };
    }

    if (actionUpper === 'DELETE_STRATEGY') {
      const stratId = command.strategyId || command.id;
      if (!stratId) return { success: false, message: 'Strategy ID is required' };
      await dbDeleteStrategy(stratId);
      this.notify('AI_STRATEGY_DELETED', { strategyId: stratId });
      return { success: true, message: `Strategy ${stratId} deleted` };
    }

    if (actionUpper === 'RECORD_OBSERVATION' || actionUpper === 'SAVE_OBSERVATION') {
      const obsData = command.observation || command;
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
        tags: obsData.tags || ['AI_Obs'],
        metrics: obsData.metrics,
      };

      await dbSaveObservation(newObs as any);
      this.notify('AI_OBSERVATION_SAVED', { observation: newObs });
      tradeStore.addLog(
        'info',
        `AI Market Observation: ${newObs.title}`,
        `${newObs.category.toUpperCase()} • ${newObs.content.substring(0, 80)}...`,
        'AI_AGENT'
      );
      return { success: true, observation: newObs };
    }

    if (actionUpper === 'GET_OBSERVATIONS' || actionUpper === 'LIST_OBSERVATIONS') {
      const obs = await dbGetObservations(command.category);
      return { success: true, count: obs.length, observations: obs };
    }

    if (actionUpper === 'DELETE_OBSERVATION') {
      const obsId = command.observationId || command.id;
      if (!obsId) return { success: false, message: 'Observation ID is required' };
      await dbDeleteObservation(obsId);
      this.notify('AI_OBSERVATION_DELETED', { observationId: obsId });
      return { success: true, message: `Observation ${obsId} deleted` };
    }

    if (actionUpper === 'RUN_BACKTEST') {
      const sym = normalizeSymbol(command.symbol || 'EURUSD');
      const tf = (command.timeframe || 'M1').toUpperCase();
      const candleCount = Number(command.candleCount) || 300;
      const initialDeposit = Number(command.initialDeposit) || 10000;

      // 1. Fetch candles from database or MT5 connector
      let candles = await dbGetCandles(sym, tf, candleCount);
      if (candles.length < 20) {
        const fetched = await connector.getCandles(sym, tf, candleCount);
        if (fetched && fetched.length >= 20) {
          candles = fetched;
        } else {
          return {
            success: false,
            message: `Insufficient historical candles for ${sym} [${tf}]. Need at least 20, got ${candles.length}.`,
          };
        }
      }

      const stratObj = command.strategy || {
        id: command.strategyId || 'adhoc-ai-strat',
        name: command.strategyName || 'AI Algorithmic Evaluation',
        type: command.strategyType || 'MULTI_INDICATOR_CONSENSUS',
        symbol: sym,
        timeframe: tf,
        parameters: command.parameters || {},
      };

      const result = runStrategyBacktest(stratObj, candles, initialDeposit, 0.0001);
      await dbSaveBacktestResult(result);

      this.notify('AI_BACKTEST_COMPLETED', { result });
      tradeStore.addLog(
        'info',
        `AI Backtest Finished: ${result.strategyName}`,
        `Win Rate: ${result.winRatePct}% | Net Profit: $${result.netProfit} | Trades: ${result.totalTrades}`,
        'AI_AGENT'
      );
      return { success: true, result };
    }

    if (actionUpper === 'GET_BACKTEST_RESULTS') {
      const results = await dbGetBacktestResults(command.strategyId, command.limit || 20);
      return { success: true, count: results.length, results };
    }

    if (actionUpper === 'GET_DATABASE_ANALYTICS') {
      const analytics = await dbGetAnalytics();
      return { success: true, analytics };
    }

    if (actionUpper === 'PRUNE_DATABASE') {
      await pruneDatabase();
      return { success: true, message: 'Database pruned and capped successfully' };
    }

    // ==========================================
    // 5. Emergency Failsafes & State
    // ==========================================
    if (actionUpper === 'EMERGENCY_HALT') {
      this.isRunning = false;
      this.notify('AI_EMERGENCY_HALT', { reason: command.reason || 'AI triggered halt' });
      tradeStore.triggerKillSwitch(true);
      return { success: true, message: 'Daemon and automated trading halted' };
    }

    // ==========================================
    // 6. Automated Bot Orchestration (AI Controlled)
    // ==========================================
    if (actionUpper === 'BOT_LIST' || actionUpper === 'LIST_BOTS') {
      const bots = botStore.getAllBots();
      return { success: true, count: bots.length, bots };
    }

    if (actionUpper === 'BOT_CREATE' || actionUpper === 'DEPLOY_BOT') {
      const created = await botStore.createBot(command.bot || command);
      this.notify('AI_BOT_CREATED', { botId: created.id, name: created.name });
      return { success: true, bot: created };
    }

    if (actionUpper === 'BOT_START') {
      const botId = command.botId || command.id;
      const bot = await botStore.updateBotStatus(botId, 'RUNNING', 'Started via AI dispatch');
      this.notify('AI_BOT_STARTED', { botId });
      return { success: Boolean(bot), bot };
    }

    if (actionUpper === 'BOT_PAUSE') {
      const botId = command.botId || command.id;
      const bot = await botStore.updateBotStatus(botId, 'PAUSED', 'Paused via AI dispatch');
      this.notify('AI_BOT_PAUSED', { botId });
      return { success: Boolean(bot), bot };
    }

    if (actionUpper === 'BOT_STOP') {
      const botId = command.botId || command.id;
      const bot = await botStore.updateBotStatus(botId, 'STOPPED', 'Stopped via AI dispatch');
      this.notify('AI_BOT_STOPPED', { botId });
      return { success: Boolean(bot), bot };
    }

    if (actionUpper === 'BOT_DELETE') {
      const botId = command.botId || command.id;
      const deleted = await botStore.deleteBot(botId);
      this.notify('AI_BOT_DELETED', { botId });
      return { success: deleted };
    }

    if (actionUpper === 'BOT_EVALUATE') {
      const botId = command.botId || command.id;
      const bot = botStore.getBot(botId);
      if (!bot) return { success: false, message: 'Bot not found' };
      const signal = await botEngine.processBot(bot);
      return { success: true, botId, signal };
    }

    if (actionUpper === 'BOT_FORCE_SIGNAL') {
      const botId = command.botId || command.id;
      const sigType = (command.signal || command.orderType || 'BUY').toUpperCase() as 'BUY' | 'SELL';
      const res = await botEngine.forceSignal(botId, sigType);
      this.notify('AI_BOT_FORCED_SIGNAL', { botId, signal: sigType });
      return res;
    }

    if (actionUpper === 'BOT_GET_POSITIONS') {
      const botId = command.botId || command.id;
      const positions = await botEngine.getBotPositions(botId);
      return { success: true, count: positions.length, positions };
    }

    if (actionUpper === 'BOT_UPDATE_CONFIG') {
      const botId = command.botId || command.id;
      const existing = botStore.getBot(botId);
      if (!existing) return { success: false, message: 'Bot not found' };

      const updated = await botStore.saveBot({
        ...existing,
        ...command.updates,
        id: botId,
      });
      this.notify('AI_BOT_CONFIG_UPDATED', { botId });
      return { success: true, bot: updated };
    }

    if (actionUpper === 'BOT_CLOSE_POSITIONS') {
      const botId = command.botId || command.id;
      const result = await botEngine.closeBotPositions(botId, command.reason || 'AI emergency close');
      return { success: true, ...result };
    }

    if (actionUpper === 'BOT_GET_EXECUTIONS') {
      const botId = command.botId || command.id;
      const executions = await botStore.getExecutions(botId, command.limit || 50);
      return { success: true, count: executions.length, executions };
    }

    if (actionUpper === 'BOT_GET_LOGS') {
      const botId = command.botId || command.id;
      const logs = await botStore.getLogs(botId, command.limit || 50);
      return { success: true, count: logs.length, logs };
    }

    // ==========================================
    // 7. Extended Trading & Batch Controls
    // ==========================================
    if (actionUpper === 'CLOSE_BY') {
      const ticket = Number(command.ticket);
      const oppositeTicket = Number(command.oppositeTicket);
      if (!ticket || !oppositeTicket) {
        return { success: false, message: 'Both ticket and oppositeTicket are required' };
      }
      if (typeof (connector as any).closeByPosition === 'function') {
        const res = await (connector as any).closeByPosition(ticket, oppositeTicket);
        this.notify('AI_CLOSE_BY_EXECUTED', { ticket, oppositeTicket, res });
        return res;
      }
      return { success: false, message: 'Close-by not supported by connector' };
    }

    if (actionUpper === 'CLOSE_POSITIONS_BATCH') {
      if (typeof (connector as any).closePositionsBatch === 'function') {
        const res = await (connector as any).closePositionsBatch({
          symbol: command.symbol ? normalizeSymbol(command.symbol) : undefined,
          magic: command.magic ? Number(command.magic) : undefined,
          type: command.type,
        });
        this.notify('AI_BATCH_POSITIONS_CLOSED', res);
        return res;
      }
      return { success: false, message: 'Batch close not supported by connector' };
    }

    if (actionUpper === 'CANCEL_ORDERS_BATCH') {
      if (typeof (connector as any).cancelOrdersBatch === 'function') {
        const res = await (connector as any).cancelOrdersBatch({
          symbol: command.symbol ? normalizeSymbol(command.symbol) : undefined,
          magic: command.magic ? Number(command.magic) : undefined,
          type: command.type,
        });
        this.notify('AI_BATCH_ORDERS_CANCELLED', res);
        return res;
      }
      return { success: false, message: 'Batch cancel not supported by connector' };
    }

    // ==========================================
    // 8. Knowledge Base & Research Intelligence
    // ==========================================
    if (actionUpper === 'GET_KNOWLEDGE_SUMMARY') {
      const { dbGetStrategies, dbGetObservations, dbGetBacktestResults } = await import('@features/database');
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
          bots: bots.map((b) => ({ id: b.id, name: b.name, status: b.status, symbol: b.symbol, winRate: b.stats.tradesExecuted > 0 ? Math.round((b.stats.winningTrades / b.stats.tradesExecuted) * 100) : 0 })),
        },
      };
    }

    if (actionUpper === 'SEARCH_STRATEGIES') {
      const { dbSearchStrategies } = await import('@core/database/db.ts');
      const query = command.query || command.search || '';
      const results = await dbSearchStrategies(query);
      return { success: true, count: results.length, strategies: results };
    }

    if (actionUpper === 'SEARCH_OBSERVATIONS') {
      const { dbSearchObservations } = await import('@core/database/db.ts');
      const query = command.query || command.search || '';
      const results = await dbSearchObservations(query);
      return { success: true, count: results.length, observations: results };
    }

    if (actionUpper === 'JOURNAL_CREATE' || actionUpper === 'SAVE_JOURNAL') {
      const { dbSaveJournalEntry } = await import('@core/database/db.ts');
      const entry = await dbSaveJournalEntry(command.entry || command);
      this.notify('AI_JOURNAL_SAVED', { entryId: entry.id });
      return { success: true, entry };
    }

    if (actionUpper === 'JOURNAL_LIST') {
      const { dbGetJournalEntries } = await import('@core/database/db.ts');
      const entries = await dbGetJournalEntries(command.limit || 50);
      return { success: true, count: entries.length, entries };
    }

    if (actionUpper === 'EXPORT_DATABASE') {
      const { dbExportAllData } = await import('@core/database/db.ts');
      const backup = await dbExportAllData();
      return { success: true, backup };
    }

    return { success: false, message: `Unknown AI action: ${command.action}` };
  }

  // Get status
  public getStatus(): any {
    const now = Date.now();
    const isAiConnected = this.aiLastHeartbeat > 0 && now - this.aiLastHeartbeat < this.config.heartbeatTimeoutMs;
    const connector = connectorManager.getConnector();

    return {
      status: this.isRunning ? 'RUNNING' : 'PAUSED',
      uptimeSeconds: Math.floor((now - this.startedAt) / 1000),
      lastPulse: this.lastPulse,
      processedEvents: this.processedEventsCount,
      ai: {
        connected: isAiConnected,
        name: this.aiName,
        sessionId: this.aiSessionId,
        lastHeartbeat: this.aiLastHeartbeat,
        secondsSinceHeartbeat: this.aiLastHeartbeat ? Math.floor((now - this.aiLastHeartbeat) / 1000) : null,
      },
      mt5: {
        provider: connectorManager.getProviderName(),
        status: connector.getStatus(),
      },
      bots: {
        total: botStore.getAllBots().length,
        active: botStore.getActiveBots().length,
        instances: botStore.getAllBots().map((b) => ({
          id: b.id,
          name: b.name,
          symbol: b.symbol,
          timeframe: b.timeframe,
          status: b.status,
          strategyType: b.strategyType,
          executionMode: b.executionMode,
          tradesExecuted: b.stats.tradesExecuted,
          realizedPnl: b.stats.realizedPnl,
          lastSignal: b.stats.lastSignal,
          lastSignalTime: b.stats.lastSignalTime,
        })),
      },
      config: this.config,
      watchlist: this.watchlist,
      tasks: this.tasks,
      activeSseSubscribers: this.sseClients.size,
      capabilities: [
        'BUY',
        'SELL',
        'EXECUTE_ORDER',
        'MODIFY_POSITION',
        'CLOSE_POSITION',
        'CLOSE_ALL',
        'MODIFY_ORDER',
        'CANCEL_ORDER',
        'CALC_MARGIN',
        'CALC_PROFIT',
        'CHECK_ORDER',
        'GET_MARKET_DEPTH',
        'GET_ACCOUNT',
        'GET_POSITIONS',
        'GET_ORDERS',
        'GET_TICKS',
        'GET_CANDLES',
        'GET_HISTORY_DEALS',
        'GET_HISTORY_ORDERS',
        'CONNECT_MT5',
        'DISCONNECT_MT5',
        'CREATE_STRATEGY',
        'GET_STRATEGIES',
        'DELETE_STRATEGY',
        'RECORD_OBSERVATION',
        'GET_OBSERVATIONS',
        'DELETE_OBSERVATION',
        'RUN_BACKTEST',
        'GET_BACKTEST_RESULTS',
        'GET_DATABASE_ANALYTICS',
        'PRUNE_DATABASE',
        'EMERGENCY_HALT',
        'RESUME',
        'BOT_LIST',
        'BOT_CREATE',
        'BOT_START',
        'BOT_PAUSE',
        'BOT_STOP',
        'BOT_DELETE',
        'BOT_EVALUATE',
        'BOT_CLOSE_POSITIONS',
        'BOT_GET_EXECUTIONS',
        'BOT_GET_LOGS',
      ],
    };
  }

  public updateConfig(newConfig: Partial<DaemonConfig>): DaemonConfig {
    this.config = { ...this.config, ...newConfig };
    this.notify('DAEMON_CONFIG_UPDATED', { config: this.config });
    return this.config;
  }

  public updateWatchlist(symbols: string[]): string[] {
    this.watchlist = symbols.map((s) => s.trim()).filter(Boolean);
    this.notify('DAEMON_WATCHLIST_UPDATED', { watchlist: this.watchlist });
    return this.watchlist;
  }

  public addSseClient(res: Response): void {
    this.sseClients.add(res);
  }

  public removeSseClient(res: Response): void {
    this.sseClients.delete(res);
  }
}

export const daemonService = DaemonService.getInstance();
