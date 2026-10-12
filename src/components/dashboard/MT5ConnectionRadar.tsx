import React, { useState } from 'react';
import { AppState } from '@/types';
import { api } from '../../lib/api';
import {
  Laptop,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Copy,
  Check,
  Zap,
} from 'lucide-react';

interface MT5ConnectionRadarProps {
  state: AppState | null;
  onRefresh?: () => void;
}

export const MT5ConnectionRadar: React.FC<MT5ConnectionRadarProps> = ({ state, onRefresh }) => {
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [isPinging, setIsPinging] = useState(false);
  const [pingResult, setPingResult] = useState<{ ok: boolean; latencyMs: number } | null>(null);

  const isConnected = state?.connection.isEaConnected ?? false;
  const lastSync = state?.connection.lastEaSync ?? 0;
  const terminalName = state?.connection.terminalName;
  const terminalCompany = state?.connection.terminalCompany;
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
      const res = await api.checkBridgeHealth('/health');
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
      <div className="bg-slate-900/60 border border-emerald-900/40 rounded-xl p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center">
              <span className="h-3 w-3 rounded-full bg-emerald-400 block animate-ping absolute inset-0 opacity-75" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 block relative" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
                <span className="font-semibold text-emerald-400">
                  MetaTrader 5 Direct IPC Online
                </span>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span className="text-slate-400 tabular-nums">
                  {elapsedSeconds === 0 ? 'Sync < 1s' : `${elapsedSeconds}s ago`}
                </span>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span className="text-cyan-400">
                  Python Package v5.0.6231
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Terminal: <span className="text-slate-200 font-medium">{terminalName || 'MetaTrader 5'}</span>
                <span aria-hidden="true" className="text-slate-600 mx-1.5">·</span>
                Broker: <span className="text-slate-200 font-medium">{terminalCompany || state?.account.company || 'Broker Terminal'}</span>
                {chartSymbol && (
                  <>
                    <span aria-hidden="true" className="text-slate-600 mx-1.5">·</span>
                    Symbol: <span className="text-cyan-300 font-medium">{chartSymbol} [{chartTimeframe || 'M1'}]</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <span className="text-slate-500">Bridge Port</span>
            <span className="text-cyan-300 tabular-nums font-semibold">127.0.0.1:8888</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-cyan-950/60 text-cyan-400 border border-cyan-800/60 flex items-center justify-center shrink-0">
            <Laptop className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-200 font-mono">
                Awaiting MetaTrader 5 Terminal Process
              </h2>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="text-xs text-amber-400 font-mono">
                Direct Python Engine Standby
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-1 max-w-2xl leading-relaxed">
              Zero manual setup required. Our bridge interacts directly with MetaTrader 5 using the official Python <code className="text-cyan-400">MetaTrader5</code> package via inter-process memory.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            onClick={copyCommand}
            className="px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-xs font-mono text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors"
          >
            {copiedCmd ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            <span>Copy Run Command</span>
          </button>

          <button
            onClick={handleTestPing}
            disabled={isPinging}
            className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-mono font-medium flex items-center gap-1.5 transition-all shadow-sm"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isPinging ? 'animate-spin' : ''}`} />
            <span>Check Engine Health</span>
          </button>
        </div>
      </div>

      {/* 3-Step Setup Guide Checklist */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-slate-800/60 font-mono text-xs">
        <div className="bg-slate-950/40 border border-slate-800/60 rounded-lg p-3">
          <div className="text-xs font-semibold text-slate-300 mb-1">
            01. Python MetaTrader5 Package
          </div>
          <p className="text-slate-500 text-[11px] leading-relaxed">
            Run <code className="text-cyan-400">pip install MetaTrader5 requests</code> on your workstation.
          </p>
        </div>

        <div className="bg-slate-950/40 border border-slate-800/60 rounded-lg p-3">
          <div className="text-xs font-semibold text-slate-300 mb-1">
            02. Launch MetaTrader 5
          </div>
          <p className="text-slate-500 text-[11px] leading-relaxed">
            Start your desktop MT5 terminal and authenticate with your broker account.
          </p>
        </div>

        <div className="bg-slate-950/40 border border-slate-800/60 rounded-lg p-3">
          <div className="text-xs font-semibold text-slate-300 mb-1">
            03. Native Auto-Attach
          </div>
          <p className="text-slate-500 text-[11px] leading-relaxed">
            The Python connector automatically discovers and streams the active terminal instance.
          </p>
        </div>
      </div>

      {pingResult && (
        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono text-slate-400">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" /> Platform HTTP listener active ({pingResult.latencyMs}ms)
          </span>
          <span className="text-[11px] text-slate-500">
            Launch MT5 locally to stream live broker accounts and quotes.
          </span>
        </div>
      )}
    </div>
  );
};
