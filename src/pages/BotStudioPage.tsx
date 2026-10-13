import React, { useState, useEffect } from 'react';
import {
  Bot,
  Play,
  Pause,
  Square,
  Plus,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Activity,
  Layers,
  Shield,
  Zap,
  TrendingUp,
  Cpu,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Sliders,
  DollarSign,
  BarChart2,
  ExternalLink,
  Code,
  Copy,
  Check,
} from 'lucide-react';
import { api } from '../lib/api';

interface BotInstance {
  id: string;
  name: string;
  strategyId: string;
  strategyName: string;
  strategyType: string;
  symbol: string;
  timeframe: string;
  status: 'IDLE' | 'RUNNING' | 'PAUSED' | 'STOPPED' | 'ERROR';
  executionMode: 'LIVE' | 'PAPER' | 'DRY_RUN';
  magicNumber: number;
  allocation: {
    lotSize: number;
    maxPositions: number;
    maxDailyLoss: number;
    targetDailyProfit?: number;
    stopLossPoints?: number;
    takeProfitPoints?: number;
  };
  trailingStop: {
    enabled: boolean;
    distancePoints: number;
    stepPoints: number;
  };
  cooldownSeconds: number;
  lastTradeTimestamp?: number;
  createdAt: number;
  updatedAt: number;
  stats: {
    tradesExecuted: number;
    winningTrades: number;
    losingTrades: number;
    realizedPnl: number;
    unrealizedPnl: number;
    lastSignal?: 'BUY' | 'SELL' | 'HOLD' | 'CLOSE';
    lastSignalTime?: number;
    lastSignalReason?: string;
    lastExecutionTime?: number;
    lastError?: string | null;
  };
}

