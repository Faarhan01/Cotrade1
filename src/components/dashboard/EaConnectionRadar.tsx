import React, { useState } from 'react';
import { AppState } from '@/types';
import { connectionApi } from '../../services/api/connectionApi';
import {
  Laptop,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Copy,
  Check,
  Terminal,
  Activity,
  Cpu,
  Zap,
  Globe,
  ShieldCheck,
} from 'lucide-react';

interface MT5ConnectionRadarProps {
  state: AppState | null;
  onRefresh?: () => void;
}

export const MT5ConnectionRadar: React.FC<MT5ConnectionRadarProps> = ({ state, onRefresh }) => {
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [isPinging, setIsPinging] = useState(false);
  const [pingResult, setPingResult] = useState<{ ok: boolean; latencyMs: number } | null>(null);

  const isConnected = state?.connection.terminalConnected ?? state?.connection.isEaConnected ?? false;
  const lastSync = state?.connection.lastSync ?? state?.connection.lastEaSync ?? 0;
  const terminalName = state?.connection.terminalName || 'MetaTrader 5';
  const terminalCompany = state?.connection.terminalCompany || state?.account.company;
  const chartSymbol = state?.connection.chartSymbol;
  const chartTimeframe = state?.connection.chartTimeframe;

  const bridgeCommand = 'python3 backend/src/scripts/peron_bridge.py';

  const copyCommand = () => {
    navigator.clipboard.writeText(bridgeCommand);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  const handleTestPing = async () => {
    try {
      setIsPinging(true);
      const res = await connectionApi.pingHealth('/health');
      setPingResult(res);
      onRefresh?.();
    } catch {
      setPingResult({ ok: false, latencyMs: 0 });
    } finally {
      setIsPinging(false);
    }
  };

  if (isConnected) {
    const elapsedSeconds = lastSync > 0 ? Math.max(0, Math.round((Date.now() - lastSync) / 1000)) : 0;

    return (
      <div className="bg-emerald-950/25 border border-emerald-800/40 rounded-xl p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <span className="h-3 w-3 rounded-full bg-emerald-400 block animate-ping absolute inset-0" />
              <span className="h-3 w-3 rounded-full bg-emerald-400 block relative" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm font-mono text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  MetaTrader 5 Direct Engine Live
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-700/60">
                  {elapsedSeconds === 0 ? 'Sync < 1s' : `Sync ${elapsedSeconds}s ago`}
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/60">
                  Native MetaTrader5 Package
                </span>
              </div>
              <p className="text-xs text-slate-300 font-mono mt-0.5">
                Terminal: <strong className="text-white">{terminalName}</strong> • Broker:{' '}
                <strong className="text-white">{terminalCompany || 'Active MT5 Broker'}</strong>
                {chartSymbol && (
                  <span>
                    {' '}• Stream: <strong className="text-cyan-400">{chartSymbol} {chartTimeframe || 'M1'}</strong>
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <div className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 flex items-center gap-1.5 text-slate-300">
              <span className="text-slate-500">Bridge IPC:</span>
              <code className="text-cyan-300 font-bold">127.0.0.1:8888</code>
            </div>
            <button
              onClick={handleTestPing}
              disabled={isPinging}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
              title="Ping Direct Bridge"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isPinging ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-slate-900 via-cyan-950/20 to-slate-900 border border-cyan-800/30 rounded-xl p-5 shadow-sm space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center shrink-0">
            <Laptop className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-cyan-300 uppercase tracking-wider font-mono">
                Direct MetaTrader 5 Package Engine Ready
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/80 animate-pulse">
                Zero EA Required
              </span>
            </div>
            <p className="text-xs text-slate-300 font-mono mt-1 max-w-2xl leading-relaxed">
              Native Python IPC hooks directly into your MetaTrader 5 desktop application. Run full market quotes, orders, strategy backtests, and AI daemon controls without any MQL5 Expert Advisor installations.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            onClick={copyCommand}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors"
          >
            {copiedCmd ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            <span>Copy Runner Command</span>
          </button>

          <button
            onClick={handleTestPing}
            disabled={isPinging}
            className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-mono font-bold flex items-center gap-1.5 transition-all shadow-sm"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isPinging ? 'animate-spin' : ''}`} />
            <span>Check Engine Health</span>
          </button>
        </div>
      </div>

      {/* 3-Step Setup Guide */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-2 border-t border-slate-800/60 font-mono text-xs">
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-2.5 flex items-start gap-2">
          <span className="h-5 w-5 rounded bg-cyan-950 text-cyan-400 font-bold flex items-center justify-center shrink-0 text-[10px]">1</span>
          <div>
            <div className="font-bold text-slate-200 text-[11px]">Install Python Package</div>
            <p className="text-slate-500 text-[10px] mt-0.5">Run <code className="text-cyan-400">pip install MetaTrader5 requests</code>.</p>
          </div>
        </div>

        <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-2.5 flex items-start gap-2">
          <span className="h-5 w-5 rounded bg-cyan-950 text-cyan-400 font-bold flex items-center justify-center shrink-0 text-[10px]">2</span>
          <div>
            <div className="font-bold text-slate-200 text-[11px]">Launch MetaTrader 5</div>
            <p className="text-slate-500 text-[10px] mt-0.5">Start your broker's MT5 terminal application and log in.</p>
          </div>
        </div>

        <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-2.5 flex items-start gap-2">
          <span className="h-5 w-5 rounded bg-cyan-950 text-cyan-400 font-bold flex items-center justify-center shrink-0 text-[10px]">3</span>
          <div>
            <div className="font-bold text-slate-200 text-[11px]">Direct Bridge Stream</div>
            <p className="text-slate-500 text-[10px] mt-0.5">Run <code className="text-cyan-400">python3 backend/src/scripts/peron_bridge.py</code></p>
          </div>
        </div>
      </div>

      {pingResult && (
        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono text-slate-400">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <CheckCircle2 className="h-4 w-4" /> Platform HTTP listener active ({pingResult.latencyMs}ms)
          </span>
          <span className="text-[11px] text-slate-500">
            Engine is listening for MetaTrader 5 application signals.
          </span>
        </div>
      )}
    </div>
  );
};

// Backwards-compatible export
export const EaConnectionRadar = MT5ConnectionRadar;
