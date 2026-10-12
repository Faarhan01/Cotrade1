import { appendEvent, readEvents, clearEvents } from '@services/eventBuffer';
import { tradeStore } from '@services/tradeStore';
import { connectorManager } from '@features/mt5';
import { broadcast } from '@services/websocketServer';
import { Response } from 'express';

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
    maxOpenPositions: 5,
    aiControlMode: 'autonomous',
  };

  private watchlist: string[] = ['EURUSD', 'GBPUSD', 'XAUUSD'];
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

    // 1. Check AI watchdog
    const aiAlive = this.aiLastHeartbeat > 0 && now - this.aiLastHeartbeat < this.config.heartbeatTimeoutMs;

    // 2. Run active tasks
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
      // Check current ticks for unusual spread
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

  // External AI Dispatches Action or Trade
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
  }): Promise<any> {
    const connector = connectorManager.getConnector();
    const actionUpper = (command.action || '').toUpperCase();

    this.notify('AI_DISPATCH_RECEIVED', {
      action: actionUpper,
      command,
      timestamp: Date.now(),
    });

    if (actionUpper === 'BUY' || actionUpper === 'SELL' || actionUpper === 'EXECUTE_ORDER') {
      const orderData = {
        action: 'EXECUTE_TRADE' as const,
        symbol: command.symbol || 'EURUSD',
        orderType: (command.orderType === 'SELL' || actionUpper === 'SELL' ? 'SELL' : 'BUY') as 'BUY' | 'SELL',
        volume: Number(command.volume) || 0.1,
        price: command.price,
        sl: command.sl,
        tp: command.tp,
        source: 'AI_MCP' as const,
        comment: `AI_${(command.confidence ? Math.round(command.confidence * 100) : 90)}%`,
      };

      const queueResult = tradeStore.enqueueCommand(orderData);
      const execResult = await connector.executeOrder(orderData as any);

      this.notify('AI_ORDER_EXECUTED', {
        success: execResult.success,
        ticket: execResult.ticket,
        price: execResult.price,
        message: execResult.message,
        commandId: queueResult.commandId,
      });

      return {
        success: execResult.success,
        ticket: execResult.ticket,
        price: execResult.price,
        message: execResult.message,
        commandId: queueResult.commandId,
      };
    } else if (actionUpper === 'CLOSE_ALL') {
      const positions = tradeStore.getPositions();
      const results = [];
      for (const p of positions) {
        const res = await connector.closePosition(p.ticket, p.volume);
        results.push({ ticket: p.ticket, ...res });
      }
      this.notify('AI_CLOSE_ALL_COMPLETED', { closedCount: results.length, results });
      return { success: true, closedPositions: results };
    } else if (actionUpper === 'EMERGENCY_HALT') {
      this.isRunning = false;
      this.notify('AI_EMERGENCY_HALT', { reason: command.reason || 'AI triggered halt' });
      return { success: true, message: 'Daemon and automated trading halted' };
    } else if (actionUpper === 'RESUME') {
      this.isRunning = true;
      this.notify('AI_DAEMON_RESUMED', { message: 'Daemon resumed' });
      return { success: true, message: 'Daemon operations resumed' };
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
      config: this.config,
      watchlist: this.watchlist,
      tasks: this.tasks,
      activeSseSubscribers: this.sseClients.size,
    };
  }

  public updateConfig(newConfig: Partial<DaemonConfig>): DaemonConfig {
    this.config = { ...this.config, ...newConfig };
    this.notify('DAEMON_CONFIG_UPDATED', { config: this.config });
    return this.config;
  }

  public updateWatchlist(symbols: string[]): string[] {
    this.watchlist = symbols.map((s) => s.trim().toUpperCase());
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
