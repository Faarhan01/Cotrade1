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
  FileCode2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { api } from '../../lib/api';

export const MT5GatewayPage: React.FC = () => {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showLegacyEa, setShowLegacyEa] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

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
      const res = await api.getConnectionStatus();
      setStatus(res);
    } catch (err) {
      console.error('Failed to get connection status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 4000);
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

  const pythonBridgeRunCmd = `python3 backend/src/scripts/peron_bridge.py`;
  const pipInstallCmd = `pip install MetaTrader5 requests`;

  const pythonTestScript = `import MetaTrader5 as mt5

if not mt5.initialize():
    print("Failed to initialize MT5:", mt5.last_error())
else:
    info = mt5.terminal_info()
    print("Connected to:", info.name, "Build:", info.build)
    acc = mt5.account_info()
    if acc:
        print("Login:", acc.login, "Balance:", acc.balance, acc.currency)
    mt5.shutdown()`;

  const isConnected = status?.connected || status?.terminalConnected || false;

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
              <h1 className="text-xl font-bold text-white tracking-tight">MetaTrader 5 Direct Terminal Gateway</h1>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full border uppercase font-bold ${
                  isConnected
                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                    : 'bg-amber-950/80 text-amber-300 border-amber-700'
                }`}
              >
                {isConnected ? 'TERMINAL CONNECTED' : 'AWAITING TERMINAL'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Direct connection via official <code className="text-cyan-400 font-mono">MetaTrader5</code> Python package. No Expert Advisor (EA) required.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
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
              <span>Refresh Status</span>
            </button>
          )}
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
          <div className="text-xs text-slate-400 mb-1">Bridge Provider</div>
          <div className="text-base font-bold font-mono text-cyan-400 flex items-center gap-2">
            <Cpu className="h-4 w-4" />
            <span>Peron MT5 Python Package</span>
          </div>
          <div className="text-[11px] text-slate-500 font-mono mt-1">
            Engine: {status?.engine || 'peron_mt5'}
          </div>
        </div>

        <div className="terminal-card p-4">
          <div className="text-xs text-slate-400 mb-1">MetaTrader 5 Package</div>
          <div className="text-base font-bold font-mono text-white flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span>v{status?.packageVersion || '5.0.6231'}</span>
          </div>
          <div className="text-[11px] text-slate-500 font-mono mt-1">
            Official MetaTrader5 library
          </div>
        </div>

        <div className="terminal-card p-4">
          <div className="text-xs text-slate-400 mb-1">Terminal Handshake</div>
          <div className="text-base font-bold font-mono text-white truncate">
            {status?.terminal?.name || (isConnected ? 'MetaTrader 5' : 'Desktop Standby')}
          </div>
          <div className="text-[11px] text-slate-500 font-mono mt-1">
            Build: {status?.terminal?.build || (isConnected ? 'Latest' : 'Pending')}
          </div>
        </div>

        <div className="terminal-card p-4">
          <div className="text-xs text-slate-400 mb-1">Broker Account</div>
          <div className="text-base font-bold font-mono text-white">
            {status?.login ? `#${status.login}` : 'Not logged in'}
          </div>
          <div className="text-[11px] text-slate-500 font-mono mt-1 truncate">
            Server: {status?.server || 'Awaiting Terminal'}
          </div>
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
            If your MetaTrader 5 application is already logged in on your machine, leave credentials blank to auto-attach to the active session. Otherwise, specify credentials to authenticate automatically:
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
                2. Start MetaTrader 5 Desktop Application
              </div>
              <p className="text-[11px] text-slate-400">
                Launch your broker's MetaTrader 5 application on your computer and log in to your trading account. Ensure "Allow Algo Trading" is active in Tools &gt; Options &gt; Expert Advisors.
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

            {/* Step 4: Verification script */}
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80">
              <div className="flex items-center justify-between text-xs font-mono text-slate-300 font-bold mb-1">
                <span>Verification Python Script</span>
                <button
                  onClick={() => handleCopy(pythonTestScript, 'test-py')}
                  className="text-cyan-400 hover:text-cyan-300 text-[11px] flex items-center gap-1"
                >
                  {copiedId === 'test-py' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  <span>{copiedId === 'test-py' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="text-[10px] font-mono text-slate-400 bg-slate-900/60 p-2 rounded overflow-x-auto">
                {pythonTestScript}
              </pre>
            </div>
          </div>
        </div>
      </div>

      {/* Collapsible Legacy EA Section */}
      <div className="border border-slate-800/80 rounded-xl bg-slate-900/40 p-4">
        <button
          onClick={() => setShowLegacyEa(!showLegacyEa)}
          className="w-full flex items-center justify-between text-left text-xs font-mono text-slate-400 hover:text-slate-200"
        >
          <div className="flex items-center gap-2">
            <FileCode2 className="h-4 w-4 text-slate-500" />
            <span>Legacy Alternative: WebRequest Expert Advisor (Optional)</span>
          </div>
          {showLegacyEa ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>

        {showLegacyEa && (
          <div className="mt-4 pt-3 border-t border-slate-800/80 text-xs text-slate-400 space-y-2 font-mono">
            <p>
              If your environment cannot run Python locally, our platform also includes a fallback MQL5 EA located at <code className="text-cyan-400">backend/ea/AIMT5Bridge.mq5</code>.
            </p>
            <p>
              However, the direct Python <code className="text-cyan-400">MetaTrader5</code> package is the recommended, zero-lag standard.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
