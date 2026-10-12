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
  Terminal,
  Activity,
  Cpu,
  Zap,
} from 'lucide-react';

interface EaConnectionRadarProps {
  state: AppState | null;
  onRefresh?: () => void;
}

export const EaConnectionRadar: React.FC<EaConnectionRadarProps> = ({ state, onRefresh }) => {
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
      <div className="bg-emerald-950/30 border border-emerald-800/50 rounded-xl p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <span className="h-3.5 w-3.5 rounded-full bg-emerald-400 block animate-ping absolute inset-0" />
              <span className="h-3.5 w-3.5 rounded-full bg-emerald-400 block relative" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm font-mono text-emerald-300 uppercase tracking-wider">
                  MetaTrader 5 Direct Process Live &amp; Connected
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-700">
                  {elapsedSeconds === 0 ? 'Active < 1s' : `${elapsedSeconds}s ago`}
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                  Direct Python IPC
                </span>
              </div>
              <p className="text-xs text-slate-300 font-mono mt-0.5">
                Terminal: <strong className="text-white">{terminalName || 'MetaTrader 5'}</strong> • Broker:{' '}
                <strong className="text-white">{terminalCompany || state?.account.company || 'Live Broker'}</strong>
                {chartSymbol && (
                  <span>
                    {' '}• Feed: <strong className="text-cyan-400">{chartSymbol} {chartTimeframe}</strong>
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <div className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 flex items-center gap-1.5 text-slate-300">
              <span className="text-slate-500">Bridge Port:</span>
              <code className="text-cyan-300 font-bold">127.0.0.1:8888</code>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-slate-900 via-cyan-950/20 to-slate-900 border border-cyan-800/40 rounded-xl p-5 shadow-sm space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 flex items-center justify-center shrink-0">
            <Laptop className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-cyan-300 uppercase tracking-wider font-mono">
                Awaiting MetaTrader 5 Terminal Application
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 animate-pulse">
                Direct Package Engine Active
              </span>
            </div>
            <p className="text-xs text-slate-300 font-mono mt-1 max-w-2xl leading-relaxed">
              Zero EA installation required. Our platform connects directly into your MetaTrader 5 application via inter-process memory using the official Python <code className="text-cyan-400 font-bold">MetaTrader5</code> package.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            onClick={copyCommand}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors"
          >
            {copiedCmd ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            <span>Copy Run Command</span>
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

      {/* 3-Step Direct MT5 Package Guide Checklist */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-2 border-t border-slate-800/60 font-mono text-xs">
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-2.5 flex items-start gap-2">
          <span className="h-5 w-5 rounded bg-cyan-950 text-cyan-400 font-bold flex items-center justify-center shrink-0 text-[10px]">1</span>
          <div>
            <div className="font-bold text-slate-200 text-[11px]">Install Python Package</div>
            <p className="text-slate-500 text-[10px] mt-0.5">Run <code className="text-cyan-400">pip install MetaTrader5 requests</code> in terminal.</p>
          </div>
        </div>

        <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-2.5 flex items-start gap-2">
          <span className="h-5 w-5 rounded bg-cyan-950 text-cyan-400 font-bold flex items-center justify-center shrink-0 text-[10px]">2</span>
          <div>
            <div className="font-bold text-slate-200 text-[11px]">Open MetaTrader 5</div>
            <p className="text-slate-500 text-[10px] mt-0.5">Start your broker's MT5 desktop application and log in to your account.</p>
          </div>
        </div>

        <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-2.5 flex items-start gap-2">
          <span className="h-5 w-5 rounded bg-cyan-950 text-cyan-400 font-bold flex items-center justify-center shrink-0 text-[10px]">3</span>
          <div>
            <div className="font-bold text-slate-200 text-[11px]">Auto-Connects Instantly</div>
            <p className="text-slate-500 text-[10px] mt-0.5">The Python connector hooks directly into the active MT5 desktop instance.</p>
          </div>
        </div>
      </div>

      {pingResult && (
        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono text-slate-400">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <CheckCircle2 className="h-4 w-4" /> Platform HTTP listener active ({pingResult.latencyMs}ms)
          </span>
          <span className="text-[11px] text-slate-500">
            Open MT5 app locally to stream live broker accounts and quotes.
          </span>
        </div>
      )}
    </div>
  );
};
