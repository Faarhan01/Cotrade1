import {
  BotInstance,
  BotExecutionRecord,
  BotLogEntry,
  BotStatus,
} from './botTypes.ts';
import {
  dbGetBots,
  dbGetBotById,
  dbSaveBot,
  dbDeleteBot,
  dbSaveBotExecution,
  dbGetBotExecutions,
  dbSaveBotLog,
  dbGetBotLogs,
  dbGetStrategyById,
} from '@features/database';
import { logger } from '@core/utils/logger.ts';
import { normalizeSymbol } from '@core/utils';

export class BotStore {
  private static instance: BotStore;
  private bots: Map<string, BotInstance> = new Map();
  private initialized: boolean = false;

  private constructor() {}

  public static getInstance(): BotStore {
    if (!BotStore.instance) {
      BotStore.instance = new BotStore();
    }
    return BotStore.instance;
  }

  public async initialize(): Promise<void> {
    if (this.initialized) return;
    try {
      const persisted = await dbGetBots();
      for (const bot of persisted) {
        this.bots.set(bot.id, bot);
      }
      this.initialized = true;
      logger.info('BotStore', `Loaded ${this.bots.size} bot instances from database`);

      // Seed a default demo bot if none exist
      if (this.bots.size === 0) {
        await this.seedDefaultBots();
      }
    } catch (err: any) {
      logger.warn('BotStore', `Initialization notice: ${err.message}`);
      this.initialized = true;
    }
  }

  private async seedDefaultBots(): Promise<void> {
    const demoBot: BotInstance = {
      id: 'bot-rsi-scalper-eurusd',
      name: 'EURUSD RSI Momentum Alpha',
      strategyId: 'strat-rsi-reversal-eurusd',
      strategyName: 'RSI Reversal Mean Reversion',
      strategyType: 'RSI_REVERSAL',
      symbol: 'EURUSD',
      timeframe: 'M1',
      status: 'IDLE',
      executionMode: 'PAPER',
      magicNumber: 881001,
      allocation: {
        lotSize: 0.1,
        maxPositions: 2,
        maxDailyLoss: 150,
        targetDailyProfit: 300,
        stopLossPoints: 250,
        takeProfitPoints: 500,
      },
      trailingStop: {
        enabled: true,
        distancePoints: 150,
        stepPoints: 50,
      },
      cooldownSeconds: 45,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      stats: {
        tradesExecuted: 0,
        winningTrades: 0,
        losingTrades: 0,
        realizedPnl: 0,
        unrealizedPnl: 0,
      },
      parametersOverride: {
        rsiOversold: 30,
        rsiOverbought: 70,
        rsiPeriod: 14,
      },
    };

    const goldBot: BotInstance = {
      id: 'bot-gold-trend-alpha',
      name: 'XAUUSD Trend Rider (Gold Alpha)',
      strategyId: 'strat-ema-crossover-xauusd',
      strategyName: 'EMA 9/21 Trend Scalper',
      strategyType: 'EMA_CROSSOVER',
      symbol: 'XAUUSD',
      timeframe: 'M5',
      status: 'IDLE',
      executionMode: 'PAPER',
      magicNumber: 881002,
      allocation: {
        lotSize: 0.05,
        maxPositions: 2,
        maxDailyLoss: 250,
        targetDailyProfit: 500,
        stopLossPoints: 400,
        takeProfitPoints: 800,
      },
      trailingStop: {
        enabled: true,
        distancePoints: 200,
        stepPoints: 60,
      },
      cooldownSeconds: 60,
      createdAt: Date.now() - 3600000,
      updatedAt: Date.now() - 3600000,
      stats: {
        tradesExecuted: 0,
        winningTrades: 0,
        losingTrades: 0,
        realizedPnl: 0,
        unrealizedPnl: 0,
      },
      parametersOverride: {
        fastEmaPeriod: 9,
        slowEmaPeriod: 21,
      },
    };

    await this.saveBot(demoBot);
    await this.saveBot(goldBot);
    logger.info('BotStore', 'Seeded initial default trading bots');
  }

  public getAllBots(): BotInstance[] {
    return Array.from(this.bots.values());
  }

  public getBot(id: string): BotInstance | undefined {
    return this.bots.get(id);
  }

  public getActiveBots(): BotInstance[] {
    return Array.from(this.bots.values()).filter((b) => b.status === 'RUNNING');
  }

  public async saveBot(bot: BotInstance): Promise<BotInstance> {
    bot.updatedAt = Date.now();
    this.bots.set(bot.id, bot);
    try {
      await dbSaveBot(bot);
    } catch (err: any) {
      logger.warn('BotStore', `Failed to persist bot ${bot.id}: ${err.message}`);
    }
    return bot;
  }

