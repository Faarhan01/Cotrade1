import React, { useState, useEffect } from 'react';
import { AppState } from '../../types';
import { connectionApi } from '../../services/api/connectionApi';
import {
  Radio,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Copy,
  Check,
  Terminal,
  Activity,
  Layers,
  Settings,
  Cpu,
  Server,
  Zap,
} from 'lucide-react';

interface EaConnectionRadarProps {
  state: AppState | null;
  onRefresh?: () => void;
}

export const EaConnectionRadar: React.FC<EaConnectionRadarProps> = ({ state, onRefresh }) => {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [isPinging, setIsPinging] = useState(false);
  const [engineStatus, setEngineStatus] = useState<any>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configForm, setConfigForm] = useState({
    login: '',
    password: '',
    server: '',
    path: '',
    provider: 'peron',
  });
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const isConnected = Boolean(
    state?.connection.isEaConnected &&
    state?.account.login &&
    state?.account.login > 0 &&
    engineStatus?.terminalConnected
  );
  const lastSync = state?.connection.lastEaSync ?? 0;
  const terminalName = state?.connection.terminalName || 'MetaTrader 5';
  const terminalCompany = state?.connection.terminalCompany || state?.account.company || 'MetaQuotes / Broker';
  const chartSymbol = state?.connection.chartSymbol;
  const chartTimeframe = state?.connection.chartTimeframe;

  const fetchStatus = async () => {
    try {
      const res = await connectionApi.getStatus();
      setEngineStatus(res);
      if (res.login && !configForm.login) {
        setConfigForm((prev) => ({
          ...prev,
          login: String(res.login),
          server: res.server || '',
          provider: res.provider || 'peron',
        }));
      }
    } catch {}
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleTestPing = async () => {
    try {
      setIsPinging(true);
      const res = await connectionApi.pingHealth('/health');
      if (res.ok) {
        setStatusMessage({ text: `Peron Bridge active (${res.latencyMs}ms latency)`, type: 'success' });
      } else {
        setStatusMessage({ text: 'Bridge connection failed', type: 'error' });
      }
      await fetchStatus();
      onRefresh?.();
    } catch {
      setStatusMessage({ text: 'Could not contact bridge', type: 'error' });
    } finally {
      setIsPinging(false);
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsPinging(true);
      const res = await connectionApi.connect({
        login: configForm.login ? Number(configForm.login) : undefined,
        password: configForm.password || undefined,
        server: configForm.server || undefined,
        path: configForm.path || undefined,
      });
      if (res.success) {
        setStatusMessage({ text: res.message || 'Connected to MT5 successfully', type: 'success' });
        setShowConfigModal(false);
        await fetchStatus();
        onRefresh?.();
      } else {
        setStatusMessage({ text: res.message || 'Connection failed', type: 'error' });
      }
    } catch (err: any) {
      setStatusMessage({ text: `Connection error: ${err.message}`, type: 'error' });
    } finally {
      setIsPinging(false);
      setTimeout(() => setStatusMessage(null), 4000);
    }
  };

  const handleSwitchProvider = async (provider: string) => {
    try {
      setIsPinging(true);
      const res = await connectionApi.switchProvider(provider);
      if (res.success) {
        setStatusMessage({ text: `Switched provider to ${provider}`, type: 'success' });
        await fetchStatus();
        onRefresh?.();
      }
    } catch (err: any) {
      setStatusMessage({ text: `Provider switch error: ${err.message}`, type: 'error' });
    } finally {
      setIsPinging(false);
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  const elapsedSeconds = lastSync > 0 ? Math.max(0, Math.round((Date.now() - lastSync) / 1000)) : 0;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm space-y-3 font-mono">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <span
              className={`h-3.5 w-3.5 rounded-full block ${
                isConnected ? 'bg-emerald-400 animate-ping absolute inset-0' : 'bg-cyan-400'
              }`}
            />
            <span
              className={`h-3.5 w-3.5 rounded-full block relative ${
                isConnected ? 'bg-emerald-400' : 'bg-cyan-400'
              }`}
            />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-extrabold text-sm text-white uppercase tracking-wider">
                {isConnected ? 'MetaTrader 5 Terminal Online' : 'MT5 Terminal Disconnected'}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                Peron MT5 v5.0
              </span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded border ${
                  isConnected
                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                    : 'bg-amber-950/60 text-amber-300 border-amber-800/60'
                }`}
              >
                {isConnected ? 'Live Real Broker Feed' : 'Awaiting Local MT5 App'}
              </span>
              {isConnected && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  {elapsedSeconds === 0 ? '< 1s sync' : `${elapsedSeconds}s ago`}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {isConnected ? (
                <>
                  Server: <strong className="text-cyan-300">{state?.account.server || engineStatus?.server}</strong> • Login:{' '}
                  <strong className="text-slate-200">#{state?.account.login}</strong>
                  {chartSymbol && (
                    <span>
                      {' '}• Active Chart: <strong className="text-emerald-400">{chartSymbol} {chartTimeframe}</strong>
                    </span>
                  )}
                </>
              ) : (
                <span className="text-slate-400">
                  Peron Python package is loaded. Open your local MetaTrader 5 application to stream live market specifications and execute real trades.
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setShowConfigModal(true)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 flex items-center gap-1.5 transition-colors"
          >
            <Settings className="h-3.5 w-3.5 text-cyan-400" />
            <span>Connection Settings</span>
          </button>

          <button
            onClick={handleTestPing}
            disabled={isPinging}
            className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isPinging ? 'animate-spin' : ''}`} />
            <span>Test Ping</span>
          </button>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`text-xs px-3 py-1.5 rounded-lg border flex items-center gap-2 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
              : 'bg-rose-950/60 border-rose-800 text-rose-300'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
          ) : (
            <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Connection Config Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">MT5 Connection Configuration</h3>
              </div>
              <button
                onClick={() => setShowConfigModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ×
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Cotrade connects directly to MetaTrader 5 via the Python package (<code className="text-cyan-300">Faarhan01/peron</code>).
              Enter your broker account details to connect or switch providers.
            </p>

            <form onSubmit={handleConnect} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Account Login #</label>
                <input
                  type="text"
                  value={configForm.login}
                  onChange={(e) => setConfigForm({ ...configForm, login: e.target.value })}
                  placeholder="e.g. 8849102"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Account Password</label>
                <input
                  type="password"
                  value={configForm.password}
                  onChange={(e) => setConfigForm({ ...configForm, password: e.target.value })}
                  placeholder="Broker account password"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Server Name</label>
                <input
                  type="text"
                  value={configForm.server}
                  onChange={(e) => setConfigForm({ ...configForm, server: e.target.value })}
                  placeholder="e.g. MetaQuotes-Demo or Broker-Live"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">MT5 Terminal Path (Optional on Windows)</label>
                <input
                  type="text"
                  value={configForm.path}
                  onChange={(e) => setConfigForm({ ...configForm, path: e.target.value })}
                  placeholder="C:\Program Files\MetaTrader 5\terminal64.exe"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:border-cyan-500 focus:outline-none text-[11px]"
                />
              </div>

              <div className="pt-2 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="px-3 py-2 rounded-lg bg-slate-800 text-slate-300 font-bold hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPinging}
                  className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold flex items-center gap-1.5"
                >
                  {isPinging ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                  <span>Save & Connect</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
