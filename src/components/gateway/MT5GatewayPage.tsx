import React, { useState, useEffect } from 'react';
import {
  Laptop,
  Terminal,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  Cpu,
  Copy,
  Check,
  Zap,
  Activity,
  Layers,
  Shield,
  Search,
  Filter,
  BarChart3,
  XCircle,
  HelpCircle,
} from 'lucide-react';
import { api } from '../../lib/api';

export const MT5GatewayPage: React.FC = () => {
  const [status, setStatus] = useState<any>(null);
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [symbolGroups, setSymbolGroups] = useState<any>(null);
  const [selectedGroup, setSelectedGroup] = useState<string>('All');
  const [symbolSearch, setSymbolSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [performingBulk, setPerformingBulk] = useState(false);

  // Connection Credentials Form
  const [connForm, setConnForm] = useState({
    login: '',
    password: '',
    server: '',
    path: '',
  });

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const [statusRes, diagRes, groupsRes] = await Promise.allSettled([
        api.getConnectionStatus(),
        api.getGatewayDiagnostics(),
        api.getSymbolGroups(),
      ]);

      if (statusRes.status === 'fulfilled') setStatus(statusRes.value);
      if (diagRes.status === 'fulfilled' && diagRes.value?.success) setDiagnostics(diagRes.value);
      if (groupsRes.status === 'fulfilled' && groupsRes.value?.success) setSymbolGroups(groupsRes.value);
    } catch (err) {
      console.error('Failed to get connection status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionMessage(null);
      const params: any = {};
      if (connForm.login) params.login = parseInt(connForm.login, 10);
      if (connForm.password) params.password = connForm.password;
      if (connForm.server) params.server = connForm.server;
      if (connForm.path) params.path = connForm.path;

      const res = await api.connect(params);
      if (res?.success) {
        setActionMessage({ text: 'Connected to MetaTrader 5 terminal successfully!', type: 'success' });
      } else {
        setActionMessage({ text: res?.message || 'Connection attempt returned note', type: 'error' });
      }
      fetchStatus();
    } catch (err: any) {
      setActionMessage({ text: err?.message || 'Connection failed', type: 'error' });
    }
  };

  const handleDisconnect = async () => {
    try {
      await api.disconnect();
      setActionMessage({ text: 'Disconnected from MetaTrader 5 terminal', type: 'success' });
      fetchStatus();
    } catch (err: any) {
      setActionMessage({ text: err?.message || 'Disconnect failed', type: 'error' });
    }
  };

  const handleCloseAll = async () => {
    if (!window.confirm('Are you sure you want to close ALL open positions?')) return;
    try {
      setPerformingBulk(true);
      const res = await api.closeAllPositions();
      setActionMessage({
        text: `Liquidated ${res.closedCount || 0} position(s) successfully`,
        type: 'success',
      });
      fetchStatus();
    } catch (err: any) {
      setActionMessage({ text: err?.message || 'Failed to close all positions', type: 'error' });
    } finally {
      setPerformingBulk(false);
    }
  };

  const handleCancelAll = async () => {
    if (!window.confirm('Cancel all pending orders?')) return;
    try {
      setPerformingBulk(true);
      const res = await api.cancelAllOrders();
      setActionMessage({
        text: `Cancelled ${res.cancelledCount || 0} pending order(s)`,
        type: 'success',
      });
      fetchStatus();
    } catch (err: any) {
      setActionMessage({ text: err?.message || 'Failed to cancel orders', type: 'error' });
    } finally {
      setPerformingBulk(false);
    }
  };

  const pythonBridgeRunCmd = `python3 backend/src/gateway/mt5connector/scripts/peron_bridge.py`;
  const pipInstallCmd = `pip install MetaTrader5 requests`;

  const isConnected = status?.connected || status?.terminalConnected || false;

  // Flattened symbols for display
  const allSymbols = symbolGroups?.groups
    ? Object.entries(symbolGroups.groups).flatMap(([grp, list]: any) =>
        list.map((item: any) => ({ ...item, group: grp }))
      )
    : [];

  const filteredSymbols = allSymbols.filter((s: any) => {
    const matchGroup = selectedGroup === 'All' || s.group === selectedGroup;
    const matchSearch =
      !symbolSearch ||
      s.symbol.toLowerCase().includes(symbolSearch.toLowerCase()) ||
      (s.description && s.description.toLowerCase().includes(symbolSearch.toLowerCase()));
    return matchGroup && matchSearch;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-6 rounded-2xl shadow-sm">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-cyan-950/80 border border-cyan-700/60 flex items-center justify-center text-cyan-400 shadow-md">
            <Laptop className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-white tracking-tight">
                MetaTrader 5 Direct Terminal Gateway
              </h1>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full border uppercase font-bold ${
                  isConnected
                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                    : 'bg-amber-950/80 text-amber-300 border-amber-700'
                }`}
              >
                {isConnected ? 'TERMINAL CONNECTED' : 'STANDBY SANDBOX ACTIVE'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              High-performance direct gateway powered by the official Python{' '}
              <code className="text-cyan-400 font-mono">MetaTrader5</code> package. Real-time IPC streaming &amp; dual-mode execution.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isConnected ? (
            <button
              onClick={handleDisconnect}
              className="btn btn-secondary text-rose-400 border-rose-800 hover:bg-rose-950/40 text-xs"
            >
              Disconnect Terminal
            </button>
          ) : (
            <button
              onClick={fetchStatus}
              disabled={loading}
              className="btn btn-primary text-xs flex items-center gap-1.5"
            >
              <RotateCcw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Probe MT5</span>
            </button>
          )}

          <button
            onClick={handleCloseAll}
            disabled={performingBulk}
            className="btn btn-secondary text-xs text-rose-400 border-rose-900/60 hover:bg-rose-950/40 flex items-center gap-1"
            title="Liquidate all open positions immediately"
          >
            <XCircle className="h-3.5 w-3.5" />
            <span>Close All</span>
          </button>
        </div>
      </div>

      {actionMessage && (
        <div
          className={`p-3 rounded-lg border text-xs font-mono flex items-center gap-2 ${
            actionMessage.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
              : 'bg-rose-950/60 border-rose-800 text-rose-300'
          }`}
        >
          {actionMessage.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertTriangle className="h-4 w-4" />
          )}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* Terminal Diagnostics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="terminal-card p-4">
          <div className="text-xs text-slate-400 mb-1">Gateway Engine</div>
          <div className="text-base font-bold font-mono text-cyan-400 flex items-center gap-2">
            <Cpu className="h-4 w-4" />
            <span>MetaTrader5 Package</span>
          </div>
          <div className="text-[11px] text-slate-500 font-mono mt-1">
            Engine: {status?.engine || 'peron_mt5'} • IPC: Direct Memory
          </div>
        </div>

        <div className="terminal-card p-4">
          <div className="text-xs text-slate-400 mb-1">Package Availability</div>
          <div className="text-base font-bold font-mono text-white flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${
                diagnostics?.package?.installed || status?.packageAvailable ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            />
            <span>v{diagnostics?.package?.version || status?.packageVersion || '5.0.6231'}</span>
          </div>
          <div className="text-[11px] text-slate-500 font-mono mt-1 truncate">
            Python: {diagnostics?.package?.pythonVersion || 'Python 3'}
          </div>
        </div>

        <div className="terminal-card p-4">
          <div className="text-xs text-slate-400 mb-1">Terminal Handshake</div>
          <div className="text-base font-bold font-mono text-white truncate">
            {status?.terminal?.name || (isConnected ? 'MetaTrader 5' : 'Desktop Standby')}
          </div>
          <div className="text-[11px] text-slate-500 font-mono mt-1">
            Build: {status?.terminal?.build || (isConnected ? 'Active' : 'Awaiting App')}
          </div>
        </div>

        <div className="terminal-card p-4">
          <div className="text-xs text-slate-400 mb-1">Broker Account</div>
          <div className="text-base font-bold font-mono text-white">
            {status?.login ? `#${status.login}` : (isConnected ? 'Logged In' : 'Sandbox #88204192')}
          </div>
          <div className="text-[11px] text-slate-500 font-mono mt-1 truncate">
            Server: {status?.server || 'MetaTrader 5 Direct Sandbox'}
          </div>
        </div>
      </div>

      {/* Package Capabilities Badges */}
      <div className="terminal-card p-4">
        <div className="text-xs font-mono text-slate-400 mb-2 flex items-center justify-between">
          <span className="font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-cyan-400" />
            Direct MetaTrader 5 Package Capabilities
          </span>
          <span className="text-[11px] text-slate-500">
            {diagnostics?.package?.capabilities?.length || 13} capabilities active
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(
            diagnostics?.package?.capabilities || [
              'LIVE_TICK_STREAMING',
              'OHLCV_CANDLE_HISTORY',
              'LEVEL2_MARKET_DEPTH',
              'ACCOUNT_METRICS_SYNC',
              'POSITION_TRACKING',
              'PENDING_ORDER_MANAGEMENT',
              'HISTORICAL_DEALS_PULL',
              'HISTORICAL_ORDERS_PULL',
              'PRE_TRADE_MARGIN_CHECK',
              'PROFIT_PROJECTION_CALC',
              'DIRECT_ORDER_SEND',
              'SL_TP_MODIFICATION',
              'SUB_MILLISECOND_IPC',
            ]
          ).map((cap: string) => (
            <span
              key={cap}
              className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-cyan-300"
            >
              ✓ {cap.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      </div>

      {/* Main Connection Setup & Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Direct Connection Form */}
        <div className="terminal-card p-5 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="h-4 w-4 text-cyan-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Direct Terminal Auto-Connect
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            If your MetaTrader 5 desktop application is open and logged in, leave fields blank to auto-hook into the active session. Or provide credentials to authenticate directly:
          </p>

          <form onSubmit={handleConnect} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1">MT5 Login ID (optional)</label>
                <input
                  type="text"
                  placeholder="e.g. 10582910"
                  value={connForm.login}
                  onChange={(e) => setConnForm({ ...connForm, login: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1">Password (optional)</label>
                <input
                  type="password"
                  placeholder="Broker password"
                  value={connForm.password}
                  onChange={(e) => setConnForm({ ...connForm, password: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1">Broker Server (optional)</label>
                <input
                  type="text"
                  placeholder="e.g. MetaQuotes-Demo"
                  value={connForm.server}
                  onChange={(e) => setConnForm({ ...connForm, server: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1">Terminal Path (optional)</label>
                <input
                  type="text"
                  placeholder="C:\Program Files\MetaTrader 5\terminal64.exe"
                  value={connForm.path}
                  onChange={(e) => setConnForm({ ...connForm, path: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:border-cyan-500"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full btn btn-primary py-2 text-xs font-bold tracking-wider uppercase flex items-center justify-center gap-2 mt-2"
            >
              <Play className="h-3.5 w-3.5" />
              <span>Connect to MetaTrader 5 Terminal</span>
            </button>
          </form>

          <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800/80 text-[11px] font-mono text-slate-400 space-y-1.5">
            <div className="text-cyan-400 font-bold flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5" />
              <span>Zero-Lag Direct Process Memory Channel</span>
            </div>
            <p>
              By leveraging the Python MetaTrader 5 package, order execution and market tick streaming happen directly through inter-process shared memory at sub-millisecond speeds.
            </p>
          </div>
        </div>

        {/* Right Column: Setup Instructions & CLI Commands */}
        <div className="terminal-card p-5 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Terminal className="h-4 w-4 text-violet-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Local Machine Setup Steps
            </h2>
          </div>

          <div className="space-y-3">
            {/* Step 1 */}
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80">
              <div className="flex items-center justify-between text-xs font-mono text-slate-300 font-bold mb-1">
                <span>1. Install MetaTrader 5 Python Package</span>
                <button
                  onClick={() => handleCopy(pipInstallCmd, 'pip')}
                  className="text-cyan-400 hover:text-cyan-300 text-[11px] flex items-center gap-1"
                >
                  {copiedId === 'pip' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  <span>{copiedId === 'pip' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="text-[11px] font-mono text-cyan-300 bg-slate-900/60 p-2 rounded overflow-x-auto">
                {pipInstallCmd}
              </pre>
            </div>

            {/* Step 2 */}
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80">
              <div className="text-xs font-mono text-slate-300 font-bold mb-1">
                2. Open MetaTrader 5 Desktop Application
              </div>
              <p className="text-[11px] text-slate-400">
                Launch your MetaTrader 5 desktop application and log in to your trading account. Ensure "Allow Algo Trading" is enabled in Tools &gt; Options &gt; Expert Advisors.
              </p>
            </div>

            {/* Step 3 */}
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80">
              <div className="flex items-center justify-between text-xs font-mono text-slate-300 font-bold mb-1">
                <span>3. Start the High-Speed Python Bridge</span>
                <button
                  onClick={() => handleCopy(pythonBridgeRunCmd, 'bridge')}
                  className="text-cyan-400 hover:text-cyan-300 text-[11px] flex items-center gap-1"
                >
                  {copiedId === 'bridge' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  <span>{copiedId === 'bridge' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="text-[11px] font-mono text-cyan-300 bg-slate-900/60 p-2 rounded overflow-x-auto">
                {pythonBridgeRunCmd}
              </pre>
            </div>
          </div>
        </div>
      </div>

      {/* Symbol Specifications Explorer */}
      <div className="terminal-card p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-cyan-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Broker Symbol Specification Explorer
            </h2>
            <span className="text-[11px] font-mono text-slate-500">
              ({filteredSymbols.length} symbols)
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Group Filter Tabs */}
            {['All', 'Forex', 'Metals', 'Crypto', 'Indices'].map((grp) => (
              <button
                key={grp}
                onClick={() => setSelectedGroup(grp)}
                className={`text-[10px] font-mono px-2.5 py-1 rounded transition-colors ${
                  selectedGroup === grp
                    ? 'bg-cyan-500 text-slate-950 font-bold'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {grp}
              </button>
            ))}

            {/* Search Input */}
            <div className="relative">
              <Search className="h-3 w-3 text-slate-500 absolute left-2 top-2" />
              <input
                type="text"
                placeholder="Search symbol..."
                value={symbolSearch}
                onChange={(e) => setSymbolSearch(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg pl-7 pr-2.5 py-1 text-xs text-white font-mono uppercase focus:border-cyan-500 w-32"
              />
            </div>
          </div>
        </div>

        {/* Symbol Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[360px] overflow-y-auto pr-1">
          {filteredSymbols.length > 0 ? (
            filteredSymbols.map((s: any) => (
              <div
                key={s.symbol}
                className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 font-mono text-xs hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-white text-sm">{s.symbol}</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                      {s.group || 'Forex'}
                    </span>
                  </div>
                  <span className="text-[11px] text-cyan-400 font-bold">
                    Spread: {s.spread ?? 12} pts
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 truncate mb-2">
                  {s.description || s.symbol}
                </div>
                <div className="grid grid-cols-3 gap-1 text-[10px] text-slate-400 bg-slate-900/60 p-1.5 rounded">
                  <div>
                    <span className="text-slate-500 block">Digits</span>
                    <span className="text-white font-bold">{s.digits ?? 5}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Lot Step</span>
                    <span className="text-white font-bold">{s.lotStep ?? 0.01}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Min/Max</span>
                    <span className="text-white font-bold">{s.minLot ?? 0.01}-{s.maxLot ?? 100}</span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-3 text-center py-8 text-slate-500 font-mono text-xs">
              No symbols matching current filter.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
