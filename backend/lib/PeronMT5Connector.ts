import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  AccountInfo,
  CandleData,
  DetailedSymbolInfo,
  PendingOrder,
  Position,
  TickData,
  TradeCommand,
} from '../types/mt5.js';
import {
  ConnectParams,
  ConnectionStatus,
  ExecutionResult,
  IMT5Connector,
} from './mt5Provider.js';
import { defaultMT5Config } from '../config/mt5Config.js';
import { logger } from '../utils/logger.js';
import { normalizeSymbol, symbolsMatch } from '../utils/symbolUtils.js';

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
    const running = await this.pingBridge();
    if (!running && defaultMT5Config.autoStartBridge) {
      await this.startPythonBridgeProcess();
      // Wait up to 4 seconds for bridge to respond
      for (let i = 0; i < 8; i++) {
        await new Promise((r) => setTimeout(r, 500));
        if (await this.pingBridge()) break;
      }
    }

    const connected = await this.pingBridge();
    if (connected) {
      this.startContinuousSync();
      logger.info('PeronConnector', 'Peron MT5 Bridge online and streaming market data');
    } else {
      logger.warn('PeronConnector', 'Could not reach Peron MT5 Bridge yet. Periodic retry active.');
      this.startContinuousSync();
    }
    return connected;
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
      const scriptPath = path.resolve(__dirname, '../scripts/peron_bridge.py');
      logger.info('PeronConnector', `Spawning Python Peron Bridge: ${defaultMT5Config.pythonPath} ${scriptPath}`);

      this.pythonProcess = spawn(defaultMT5Config.pythonPath, [scriptPath], {
        env: {
          ...process.env,
          PERON_PORT: String(this.port),
          PERON_HOST: this.host,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      this.pythonProcess.stdout?.on('data', (d) => {
        logger.debug('PeronPythonOut', d.toString().trim());
      });

      this.pythonProcess.stderr?.on('data', (d) => {
        logger.warn('PeronPythonErr', d.toString().trim());
      });

      this.pythonProcess.on('exit', (code) => {
        logger.warn('PeronConnector', `Python Peron Bridge exited with code ${code}`);
        this.pythonProcess = null;
      });
    } catch (err: any) {
      logger.error('PeronConnector', `Failed to spawn Python Peron Bridge process: ${err.message}`);
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
      const [accRes, posRes, ordRes, ticksRes, symRes] = await Promise.all([
        fetch(`${this.bridgeUrl}/account`, { signal: AbortSignal.timeout(2000) }),
        fetch(`${this.bridgeUrl}/positions`, { signal: AbortSignal.timeout(2000) }),
        fetch(`${this.bridgeUrl}/orders`, { signal: AbortSignal.timeout(2000) }),
        fetch(`${this.bridgeUrl}/ticks`, { signal: AbortSignal.timeout(2000) }),
        fetch(`${this.bridgeUrl}/symbols`, { signal: AbortSignal.timeout(2000) }),
      ]);

      if (accRes.ok && posRes.ok && ordRes.ok && ticksRes.ok && symRes.ok) {
        const rawAccount = await accRes.json();
        const account = rawAccount as AccountInfo | null;
        const positions = (await posRes.json()) as Position[];
        const pendingOrders = (await ordRes.json()) as PendingOrder[];
        const rawTicks = (await ticksRes.json()) as any[];
        const rawSymbols = (await symRes.json()) as any[];

        const isTerminalConnected = Boolean(account && account.login > 0);
        this.status.connected = isTerminalConnected;
        this.status.terminalConnected = isTerminalConnected;
        this.status.lastPingMs = Date.now();
        if (account?.server) this.status.server = account.server;
        if (account?.login) this.status.login = account.login;

        const ticks = isTerminalConnected ? this.normalizeTicks(rawTicks) : [];
        const symbols = isTerminalConnected ? this.normalizeSymbols(rawSymbols) : [];

        if (this.onSyncCallback) {
          this.onSyncCallback({
            account: account || {
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
      }
    } catch {
      // Transient error or bridge restarting
      this.status.connected = false;
      this.status.terminalConnected = false;
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
}
