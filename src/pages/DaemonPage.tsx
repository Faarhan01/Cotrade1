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
  Database,
  BookOpen,
} from 'lucide-react';
import { api } from '../lib/api';

interface RegisteredCommand {
  name: string;
  category: string;
  description: string;
  inputSchema: { properties?: Record<string, any>; required?: string[] };
}

function exampleArguments(command?: RegisteredCommand): Record<string, any> {
  if (!command) return {};
  const examples: Record<string, any> = {
    symbol: 'EURUSD',
    orderType: 'BUY',
    volume: 0.01,
    timeframe: 'M1',
    count: 100,
    limit: 100,
    botId: 'bot-id',
    ticket: 0,
    strategyId: 'strategy-id',
  };
  const args: Record<string, any> = {};
  for (const key of command.inputSchema.required || []) {
    const property = command.inputSchema.properties?.[key] || {};
    args[key] = examples[key] ?? (property.enum?.[0] ?? (property.type === 'number' ? 0 : property.type === 'boolean' ? false : property.type === 'array' ? [] : property.type === 'object' ? {} : ''));
  }
  if (command.name === 'EXECUTE_TRADE') {
    args.symbol = 'EURUSD';
    args.orderType = 'BUY';
    args.volume = 0.01;
  }
  return args;
}