  public async createBot(data: Partial<BotInstance>): Promise<BotInstance> {
    const now = Date.now();
    const id = data.id || `bot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    
    // Look up strategy to populate details if available
    let strategyName = data.strategyName || 'Custom Strategy';
    let strategyType = data.strategyType || 'CUSTOM';
    if (data.strategyId) {
      try {
        const strat = await dbGetStrategyById(data.strategyId);
        if (strat) {
          strategyName = strat.name;
          strategyType = strat.type;
        }
      } catch {}
    }

    const newBot: BotInstance = {
      id,
      name: data.name || `Bot ${data.symbol || 'EURUSD'} (${strategyType})`,
      strategyId: data.strategyId || 'custom',
      strategyName,
      strategyType,
      symbol: normalizeSymbol(data.symbol || 'EURUSD'),
      timeframe: data.timeframe || 'M1',
      status: data.status || 'IDLE',
      executionMode: data.executionMode || 'PAPER',
      magicNumber: data.magicNumber || Math.floor(800000 + Math.random() * 99999),
      allocation: {
        lotSize: data.allocation?.lotSize || 0.1,
        maxPositions: data.allocation?.maxPositions || 1,
        maxDailyLoss: data.allocation?.maxDailyLoss || 200,
        targetDailyProfit: data.allocation?.targetDailyProfit || 400,
        stopLossPoints: data.allocation?.stopLossPoints || 250,
        takeProfitPoints: data.allocation?.takeProfitPoints || 500,
      },
      trailingStop: {
        enabled: data.trailingStop?.enabled ?? false,
        distancePoints: data.trailingStop?.distancePoints || 100,
        stepPoints: data.trailingStop?.stepPoints || 30,
      },
      cooldownSeconds: data.cooldownSeconds || 60,
      createdAt: now,
      updatedAt: now,
      stats: {
        tradesExecuted: 0,
        winningTrades: 0,
        losingTrades: 0,
        realizedPnl: 0,
        unrealizedPnl: 0,
      },
      parametersOverride: data.parametersOverride,
    };

    return this.saveBot(newBot);
  }

  public async updateBotStatus(id: string, status: BotStatus, reason?: string): Promise<BotInstance | null> {
    const bot = this.bots.get(id);
    if (!bot) return null;
    bot.status = status;
    if (status === 'ERROR' && reason) {
      bot.stats.lastError = reason;
    } else if (status === 'RUNNING') {
      bot.stats.lastError = null;
    }
    await this.log(id, 'info', `Bot status changed to ${status}${reason ? `: ${reason}` : ''}`);
    return this.saveBot(bot);
  }

  public async deleteBot(id: string): Promise<boolean> {
    const exists = this.bots.has(id);
    if (!exists) return false;
    this.bots.delete(id);
    try {
      await dbDeleteBot(id);
    } catch (err: any) {
      logger.warn('BotStore', `Failed to delete bot ${id}: ${err.message}`);
    }
    return true;
  }

  public async recordExecution(exec: BotExecutionRecord): Promise<void> {
    const bot = this.bots.get(exec.botId);
    if (bot) {
      bot.stats.tradesExecuted += 1;
      bot.stats.lastExecutionTime = exec.openedAt;
      bot.lastTradeTimestamp = exec.openedAt;
      if (exec.pnl !== undefined) {
        bot.stats.realizedPnl += exec.pnl;
        if (exec.pnl > 0) bot.stats.winningTrades += 1;
        else if (exec.pnl < 0) bot.stats.losingTrades += 1;
      }
      await this.saveBot(bot);
    }
    try {
      await dbSaveBotExecution(exec);
    } catch (err: any) {
      logger.warn('BotStore', `Failed to persist execution ${exec.id}: ${err.message}`);
    }
  }

  public async getExecutions(botId?: string, limit = 50): Promise<BotExecutionRecord[]> {
    return dbGetBotExecutions(botId, limit);
  }

  public async log(
    botId: string,
    level: BotLogEntry['level'],
    message: string,
    data?: any
  ): Promise<void> {
    const entry: BotLogEntry = {
      id: `blog-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      botId,
      timestamp: Date.now(),
      level,
      message,
      data,
    };
    try {
      await dbSaveBotLog(entry);
    } catch {}
  }

  public async getLogs(botId: string, limit = 50): Promise<BotLogEntry[]> {
    return dbGetBotLogs(botId, limit);
  }
}

export const botStore = BotStore.getInstance();
