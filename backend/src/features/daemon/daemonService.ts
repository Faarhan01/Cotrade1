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
import { commandRegistry } from '@commands';

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
    }, { persist: false });
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

  // External AI Dispatches Full Action Suite via Unified Command Architecture
  public async dispatchAICommand(command: {
    action: string;
    [key: string]: any;
  }): Promise<any> {
    const actionUpper = (command.action || '').toUpperCase().trim();

    this.notify('AI_DISPATCH_RECEIVED', {
      action: actionUpper,
      command,
      timestamp: Date.now(),
    });

    const { executeCommand } = await import('@commands');
    const result = await executeCommand(command.action, command, {
      source: 'DAEMON',
      aiName: this.aiName,
      sessionId: this.aiSessionId || undefined,
      notify: (type: string, payload: any) => this.notify(`AI_${type}`, payload),
    });

    if (result.data !== undefined) {
      return result.data;
    }
    return result;
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
      capabilities: commandRegistry.getAll().map((command) => command.name),
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
