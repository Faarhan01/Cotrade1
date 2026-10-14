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
  Edit2,
  Crosshair,
  Settings,
  Sparkles,
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
  parametersOverride?: Record<string, any>;
}

export const BotStudioPage: React.FC = () => {
  const [bots, setBots] = useState<BotInstance[]>([]);
  const [strategies, setStrategies] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);
  const [botLogs, setBotLogs] = useState<any[]>([]);
  const [botExecutions, setBotExecutions] = useState<any[]>([]);
  const [botPositions, setBotPositions] = useState<any[]>([]);
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [evaluatingBotId, setEvaluatingBotId] = useState<string | null>(null);
  const [forcingSignal, setForcingSignal] = useState<'BUY' | 'SELL' | null>(null);
  const [activeTab, setActiveTab] = useState<'positions' | 'executions' | 'logs' | 'ai'>('positions');

  // Inline Notification Toast
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // In-app Confirmation Dialog (replaces window.confirm)
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmText?: string;
    confirmColor?: 'rose' | 'amber' | 'indigo';
    onConfirm: () => void;
  } | null>(null);

  const showNotification = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 4500);
  };

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

  // Edit Modal Form
  const [editForm, setEditForm] = useState<{
    id: string;
    name: string;
    symbol: string;
    timeframe: string;
    executionMode: 'LIVE' | 'PAPER';
    lotSize: number;
    maxPositions: number;
    maxDailyLoss: number;
    targetDailyProfit: number;
    stopLossPoints: number;
    takeProfitPoints: number;
    trailingEnabled: boolean;
    trailingDistance: number;
    trailingStep: number;
    cooldownSeconds: number;
  }>({
    id: '',
    name: '',
    symbol: 'EURUSD',
    timeframe: 'M1',
    executionMode: 'PAPER',
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
    } catch (err: any) {
      console.error('Failed to load bot data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadSelectedBotDetails = async (botId: string) => {
    try {
      const [logsRes, execsRes, posRes] = await Promise.all([
        api.getBotLogs(botId, 40).catch(() => ({ logs: [] })),
        api.getBotExecutions(botId, 40).catch(() => ({ executions: [] })),
        api.getBotPositions(botId).catch(() => ({ positions: [] })),
      ]);
      if (logsRes?.logs) setBotLogs(logsRes.logs);
      if (execsRes?.executions) setBotExecutions(execsRes.executions);
      if (posRes?.positions) setBotPositions(posRes.positions);
    } catch {}
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedBotId) {
      loadSelectedBotDetails(selectedBotId);
      const subInterval = setInterval(() => {
        loadSelectedBotDetails(selectedBotId);
      }, 2500);
      return () => clearInterval(subInterval);
    }
  }, [selectedBotId]);

  const handleStartBot = async (id: string) => {
    try {
      await api.startBot(id);
      showNotification('Bot execution loop activated', 'success');
      loadData();
    } catch (err: any) {
      showNotification(`Failed to start bot: ${err.message}`, 'error');
    }
  };

  const handlePauseBot = async (id: string) => {
    try {
      await api.pauseBot(id);
      showNotification('Bot paused', 'info');
      loadData();
    } catch (err: any) {
      showNotification(`Failed to pause: ${err.message}`, 'error');
    }
  };

  const handleStopBot = async (id: string) => {
    try {
      await api.stopBot(id);
      showNotification('Bot stopped', 'info');
      loadData();
    } catch (err: any) {
      showNotification(`Failed to stop: ${err.message}`, 'error');
    }
  };

  const handleDeleteBot = (id: string, name: string) => {
    setConfirmDialog({
      title: 'Delete Trading Bot',
      message: `Are you sure you want to permanently delete "${name}"? Historical execution records will be preserved in audit logs.`,
      confirmText: 'Delete Bot',
      confirmColor: 'rose',
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await api.deleteBot(id);
          showNotification(`Bot "${name}" deleted successfully`, 'success');
          if (selectedBotId === id) setSelectedBotId(null);
          loadData();
        } catch (err: any) {
          showNotification(`Delete failed: ${err.message}`, 'error');
        }
      },
    });
  };

  const handleEvaluateNow = async (id: string) => {
    try {
      setEvaluatingBotId(id);
      const res = await api.evaluateBot(id);
      loadData();
      if (res?.signal) {
        showNotification(
          `Signal: ${res.signal.signal} (${Math.round(res.signal.confidence * 100)}% conf) - ${res.signal.reason}`,
          res.signal.signal === 'BUY' ? 'success' : res.signal.signal === 'SELL' ? 'error' : 'info'
        );
      }
    } catch (err: any) {
      showNotification(`Evaluation error: ${err.message}`, 'error');
    } finally {
      setEvaluatingBotId(null);
    }
  };

  const handleForceSignal = async (signalType: 'BUY' | 'SELL') => {
    if (!selectedBotId) return;
    try {
      setForcingSignal(signalType);
      const res = await api.forceBotSignal(selectedBotId, signalType);
      if (res?.success) {
        showNotification(`Forced ${signalType} trade fill executed successfully`, 'success');
        loadData();
        loadSelectedBotDetails(selectedBotId);
      }
    } catch (err: any) {
      showNotification(`Failed to force ${signalType}: ${err.message}`, 'error');
    } finally {
      setForcingSignal(null);
    }
  };

  const handleClosePositions = (id: string, count: number) => {
    setConfirmDialog({
      title: 'Emergency Close Bot Positions',
      message: `Close all ${count > 0 ? count : ''} open positions currently active for this bot instance?`,
      confirmText: 'Close All Positions',
      confirmColor: 'amber',
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          const res = await api.closeBotPositions(id, 'Manual operator emergency closure');
          showNotification(`Closed ${res.closed} open position(s)`, 'success');
          loadData();
          loadSelectedBotDetails(id);
        } catch (err: any) {
          showNotification(`Error closing positions: ${err.message}`, 'error');
        }
      },
    });
  };

  const handleOpenEditModal = (bot: BotInstance) => {
    setEditForm({
      id: bot.id,
      name: bot.name,
      symbol: bot.symbol,
      timeframe: bot.timeframe,
      executionMode: bot.executionMode === 'LIVE' ? 'LIVE' : 'PAPER',
      lotSize: bot.allocation.lotSize,
      maxPositions: bot.allocation.maxPositions,
      maxDailyLoss: bot.allocation.maxDailyLoss,
      targetDailyProfit: bot.allocation.targetDailyProfit || 300,
      stopLossPoints: bot.allocation.stopLossPoints || 250,
      takeProfitPoints: bot.allocation.takeProfitPoints || 500,
      trailingEnabled: bot.trailingStop.enabled,
      trailingDistance: bot.trailingStop.distancePoints,
      trailingStep: bot.trailingStop.stepPoints,
      cooldownSeconds: bot.cooldownSeconds,
    });
    setShowEditModal(true);
  };

  const handleSaveEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updates = {
        name: editForm.name,
        symbol: editForm.symbol.trim(),
        timeframe: editForm.timeframe,
        executionMode: editForm.executionMode,
        allocation: {
          lotSize: Number(editForm.lotSize),
          maxPositions: Number(editForm.maxPositions),
          maxDailyLoss: Number(editForm.maxDailyLoss),
          targetDailyProfit: Number(editForm.targetDailyProfit),
          stopLossPoints: Number(editForm.stopLossPoints),
          takeProfitPoints: Number(editForm.takeProfitPoints),
        },
        trailingStop: {
          enabled: editForm.trailingEnabled,
          distancePoints: Number(editForm.trailingDistance),
          stepPoints: Number(editForm.trailingStep),
        },
        cooldownSeconds: Number(editForm.cooldownSeconds),
      };

      await api.updateBot(editForm.id, updates);
      setShowEditModal(false);
      showNotification('Bot configuration updated successfully', 'success');
      loadData();
    } catch (err: any) {
      showNotification(`Failed to update bot: ${err.message}`, 'error');
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
      symbol: deployForm.symbol.trim(),
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
      showNotification(`Bot "${payload.name}" deployed!`, 'success');
      loadData();
    } catch (err: any) {
      showNotification(`Failed to deploy bot: ${err.message}`, 'error');
    }
  };

  const handleQuickPresetDeploy = async (preset: {
    name: string;
    symbol: string;
    timeframe: string;
    strategyType: string;
    lotSize: number;
    sl: number;
    tp: number;
  }) => {
    try {
      const matchStrat = strategies.find((s) => s.type === preset.strategyType) || strategies[0];
      await api.createBot({
        name: preset.name,
        strategyId: matchStrat?.id || 'strat-default',
        strategyName: matchStrat?.name || preset.name,
        strategyType: preset.strategyType,
        symbol: preset.symbol,
        timeframe: preset.timeframe,
        executionMode: 'PAPER',
        status: 'IDLE',
        allocation: {
          lotSize: preset.lotSize,
          maxPositions: 2,
          maxDailyLoss: 150,
          targetDailyProfit: 300,
          stopLossPoints: preset.sl,
          takeProfitPoints: preset.tp,
        },
        trailingStop: {
          enabled: true,
          distancePoints: Math.round(preset.sl * 0.6),
          stepPoints: 30,
        },
        cooldownSeconds: 45,
      });
      showNotification(`Preset "${preset.name}" deployed!`, 'success');
      loadData();
    } catch (err: any) {
      showNotification(`Preset deploy error: ${err.message}`, 'error');
    }
  };

  // Metrics calculation
  const totalBots = bots.length;
  const activeBotsCount = bots.filter((b) => b.status === 'RUNNING').length;
  const totalRealizedPnl = bots.reduce((sum, b) => sum + (b.stats.realizedPnl || 0), 0);
  const totalTrades = bots.reduce((sum, b) => sum + (b.stats.tradesExecuted || 0), 0);
  const totalWins = bots.reduce((sum, b) => sum + (b.stats.winningTrades || 0), 0);
  const winRate = totalTrades > 0 ? Math.round((totalWins / totalTrades) * 100) : 0;

  const selectedBot = bots.find((b) => b.id === selectedBotId);

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
    <div className="space-y-6">
      {/* Toast Notification Banner */}
      {toast && (
        <div className={`p-3.5 rounded-xl border flex items-center justify-between font-mono text-xs transition-all shadow-lg ${
          toast.type === 'success'
            ? 'bg-emerald-950/90 text-emerald-300 border-emerald-800'
            : toast.type === 'error'
            ? 'bg-rose-950/90 text-rose-300 border-rose-800'
            : 'bg-indigo-950/90 text-indigo-300 border-indigo-800'
        }`}>
          <div className="flex items-center gap-2">
            {toast.type === 'success' && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />}
            {toast.type === 'error' && <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />}
            {toast.type === 'info' && <Activity className="h-4 w-4 shrink-0 text-indigo-400" />}
            <span>{toast.text}</span>
          </div>
          <button onClick={() => setToast(null)} className="text-slate-400 hover:text-white ml-3 text-xs">
            ✕
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="card-panel flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-indigo-950/80 border border-indigo-700/60 flex items-center justify-center text-indigo-400 shadow-md shrink-0">
            <Bot className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-white tracking-tight">Algorithmic Bot Studio</h1>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/80">
                AI Autonomous Daemon Controlled
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 font-mono">
              Deploy, monitor, and steer automated strategy bots with live tick evaluation, dynamic trailing stops, and MetaTrader 5 execution.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={loadData}
            disabled={loading}
            className="btn btn-secondary gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => setShowDeployModal(true)}
            className="btn btn-primary gap-1.5"
          >
            <Plus className="h-4 w-4" />
            <span>Deploy Custom Bot</span>
          </button>
        </div>
      </div>

      {/* Metric Cards HUD */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="card-panel space-y-1">
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Total Bots</span>
          <span className="text-lg font-bold text-white font-mono">{totalBots}</span>
          <span className="text-[10px] text-slate-500 block">Configured instances</span>
        </div>

        <div className="card-panel space-y-1">
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Active Running</span>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-emerald-400 font-mono">{activeBotsCount}</span>
            {activeBotsCount > 0 && <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>}
          </div>
          <span className="text-[10px] text-slate-500 block">3s automated loop</span>
        </div>

        <div className="card-panel space-y-1">
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Realized Bot P&L</span>
          <span className={`text-lg font-bold font-mono ${totalRealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            ${totalRealizedPnl.toFixed(2)}
          </span>
          <span className="text-[10px] text-slate-500 block">Net performance</span>
        </div>

        <div className="card-panel space-y-1">
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Total Trades</span>
          <span className="text-lg font-bold text-white font-mono">{totalTrades}</span>
          <span className="text-[10px] text-slate-500 block">Executed fills</span>
        </div>

        <div className="card-panel space-y-1">
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Win Rate</span>
          <span className="text-lg font-bold text-indigo-400 font-mono">{winRate}%</span>
          <span className="text-[10px] text-slate-500 block">{totalWins} wins / {Math.max(0, totalTrades - totalWins)} losses</span>
        </div>
      </div>

      {/* 1-Click Quick Deploy Presets */}
      <div className="card-panel font-mono text-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-300 font-bold">
            <Sparkles className="h-4 w-4 text-indigo-400" />
            <span>Instant Algorithmic Bot Presets</span>
          </div>
          <span className="text-[11px] text-slate-500">1-Click Automated Setup</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <button
            onClick={() => handleQuickPresetDeploy({
              name: 'EURUSD M1 Scalper Alpha',
              symbol: 'EURUSD',
              timeframe: 'M1',
              strategyType: 'RSI_REVERSAL',
              lotSize: 0.1,
              sl: 200,
              tp: 400,
            })}
            className="card-panel hover:border-indigo-500/60 text-left transition-colors group"
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-white group-hover:text-indigo-300">EURUSD Scalper</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-400 border border-indigo-800">M1</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">RSI Oversold/Overbought Pullback</p>
          </button>

          <button
            onClick={() => handleQuickPresetDeploy({
              name: 'XAUUSD Gold Trend Alpha',
              symbol: 'XAUUSD',
              timeframe: 'M5',
              strategyType: 'EMA_CROSSOVER',
              lotSize: 0.05,
              sl: 400,
              tp: 800,
            })}
            className="card-panel hover:border-amber-500/60 text-left transition-colors group"
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-white group-hover:text-amber-300">Gold Trend Rider</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-950 text-amber-400 border border-amber-800">M5</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">EMA 9/21 Dynamic Trend Alpha</p>
          </button>

          <button
            onClick={() => handleQuickPresetDeploy({
              name: 'BTCUSD Momentum Breakout',
              symbol: 'BTCUSD',
              timeframe: 'M15',
              strategyType: 'BREAKOUT_VOLATILITY',
              lotSize: 0.02,
              sl: 500,
              tp: 1000,
            })}
            className="card-panel hover:border-emerald-500/60 text-left transition-colors group"
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-white group-hover:text-emerald-300">BTC Momentum</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">M15</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">20-Bar Channel Breakout</p>
          </button>

          <button
            onClick={() => handleQuickPresetDeploy({
              name: 'Multi-Asset Consensus Alpha',
              symbol: 'EURUSD',
              timeframe: 'M1',
              strategyType: 'MULTI_INDICATOR_CONSENSUS',
              lotSize: 0.1,
              sl: 250,
              tp: 500,
            })}
            className="card-panel hover:border-purple-500/60 text-left transition-colors group"
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-white group-hover:text-purple-300">Consensus Engine</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-950 text-purple-400 border border-purple-800">M1</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Triple RSI + EMA Alignment</p>
          </button>
        </div>
      </div>

      {/* Bot Instances List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white font-mono tracking-tight flex items-center gap-2">
            <Layers className="h-4 w-4 text-indigo-400" />
            <span>Deployed Bot Instances ({bots.length})</span>
          </h2>
        </div>

        {bots.length === 0 ? (
          <div className="card-panel text-center font-mono text-xs text-slate-400 space-y-3">
            <p>No automated trading bots currently configured.</p>
            <button
              onClick={() => setShowDeployModal(true)}
              className="btn btn-primary"
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
                      ? 'border-indigo-500/80 shadow-md shadow-indigo-950/40 ring-1 ring-indigo-500/30'
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
                        b.executionMode === 'LIVE' ? 'bg-rose-950 text-rose-300 border border-rose-800/60' : 'bg-slate-950 text-indigo-300 border border-indigo-800/60'
                      }`}>
                        {b.executionMode}
                      </span>
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="flex items-center gap-1.5 flex-wrap font-mono text-[10px]">
                    <span className="px-2 py-0.5 rounded bg-slate-950 text-indigo-400 border border-slate-800 font-bold">
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
                  <div className="card-panel font-mono text-xs space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Latest Signal:</span>
                      <span className={`font-bold ${
                        b.stats.lastSignal === 'BUY'
                          ? 'text-emerald-400'
                          : b.stats.lastSignal === 'SELL'
                          ? 'text-rose-400'
                          : 'text-indigo-300'
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
                      className="btn btn-secondary gap-1"
                      title="Trigger immediate evaluation"
                    >
                      <Activity className={`h-3 w-3 ${evaluatingBotId === b.id ? 'animate-spin' : ''}`} />
                      <span>Eval</span>
                    </button>

                    <button
                      onClick={(e) => { e.stopPropagation(); handleOpenEditModal(b); }}
                      className="btn btn-secondary p-1"
                      title="Edit bot configuration"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>

                    <button
                      onClick={(e) => { e.stopPropagation(); handleClosePositions(b.id, 0); }}
                      className="btn btn-secondary gap-1"
                      title="Emergency close positions"
                    >
                      <Square className="h-3 w-3" />
                      <span>Close</span>
                    </button>

                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteBot(b.id, b.name); }}
                      className="btn btn-secondary p-1"
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

      {/* Selected Bot Detailed Inspector */}
      {selectedBot && (
        <div className="card-panel space-y-6 font-mono">
          {/* Header of Selected Bot */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-base font-bold text-white">{selectedBot.name}</h3>
                <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                  selectedBot.status === 'RUNNING' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-slate-950 text-slate-400 border border-slate-800'
                }`}>
                  {selectedBot.status}
                </span>
                <span className="text-xs text-slate-500">Magic #{selectedBot.magicNumber}</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Strategy: {selectedBot.strategyName} ({selectedBot.strategyType}) • Asset: {selectedBot.symbol} [{selectedBot.timeframe}]
              </p>
            </div>

            {/* Test Execution Signals */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400 mr-1">Force Test Signal:</span>
              <button
                onClick={() => handleForceSignal('BUY')}
                disabled={forcingSignal !== null}
                className="px-3 py-1 rounded bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-800/80 text-xs font-bold transition-colors flex items-center gap-1"
              >
                <ArrowUpRight className="h-3.5 w-3.5" />
                <span>Test BUY</span>
              </button>
              <button
                onClick={() => handleForceSignal('SELL')}
                disabled={forcingSignal !== null}
                className="px-3 py-1 rounded bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800/80 text-xs font-bold transition-colors flex items-center gap-1"
              >
                <ArrowDownRight className="h-3.5 w-3.5" />
                <span>Test SELL</span>
              </button>
            </div>
          </div>

          {/* Sub Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <button
              onClick={() => setActiveTab('positions')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                activeTab === 'positions' ? 'bg-indigo-950 text-indigo-300 border border-indigo-800' : 'text-slate-400 hover:text-white'
              }`}
            >
              Active Positions ({botPositions.length})
            </button>
            <button
              onClick={() => setActiveTab('executions')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                activeTab === 'executions' ? 'bg-indigo-950 text-indigo-300 border border-indigo-800' : 'text-slate-400 hover:text-white'
              }`}
            >
              Execution Fills ({botExecutions.length})
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                activeTab === 'logs' ? 'bg-indigo-950 text-indigo-300 border border-indigo-800' : 'text-slate-400 hover:text-white'
              }`}
            >
              Signal & Audit Logs ({botLogs.length})
            </button>
            <button
              onClick={() => setActiveTab('ai')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                activeTab === 'ai' ? 'bg-indigo-950 text-indigo-300 border border-indigo-800' : 'text-slate-400 hover:text-white'
              }`}
            >
              External AI Control API
            </button>
          </div>

          {/* Tab 1: Active Open Positions */}
          {activeTab === 'positions' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Current positions managed by this bot</span>
                {botPositions.length > 0 && (
                  <button
                    onClick={() => handleClosePositions(selectedBot.id, botPositions.length)}
                    className="px-2.5 py-1 rounded bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800 text-[11px] font-bold"
                  >
                    Close All Bot Positions
                  </button>
                )}
              </div>

              {botPositions.length === 0 ? (
                <div className="py-12 border border-dashed border-slate-800 rounded-xl text-center text-slate-500 text-xs">
                  No active open positions. Bot is monitoring live tick candles for trade criteria.
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-800 rounded-lg">
                  <table className="data-table">
                    <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                      <tr>
                        <th className="data-table-th">Ticket</th>
                        <th className="data-table-th">Symbol</th>
                        <th className="data-table-th">Type</th>
                        <th className="data-table-th">Volume</th>
                        <th className="data-table-th">Entry Price</th>
                        <th className="data-table-th">Current Price</th>
                        <th className="data-table-th">SL</th>
                        <th className="data-table-th">TP</th>
                        <th className="data-table-th">Unrealized P&L</th>
                        <th className="data-table-th">Mode</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 bg-slate-900/40 text-[11px]">
                      {botPositions.map((pos) => (
                        <tr key={pos.id || pos.ticket} className="btn btn-secondary">
                          <td className="data-table-td text-indigo-400 font-bold">#{pos.ticket}</td>
                          <td className="data-table-td text-white">{pos.symbol}</td>
                          <td className={`py-2 px-3 font-bold ${pos.orderType === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {pos.orderType}
                          </td>
                          <td className="data-table-td text-white">{pos.volume}</td>
                          <td className="data-table-td text-slate-300">{Number(pos.entryPrice).toFixed(4)}</td>
                          <td className="data-table-td text-slate-300">{pos.currentPrice ? Number(pos.currentPrice).toFixed(4) : '-'}</td>
                          <td className="data-table-td text-slate-400">{pos.sl ? Number(pos.sl).toFixed(4) : '-'}</td>
                          <td className="data-table-td text-slate-400">{pos.tp ? Number(pos.tp).toFixed(4) : '-'}</td>
                          <td className={`py-2 px-3 font-bold ${Number(pos.pnl) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {pos.pnl !== undefined ? `$${Number(pos.pnl).toFixed(2)}` : '$0.00'}
                          </td>
                          <td className="data-table-td">
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-950 text-indigo-300 border border-indigo-800/60">
                              {pos.executionMode}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Execution Fills History */}
          {activeTab === 'executions' && (
            <div className="overflow-x-auto border border-slate-800 rounded-lg max-h-96">
              <table className="data-table">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] sticky top-0 border-b border-slate-800">
                  <tr>
                    <th className="data-table-th">Time</th>
                    <th className="data-table-th">Type</th>
                    <th className="data-table-th">Vol</th>
                    <th className="data-table-th">Entry</th>
                    <th className="data-table-th">Exit</th>
                    <th className="data-table-th">P&L</th>
                    <th className="data-table-th">Status</th>
                    <th className="data-table-th">Reason / Logic</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-900/40 text-[11px]">
                  {botExecutions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500">
                        No trade fills recorded yet for this bot.
                      </td>
                    </tr>
                  ) : (
                    botExecutions.map((e) => (
                      <tr key={e.id} className="btn btn-secondary">
                        <td className="data-table-td text-slate-400">{new Date(e.openedAt).toLocaleTimeString()}</td>
                        <td className={`py-2 px-3 font-bold ${e.orderType === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {e.orderType}
                        </td>
                        <td className="data-table-td text-white">{e.volume}</td>
                        <td className="data-table-td text-slate-300">{Number(e.entryPrice).toFixed(4)}</td>
                        <td className="data-table-td text-slate-300">{e.exitPrice ? Number(e.exitPrice).toFixed(4) : '-'}</td>
                        <td className={`py-2 px-3 font-bold ${Number(e.pnl) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {e.pnl !== undefined ? `$${Number(e.pnl).toFixed(2)}` : '-'}
                        </td>
                        <td className="data-table-td">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                            e.status === 'OPEN' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-slate-950 text-slate-400 border border-slate-800'
                          }`}>
                            {e.status}
                          </span>
                        </td>
                        <td className="data-table-td text-slate-400 max-w-xs truncate">{e.reason || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Tab 3: Signal & Audit Logs */}
          {activeTab === 'logs' && (
            <div className="card-panel overflow-y-auto max-h-96 space-y-1.5">
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
                        : 'bg-slate-900 text-indigo-300 border border-slate-800'
                    }`}>
                      {l.level}
                    </span>
                    <span className="text-slate-300 break-words flex-1">{l.message}</span>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tab 4: External AI Control API */}
          {activeTab === 'ai' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Control this specific bot programmatically via External AI Daemon</span>
                <button
                  onClick={() => handleCopy(pythonAiBotSnippet, 'bot-py')}
                  className="btn btn-secondary gap-1"
                >
                  {copiedCode === 'bot-py' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  <span>{copiedCode === 'bot-py' ? 'Copied' : 'Copy Python'}</span>
                </button>
              </div>
              <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-indigo-300 overflow-x-auto">
{`# External AI control payload for Bot #${selectedBot.id}
import requests

API_URL = "http://localhost:3000/api/daemon/dispatch"

# 1. Update live risk allocation
requests.post(API_URL, json={
    "action": "BOT_UPDATE_CONFIG",
    "botId": "${selectedBot.id}",
    "updates": {
        "allocation": {"lotSize": 0.15, "maxPositions": 3, "maxDailyLoss": 200}
    }
})

# 2. Trigger instant signal execution
requests.post(API_URL, json={
    "action": "BOT_FORCE_SIGNAL",
    "botId": "${selectedBot.id}",
    "signal": "BUY"
})

# 3. Emergency close positions
requests.post(API_URL, json={
    "action": "BOT_CLOSE_POSITIONS",
    "botId": "${selectedBot.id}",
    "reason": "AI Risk Guard Intervention"
})`}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal (Replaces window.confirm) */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card-panel w-full max-w-md space-y-4 font-mono">
            <div className="flex items-center gap-3 text-white">
              <AlertTriangle className={`h-5 w-5 ${confirmDialog.confirmColor === 'rose' ? 'text-rose-400' : 'text-amber-400'}`} />
              <h3 className="text-base font-bold">{confirmDialog.title}</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              {confirmDialog.message}
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setConfirmDialog(null)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className={`px-4 py-2 rounded-lg text-white text-xs font-bold transition-colors ${
                  confirmDialog.confirmColor === 'rose' ? 'bg-rose-600 hover:bg-rose-500' : 'bg-amber-600 hover:bg-amber-500'
                }`}
              >
                {confirmDialog.confirmText || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit Existing Bot Configuration */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card-panel w-full max-w-lg max-h-[90vh] overflow-y-auto space-y-5 font-mono">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-indigo-400" />
                <h2 className="text-base font-bold text-white">Edit Bot Configuration</h2>
              </div>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-white text-sm">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditSubmit} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Bot Name</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="input-control w-full"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Symbol</label>
                  <input
                    type="text"
                    required
                    value={editForm.symbol}
                    onChange={(e) => setEditForm({ ...editForm, symbol: e.target.value })}
                    className="input-control w-full"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Timeframe</label>
                  <select
                    value={editForm.timeframe}
                    onChange={(e) => setEditForm({ ...editForm, timeframe: e.target.value })}
                    className="input-control w-full"
                  >
                    <option value="M1">M1</option>
                    <option value="M5">M5</option>
                    <option value="M15">M15</option>
                    <option value="H1">H1</option>
                    <option value="D1">D1</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Mode</label>
                  <select
                    value={editForm.executionMode}
                    onChange={(e) => setEditForm({ ...editForm, executionMode: e.target.value as any })}
                    className="input-control w-full"
                  >
                    <option value="PAPER">PAPER</option>
                    <option value="LIVE">LIVE</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Lot Size</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={editForm.lotSize}
                    onChange={(e) => setEditForm({ ...editForm, lotSize: Number(e.target.value) })}
                    className="input-control w-full"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Max Positions</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={editForm.maxPositions}
                    onChange={(e) => setEditForm({ ...editForm, maxPositions: Number(e.target.value) })}
                    className="input-control w-full"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Stop Loss Points</label>
                  <input
                    type="number"
                    value={editForm.stopLossPoints}
                    onChange={(e) => setEditForm({ ...editForm, stopLossPoints: Number(e.target.value) })}
                    className="input-control w-full"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Take Profit Points</label>
                  <input
                    type="number"
                    value={editForm.takeProfitPoints}
                    onChange={(e) => setEditForm({ ...editForm, takeProfitPoints: Number(e.target.value) })}
                    className="input-control w-full"
                  />
                </div>
              </div>

              <div className="card-panel space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-bold">Dynamic Trailing Stop</span>
                  <input
                    type="checkbox"
                    checked={editForm.trailingEnabled}
                    onChange={(e) => setEditForm({ ...editForm, trailingEnabled: e.target.checked })}
                    className="rounded border-slate-800 text-indigo-500 focus:ring-0"
                  />
                </div>
                {editForm.trailingEnabled && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="text-slate-400 block mb-1 text-[11px]">Distance Points</label>
                      <input
                        type="number"
                        value={editForm.trailingDistance}
                        onChange={(e) => setEditForm({ ...editForm, trailingDistance: Number(e.target.value) })}
                        className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-white"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1 text-[11px]">Step Points</label>
                      <input
                        type="number"
                        value={editForm.trailingStep}
                        onChange={(e) => setEditForm({ ...editForm, trailingStep: Number(e.target.value) })}
                        className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-white"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Deploy New Trading Bot */}
      {showDeployModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card-panel w-full max-w-xl max-h-[90vh] overflow-y-auto space-y-5 font-mono">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-indigo-400" />
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
                  className="input-control w-full"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Strategy from Knowledge Base</label>
                  <select
                    value={deployForm.strategyId}
                    onChange={(e) => setDeployForm({ ...deployForm, strategyId: e.target.value })}
                    className="input-control w-full"
                  >
                    {strategies.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Symbol (Any Broker Asset)</label>
                  <input
                    type="text"
                    required
                    value={deployForm.symbol}
                    onChange={(e) => setDeployForm({ ...deployForm, symbol: e.target.value })}
                    placeholder="e.g. EURUSD, XAUUSD, BTCUSDm..."
                    className="input-control w-full"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Timeframe</label>
                  <select
                    value={deployForm.timeframe}
                    onChange={(e) => setDeployForm({ ...deployForm, timeframe: e.target.value })}
                    className="input-control w-full"
                  >
                    <option value="M1">M1 (1m)</option>
                    <option value="M5">M5 (5m)</option>
                    <option value="M15">M15 (15m)</option>
                    <option value="M30">M30 (30m)</option>
                    <option value="H1">H1 (1h)</option>
                    <option value="H4">H4 (4h)</option>
                    <option value="D1">D1 (1d)</option>
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
                    className="input-control w-full"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Execution Mode</label>
                  <select
                    value={deployForm.executionMode}
                    onChange={(e) => setDeployForm({ ...deployForm, executionMode: e.target.value as any })}
                    className="input-control w-full"
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
                    className="input-control w-full"
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
                    className="input-control w-full"
                  />
                </div>
              </div>

              <div className="card-panel space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-bold">Dynamic Trailing Stop</span>
                  <input
                    type="checkbox"
                    checked={deployForm.trailingEnabled}
                    onChange={(e) => setDeployForm({ ...deployForm, trailingEnabled: e.target.checked })}
                    className="rounded border-slate-800 text-indigo-500 focus:ring-0"
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
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
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
