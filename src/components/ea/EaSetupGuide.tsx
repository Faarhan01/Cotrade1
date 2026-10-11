import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { connectionApi } from '../../services/api/connectionApi';
import {
  FileCode2,
  Download,
  Copy,
  Check,
  Globe,
  Radio,
  CheckCircle2,
  AlertTriangle,
  FolderOpen,
  Terminal,
  RefreshCw,
  ExternalLink,
  Cpu,
  Zap,
  Server,
  Layers,
} from 'lucide-react';

export const EaSetupGuide: React.FC = () => {
  const [eaCode, setEaCode] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedCli, setCopiedCli] = useState(false);
  const [pingResult, setPingResult] = useState<{ ok: boolean; latencyMs: number; data?: any } | null>(null);
  const [isPinging, setIsPinging] = useState(false);
  const [engineStatus, setEngineStatus] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'peron' | 'ea'>('peron');

  useEffect(() => {
    async function loadData() {
      try {
        const [eaRes, statusRes] = await Promise.all([
          api.getEaCode(),
          connectionApi.getStatus(),
        ]);
        if (eaRes.code) setEaCode(eaRes.code);
        setEngineStatus(statusRes);
      } catch (e) {
        console.error('Failed to load connection data:', e);
      }
    }
    loadData();
    handlePingTest();
  }, []);

  const handleCopyCode = () => {
    if (!eaCode) return;
    navigator.clipboard.writeText(eaCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleCopyCli = (cmd: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedCli(true);
    setTimeout(() => setCopiedCli(false), 2000);
  };

  const handlePingTest = async () => {
    setIsPinging(true);
    try {
      const [res, stat] = await Promise.all([
        api.checkBridgeHealth('/health'),
        connectionApi.getStatus(),
      ]);
      setPingResult(res);
      setEngineStatus(stat);
    } catch {
      setPingResult({ ok: false, latencyMs: 0 });
    } finally {
      setIsPinging(false);
    }
  };

  return (
    <div className="space-y-6 font-mono">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-cyan-950/40 to-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                <Zap className="h-5 w-5" />
              </span>
              <h1 className="text-xl font-extrabold text-white tracking-tight">
                MT5 Direct Python Connection (Faarhan01/peron)
              </h1>
            </div>
            <p className="text-xs text-slate-300 mt-2 max-w-3xl leading-relaxed">
              Cotrade connects directly to MetaTrader 5 via the Python package (from <code className="text-cyan-300">Faarhan01/peron</code>).
              The site executes trades, pulls multi-timeframe candles, streams real-time ticks, and controls risk without requiring an EA to be compiled or run.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('peron')}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'peron'
                  ? 'bg-cyan-600 text-white shadow'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Python Peron API
            </button>
            <button
              onClick={() => setActiveTab('ea')}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'ea'
                  ? 'bg-cyan-600 text-white shadow'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Legacy EA Bridge
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'peron' ? (
        <div className="space-y-6">
          {/* Peron Architecture Highlights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase">
                <Cpu className="h-4 w-4" />
                <span>Zero-EA Overhead</span>
              </div>
              <h4 className="text-sm font-bold text-white">Direct MetaTrader5 API</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Uses official Python MetaTrader5 C-bindings (<code className="text-cyan-300">initialize</code>, <code className="text-cyan-300">symbols_get</code>, <code className="text-cyan-300">order_send</code>) directly from backend services.
              </p>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase">
                <Layers className="h-4 w-4" />
                <span>As-Is Symbol Detection</span>
              </div>
              <h4 className="text-sm font-bold text-white">No Forced Uppercase</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Broker symbols (like <code className="text-emerald-300">EURUSD.m</code>, <code className="text-emerald-300">BTCUSD.raw</code>, <code className="text-emerald-300">us30</code>) are captured with exact broker naming and specifications.
              </p>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-purple-400 text-xs font-bold uppercase">
                <Server className="h-4 w-4" />
                <span>Modular Provider Layer</span>
              </div>
              <h4 className="text-sm font-bold text-white">Pluggable Connectors</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Backend is structured with <code className="text-purple-300">config</code>, <code className="text-purple-300">controllers</code>, <code className="text-purple-300">middleware</code>, and <code className="text-purple-300">lib</code>, allowing instant connector switching.
              </p>
            </div>
          </div>

          {/* Quick CLI Commands */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Python Runner & Diagnostics Commands
            </h3>
            <p className="text-xs text-slate-400">
              Run diagnostics or launch the bridge directly from the terminal:
            </p>

            <div className="space-y-2">
              <div className="flex items-center justify-between p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs">
                <span className="text-cyan-300">python3 backend/scripts/peron_runner.py check</span>
                <button
                  onClick={() => handleCopyCli('python3 backend/scripts/peron_runner.py check')}
                  className="text-slate-400 hover:text-white flex items-center gap-1 text-[11px]"
                >
                  {copiedCli ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  <span>Copy</span>
                </button>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs">
                <span className="text-cyan-300">python3 backend/scripts/peron_runner.py symbols</span>
                <button
                  onClick={() => handleCopyCli('python3 backend/scripts/peron_runner.py symbols')}
                  className="text-slate-400 hover:text-white flex items-center gap-1 text-[11px]"
                >
                  <Copy className="h-3 w-3" />
                  <span>Copy</span>
                </button>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs">
                <span className="text-cyan-300">python3 backend/scripts/peron_runner.py ticks</span>
                <button
                  onClick={() => handleCopyCli('python3 backend/scripts/peron_runner.py ticks')}
                  className="text-slate-400 hover:text-white flex items-center gap-1 text-[11px]"
                >
                  <Copy className="h-3 w-3" />
                  <span>Copy</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Step by Step Setup Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-wider">
                <span className="h-5 w-5 rounded-full bg-cyan-950 border border-cyan-800 flex items-center justify-center text-[11px]">
                  1
                </span>
                <span>Allow MT5 WebRequest</span>
              </div>
              <h3 className="text-sm font-bold text-white">Whitelist Bridge URL in MT5</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                MT5 restricts HTTP requests by default. Open MT5:
              </p>
              <div className="bg-slate-950 border border-slate-800 p-2.5 rounded-lg text-xs text-slate-300 space-y-1">
                <p>1. Menu: <strong className="text-white">Tools → Options</strong> (Ctrl+O)</p>
                <p>2. Tab: <strong className="text-white">Expert Advisors</strong></p>
                <p>3. Check: <strong className="text-emerald-400">Allow WebRequest for listed URL:</strong></p>
              </div>
              <div className="flex items-center justify-between p-2 bg-slate-950/90 border border-slate-800 rounded text-xs">
                <span className="text-cyan-400 font-bold truncate">http://127.0.0.1:7777</span>
                <button
                  onClick={() => handleCopyUrl('http://127.0.0.1:7777')}
                  className="text-slate-400 hover:text-white ml-2 flex items-center gap-1 text-[11px]"
                >
                  {copiedUrl ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                </button>
              </div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-wider">
                <span className="h-5 w-5 rounded-full bg-cyan-950 border border-cyan-800 flex items-center justify-center text-[11px]">
                  2
                </span>
                <span>Copy EA to MT5 Folder</span>
              </div>
              <h3 className="text-sm font-bold text-white">Paste into MQL5/Experts</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Save the file into your MetaTrader 5 directory:
              </p>
              <div className="bg-slate-950 border border-slate-800 p-2.5 rounded-lg text-xs text-slate-300 space-y-1">
                <p>1. Click <strong className="text-white">File → Open Data Folder</strong> in MT5</p>
                <p>2. Open <strong className="text-white">MQL5</strong> → <strong className="text-white">Experts</strong></p>
                <p>3. Copy <code className="text-cyan-400">AIMT5Bridge.mq5</code> there</p>
              </div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-wider">
                <span className="h-5 w-5 rounded-full bg-cyan-950 border border-cyan-800 flex items-center justify-center text-[11px]">
                  3
                </span>
                <span>Attach EA & Enable Trading</span>
              </div>
              <h3 className="text-sm font-bold text-white">Attach to Any Active Chart</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Drag the EA onto your chart (e.g. EURUSD):
              </p>
              <div className="bg-slate-950 border border-slate-800 p-2.5 rounded-lg text-xs text-slate-300 space-y-1">
                <p>1. Ensure <strong className="text-emerald-400">Algo Trading</strong> is enabled</p>
                <p>2. Check "Allow Algo Trading" in EA properties</p>
                <p>3. Default URL: <code className="text-cyan-400">http://127.0.0.1:7777</code></p>
              </div>
            </div>
          </div>

          {/* Full MQL5 Source Code Viewer */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  backend/ea/AIMT5Bridge.mq5 Source Code
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyCode}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 flex items-center gap-1.5 transition-colors"
                >
                  {copiedCode ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedCode ? 'Copied!' : 'Copy Code'}</span>
                </button>
              </div>
            </div>

            <div className="relative">
              <pre className="bg-slate-950 border border-slate-800/90 rounded-lg p-4 text-xs text-slate-300 overflow-x-auto max-h-[350px] leading-relaxed selection:bg-cyan-900">
                {eaCode || '// Loading EA source code...'}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Diagnostics Panel */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Connection Diagnostics
            </h3>
          </div>
          <button
            onClick={handlePingTest}
            disabled={isPinging}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 flex items-center gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isPinging ? 'animate-spin' : ''}`} />
            <span>Refresh Ping</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
            <span className="text-[10px] text-slate-500 uppercase block">Provider</span>
            <span className="font-bold text-white">{engineStatus?.provider || 'peron'}</span>
          </div>
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
            <span className="text-[10px] text-slate-500 uppercase block">Engine Mode</span>
            <span className="font-bold text-cyan-300">{engineStatus?.engine || 'peron_mt5'}</span>
          </div>
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
            <span className="text-[10px] text-slate-500 uppercase block">Status</span>
            <span className="font-bold text-emerald-400">
              {pingResult?.ok ? 'Connected (200 OK)' : 'Checking...'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
