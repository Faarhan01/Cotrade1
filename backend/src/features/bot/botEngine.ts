import { botStore } from './botStore.ts';
import {
  BotInstance,
  BotSignalResult,
  BotExecutionRecord,
} from './botTypes.ts';
import { connectorManager } from '@features/mt5';
import { tradeStore } from '@services/tradeStore';
import { broadcast } from '@services/websocketServer';
import { logger } from '@core/utils/logger.ts';
import { normalizeSymbol } from '@core/utils';
import { dbGetCandles, dbGetStrategyById } from '@features/database';
import { CandleData, TickData } from '@/types';

export class BotEngine {
  private static instance: BotEngine;
  private loopTimer: NodeJS.Timeout | null = null;
  private isProcessing: boolean = false;
  private paperPositions: Map<string, BotExecutionRecord[]> = new Map();

  private constructor() {}

  public static getInstance(): BotEngine {
    if (!BotEngine.instance) {
      BotEngine.instance = new BotEngine();
    }
    return BotEngine.instance;
  }

  public async start(): Promise<void> {
    await botStore.initialize();
    this.paperPositions.clear();
    const openPaperExecutions = await botStore.getOpenPaperExecutions();
    for (const execution of openPaperExecutions) {
      const executions = this.paperPositions.get(execution.botId) || [];
      executions.push(execution);
      this.paperPositions.set(execution.botId, executions);
    }
    if (this.loopTimer) clearInterval(this.loopTimer);

    // Run evaluation loop every 3 seconds
    this.loopTimer = setInterval(() => {
      this.evaluateActiveBots().catch((err) => {
        logger.warn('BotEngine', `Evaluation cycle error: ${err.message}`);
      });
    }, 3000);

    logger.info('BotEngine', 'Automated Bot Execution Engine active (3s evaluation loop)');
  }

  public stop(): void {
    if (this.loopTimer) {
      clearInterval(this.loopTimer);
      this.loopTimer = null;
    }
  }

