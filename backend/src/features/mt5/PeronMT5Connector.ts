import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
  AccountInfo,
  CandleData,
  DetailedSymbolInfo,
  HistoryDeal,
  HistoryOrder,
  MarginCalcResult,
  OrderCheckResult,
  PendingOrder,
  Position,
  ProfitCalcResult,
  TickData,
  TradeCommand,
} from '@core/types';
import {
  ConnectParams,
  ConnectionStatus,
  ExecutionResult,
  IMT5Connector,
} from './mt5Provider.ts';
import { defaultMT5Config } from '@core/config';
import { logger } from '@core/utils';
import { normalizeSymbol, symbolsMatch } from '@core/utils';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class PeronMT5Connector implements IMT5Connector {
  public readonly name = 'peron';
  private pythonProcess: ChildProcess | null = null;
  private bridgeUrl: string;
  private pollIntervalTimer: NodeJS.Timeout | null = null;
  private status: ConnectionStatus = {
    connected: false,
    provider: 'peron',
    engine: 'peron_python_bridge',
    isNative: false,
    server: '',
    lastPingMs: 0,
    message: 'Initializing Peron MT5 Connector',
  };
  private onSyncCallback?: (data: {
    account: AccountInfo;
    positions: Position[];
    pendingOrders: PendingOrder[];
    ticks: TickData[];
    symbols: DetailedSymbolInfo[];
  }) => void;

  private lastSymbolsFetchTime: number = 0;
  private cachedSymbols: DetailedSymbolInfo[] = [];
  private cachedAccount: AccountInfo | null = null;
  private cachedPositions: Position[] = [];
  private cachedOrders: PendingOrder[] = [];
  private cachedTicks: TickData[] = [];
  private consecutiveErrors: number = 0;
  private lastAutoConnectAttemptTime: number = 0;

  constructor(
    private port: number = defaultMT5Config.peronBridgePort,
    private host: string = defaultMT5Config.peronBridgeHost
  ) {
    this.bridgeUrl = `http://${this.host}:${this.port}`;
  }

  public setOnSyncCallback(
    cb: (data: {
      account: AccountInfo;
      positions: Position[];
      pendingOrders: PendingOrder[];
      ticks: TickData[];
      symbols: DetailedSymbolInfo[];
    }) => void
  ) {
    this.onSyncCallback = cb;
  }

  public async initialize(): Promise<boolean> {
    logger.info('PeronConnector', `Initializing connection to Peron MT5 Bridge at ${this.bridgeUrl}`);

    // Check if bridge is already running
    let running = await this.pingBridge();
    if (!running && defaultMT5Config.autoStartBridge) {
      await this.startPythonBridgeProcess();
      // Wait up to 4 seconds for bridge to respond
      for (let i = 0; i < 8; i++) {
        await new Promise((r) => setTimeout(r, 500));
        if (await this.pingBridge()) break;
      }
    }

    running = await this.pingBridge();
    if (running) {
      // Trigger auto-connect to the local MT5 terminal via the Python bridge
      await this.autoConnectToMT5();
      this.startContinuousSync();
      logger.info('PeronConnector', 'Peron MT5 Bridge online and streaming market data');
    } else {
      logger.warn('PeronConnector', 'Could not reach Peron MT5 Bridge yet. Periodic retry active.');
      this.startContinuousSync();
    }
    return running;
  }

  /**
   * Tell the Python bridge to connect to the local MetaTrader 5 terminal.
   * Uses credentials from env vars (MT5_LOGIN, MT5_PASSWORD, MT5_SERVER) if set,
   * otherwise just calls mt5.initialize() to attach to the already-running terminal.
   */
  private async autoConnectToMT5(): Promise<void> {
    try {
      const payload: Record<string, any> = {};
      if (defaultMT5Config.login) payload.login = defaultMT5Config.login;
      if (defaultMT5Config.password) payload.password = defaultMT5Config.password;
      if (defaultMT5Config.server) payload.server = defaultMT5Config.server;

      const res = await fetch(`${this.bridgeUrl}/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      });
      const data = (await res.json()) as any;
      if (data.success) {
        this.status.connected = true;
        this.status.terminalConnected = true;
        this.status.message = 'Connected to MetaTrader 5 Terminal';
        logger.info('PeronConnector', `Auto-connected to MT5: ${data.message}`);
      } else {
        logger.warn('PeronConnector', `MT5 auto-connect returned: ${data.message}`);
      }
    } catch (err: any) {
      logger.warn('PeronConnector', `MT5 auto-connect request failed: ${err.message}`);
    }
  }

  public async shutdown(): Promise<void> {
    if (this.pollIntervalTimer) {
      clearInterval(this.pollIntervalTimer);
      this.pollIntervalTimer = null;
    }
    if (this.pythonProcess) {
      this.pythonProcess.kill('SIGTERM');
      this.pythonProcess = null;
    }
    this.status.connected = false;
  }

  public getStatus(): ConnectionStatus {
    return { ...this.status };
  }

  private async pingBridge(): Promise<boolean> {
    try {
      const res = await fetch(`${this.bridgeUrl}/health`, {
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) {
        const data = (await res.json()) as any;
        this.status.connected = Boolean(data.connected);
        this.status.terminalConnected = Boolean(data.terminalConnected);
        this.status.packageAvailable = Boolean(data.packageAvailable);
        this.status.packageVersion = data.packageVersion || '5.0.6231';
        this.status.engine = data.engine || 'peron_mt5';
        this.status.isNative = Boolean(data.isNative);
        this.status.lastPingMs = Date.now();
        this.status.server = data.account?.server || '';
        this.status.login = data.account?.login || 0;
        this.status.message = data.message || (
          data.connected
            ? 'Connected to MetaTrader 5 Terminal'
            : 'Awaiting MetaTrader 5 Terminal (Launch MT5 app to connect)'
        );
        return true;
      }
    } catch {
      // Bridge not reachable
    }
    this.status.connected = false;
    this.status.terminalConnected = false;
    this.status.message = 'Peron Python Bridge offline or unreachable';
    return false;
  }

  private async startPythonBridgeProcess(): Promise<void> {
    try {
      const candidates = [
        path.resolve(__dirname, '../../scripts/peron_bridge.py'),
        path.resolve(__dirname, '../../../scripts/peron_bridge.py'),
        path.resolve(process.cwd(), 'backend/src/scripts/peron_bridge.py'),
        path.resolve(process.cwd(), 'backend/scripts/peron_bridge.py'),
      ];
      const scriptPath = candidates.find((p) => fs.existsSync(p));
      if (!scriptPath) {
        logger.warn('PeronConnector', 'peron_bridge.py script not found, running in standalone mode');
        return;
      }

      const pythonExec = process.env.PYTHON_PATH || 'python3';
      logger.info('PeronConnector', `Spawning Python Peron Bridge: ${pythonExec} ${scriptPath}`);

      this.pythonProcess = spawn(pythonExec, [scriptPath], {
        env: {
          ...process.env,
          PERON_PORT: String(this.port),
          PERON_HOST: this.host,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      this.pythonProcess.on('error', (err: any) => {
        logger.warn('PeronConnector', `Python bridge process notice: ${err.message}. Standalone bridge mode active.`);
        this.pythonProcess = null;
      });

      this.pythonProcess.stdout?.on('data', (d) => {
        logger.debug('PeronPythonOut', d.toString().trim());
      });

      this.pythonProcess.stderr?.on('data', (d) => {
        logger.warn('PeronPythonErr', d.toString().trim());
      });

      this.pythonProcess.on('exit', (code) => {
        if (code !== 0 && code !== null) {
          logger.warn('PeronConnector', `Python Peron Bridge exited with code ${code}`);
        }
        this.pythonProcess = null;
      });
    } catch (err: any) {
      logger.warn('PeronConnector', `Notice during bridge spawn: ${err.message}`);
    }
  }

  private startContinuousSync(): void {
    if (this.pollIntervalTimer) return;
    this.pollIntervalTimer = setInterval(async () => {
      await this.syncCycle();
    }, defaultMT5Config.pollIntervalMs);
  }

  private async syncCycle(): Promise<void> {
    try {
      const now = Date.now();
      const shouldFetchSymbols = this.cachedSymbols.length === 0 || now - this.lastSymbolsFetchTime > 30000;

      const fetchPromises: Promise<any>[] = [
        fetch(`${this.bridgeUrl}/account`, { signal: AbortSignal.timeout(2500) }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch(`${this.bridgeUrl}/positions`, { signal: AbortSignal.timeout(2500) }).then((r) => (r.ok ? r.json() : [])).catch(() => []),
        fetch(`${this.bridgeUrl}/orders`, { signal: AbortSignal.timeout(2500) }).then((r) => (r.ok ? r.json() : [])).catch(() => []),
        fetch(`${this.bridgeUrl}/ticks`, { signal: AbortSignal.timeout(2500) }).then((r) => (r.ok ? r.json() : [])).catch(() => []),
      ];

      if (shouldFetchSymbols) {
        fetchPromises.push(
          fetch(`${this.bridgeUrl}/symbols`, { signal: AbortSignal.timeout(3000) }).then((r) => (r.ok ? r.json() : [])).catch(() => [])
        );
      }

      const results = await Promise.all(fetchPromises);
      const rawAccount = results[0] as AccountInfo | null;
      const positions = (results[1] || []) as Position[];
      const pendingOrders = (results[2] || []) as PendingOrder[];
      const rawTicks = (results[3] || []) as any[];

      if (shouldFetchSymbols && results[4]) {
        const rawSymbols = results[4] as any[];
        if (Array.isArray(rawSymbols) && rawSymbols.length > 0) {
          this.cachedSymbols = this.normalizeSymbols(rawSymbols);
          this.lastSymbolsFetchTime = now;
        }
      }

      const isTerminalConnected = Boolean(rawAccount && rawAccount.login > 0);
      this.status.connected = isTerminalConnected;
      this.status.terminalConnected = isTerminalConnected;
      this.status.lastPingMs = Date.now();
      this.consecutiveErrors = 0;

      if (rawAccount?.server) this.status.server = rawAccount.server;
      if (rawAccount?.login) this.status.login = rawAccount.login;

      const ticks = isTerminalConnected ? this.normalizeTicks(rawTicks) : [];
      const symbols = isTerminalConnected ? this.cachedSymbols : [];

      // Auto-connect to MT5 periodically if the bridge is up but terminal isn't connected yet
      if (!isTerminalConnected && now - this.lastAutoConnectAttemptTime > 20000) {
        this.lastAutoConnectAttemptTime = now;
        await this.autoConnectToMT5();
      }

      if (this.onSyncCallback) {
        this.onSyncCallback({
          account: rawAccount || {
            login: 0,
            tradeMode: 'NOT_CONNECTED',
            balance: 0,
            equity: 0,
            margin: 0,
            freeMargin: 0,
            marginLevel: 0,
            leverage: 0,
            currency: 'USD',
            server: 'Awaiting MT5 Terminal',
            company: 'MetaTrader 5',
            profit: 0,
            lastUpdate: Date.now(),
          },
          positions: isTerminalConnected && Array.isArray(positions) ? positions : [],
          pendingOrders: isTerminalConnected && Array.isArray(pendingOrders) ? pendingOrders : [],
          ticks,
          symbols,
        });
      }
    } catch {
      this.consecutiveErrors++;
      if (this.consecutiveErrors > 3) {
        this.status.connected = false;
        this.status.terminalConnected = false;
      }
    }
  }

  private normalizeTicks(raw: any[]): TickData[] {
    if (!Array.isArray(raw)) return [];
    return raw.map((t) => {
      const bid = Number(t.bid) || 0;
      const ask = Number(t.ask) || 0;
      const spread = t.spread != null ? Number(t.spread) : (ask && bid ? Math.round((ask - bid) * 100000) : 10);
      return {
        symbol: t.symbol || 'EURUSD',
        time: Number(t.time) || Math.floor(Date.now() / 1000),
        bid,
        ask,
        spread,
        last: Number(t.last ?? bid) || 0,
        volume: Number(t.volume) || 1,
        high24h: Number(t.high24h ?? ask) || 0,
        low24h: Number(t.low24h ?? bid) || 0,
      };
    });
  }

  private normalizeSymbols(raw: any[]): DetailedSymbolInfo[] {
    if (!Array.isArray(raw)) return [];
    return raw.map((s) => {
      const digits = Number(s.digits ?? 5);
      const point = Number(s.point ?? Math.pow(10, -digits));
      return {
        symbol: s.symbol,
        digits,
        point,
        spread: Number(s.spread ?? 10),
        bid: Number(s.bid ?? 0),
        ask: Number(s.ask ?? 0),
        minLot: Number(s.minLot ?? s.volumeMin ?? 0.01),
        maxLot: Number(s.maxLot ?? s.volumeMax ?? 100.0),
        lotStep: Number(s.lotStep ?? s.volumeStep ?? 0.01),
        contractSize: Number(s.contractSize ?? 100000),
        tradeAllowed: s.tradeAllowed !== undefined ? Boolean(s.tradeAllowed) : true,
        description: s.description || s.symbol,
        high24h: s.high24h != null ? Number(s.high24h) : undefined,
        low24h: s.low24h != null ? Number(s.low24h) : undefined,
      };
    });
  }

  public async connect(params?: ConnectParams): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch(`${this.bridgeUrl}/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params || {}),
      });
      const data = (await res.json()) as any;
      if (data.success) {
        await this.syncCycle();
      }
      return { success: Boolean(data.success), message: data.message || 'Connect response' };
    } catch (err: any) {
      return { success: false, message: `Failed to connect via Peron: ${err.message}` };
    }
  }

  public async disconnect(): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch(`${this.bridgeUrl}/disconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = (await res.json()) as any;
      this.status.connected = false;
      return { success: Boolean(data.success), message: data.message || 'Disconnected' };
    } catch (err: any) {
      return { success: false, message: `Failed to disconnect: ${err.message}` };
    }
  }

  public async getAccountInfo(): Promise<AccountInfo | null> {
    try {
      const res = await fetch(`${this.bridgeUrl}/account`);
      if (res.ok) return (await res.json()) as AccountInfo;
    } catch {}
    return null;
  }

  public async getTerminalInfo(): Promise<any> {
    try {
      const res = await fetch(`${this.bridgeUrl}/terminal`);
      if (res.ok) return await res.json();
    } catch {}
    return null;
  }

  public async getSymbols(): Promise<DetailedSymbolInfo[]> {
    try {
      const res = await fetch(`${this.bridgeUrl}/symbols`);
      if (res.ok) {
        const raw = (await res.json()) as any[];
        return this.normalizeSymbols(raw);
      }
    } catch {}
    return [];
  }

  public async getSymbolInfo(symbol: string): Promise<DetailedSymbolInfo | null> {
    const list = await this.getSymbols();
    return list.find((s) => symbolsMatch(s.symbol, symbol)) || null;
  }

  public async getTicks(symbols?: string[]): Promise<TickData[]> {
    try {
      const qs = symbols && symbols.length ? `?symbols=${encodeURIComponent(symbols.join(','))}` : '';
      const res = await fetch(`${this.bridgeUrl}/ticks${qs}`);
      if (res.ok) {
        const raw = (await res.json()) as any[];
        return this.normalizeTicks(raw);
      }
    } catch {}
    return [];
  }

  public async getCandles(symbol: string, timeframe: string, count: number): Promise<CandleData[]> {
    try {
      const normSym = normalizeSymbol(symbol);
      const res = await fetch(
        `${this.bridgeUrl}/candles?symbol=${encodeURIComponent(normSym)}&timeframe=${encodeURIComponent(timeframe)}&count=${count}`
      );
      if (res.ok) return (await res.json()) as CandleData[];
    } catch {}
    return [];
  }

  public async getPositions(symbol?: string): Promise<Position[]> {
    try {
      const qs = symbol ? `?symbol=${encodeURIComponent(normalizeSymbol(symbol))}` : '';
      const res = await fetch(`${this.bridgeUrl}/positions${qs}`);
      if (res.ok) return (await res.json()) as Position[];
    } catch {}
    return [];
  }

  public async getOrders(symbol?: string): Promise<PendingOrder[]> {
    try {
      const qs = symbol ? `?symbol=${encodeURIComponent(normalizeSymbol(symbol))}` : '';
      const res = await fetch(`${this.bridgeUrl}/orders${qs}`);
      if (res.ok) return (await res.json()) as PendingOrder[];
    } catch {}
    return [];
  }

  public async executeOrder(cmd: TradeCommand): Promise<ExecutionResult> {
    try {
      const res = await fetch(`${this.bridgeUrl}/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: normalizeSymbol(cmd.symbol),
          orderType: cmd.orderType,
          volume: cmd.volume,
          sl: cmd.sl,
          tp: cmd.tp,
          price: cmd.price,
          comment: cmd.comment || 'Peron_UI',
          magic: cmd.magic,
        }),
      });
      const data = (await res.json()) as ExecutionResult;
      // Trigger sync immediately to pick up new position
      setTimeout(() => this.syncCycle(), 100);
      return data;
    } catch (err: any) {
      return { success: false, message: `Execution failed: ${err.message}` };
    }
  }

  public async closePosition(ticket: number, volume?: number): Promise<ExecutionResult> {
    try {
      const res = await fetch(`${this.bridgeUrl}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket, volume }),
      });
      const data = (await res.json()) as ExecutionResult;
      setTimeout(() => this.syncCycle(), 100);
      return data;
    } catch (err: any) {
      return { success: false, message: `Close position failed: ${err.message}` };
    }
  }

  public async modifyPosition(ticket: number, sl?: number, tp?: number): Promise<ExecutionResult> {
    try {
      const res = await fetch(`${this.bridgeUrl}/modify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket, sl, tp }),
      });
      const data = (await res.json()) as ExecutionResult;
      setTimeout(() => this.syncCycle(), 100);
      return data;
    } catch (err: any) {
      return { success: false, message: `Modify position failed: ${err.message}` };
    }
  }

  public async modifyOrder(ticket: number, price?: number, sl?: number, tp?: number): Promise<ExecutionResult> {
    try {
      const res = await fetch(`${this.bridgeUrl}/order/modify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket, price, sl, tp }),
      });
      const data = (await res.json()) as ExecutionResult;
      setTimeout(() => this.syncCycle(), 100);
      return data;
    } catch (err: any) {
      return { success: false, message: `Modify order failed: ${err.message}` };
    }
  }

  public async cancelOrder(ticket: number): Promise<ExecutionResult> {
    try {
      const res = await fetch(`${this.bridgeUrl}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket }),
      });
      const data = (await res.json()) as ExecutionResult;
      setTimeout(() => this.syncCycle(), 100);
      return data;
    } catch (err: any) {
      return { success: false, message: `Cancel order failed: ${err.message}` };
    }
  }

  public async getHistoryDeals(params?: { dateFrom?: number; dateTo?: number; count?: number }): Promise<HistoryDeal[]> {
    try {
      const qs = new URLSearchParams();
      if (params?.dateFrom) qs.set('from', String(params.dateFrom));
      if (params?.dateTo) qs.set('to', String(params.dateTo));
      if (params?.count) qs.set('count', String(params.count));
      const res = await fetch(`${this.bridgeUrl}/history/deals?${qs.toString()}`);
      if (res.ok) return (await res.json()) as HistoryDeal[];
    } catch {}
    return [];
  }

  public async getHistoryOrders(params?: { dateFrom?: number; dateTo?: number; count?: number }): Promise<HistoryOrder[]> {
    try {
      const qs = new URLSearchParams();
      if (params?.dateFrom) qs.set('from', String(params.dateFrom));
      if (params?.dateTo) qs.set('to', String(params.dateTo));
      if (params?.count) qs.set('count', String(params.count));
      const res = await fetch(`${this.bridgeUrl}/history/orders?${qs.toString()}`);
      if (res.ok) return (await res.json()) as HistoryOrder[];
    } catch {}
    return [];
  }

  public async calcMargin(orderType: string, symbol: string, volume: number, price?: number): Promise<MarginCalcResult> {
    try {
      const res = await fetch(`${this.bridgeUrl}/calc/margin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: orderType, symbol: normalizeSymbol(symbol), volume, price }),
      });
      if (res.ok) return (await res.json()) as MarginCalcResult;
    } catch (err: any) {
      return { success: false, margin: 0, currency: 'USD', message: err.message };
    }
    return { success: false, margin: 0, currency: 'USD', message: 'Failed to calculate margin' };
  }

  public async calcProfit(orderType: string, symbol: string, volume: number, priceOpen: number, priceClose: number): Promise<ProfitCalcResult> {
    try {
      const res = await fetch(`${this.bridgeUrl}/calc/profit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: orderType, symbol: normalizeSymbol(symbol), volume, priceOpen, priceClose }),
      });
      if (res.ok) return (await res.json()) as ProfitCalcResult;
    } catch (err: any) {
      return { success: false, profit: 0, currency: 'USD', message: err.message };
    }
    return { success: false, profit: 0, currency: 'USD', message: 'Failed to calculate profit' };
  }

  public async checkOrder(cmd: Partial<TradeCommand>): Promise<OrderCheckResult> {
    try {
      const res = await fetch(`${this.bridgeUrl}/order/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: normalizeSymbol(cmd.symbol),
          orderType: cmd.orderType || 'BUY',
          volume: cmd.volume || 0.1,
          price: cmd.price,
        }),
      });
      return (await res.json()) as OrderCheckResult;
    } catch (err: any) {
      return { feasible: false, message: `Pre-check failed: ${err.message}` };
    }
  }

  public async getMarketDepth(symbol: string): Promise<{ bids: any[]; asks: any[] }> {
    try {
      const res = await fetch(`${this.bridgeUrl}/depth?symbol=${encodeURIComponent(normalizeSymbol(symbol))}`);
      if (res.ok) return await res.json();
    } catch {}
    return { bids: [], asks: [] };
  }

  public async getDetailedSymbol(symbol: string): Promise<DetailedSymbolInfo | null> {
    try {
      const res = await fetch(`${this.bridgeUrl}/symbol/info?symbol=${encodeURIComponent(normalizeSymbol(symbol))}`);
      if (res.ok) return (await res.json()) as DetailedSymbolInfo;
    } catch {}
    return this.getSymbolInfo(symbol);
  }
}