export const BotStudioPage: React.FC = () => {
  const [bots, setBots] = useState<BotInstance[]>([]);
  const [strategies, setStrategies] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);
  const [botLogs, setBotLogs] = useState<any[]>([]);
  const [botExecutions, setBotExecutions] = useState<any[]>([]);
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [evaluatingBotId, setEvaluatingBotId] = useState<string | null>(null);

  // Deploy Modal Form
  const [deployForm, setDeployForm] = useState({
    name: '',
    strategyId: '',
    symbol: 'EURUSD',
    timeframe: 'M1',
    executionMode: 'PAPER' as 'LIVE' | 'PAPER',
    lotSize: 0.1,
    maxPositions: 2,
    maxDailyLoss: 150,
    targetDailyProfit: 300,
    stopLossPoints: 250,
    takeProfitPoints: 500,
    trailingEnabled: true,
    trailingDistance: 150,
    trailingStep: 50,
    cooldownSeconds: 45,
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [botsRes, stratsRes] = await Promise.all([
        api.getBots(),
        api.getStrategies(),
      ]);

      if (botsRes?.bots) {
        setBots(botsRes.bots);
        if (!selectedBotId && botsRes.bots.length > 0) {
          setSelectedBotId(botsRes.bots[0].id);
        }
      }
      if (stratsRes?.strategies) {
        setStrategies(stratsRes.strategies);
        if (!deployForm.strategyId && stratsRes.strategies.length > 0) {
          setDeployForm((prev) => ({
            ...prev,
            strategyId: stratsRes.strategies[0].id,
            name: `${stratsRes.strategies[0].name} Bot`,
          }));
        }
      }
    } catch (err) {
      console.error('Failed to load bot data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedBotId) {
      api.getBotLogs(selectedBotId, 30).then((res) => {
        if (res?.logs) setBotLogs(res.logs);
      }).catch(() => {});

      api.getBotExecutions(selectedBotId, 30).then((res) => {
        if (res?.executions) setBotExecutions(res.executions);
      }).catch(() => {});
    }
  }, [selectedBotId]);

  const handleStartBot = async (id: string) => {
    try {
      await api.startBot(id);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handlePauseBot = async (id: string) => {
    try {
      await api.pauseBot(id);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleStopBot = async (id: string) => {
    try {
      await api.stopBot(id);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteBot = async (id: string) => {
    if (!confirm('Are you sure you want to delete this trading bot instance?')) return;
    try {
      await api.deleteBot(id);
      if (selectedBotId === id) setSelectedBotId(null);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleEvaluateNow = async (id: string) => {
    try {
      setEvaluatingBotId(id);
      const res = await api.evaluateBot(id);
      loadData();
      if (res?.signal) {
        alert(`Evaluation completed!\nSignal: ${res.signal.signal}\nReason: ${res.signal.reason}\nConfidence: ${Math.round(res.signal.confidence * 100)}%`);
      }
    } catch (err: any) {
      alert(`Evaluation error: ${err.message}`);
    } finally {
      setEvaluatingBotId(null);
    }
  };

  const handleClosePositions = async (id: string) => {
    if (!confirm('Emergency close all open positions for this bot?')) return;
    try {
      const res = await api.closeBotPositions(id, 'Manual operator closure');
      alert(`Closed ${res.closed} open positions`);
      loadData();
    } catch (err: any) {
      alert(`Error closing positions: ${err.message}`);
    }
  };

  const handleDeployBotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const selectedStrat = strategies.find((s) => s.id === deployForm.strategyId);

    const payload = {
      name: deployForm.name || `${selectedStrat?.name || 'Trading'} Bot`,
      strategyId: deployForm.strategyId,
      strategyName: selectedStrat?.name || 'Custom Strategy',
      strategyType: selectedStrat?.type || 'CUSTOM',
      symbol: deployForm.symbol,
      timeframe: deployForm.timeframe,
      executionMode: deployForm.executionMode,
      status: 'IDLE',
      allocation: {
        lotSize: Number(deployForm.lotSize),
        maxPositions: Number(deployForm.maxPositions),
        maxDailyLoss: Number(deployForm.maxDailyLoss),
        targetDailyProfit: Number(deployForm.targetDailyProfit),
        stopLossPoints: Number(deployForm.stopLossPoints),
        takeProfitPoints: Number(deployForm.takeProfitPoints),
      },
      trailingStop: {
        enabled: deployForm.trailingEnabled,
        distancePoints: Number(deployForm.trailingDistance),
        stepPoints: Number(deployForm.trailingStep),
      },
      cooldownSeconds: Number(deployForm.cooldownSeconds),
    };

    try {
      await api.createBot(payload);
      setShowDeployModal(false);
      loadData();
    } catch (err: any) {
      alert(`Failed to deploy bot: ${err.message}`);
    }
  };

  // Metrics calculation
  const totalBots = bots.length;
  const activeBotsCount = bots.filter((b) => b.status === 'RUNNING').length;
  const totalRealizedPnl = bots.reduce((sum, b) => sum + (b.stats.realizedPnl || 0), 0);
  const totalTrades = bots.reduce((sum, b) => sum + (b.stats.tradesExecuted || 0), 0);
  const totalWins = bots.reduce((sum, b) => sum + (b.stats.winningTrades || 0), 0);
  const winRate = totalTrades > 0 ? Math.round((totalWins / totalTrades) * 100) : 0;

  const pythonAiBotSnippet = `# External AI Python Bot Control via Daemon API
import requests

# 1. Deploy an automated bot bound to a Knowledge Base strategy
res = requests.post("http://localhost:3000/api/daemon/dispatch", json={
    "action": "BOT_CREATE",
    "name": "AI Quantitative EURUSD Scalper",
    "strategyId": "strat-rsi-reversal-eurusd",
    "symbol": "EURUSD",
    "timeframe": "M1",
    "executionMode": "PAPER",  # or "LIVE"
    "allocation": {"lotSize": 0.1, "maxPositions": 2, "maxDailyLoss": 150}
})
bot_id = res.json()["bot"]["id"]

# 2. Start automated execution loop
requests.post("http://localhost:3000/api/daemon/dispatch", json={
    "action": "BOT_START",
    "botId": bot_id
})

# 3. Query live signal evaluation
eval_res = requests.post("http://localhost:3000/api/daemon/dispatch", json={
    "action": "BOT_EVALUATE",
    "botId": bot_id
})
print("AI Signal:", eval_res.json())`;

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="container mx-auto px-4 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-6 rounded-2xl shadow-sm">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-cyan-950/80 border border-cyan-700/60 flex items-center justify-center text-cyan-400 shadow-md shrink-0">
            <Bot className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white tracking-tight">Algorithmic Bot Studio</h1>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/80">
                AI Autonomous Daemon Controlled
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 font-mono">
              Deploy, monitor, and steer automated strategy bots with live tick evaluation, trailing stops, and MetaTrader 5 execution.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => setShowDeployModal(true)}
            className="px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-mono font-bold flex items-center gap-1.5 transition-colors shadow-md shadow-cyan-950/60"
          >
            <Plus className="h-4 w-4" />
            <span>Deploy New Bot</span>
          </button>
        </div>
      </div>

      {/* Metric Cards HUD */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Total Bots</span>
          <span className="text-lg font-bold text-white font-mono">{totalBots}</span>
          <span className="text-[10px] text-slate-500 block">Configured instances</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Active Running</span>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-emerald-400 font-mono">{activeBotsCount}</span>
            {activeBotsCount > 0 && <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>}
          </div>
          <span className="text-[10px] text-slate-500 block">3s evaluation loop</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Realized Bot P&L</span>
          <span className={`text-lg font-bold font-mono ${totalRealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            ${totalRealizedPnl.toFixed(2)}
          </span>
          <span className="text-[10px] text-slate-500 block">Net performance</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Total Trades</span>
          <span className="text-lg font-bold text-white font-mono">{totalTrades}</span>
          <span className="text-[10px] text-slate-500 block">Executed fills</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Win Rate</span>
          <span className="text-lg font-bold text-cyan-400 font-mono">{winRate}%</span>
          <span className="text-[10px] text-slate-500 block">{totalWins} wins / {totalTrades - totalWins} losses</span>
        </div>
      </div>

      {/* External AI Controller & Integration Telemetry Banner */}
      <div className="bg-slate-900/80 border border-cyan-800/40 rounded-xl p-4 font-mono text-xs space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-cyan-300 font-bold">
            <Cpu className="h-4 w-4 text-cyan-400" />
            <span>External AI Autonomous Control Protocol Active</span>
          </div>
          <button
            onClick={() => handleCopy(pythonAiBotSnippet, 'py-snippet')}
            className="text-cyan-400 hover:text-cyan-300 text-[11px] flex items-center gap-1 self-start sm:self-auto"
          >
            {copiedCode === 'py-snippet' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            <span>{copiedCode === 'py-snippet' ? 'Copied' : 'Copy Python AI Snippet'}</span>
          </button>
        </div>
        <p className="text-slate-400 text-[11px] leading-relaxed">
          Any external AI agent (Claude, Cursor, custom Python scripts) can deploy, start, pause, or query trading bots via the Daemon API (<code className="text-cyan-400">/api/daemon/dispatch</code>) or native Model Context Protocol (MCP) tools.
        </p>
      </div>

      {/* Bot Instances List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white font-mono tracking-tight flex items-center gap-2">
            <Layers className="h-4 w-4 text-cyan-400" />
            <span>Deployed Bot Instances ({bots.length})</span>
          </h2>
        </div>

        {bots.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center font-mono text-xs text-slate-400 space-y-3">
            <p>No automated trading bots currently configured.</p>
            <button
              onClick={() => setShowDeployModal(true)}
              className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition-colors"
            >
              Deploy Your First Bot
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {bots.map((b) => {
              const isSelected = selectedBotId === b.id;
              const isRunning = b.status === 'RUNNING';

              return (
                <div
                  key={b.id}
                  onClick={() => setSelectedBotId(b.id)}
                  className={`bg-slate-900 border rounded-xl p-4 space-y-3 transition-all cursor-pointer ${
                    isSelected
                      ? 'border-cyan-500/80 shadow-md shadow-cyan-950/40 ring-1 ring-cyan-500/30'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* Top Bar */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-white font-mono">{b.name}</h3>
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                        {b.strategyName}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                        b.status === 'RUNNING'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/80'
                          : b.status === 'PAUSED'
                          ? 'bg-amber-950 text-amber-400 border border-amber-800/80'
                          : 'bg-slate-950 text-slate-400 border border-slate-800'
                      }`}>
                        {b.status}
                      </span>
                      <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                        b.executionMode === 'LIVE' ? 'bg-rose-950 text-rose-300 border border-rose-800/60' : 'bg-slate-950 text-cyan-300 border border-cyan-800/60'
                      }`}>
                        {b.executionMode}
                      </span>
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="flex items-center gap-1.5 flex-wrap font-mono text-[10px]">
                    <span className="px-2 py-0.5 rounded bg-slate-950 text-cyan-400 border border-slate-800 font-bold">
                      {b.symbol} {b.timeframe}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800">
                      {b.allocation.lotSize} Lots
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800">
                      Max {b.allocation.maxPositions} Pos
                    </span>
                    {b.trailingStop?.enabled && (
                      <span className="px-2 py-0.5 rounded bg-slate-950 text-emerald-400 border border-emerald-900/60">
                        Trailing Stop ({b.trailingStop.distancePoints}pt)
                      </span>
                    )}
                  </div>

                  {/* Real-time Signal Readout */}
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 font-mono text-xs space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Latest Signal:</span>
                      <span className={`font-bold ${
                        b.stats.lastSignal === 'BUY'
                          ? 'text-emerald-400'
                          : b.stats.lastSignal === 'SELL'
                          ? 'text-rose-400'
                          : 'text-cyan-300'
                      }`}>
                        {b.stats.lastSignal || 'NEUTRAL / EVALUATING'}
                      </span>
                    </div>
                    {b.stats.lastSignalReason && (
                      <p className="text-[10px] text-slate-400 line-clamp-1">
                        {b.stats.lastSignalReason}
                      </p>
                    )}
                  </div>

                  {/* Performance Readout */}
                  <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-800/60 font-mono text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 block">P&L</span>
                      <span className={`font-bold ${b.stats.realizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        ${b.stats.realizedPnl.toFixed(2)}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 block">Trades</span>
                      <span className="text-white font-bold">{b.stats.tradesExecuted}</span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 block">Max Loss</span>
                      <span className="text-rose-400 font-bold">${b.allocation.maxDailyLoss}</span>
                    </div>
                  </div>

                  {/* Bot Controls */}
                  <div className="flex items-center gap-1.5 pt-2 border-t border-slate-800/80 font-mono text-xs">
                    {isRunning ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); handlePauseBot(b.id); }}
                        className="flex-1 py-1 rounded bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-800/80 flex items-center justify-center gap-1 transition-colors"
                      >
                        <Pause className="h-3 w-3" />
                        <span>Pause</span>
                      </button>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleStartBot(b.id); }}
                        className="flex-1 py-1 rounded bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-800/80 flex items-center justify-center gap-1 transition-colors"
                      >
                        <Play className="h-3 w-3" />
                        <span>Start</span>
                      </button>
                    )}

                    <button
                      onClick={(e) => { e.stopPropagation(); handleEvaluateNow(b.id); }}
                      disabled={evaluatingBotId === b.id}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 flex items-center gap-1 transition-colors"
                      title="Trigger immediate evaluation"
                    >
                      <Activity className={`h-3 w-3 ${evaluatingBotId === b.id ? 'animate-spin' : ''}`} />
                      <span>Eval</span>
                    </button>

                    <button
                      onClick={(e) => { e.stopPropagation(); handleClosePositions(b.id); }}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-rose-300 border border-slate-700 flex items-center gap-1 transition-colors"
                      title="Emergency close positions"
                    >
                      <Square className="h-3 w-3" />
                      <span>Close</span>
                    </button>

                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteBot(b.id); }}
                      className="p-1 rounded bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 border border-slate-700 transition-colors"
                      title="Delete bot"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Selected Bot Detailed Inspector & Execution Logs */}
      {selectedBotId && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
          {/* Execution History */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3 font-mono">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-cyan-400" />
                <span>Bot Execution Fills ({botExecutions.length})</span>
              </h3>
              <span className="text-[11px] text-slate-500">Live & Paper Orders</span>
            </div>

            <div className="overflow-x-auto border border-slate-800 rounded-lg max-h-80">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] sticky top-0 border-b border-slate-800">
                  <tr>
                    <th className="py-2 px-3">Time</th>
                    <th className="py-2 px-3">Type</th>
                    <th className="py-2 px-3">Vol</th>
                    <th className="py-2 px-3">Entry</th>
                    <th className="py-2 px-3">Exit</th>
                    <th className="py-2 px-3">P&L</th>
                    <th className="py-2 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-900/40 text-[11px]">
                  {botExecutions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        No trade fills recorded yet for this bot.
                      </td>
                    </tr>
                  ) : (
                    botExecutions.map((e) => (
                      <tr key={e.id} className="hover:bg-slate-800/40">
                        <td className="py-1.5 px-3 text-slate-400">{new Date(e.openedAt).toLocaleTimeString()}</td>
                        <td className={`py-1.5 px-3 font-bold ${e.orderType === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {e.orderType}
                        </td>
                        <td className="py-1.5 px-3 text-white">{e.volume}</td>
                        <td className="py-1.5 px-3 text-slate-300">{e.entryPrice.toFixed(4)}</td>
                        <td className="py-1.5 px-3 text-slate-300">{e.exitPrice ? e.exitPrice.toFixed(4) : '-'}</td>
                        <td className={`py-1.5 px-3 font-bold ${e.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {e.pnl !== undefined ? `$${e.pnl.toFixed(2)}` : '-'}
                        </td>
                        <td className="py-1.5 px-3">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                            e.status === 'OPEN' ? 'bg-emerald-950 text-emerald-400' : 'bg-slate-950 text-slate-400'
                          }`}>
                            {e.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Audit Logs */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3 font-mono">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Clock className="h-4 w-4 text-cyan-400" />
                <span>Decision & Signal Audit Trail</span>
              </h3>
              <span className="text-[11px] text-slate-500">Real-time Log</span>
            </div>

            <div className="overflow-y-auto border border-slate-800 rounded-lg p-2.5 max-h-80 space-y-1.5 bg-slate-950">
              {botLogs.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs">
                  No log entries recorded yet.
                </div>
              ) : (
                botLogs.map((l) => (
                  <div key={l.id} className="text-[11px] flex items-start gap-2 py-0.5">
                    <span className="text-slate-500 shrink-0">{new Date(l.timestamp).toLocaleTimeString()}</span>
                    <span className={`px-1 py-0.2 rounded text-[9px] uppercase font-bold shrink-0 ${
                      l.level === 'trade'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : l.level === 'error'
                        ? 'bg-rose-950 text-rose-400 border border-rose-800'
                        : 'bg-slate-900 text-cyan-300'
                    }`}>
                      {l.level}
                    </span>
                    <span className="text-slate-300 break-words flex-1">{l.message}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Deploy New Trading Bot */}
      {showDeployModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl font-mono">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-cyan-400" />
                <h2 className="text-base font-bold text-white">Deploy Automated Trading Bot</h2>
              </div>
              <button
                onClick={() => setShowDeployModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleDeployBotSubmit} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Bot Name</label>
                <input
                  type="text"
                  required
                  value={deployForm.name}
                  onChange={(e) => setDeployForm({ ...deployForm, name: e.target.value })}
                  placeholder="e.g. EURUSD RSI Scalper Alpha"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Strategy from Knowledge Base</label>
                  <select
                    value={deployForm.strategyId}
                    onChange={(e) => setDeployForm({ ...deployForm, strategyId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:border-cyan-500"
                  >
                    {strategies.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Symbol</label>
                  <select
                    value={deployForm.symbol}
                    onChange={(e) => setDeployForm({ ...deployForm, symbol: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:border-cyan-500"
                  >
                    <option value="EURUSD">EURUSD</option>
                    <option value="GBPUSD">GBPUSD</option>
                    <option value="USDJPY">USDJPY</option>
                    <option value="XAUUSD">XAUUSD (Gold)</option>
                    <option value="BTCUSD">BTCUSD (Bitcoin)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Timeframe</label>
                  <select
                    value={deployForm.timeframe}
                    onChange={(e) => setDeployForm({ ...deployForm, timeframe: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:border-cyan-500"
                  >
                    <option value="M1">M1 (1m)</option>
                    <option value="M5">M5 (5m)</option>
                    <option value="M15">M15 (15m)</option>
                    <option value="H1">H1 (1h)</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Lot Size</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={deployForm.lotSize}
                    onChange={(e) => setDeployForm({ ...deployForm, lotSize: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Execution Mode</label>
                  <select
                    value={deployForm.executionMode}
                    onChange={(e) => setDeployForm({ ...deployForm, executionMode: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:border-cyan-500"
                  >
                    <option value="PAPER">PAPER (Simulation)</option>
                    <option value="LIVE">LIVE (MetaTrader 5)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Max Daily Loss USD</label>
                  <input
                    type="number"
                    min="10"
                    value={deployForm.maxDailyLoss}
                    onChange={(e) => setDeployForm({ ...deployForm, maxDailyLoss: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Max Concurrent Positions</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={deployForm.maxPositions}
                    onChange={(e) => setDeployForm({ ...deployForm, maxPositions: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-bold">Dynamic Trailing Stop</span>
                  <input
                    type="checkbox"
                    checked={deployForm.trailingEnabled}
                    onChange={(e) => setDeployForm({ ...deployForm, trailingEnabled: e.target.checked })}
                    className="rounded border-slate-800 text-cyan-500 focus:ring-0"
                  />
                </div>
                {deployForm.trailingEnabled && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="text-slate-400 block mb-1 text-[11px]">Distance Points</label>
                      <input
                        type="number"
                        value={deployForm.trailingDistance}
                        onChange={(e) => setDeployForm({ ...deployForm, trailingDistance: Number(e.target.value) })}
                        className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-white"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1 text-[11px]">Step Points</label>
                      <input
                        type="number"
                        value={deployForm.trailingStep}
                        onChange={(e) => setDeployForm({ ...deployForm, trailingStep: Number(e.target.value) })}
                        className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-white"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowDeployModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition-colors shadow-md shadow-cyan-950/60"
                >
                  Deploy Bot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