  /**
   * Main evaluation loop across all currently running bots
   */
  public async evaluateActiveBots(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const activeBots = botStore.getActiveBots();
      for (const bot of activeBots) {
        await this.processBot(bot);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process an individual bot: evaluate signals, risk guard, positions, and trailing stops
   */
  public async processBot(bot: BotInstance): Promise<BotSignalResult | null> {
    try {
      // 1. Check Global Risk Guard Kill Switch
      const riskGuard = tradeStore.getRiskGuard();
      if (riskGuard.emergencyKillSwitch) {
        await botStore.updateBotStatus(bot.id, 'PAUSED', 'Emergency Kill Switch Active');
        return null;
      }

      // 2. Fetch recent candles for the bot's symbol & timeframe
      const candles = await this.getRecentCandles(bot.symbol, bot.timeframe, 60);
      if (!candles || candles.length < 15) {
        return null;
      }

      // 3. Evaluate Strategy Logic
      const signalResult = await this.evaluateStrategySignal(bot, candles);
      
      // Update bot statistics with latest signal
      bot.stats.lastSignal = signalResult.signal;
      bot.stats.lastSignalTime = signalResult.timestamp;
      bot.stats.lastSignalReason = signalResult.reason;
      await botStore.saveBot(bot);

      // Broadcast signal event to frontend and AI listeners
      broadcast({
        type: 'bot:signal',
        payload: {
          botId: bot.id,
          symbol: bot.symbol,
          signal: signalResult.signal,
          reason: signalResult.reason,
          confidence: signalResult.confidence,
          price: signalResult.price,
          timestamp: signalResult.timestamp,
        },
      });

      // 4. Position & Trailing Stop Management
      await this.manageTrailingStops(bot, signalResult.price);

      // 5. Check if entry signal should execute
      if (signalResult.signal === 'BUY' || signalResult.signal === 'SELL') {
        await this.handleTradeSignal(bot, signalResult);
      } else if (signalResult.signal === 'CLOSE') {
        await this.closeBotPositions(bot.id, signalResult.reason);
      }

      return signalResult;
    } catch (err: any) {
      logger.warn('BotEngine', `Error processing bot ${bot.id}: ${err.message}`);
      await botStore.log(bot.id, 'error', `Execution error: ${err.message}`);
      return null;
    }
  }

  /**
   * Evaluates the specific technical strategy rules
   */
  public async evaluateStrategySignal(bot: BotInstance, candles: CandleData[]): Promise<BotSignalResult> {
    const last = candles[candles.length - 1];
    const prev = candles[candles.length - 2];
    const currentPrice = last.close;
    const now = Date.now();

    // Strategy Parameters (merge bot overrides with strategy defaults)
    const strat = await dbGetStrategyById(bot.strategyId);
    const params = {
      ...(strat?.parameters || {}),
      ...(bot.parametersOverride || {}),
    };

    const type = bot.strategyType || strat?.type || 'RSI_REVERSAL';

    if (type === 'RSI_REVERSAL') {
      const period = Number(params.rsiPeriod) || 14;
      const oversold = Number(params.rsiOversold) || 30;
      const overbought = Number(params.rsiOverbought) || 70;

      const rsi = this.calculateRSI(candles, period);
      const indicatorValues = { rsi, oversold, overbought };

      if (rsi <= oversold) {
        return {
          signal: 'BUY',
          confidence: Math.min(0.95, 0.7 + (oversold - rsi) * 0.02),
          reason: `RSI oversold at ${rsi.toFixed(1)} (threshold ${oversold})`,
          price: currentPrice,
          indicatorValues,
          timestamp: now,
        };
      } else if (rsi >= overbought) {
        return {
          signal: 'SELL',
          confidence: Math.min(0.95, 0.7 + (rsi - overbought) * 0.02),
          reason: `RSI overbought at ${rsi.toFixed(1)} (threshold ${overbought})`,
          price: currentPrice,
          indicatorValues,
          timestamp: now,
        };
      }

      return {
        signal: 'HOLD',
        confidence: 0.5,
        reason: `RSI neutral at ${rsi.toFixed(1)}`,
        price: currentPrice,
        indicatorValues,
        timestamp: now,
      };
    }

    if (type === 'EMA_CROSSOVER') {
      const fastPeriod = Number(params.fastEmaPeriod) || 9;
      const slowPeriod = Number(params.slowEmaPeriod) || 21;

      const fastEmaCurr = this.calculateEMA(candles, fastPeriod);
      const slowEmaCurr = this.calculateEMA(candles, slowPeriod);
      const fastEmaPrev = this.calculateEMA(candles.slice(0, -1), fastPeriod);
      const slowEmaPrev = this.calculateEMA(candles.slice(0, -1), slowPeriod);

      const indicatorValues = { fastEmaCurr, slowEmaCurr, fastEmaPrev, slowEmaPrev };

      // Bullish Cross
      if (fastEmaPrev <= slowEmaPrev && fastEmaCurr > slowEmaCurr) {
        return {
          signal: 'BUY',
          confidence: 0.88,
          reason: `Fast EMA (${fastPeriod}) crossed above Slow EMA (${slowPeriod})`,
          price: currentPrice,
          indicatorValues,
          timestamp: now,
        };
      }

      // Bearish Cross
      if (fastEmaPrev >= slowEmaPrev && fastEmaCurr < slowEmaCurr) {
        return {
          signal: 'SELL',
          confidence: 0.88,
          reason: `Fast EMA (${fastPeriod}) crossed below Slow EMA (${slowPeriod})`,
          price: currentPrice,
          indicatorValues,
          timestamp: now,
        };
      }

      return {
        signal: 'HOLD',
        confidence: 0.5,
        reason: `EMA alignment unchanged (Fast: ${fastEmaCurr.toFixed(4)}, Slow: ${slowEmaCurr.toFixed(4)})`,
        price: currentPrice,
        indicatorValues,
        timestamp: now,
      };
    }

    if (type === 'BREAKOUT_VOLATILITY') {
      const lookback = 20;
      const recent = candles.slice(-lookback - 1, -1);
      const highChannel = Math.max(...recent.map((c) => c.high));
      const lowChannel = Math.min(...recent.map((c) => c.low));

      const indicatorValues = { highChannel, lowChannel, currentPrice };

      if (currentPrice > highChannel) {
        return {
          signal: 'BUY',
          confidence: 0.85,
          reason: `Price broke out above 20-bar channel high (${highChannel.toFixed(4)})`,
          price: currentPrice,
          indicatorValues,
          timestamp: now,
        };
      } else if (currentPrice < lowChannel) {
        return {
          signal: 'SELL',
          confidence: 0.85,
          reason: `Price broke down below 20-bar channel low (${lowChannel.toFixed(4)})`,
          price: currentPrice,
          indicatorValues,
          timestamp: now,
        };
      }

      return {
        signal: 'HOLD',
        confidence: 0.5,
        reason: 'Price within consolidation channel',
        price: currentPrice,
        indicatorValues,
        timestamp: now,
      };
    }

    if (type === 'MACD_MOMENTUM') {
      const fast = Number(params.fastEmaPeriod) || 12;
      const slow = Number(params.slowEmaPeriod) || 26;
      const signalPeriod = Number(params.signalPeriod) || 9;

      const macd = this.calculateMACD(candles, fast, slow, signalPeriod);
      const indicatorValues = { ...macd, currentPrice };

      if (macd.hist > 0 && macd.prevHist <= 0) {
        return {
          signal: 'BUY',
          confidence: 0.90,
          reason: `MACD histogram crossed above zero line (MACD: ${macd.macd.toFixed(4)}, Signal: ${macd.signal.toFixed(4)})`,
          price: currentPrice,
          indicatorValues,
          timestamp: now,
        };
      } else if (macd.hist < 0 && macd.prevHist >= 0) {
        return {
          signal: 'SELL',
          confidence: 0.90,
          reason: `MACD histogram crossed below zero line (MACD: ${macd.macd.toFixed(4)}, Signal: ${macd.signal.toFixed(4)})`,
          price: currentPrice,
          indicatorValues,
          timestamp: now,
        };
      }

      return {
        signal: 'HOLD',
        confidence: 0.5,
        reason: `MACD histogram neutral (${macd.hist.toFixed(5)})`,
        price: currentPrice,
        indicatorValues,
        timestamp: now,
      };
    }

    if (type === 'BOLLINGER_BANDS') {
      const period = Number(params.bbPeriod) || 20;
      const stdDevMult = Number(params.bbStdDev) || 2.0;

      const bb = this.calculateBollingerBands(candles, period, stdDevMult);
      const indicatorValues = { ...bb, currentPrice };

      // Mean reversion / bounce logic
      if (currentPrice <= bb.lower) {
        return {
          signal: 'BUY',
          confidence: 0.89,
          reason: `Price tested Bollinger Lower Band (${bb.lower.toFixed(4)}) - Mean Reversion Long`,
          price: currentPrice,
          indicatorValues,
          timestamp: now,
        };
      } else if (currentPrice >= bb.upper) {
        return {
          signal: 'SELL',
          confidence: 0.89,
          reason: `Price tested Bollinger Upper Band (${bb.upper.toFixed(4)}) - Mean Reversion Short`,
          price: currentPrice,
          indicatorValues,
          timestamp: now,
        };
      }

      return {
        signal: 'HOLD',
        confidence: 0.5,
        reason: `Price inside Bollinger Bands (${bb.lower.toFixed(4)} - ${bb.upper.toFixed(4)})`,
        price: currentPrice,
        indicatorValues,
        timestamp: now,
      };
    }

    if (type === 'SCALPING_FAST') {
      const fastEma = this.calculateEMA(candles, 5);
      const midEma = this.calculateEMA(candles, 13);
      const rsi5 = this.calculateRSI(candles, 7);
      const indicatorValues = { fastEma, midEma, rsi5, currentPrice };

      if (fastEma > midEma && rsi5 < 45) {
        return {
          signal: 'BUY',
          confidence: 0.92,
          reason: `Fast Scalper: EMA 5/13 bullish push with short RSI pullback (${rsi5.toFixed(1)})`,
          price: currentPrice,
          indicatorValues,
          timestamp: now,
        };
      } else if (fastEma < midEma && rsi5 > 55) {
        return {
          signal: 'SELL',
          confidence: 0.92,
          reason: `Fast Scalper: EMA 5/13 bearish push with short RSI bounce (${rsi5.toFixed(1)})`,
          price: currentPrice,
          indicatorValues,
          timestamp: now,
        };
      }

      return {
        signal: 'HOLD',
        confidence: 0.5,
        reason: 'Scalper conditions waiting for micro-trend trigger',
        price: currentPrice,
        indicatorValues,
        timestamp: now,
      };
    }

    // Default Multi-Indicator Consensus
    const rsiVal = this.calculateRSI(candles, 14);
    const emaFast = this.calculateEMA(candles, 9);
    const emaSlow = this.calculateEMA(candles, 21);

    const isTrendUp = emaFast > emaSlow;
    const isOversold = rsiVal < 42;
    const isOverbought = rsiVal > 58;

    if (isTrendUp && isOversold) {
      return {
        signal: 'BUY',
        confidence: 0.91,
        reason: `Consensus: Upward EMA bias with RSI pullback (${rsiVal.toFixed(1)})`,
        price: currentPrice,
        indicatorValues: { rsi: rsiVal, emaFast, emaSlow },
        timestamp: now,
      };
    } else if (!isTrendUp && isOverbought) {
      return {
        signal: 'SELL',
        confidence: 0.91,
        reason: `Consensus: Downward EMA bias with RSI rally (${rsiVal.toFixed(1)})`,
        price: currentPrice,
        indicatorValues: { rsi: rsiVal, emaFast, emaSlow },
        timestamp: now,
      };
    }

    return {
      signal: 'HOLD',
      confidence: 0.5,
      reason: 'No synchronous alignment detected',
      price: currentPrice,
      indicatorValues: { rsi: rsiVal, emaFast, emaSlow },
      timestamp: now,
    };
  }

  /**
   * Handles opening a position when a valid BUY/SELL signal is generated
   */
  private async handleTradeSignal(bot: BotInstance, signal: BotSignalResult): Promise<void> {
    const now = Date.now();

    // Check cooldown
    if (bot.lastTradeTimestamp && now - bot.lastTradeTimestamp < bot.cooldownSeconds * 1000) {
      return;
    }

    // Check Max Positions for this Bot
    const openPositionsCount = await this.getBotOpenPositionsCount(bot);
    if (openPositionsCount >= bot.allocation.maxPositions) {
      return;
    }

    // Check Daily Loss Limit
    if (bot.stats.realizedPnl <= -Math.abs(bot.allocation.maxDailyLoss)) {
      await botStore.updateBotStatus(bot.id, 'PAUSED', 'Max daily loss threshold reached');
      return;
    }

    const orderType = signal.signal as 'BUY' | 'SELL';
    const volume = bot.allocation.lotSize;
    const entryPrice = signal.price;

    // Calculate SL & TP
    const point = bot.symbol.includes('JPY') ? 0.001 : bot.symbol === 'XAUUSD' ? 0.01 : 0.0001;
    const slDist = (bot.allocation.stopLossPoints || 250) * point;
    const tpDist = (bot.allocation.takeProfitPoints || 500) * point;

    const sl = orderType === 'BUY' ? entryPrice - slDist : entryPrice + slDist;
    const tp = orderType === 'BUY' ? entryPrice + tpDist : entryPrice - tpDist;

    const execId = `bexec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    if (bot.executionMode === 'LIVE') {
      const { executeCommand } = await import('@commands');
      const commandResult = await executeCommand('EXECUTE_TRADE', {
        symbol: bot.symbol,
        orderType,
        volume,
        price: entryPrice,
        sl,
        tp,
        magic: bot.magicNumber,
        comment: `BOT_${bot.name.slice(0, 15)}`,
        source: 'AI_MCP',
        confidence: signal.confidence,
        reason: signal.reason,
      }, {
        source: 'BOT',
        aiName: bot.name,
        metadata: { botId: bot.id, strategyId: bot.strategyId },
      });
      const res = commandResult.data || { success: false, message: commandResult.error || commandResult.message };

      if (res.success) {
        const record: BotExecutionRecord = {
          id: execId,
          botId: bot.id,
          symbol: bot.symbol,
          orderType,
          volume,
          entryPrice: res.price || entryPrice,
          sl,
          tp,
          ticket: res.ticket || res.dealTicket,
          dealTicket: res.dealTicket,
          status: 'OPEN',
          executionMode: 'LIVE',
          openedAt: now,
          reason: signal.reason,
          magicNumber: bot.magicNumber,
        };
        await botStore.recordExecution(record);
        await botStore.log(bot.id, 'trade', `Live ${orderType} executed @ ${record.entryPrice} (Ticket #${record.ticket})`);
        
        broadcast({
          type: 'bot:execution',
          payload: record,
        });
      } else {
        await botStore.log(bot.id, 'error', `Failed to execute live trade: ${res.message || res.error || 'Execution rejected'}`);
      }
    } else {
      // PAPER / DRY_RUN Execution
      const record: BotExecutionRecord = {
        id: execId,
        botId: bot.id,
        symbol: bot.symbol,
        orderType,
        volume,
        entryPrice,
        sl,
        tp,
        ticket: Math.floor(900000 + Math.random() * 99999),
        status: 'OPEN',
        executionMode: bot.executionMode,
        openedAt: now,
        reason: signal.reason,
        magicNumber: bot.magicNumber,
      };

      const existing = this.paperPositions.get(bot.id) || [];
      existing.push(record);
      this.paperPositions.set(bot.id, existing);

      await botStore.recordExecution(record);
      await botStore.log(bot.id, 'trade', `Paper ${orderType} opened @ ${entryPrice.toFixed(4)}: ${signal.reason}`);

      broadcast({
        type: 'bot:execution',
        payload: record,
      });
    }
  }

  /**
   * Trailing Stop Loss Management
   */
  private async manageTrailingStops(bot: BotInstance, currentPrice: number): Promise<void> {
    if (!bot.trailingStop || !bot.trailingStop.enabled) return;

    const point = bot.symbol.includes('JPY') ? 0.001 : bot.symbol === 'XAUUSD' ? 0.01 : 0.0001;
    const distance = bot.trailingStop.distancePoints * point;
    const step = bot.trailingStop.stepPoints * point;

    // 1. Manage Paper Positions
    const paper = this.paperPositions.get(bot.id) || [];
    for (const pos of paper.filter((p) => p.status === 'OPEN')) {
      const contractSize = bot.symbol === 'XAUUSD' ? 100 : bot.symbol === 'BTCUSD' ? 1 : 100000;
      const profitPoints = pos.orderType === 'BUY' ? (currentPrice - pos.entryPrice) : (pos.entryPrice - currentPrice);

      // Trailing SL logic
      if (pos.orderType === 'BUY') {
        const targetSl = currentPrice - distance;
        if (targetSl > (pos.sl || 0) + step && currentPrice > pos.entryPrice) {
          pos.sl = targetSl;
          await botStore.log(bot.id, 'info', `Trailing SL moved up to ${targetSl.toFixed(4)}`);
        }
        // Check SL/TP hit
        if (pos.sl && currentPrice <= pos.sl) {
          pos.status = 'CLOSED';
          pos.exitPrice = pos.sl;
          pos.closedAt = Date.now();
          pos.pnl = (pos.exitPrice - pos.entryPrice) * pos.volume * contractSize;
          await botStore.recordExecution(pos);
        } else if (pos.tp && currentPrice >= pos.tp) {
          pos.status = 'CLOSED';
          pos.exitPrice = pos.tp;
          pos.closedAt = Date.now();
          pos.pnl = (pos.exitPrice - pos.entryPrice) * pos.volume * contractSize;
          await botStore.recordExecution(pos);
        }
      } else {
        const targetSl = currentPrice + distance;
        if ((!pos.sl || targetSl < pos.sl - step) && currentPrice < pos.entryPrice) {
          pos.sl = targetSl;
          await botStore.log(bot.id, 'info', `Trailing SL moved down to ${targetSl.toFixed(4)}`);
        }
        // Check SL/TP hit
        if (pos.sl && currentPrice >= pos.sl) {
          pos.status = 'CLOSED';
          pos.exitPrice = pos.sl;
          pos.closedAt = Date.now();
          pos.pnl = (pos.entryPrice - pos.exitPrice) * pos.volume * contractSize;
          await botStore.recordExecution(pos);
        } else if (pos.tp && currentPrice <= pos.tp) {
          pos.status = 'CLOSED';
          pos.exitPrice = pos.tp;
          pos.closedAt = Date.now();
          pos.pnl = (pos.entryPrice - pos.exitPrice) * pos.volume * contractSize;
          await botStore.recordExecution(pos);
        }
      }
    }

    // 2. Manage Live MT5 Positions with Bot Magic Number
    if (bot.executionMode === 'LIVE') {
      const livePositions = tradeStore.getPositions().filter((p) => p.magic === bot.magicNumber);
      const { executeCommand } = await import('@commands');

      for (const pos of livePositions) {
        if (pos.type === 'BUY') {
          const targetSl = currentPrice - distance;
          if (targetSl > (pos.sl || 0) + step && currentPrice > pos.openPrice) {
            await executeCommand('MODIFY_POSITION', { ticket: pos.ticket, sl: targetSl, tp: pos.tp }, {
              source: 'BOT', aiName: bot.name, metadata: { botId: bot.id },
            });
          }
        } else if (pos.type === 'SELL') {
          const targetSl = currentPrice + distance;
          if ((!pos.sl || targetSl < pos.sl - step) && currentPrice < pos.openPrice) {
            await executeCommand('MODIFY_POSITION', { ticket: pos.ticket, sl: targetSl, tp: pos.tp }, {
              source: 'BOT', aiName: bot.name, metadata: { botId: bot.id },
            });
          }
        }
      }
    }
  }

  /**
   * Emergency or signal-based closure of all open positions for a bot
   */
  public async closeBotPositions(botId: string, reason: string = 'Bot Exit Signal'): Promise<{ closed: number }> {
    const bot = botStore.getBot(botId);
    if (!bot) return { closed: 0 };

    let closedCount = 0;

    // Paper positions closure
    const paper = this.paperPositions.get(botId) || [];
    const openPaper = paper.filter((p) => p.status === 'OPEN');
    const lastPrice = (await this.getRecentCandles(bot.symbol, bot.timeframe, 1))?.[0]?.close || 1.085;
    const contractSize = bot.symbol === 'XAUUSD' ? 100 : bot.symbol === 'BTCUSD' ? 1 : 100000;

    for (const p of openPaper) {
      p.status = 'CLOSED';
      p.exitPrice = lastPrice;
      p.closedAt = Date.now();
      p.pnl = p.orderType === 'BUY'
        ? (p.exitPrice - p.entryPrice) * p.volume * contractSize
        : (p.entryPrice - p.exitPrice) * p.volume * contractSize;
      await botStore.recordExecution(p);
      closedCount++;
    }

    // Live positions closure
    if (bot.executionMode === 'LIVE') {
      const livePositions = tradeStore.getPositions().filter((p) => p.magic === bot.magicNumber);
      const { executeCommand } = await import('@commands');
      for (const pos of livePositions) {
        const res = await executeCommand('CLOSE_POSITION', { ticket: pos.ticket }, {
          source: 'BOT', aiName: bot.name, metadata: { botId: bot.id, reason },
        });
        if (res.success) closedCount++;
      }
    }

    await botStore.log(botId, 'info', `Closed ${closedCount} positions: ${reason}`);
    return { closed: closedCount };
  }

  private async getBotOpenPositionsCount(bot: BotInstance): Promise<number> {
    if (bot.executionMode === 'LIVE') {
      return tradeStore.getPositions().filter((p) => p.magic === bot.magicNumber).length;
    }
    const paper = this.paperPositions.get(bot.id) || [];
    return paper.filter((p) => p.status === 'OPEN').length;
  }

  private async getRecentCandles(symbol: string, timeframe: string, count: number): Promise<CandleData[]> {
    const sym = normalizeSymbol(symbol);
    try {
      const connector = connectorManager.getConnector();
      const candles = await connector.getCandles(sym, timeframe, count);
      if (candles && candles.length > 0) return candles;
    } catch {}

    const cached = await dbGetCandles(sym, timeframe, count);
    if (cached && cached.length > 0) return cached;

    return tradeStore.getChartHistory();
  }

  // RSI Technical Calculator
  private calculateRSI(candles: CandleData[], period: number = 14): number {
    if (candles.length < period + 1) return 50;
    const closes = candles.map((c) => c.close);
    let gains = 0;
    let losses = 0;

    for (let i = closes.length - period; i < closes.length; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff > 0) gains += diff;
      else losses += Math.abs(diff);
    }

    const avgGain = gains / period;
    const avgLoss = losses / period || 0.00001;
    const rs = avgGain / avgLoss;
    return Math.max(0, Math.min(100, 100 - 100 / (1 + rs)));
  }

