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
      <div className="card-panel">
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
                <span className="text-indigo-400">
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
                    Symbol: <span className="text-indigo-300 font-medium">{chartSymbol} [{chartTimeframe || 'M1'}]</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <span className="text-slate-500">Bridge Port</span>
            <span className="text-indigo-300 tabular-nums font-semibold">127.0.0.1:8888</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card-panel space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-indigo-950/80 border border-indigo-700/60 flex items-center justify-center text-indigo-400 shadow-md shrink-0">
            <Laptop className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white tracking-tight">Awaiting MetaTrader 5 Terminal Process</h1>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="text-xs font-mono font-semibold text-amber-400">
                Direct Python Engine Standby
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed font-mono">
              Zero manual setup required. Our bridge interacts directly with MetaTrader 5 using the official Python <code className="text-indigo-400">MetaTrader5</code> package via inter-process memory.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            onClick={copyCommand}
            className="btn btn-secondary gap-1.5"
          >
            {copiedCmd ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            <span>Copy Run Command</span>
          </button>

          <button
            onClick={handleTestPing}
            disabled={isPinging}
            className="btn btn-primary gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isPinging ? 'animate-spin' : ''}`} />
            <span>Check Engine Health</span>
          </button>
        </div>
      </div>

      {/* 3-Step Setup Guide Checklist */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-slate-800/60 font-mono text-xs">
        <div className="card-panel">
          <div className="text-xs font-semibold text-slate-300 mb-1">
            01. Python MetaTrader5 Package
          </div>
          <p className="text-slate-500 text-[11px] leading-relaxed">
            Run <code className="text-indigo-400">pip install MetaTrader5 requests</code> on your workstation.
          </p>
        </div>

        <div className="card-panel">
          <div className="text-xs font-semibold text-slate-300 mb-1">
            02. Launch MetaTrader 5
          </div>
          <p className="text-slate-500 text-[11px] leading-relaxed">
            Start your desktop MT5 terminal and authenticate with your broker account.
          </p>
        </div>

        <div className="card-panel">
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