export const DaemonPage: React.FC = () => {
  const [status, setStatus] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('ALL');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Expanded Command Dispatch State
  const [actionCategory, setActionCategory] = useState<'trade' | 'check' | 'knowledge' | 'system'>('trade');
  const [commands, setCommands] = useState<RegisteredCommand[]>([]);
  const [selectedAction, setSelectedAction] = useState('EXECUTE_TRADE');
  const [commandArgsJson, setCommandArgsJson] = useState('{\n  "symbol": "EURUSD",\n  "orderType": "BUY",\n  "volume": 0.01\n}');
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
      const eventsRes = await api.getDaemonEvents({ limit: 60 });
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
    const statusInterval = setInterval(async () => {
      try {
        const res = await api.getDaemonStatus();
        if (res?.success) setStatus(res.daemon);
      } catch (error) {
        console.error('Failed to refresh daemon status:', error);
      }
    }, 10000);

    const eventSource = new EventSource('/api/daemon/stream');
    eventSource.addEventListener('snapshot', (message) => {
      try {
        setStatus(JSON.parse((message as MessageEvent).data));
      } catch {}
    });
    eventSource.addEventListener('daemon', (message) => {
      try {
        const incoming = JSON.parse((message as MessageEvent).data);
        setEvents((current) => [
          incoming,
          ...current.filter((event) => !(event.ts === incoming.ts && event.type === incoming.type)),
        ].slice(0, 60));
      } catch {}
    });

    return () => {
      clearInterval(statusInterval);
      eventSource.close();
    };
  }, []);

  useEffect(() => {
    api.getCommands().then(({ commands: available }) => setCommands(available)).catch((error) => {
      setDispatchResult({ success: false, message: error?.message || 'Failed to load commands' });
    });
  }, []);

  const visibleCommands = commands.filter((command) => {
    if (actionCategory === 'trade') return command.category === 'trading';
    if (actionCategory === 'check') return command.category === 'market' || command.category === 'account';
    if (actionCategory === 'knowledge') return command.category === 'knowledge';
    return command.category === 'system' || command.category === 'bot';
  });

  const selectCommand = (name: string) => {
    setSelectedAction(name);
    const command = commands.find((item) => item.name === name);
    setCommandArgsJson(JSON.stringify(exampleArguments(command), null, 2));
  };

  const handleHeartbeatPing = async () => {
    try {
      await api.sendDaemonHeartbeat('Local AI Test Agent', 'agent-quant-session-01', {
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

      const args = JSON.parse(commandArgsJson);
      if (!args || typeof args !== 'object' || Array.isArray(args)) {
        throw new Error('Command arguments must be a JSON object');
      }
      const payload = { action: selectedAction, ...args };

      const res = await api.dispatchDaemonCommand(payload);
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
    const sym = newSymbolInput.trim();
    if (!sym) return;
    const current = status?.watchlist || [];
    if (!current.some((s: string) => s.toLowerCase() === sym.toLowerCase())) {
      const updated = [...current, sym];
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
    "aiName": "Autonomous Quantitative Agent",
    "sessionId": "quant-session-01"
})

# 2. Control MetaTrader 5 execution
res = requests.post("http://localhost:3000/api/daemon/dispatch", json={
    "action": "BUY",
    "symbol": "EURUSD",
    "volume": 0.1,
    "confidence": 0.94,
    "reason": "RSI oversold consensus"
})
print("Trade Result:", res.json())

# 3. Save discovered strategy to Knowledge Base
strat = requests.post("http://localhost:3000/api/daemon/dispatch", json={
    "action": "CREATE_STRATEGY",
    "strategy": {
        "name": "EMA Trend Alpha",
        "symbol": "EURUSD",
        "type": "EMA_CROSSOVER",
        "parameters": {"fastEmaPeriod": 9, "slowEmaPeriod": 21}
    }
})
print("Knowledge Base:", strat.json())`;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-6 rounded-2xl shadow-sm">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-cyan-950/80 border border-cyan-700/60 flex items-center justify-center text-cyan-400 shadow-md shrink-0">
            <Cpu className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white tracking-tight">AI Autonomous Daemon Hub</h1>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className={`text-xs font-mono font-semibold ${status?.status === 'RUNNING' ? 'text-emerald-400' : 'text-rose-400'}`}>
                {status?.status || 'INITIALIZING'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 font-mono">
              Direct Python MetaTrader 5 controller & site Knowledge Base gateway for external AI agents.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {status?.status === 'RUNNING' ? (
            <button
              onClick={handleEmergencyHalt}
              className="px-3 py-1.5 rounded-lg border border-rose-800 text-rose-300 hover:bg-rose-950/50 text-xs font-mono transition-colors flex items-center gap-2"
            >
              <Pause className="h-3.5 w-3.5" />
              <span>Halt Daemon</span>
            </button>
          ) : (
            <button
              onClick={handleResumeDaemon}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono transition-colors flex items-center gap-2"
            >
              <Play className="h-3.5 w-3.5" />
              <span>Resume Daemon</span>
            </button>
          )}

          <button
            onClick={handleHeartbeatPing}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono transition-colors flex items-center gap-2"
            title="Simulate AI Heartbeat Ping"
          >
            <Activity className="h-3.5 w-3.5 text-cyan-400" />
            <span>AI Heartbeat</span>
          </button>

          <button
            onClick={fetchDaemonData}
            disabled={loading}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs transition-colors"
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
          <div className="text-xl font-bold font-mono text-white tabular-nums">
            {status?.uptimeSeconds ? `${Math.floor(status.uptimeSeconds / 60)}m ${status.uptimeSeconds % 60}s` : '0s'}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-mono">
            Cycle rate: 2,000ms loop
          </div>
        </div>

        {/* Metric 2 */}
        <div className="terminal-card p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>External AI Watchdog</span>
            <Radio className={`h-4 w-4 ${status?.ai?.connected ? 'text-emerald-400' : 'text-amber-400'}`} />
          </div>
          <div className="text-xl font-bold font-mono text-white flex items-center gap-2">
            <span className={`text-sm ${status?.ai?.connected ? 'text-emerald-400' : 'text-amber-400'}`}>
              {status?.ai?.connected ? 'AI Synchronized' : 'Standby / Awaiting'}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-mono truncate">
            {status?.ai?.name || 'External Agent'}
          </div>
        </div>

        {/* Metric 3 */}
        <div className="terminal-card p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Dispatched Events</span>
            <Zap className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="text-xl font-bold font-mono text-cyan-400 tabular-nums">
            {status?.processedEvents || 0}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-mono">
            Active SSE clients: {status?.activeSseSubscribers || 0}
          </div>
        </div>

        {/* Metric 4 */}
        <div className="terminal-card p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Operational Mode</span>
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
                <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                  AI Directive Dispatch Dock
                </h2>
              </div>
              <span className="text-xs font-mono text-slate-400">
                Direct Python IPC
              </span>
            </div>

            {/* Directive Category Selector */}
            <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-lg mb-4 text-xs font-mono">
              <button
                type="button"
                onClick={() => {
                  setActionCategory('trade');
                  selectCommand('EXECUTE_TRADE');
                }}
                className={`flex-1 py-1 px-2 rounded transition-colors ${
                  actionCategory === 'trade' ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Trading
              </button>
              <button
                type="button"
                onClick={() => {
                  setActionCategory('check');
                  selectCommand('CHECK_ORDER');
                }}
                className={`flex-1 py-1 px-2 rounded transition-colors ${
                  actionCategory === 'check' ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Analytics
              </button>
              <button
                type="button"
                onClick={() => {
                  setActionCategory('knowledge');
                  selectCommand('SAVE_STRATEGY');
                }}
                className={`flex-1 py-1 px-2 rounded transition-colors ${
                  actionCategory === 'knowledge' ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Knowledge
              </button>
              <button
                type="button"
                onClick={() => {
                  setActionCategory('system');
                  selectCommand('GET_ACCOUNT');
                }}
                className={`flex-1 py-1 px-2 rounded transition-colors ${
                  actionCategory === 'system' ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400 hover:text-white'
                }`}
              >
                System
              </button>
            </div>

            <form onSubmit={handleDispatchCommand} className="space-y-3">
              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1">Directive Action</label>
                <select
                  value={selectedAction}
                  onChange={(e) => selectCommand(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:border-cyan-500"
                >
                  {visibleCommands.map((command) => (
                    <option key={command.name} value={command.name}>{command.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-slate-400">{commands.find((command) => command.name === selectedAction)?.description || 'Loading registered commands.'}</p>
                <label className="text-[11px] font-mono text-slate-400 block">Command arguments (JSON)</label>
                <textarea
                  rows={10}
                  value={commandArgsJson}
                  onChange={(event) => setCommandArgsJson(event.target.value)}
                  spellCheck={false}
                  className="w-full resize-y bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:border-cyan-500"
                />
                <p className="text-[10px] text-slate-500 font-mono">
                  Required: {(commands.find((command) => command.name === selectedAction)?.inputSchema.required || []).join(', ') || 'none'}
                </p>
              </div>

              <button
                type="submit"
                disabled={dispatching}
                className="w-full py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {dispatching ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                <span>Execute Directive via Daemon</span>
              </button>
            </form>

            {dispatchResult && (
              <div className="mt-4 p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono">
                <div className="flex items-center justify-between mb-1">
                  <span className={dispatchResult.success ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                    {dispatchResult.success ? 'Execution Confirmed' : 'Execution Notice'}
                  </span>
                  <span className="text-slate-500 text-[10px]">JSON Payload</span>
                </div>
                <pre className="text-[11px] text-slate-300 overflow-x-auto max-h-40 leading-relaxed">
                  {JSON.stringify(dispatchResult, null, 2)}
                </pre>
              </div>
            )}
          </div>

          {/* Autonomous Watchlist */}
          <div className="terminal-card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sliders className="h-4 w-4 text-cyan-400" />
                <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                  Daemon Watchlist
                </h2>
              </div>
              <span className="text-xs font-mono text-slate-400">
                {status?.watchlist?.length || 0} active
              </span>
            </div>

            <div className="flex gap-2 mb-3">
              <input
                type="text"
                placeholder="Add Symbol (e.g. BTCUSD)"
                value={newSymbolInput}
                onChange={(e) => setNewSymbolInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddWatchlist()}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:border-cyan-500"
              />
              <button
                onClick={handleAddWatchlist}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-200"
              >
                Add
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {(status?.watchlist || []).map((sym: string) => (
                <span
                  key={sym}
                  className="px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300 flex items-center gap-1.5"
                >
                  <span>{sym}</span>
                  <button
                    onClick={() => handleRemoveWatchlist(sym)}
                    className="text-slate-500 hover:text-rose-400 text-sm ml-1"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Middle & Right Columns: Live Events Feed & AI API Reference */}
        <div className="lg:col-span-2 space-y-6">
          {/* Live Events Stream */}
          <div className="terminal-card p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-cyan-400" />
                <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                  Autonomous Daemon Event Stream (SSE Live)
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={selectedFilter}
                  onChange={(e) => setSelectedFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-300 font-mono"
                >
                  <option value="ALL">All Events</option>
                  <option value="AI_ORDER">AI Orders</option>
                  <option value="AI_HEARTBEAT">Heartbeats</option>
                  <option value="AI_STRATEGY">Strategies</option>
                  <option value="AI_OBSERVATION">Observations</option>
                  <option value="AI_BACKTEST">Backtests</option>
                  <option value="DAEMON_RISK">Risk Alerts</option>
                </select>

                <button
                  onClick={handleClearEvents}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-400 text-xs"
                  title="Clear events buffer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {filteredEvents.length === 0 ? (
              <div className="border border-dashed border-slate-800 rounded-lg p-8 text-center text-slate-500 font-mono text-xs">
                No events recorded matching filter. Dispatch a directive or ping heartbeat to view live stream.
              </div>
            ) : (
              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {filteredEvents.map((ev, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 font-mono text-xs hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-cyan-400 font-semibold">{ev.type}</span>
                        <span aria-hidden="true" className="text-slate-600">·</span>
                        <span className="text-slate-500 tabular-nums">
                          {ev.ts ? new Date(ev.ts).toLocaleTimeString() : 'now'}
                        </span>
                      </div>
                    </div>
                    <pre className="text-[11px] text-slate-400 overflow-x-auto leading-relaxed">
                      {JSON.stringify(ev.payload, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* External AI Integration Guide */}
          <div className="terminal-card p-5 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Code className="h-4 w-4 text-violet-400" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                External AI Integration Protocols
              </h2>
            </div>
            <p className="text-xs text-slate-400 font-mono leading-relaxed">
              Any external AI quantitative agent (Python, LangChain, Claude Desktop, AutoGen, or custom bots) can interact with this terminal using REST, Server-Sent Events, or Model Context Protocol (MCP):
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Python Snippet */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                <div className="flex items-center justify-between text-xs font-mono text-slate-300 font-semibold mb-2">
                  <span>Python Agent Integration</span>
                  <button
                    onClick={() => handleCopy(pythonExample, 'py-snippet')}
                    className="text-cyan-400 hover:text-cyan-300 text-[11px] flex items-center gap-1"
                  >
                    {copiedCode === 'py-snippet' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    <span>{copiedCode === 'py-snippet' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <pre className="text-[10px] font-mono text-slate-400 overflow-x-auto max-h-56 leading-relaxed">
                  {pythonExample}
                </pre>
              </div>

              {/* cURL Snippet */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                <div className="flex items-center justify-between text-xs font-mono text-slate-300 font-semibold mb-2">
                  <span>cURL REST Directive</span>
                  <button
                    onClick={() => handleCopy(curlExample, 'curl-snippet')}
                    className="text-cyan-400 hover:text-cyan-300 text-[11px] flex items-center gap-1"
                  >
                    {copiedCode === 'curl-snippet' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    <span>{copiedCode === 'curl-snippet' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <pre className="text-[10px] font-mono text-slate-400 overflow-x-auto max-h-56 leading-relaxed">
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