  // Exponential Moving Average Calculator
  private calculateEMA(candles: CandleData[], period: number): number {
    if (candles.length < period) return candles[candles.length - 1]?.close || 1;
    const closes = candles.map((c) => c.close);
    const k = 2 / (period + 1);
    let ema = closes[0];
    for (let i = 1; i < closes.length; i++) {
      ema = closes[i] * k + ema * (1 - k);
    }
    return ema;
  }

  // MACD Calculator
  private calculateMACD(candles: CandleData[], fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    const fastEma = this.calculateEMA(candles, fastPeriod);
    const slowEma = this.calculateEMA(candles, slowPeriod);
    const macd = fastEma - slowEma;

    const fastEmaPrev = this.calculateEMA(candles.slice(0, -1), fastPeriod);
    const slowEmaPrev = this.calculateEMA(candles.slice(0, -1), slowPeriod);
    const macdPrev = fastEmaPrev - slowEmaPrev;

    // Approximated signal EMA
    const signal = macd * (2 / (signalPeriod + 1)) + macdPrev * (1 - 2 / (signalPeriod + 1));
    const hist = macd - signal;
    const prevHist = macdPrev - signal;

    return { macd, signal, hist, prevHist };
  }

  // Bollinger Bands Calculator
  private calculateBollingerBands(candles: CandleData[], period = 20, stdDevMult = 2.0) {
    if (candles.length < period) {
      const p = candles[candles.length - 1]?.close || 1;
      return { middle: p, upper: p * 1.01, lower: p * 0.99, bandwidth: 0.02 };
    }
    const slice = candles.slice(-period);
    const closes = slice.map((c) => c.close);
    const mean = closes.reduce((a, b) => a + b, 0) / period;
    const variance = closes.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period;
    const stdDev = Math.sqrt(variance);

    const upper = mean + stdDevMult * stdDev;
    const lower = mean - stdDevMult * stdDev;
    const bandwidth = mean > 0 ? (upper - lower) / mean : 0;

    return { middle: mean, upper, lower, bandwidth };
  }

