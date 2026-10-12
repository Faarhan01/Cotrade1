import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Activity,
  Play,
  Pause,
  AlertTriangle,
  Radio,
  Send,
  RefreshCw,
  Trash2,
  CheckCircle2,
  Clock,
  Terminal,
  Shield,
  Code,
  Copy,
  Check,
  Zap,
  Sliders,
} from 'lucide-react';
import { api } from '../lib/api';

export const DaemonPage: React.FC = () => {
  const [status, setStatus] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('ALL');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Command Dispatch State
  const [dispatchForm, setDispatchForm] = useState({
    action: 'BUY',
    symbol: 'EURUSD',
    volume: 0.1,
    sl: 250,
    tp: 500,
    confidence: 0.92,
    reason: 'External AI Momentum Breakout Consensus',
  });
  const [dispatchResult, setDispatchResult] = useState<any>(null);
  const [dispatching, setDispatching] = useState(false);

  // Watchlist State
  const [newSymbolInput, setNewSymbolInput] = useState('');

  const fetchDaemonData = async () => {
    try {
      setLoading(true);
      const res = await api.getDaemonStatus();
      if (res?.success) {
        setStatus(res.daemon);
      }
      const eventsRes = await api.getDaemonEvents({ limit: 50 });
      if (eventsRes?.success) {
        setEvents(eventsRes.events || []);
      }
    } catch (err) {
      console.error('Failed to fetch daemon status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDaemonData();
    const interval = setInterval(fetchDaemonData, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleHeartbeatPing = async () => {
    try {
      await api.sendDaemonHeartbeat('Local AI Test Agent', 'test-session-1', {
        provider: 'manual_ping',
      });
      fetchDaemonData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDispatchCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setDispatching(true);
      setDispatchResult(null);
      const res = await api.dispatchDaemonCommand(dispatchForm);
      setDispatchResult(res);
      fetchDaemonData();
    } catch (err: any) {
      setDispatchResult({ success: false, message: err.message });
    } finally {
      setDispatching(false);
    }
  };

  const handleEmergencyHalt = async () => {
    try {
      await api.dispatchDaemonCommand({
        action: 'EMERGENCY_HALT',
        reason: 'User manual trigger from Daemon Console',
      });
      fetchDaemonData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleResumeDaemon = async () => {
    try {
      await api.dispatchDaemonCommand({ action: 'RESUME' });
      fetchDaemonData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleClearEvents = async () => {
    try {
      await api.clearDaemonEvents();
      setEvents([]);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddWatchlist = async () => {
    if (!newSymbolInput.trim()) return;
    const current = status?.watchlist || [];
    const upper = newSymbolInput.trim().toUpperCase();
    if (!current.includes(upper)) {
      const updated = [...current, upper];
      await api.updateDaemonWatchlist(updated);
      setNewSymbolInput('');
      fetchDaemonData();
    }
  };

  const handleRemoveWatchlist = async (sym: string) => {
    const current = status?.watchlist || [];
    const updated = current.filter((s: string) => s !== sym);
    await api.updateDaemonWatchlist(updated);
    fetchDaemonData();
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const filteredEvents = events.filter((e) => {
    if (selectedFilter === 'ALL') return true;
    return e.type.includes(selectedFilter);
  });

  const curlExample = `curl -X POST http://localhost:3000/api/daemon/dispatch \\
  -H "Content-Type: application/json" \\
  -d '{
    "action": "BUY",
    "symbol": "EURUSD",
    "volume": 0.1,
    "confidence": 0.95,
    "reason": "AI Breakout confirmation"
  }'`;

  const pythonExample = `import requests

# 1. External AI sends heartbeat
requests.post("http://localhost:3000/api/daemon/heartbeat", json={
    "aiName": "Claude DeepSeek Agent",
    "sessionId": "agent-quant-01"
})

# 2. AI emits autonomous trade command
res = requests.post("http://localhost:3000/api/daemon/dispatch", json={
    "action": "BUY",
    "symbol": "EURUSD",
    "volume": 0.1,
    "confidence": 0.91,
    "reason": "EMA cross with RSI oversold bounce"
})
print(res.json())`;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-6 rounded-2xl shadow-sm">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-cyan-950/80 border border-cyan-700/60 flex items-center justify-center text-cyan-400 shadow-md">
            <Cpu className="h-6 w-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-white tracking-tight">AI Autonomous Daemon Hub</h1>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full border uppercase font-bold ${
                  status?.status === 'RUNNING'
                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                    : 'bg-rose-950/80 text-rose-300 border-rose-700'
                }`}
              >
                {status?.status || 'INITIALIZING'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Autonomous execution loop and watchdog gateway for external AI models (ChatGPT, Claude, local LLMs).
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          {status?.status === 'RUNNING' ? (
            <button
              onClick={handleEmergencyHalt}
              className="btn btn-secondary text-rose-400 border-rose-800 hover:bg-rose-950/40 text-xs flex items-center gap-2"
            >
              <Pause className="h-3.5 w-3.5" />
              <span>Halt Daemon</span>
            </button>
          ) : (
            <button
              onClick={handleResumeDaemon}
              className="btn btn-primary text-xs flex items-center gap-2"
            >
              <Play className="h-3.5 w-3.5" />
              <span>Resume Daemon</span>
            </button>
          )}

          <button
            onClick={handleHeartbeatPing}
            className="btn btn-secondary text-xs flex items-center gap-2"
            title="Simulate AI Heartbeat Ping"
          >
            <Activity className="h-3.5 w-3.5 text-cyan-400" />
            <span>AI Ping</span>
          </button>

          <button
            onClick={fetchDaemonData}
            disabled={loading}
            className="btn btn-secondary text-xs p-2 text-slate-400 hover:text-white"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="terminal-card p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Daemon Uptime</span>
            <Clock className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="text-xl font-bold font-mono text-white">
            {status?.uptimeSeconds ? `${Math.floor(status.uptimeSeconds / 60)}m ${status.uptimeSeconds % 60}s` : '0s'}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-mono">
            Pulse loop: 2,000ms active
          </div>
        </div>

        {/* Metric 2 */}
        <div className="terminal-card p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>External AI Watchdog</span>
            <Radio
              className={`h-4 w-4 ${
                status?.ai?.connected ? 'text-emerald-400 animate-pulse' : 'text-amber-400'
              }`}
            />
          </div>
          <div className="text-xl font-bold font-mono text-white flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${
                status?.ai?.connected ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            />
            {status?.ai?.connected ? 'AI ACTIVE' : 'AWAITING AI'}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-mono truncate">
            {status?.ai?.name || 'External Agent'}
          </div>
        </div>

        {/* Metric 3 */}
        <div className="terminal-card p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Buffered Events</span>
            <Zap className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="text-xl font-bold font-mono text-cyan-400">
            {status?.processedEvents || 0}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-mono">
            Capped memory ring buffer
          </div>
        </div>

        {/* Metric 4 */}
        <div className="terminal-card p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Control Mode</span>
            <Shield className="h-4 w-4 text-violet-400" />
          </div>
          <div className="text-xl font-bold font-mono text-white uppercase">
            {status?.config?.aiControlMode || 'AUTONOMOUS'}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-mono">
            Auto risk guard: {status?.config?.autoRiskGuard ? 'ON' : 'OFF'}
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: AI Dispatch Dock & Watchlist */}
        <div className="space-y-6">
          {/* Dispatch Dock */}
          <div className="terminal-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Send className="h-4 w-4 text-cyan-400" />
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  AI Command Dispatch Dock
                </h2>
              </div>
              <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800">
                Direct MT5 Bridge
              </span>
            </div>

            <form onSubmit={handleDispatchCommand} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-mono text-slate-400 block mb-1">Action</label>
                  <select
                    value={dispatchForm.action}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, action: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:border-cyan-500"
                  >
                    <option value="BUY">BUY (Market Deal)</option>
                    <option value="SELL">SELL (Market Deal)</option>
                    <option value="CLOSE_ALL">CLOSE ALL POSITIONS</option>
                    <option value="EMERGENCY_HALT">HALT TRADING</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-mono text-slate-400 block mb-1">Symbol</label>
                  <input
                    type="text"
                    value={dispatchForm.symbol}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, symbol: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono uppercase focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-mono text-slate-400 block mb-1">Volume</label>
                  <input
                    type="number"
                    step="0.01"
                    value={dispatchForm.volume}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, volume: parseFloat(e.target.value) || 0.01 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-mono text-slate-400 block mb-1">SL (pts)</label>
                  <input
                    type="number"
                    value={dispatchForm.sl}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, sl: parseInt(e.target.value, 10) || 0 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-mono text-slate-400 block mb-1">TP (pts)</label>
                  <input
                    type="number"
                    value={dispatchForm.tp}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, tp: parseInt(e.target.value, 10) || 0 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1">AI Reasoning</label>
                <input
                  type="text"
                  value={dispatchForm.reason}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, reason: e.target.value })}
                  placeholder="e.g. Bullish order block identified"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:border-cyan-500"
                />
              </div>

              <button
                type="submit"
                disabled={dispatching}
                className="w-full btn btn-primary py-2 text-xs font-bold tracking-wider uppercase flex items-center justify-center gap-2 mt-2"
              >
                <Zap className="h-3.5 w-3.5" />
                <span>{dispatching ? 'Executing on MT5...' : 'Dispatch AI Order'}</span>
              </button>
            </form>

            {dispatchResult && (
              <div
                className={`mt-4 p-3 rounded-lg border text-xs font-mono ${
                  dispatchResult.success
                    ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                    : 'bg-rose-950/60 border-rose-800 text-rose-300'
                }`}
              >
                <div className="font-bold flex items-center gap-1.5">
                  {dispatchResult.success ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <AlertTriangle className="h-3.5 w-3.5" />
                  )}
                  <span>{dispatchResult.success ? 'Execution Accepted' : 'Execution Notice'}</span>
                </div>
                <div className="text-[11px] mt-1 text-slate-300">
                  {dispatchResult.message || (dispatchResult.success ? `Ticket #${dispatchResult.ticket}` : 'Check terminal connection')}
                </div>
              </div>
            )}
          </div>

          {/* Watchlist Manager */}
          <div className="terminal-card p-5">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3">
              Daemon Watchlist & Active Feeds
            </h3>
            <div className="flex flex-wrap gap-2 mb-3">
              {(status?.watchlist || []).map((sym: string) => (
                <span
                  key={sym}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-950 border border-slate-800 text-xs font-mono text-cyan-300"
                >
                  {sym}
                  <button
                    onClick={() => handleRemoveWatchlist(sym)}
                    className="text-slate-500 hover:text-rose-400 text-xs ml-1"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Add symbol (e.g. BTCUSD)"
                value={newSymbolInput}
                onChange={(e) => setNewSymbolInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddWatchlist()}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white font-mono uppercase"
              />
              <button
                onClick={handleAddWatchlist}
                className="btn btn-secondary text-xs px-3 py-1"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Right 2 Columns: Live Event Stream & Integration Docs */}
        <div className="lg:col-span-2 space-y-6">
          {/* Live Events Stream */}
          <div className="terminal-card p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-cyan-400" />
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  Live Daemon Event Stream
                </h2>
                <span className="text-[11px] font-mono text-slate-500">({filteredEvents.length} events)</span>
              </div>

              <div className="flex items-center gap-2">
                {/* Filter tags */}
                {['ALL', 'AI_', 'DAEMON_'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setSelectedFilter(f)}
                    className={`text-[10px] font-mono px-2 py-0.5 rounded transition-colors ${
                      selectedFilter === f
                        ? 'bg-cyan-500 text-slate-950 font-bold'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {f === 'ALL' ? 'ALL' : f.replace('_', '')}
                  </button>
                ))}

                <button
                  onClick={handleClearEvents}
                  className="text-slate-500 hover:text-rose-400 p-1"
                  title="Clear event buffer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Event List */}
            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {filteredEvents.length > 0 ? (
                filteredEvents.slice().reverse().map((ev, i) => (
                  <div
                    key={`${ev.ts}-${i}`}
                    className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 font-mono text-xs hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                      <span className="text-cyan-400 font-bold">{ev.type}</span>
                      <span>{new Date(ev.ts).toLocaleTimeString()}</span>
                    </div>
                    <pre className="text-[11px] text-slate-300 whitespace-pre-wrap overflow-x-auto bg-slate-900/60 p-2 rounded">
                      {JSON.stringify(ev.payload, null, 2)}
                    </pre>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-slate-500 font-mono text-xs">
                  No daemon events buffered. External AI actions and automated signals will stream here live.
                </div>
              )}
            </div>
          </div>

          {/* Integration Guide for External AI */}
          <div className="terminal-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Code className="h-4 w-4 text-violet-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                External AI Integration Endpoints
              </h3>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Your external AI (Python agent, Claude, OpenAI) can interface with this terminal via the following standard HTTP endpoints:
            </p>

            <div className="space-y-4">
              {/* Python Snippet */}
              <div>
                <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-1">
                  <span>Python Agent (Automated Trading)</span>
                  <button
                    onClick={() => handleCopy(pythonExample, 'py')}
                    className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 text-[11px]"
                  >
                    {copiedCode === 'py' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    <span>{copiedCode === 'py' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <pre className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto">
                  {pythonExample}
                </pre>
              </div>

              {/* cURL Snippet */}
              <div>
                <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-1">
                  <span>cURL Quick Execution</span>
                  <button
                    onClick={() => handleCopy(curlExample, 'curl')}
                    className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 text-[11px]"
                  >
                    {copiedCode === 'curl' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    <span>{copiedCode === 'curl' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <pre className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto">
                  {curlExample}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