  /**
   * Returns current open positions for a bot (matching magic number for LIVE or paper memory for PAPER)
   */
  public async getBotPositions(botId: string): Promise<any[]> {
    const bot = botStore.getBot(botId);
    if (!bot) return [];

    if (bot.executionMode === 'LIVE') {
      const livePositions = tradeStore.getPositions().filter((p) => p.magic === bot.magicNumber);
      return livePositions.map((p) => ({
        id: `live-${p.ticket}`,
        botId,
        ticket: p.ticket,
        symbol: p.symbol,
        orderType: p.type,
        volume: p.volume,
        entryPrice: p.openPrice,
        currentPrice: p.currentPrice,
        sl: p.sl,
        tp: p.tp,
        pnl: p.profit,
        status: 'OPEN',
        executionMode: 'LIVE',
        openedAt: p.openTime ? p.openTime * 1000 : Date.now(),
        magicNumber: p.magic,
      }));
    }

    const paper = this.paperPositions.get(botId) || [];
    return paper.filter((p) => p.status === 'OPEN');
  }

  /**
   * Allows operator or AI to manually force a signal execution for immediate testing
   */
  public async forceSignal(botId: string, signalType: 'BUY' | 'SELL'): Promise<any> {
    const bot = botStore.getBot(botId);
    if (!bot) throw new Error('Bot not found');

    const candles = await this.getRecentCandles(bot.symbol, bot.timeframe, 10);
    const lastPrice = candles[candles.length - 1]?.close || (bot.symbol === 'XAUUSD' ? 2650.0 : 1.085);

    const forcedSignal: BotSignalResult = {
      signal: signalType,
      confidence: 0.99,
      reason: `Operator / AI Forced Execution Signal (${signalType})`,
      price: lastPrice,
      indicatorValues: { forced: true, source: 'OPERATOR' },
      timestamp: Date.now(),
    };

    await this.handleTradeSignal(bot, forcedSignal);
    return { success: true, botId, signal: forcedSignal };
  }
}

export const botEngine = BotEngine.getInstance();
