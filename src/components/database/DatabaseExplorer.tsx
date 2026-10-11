import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import {
  Database,
  Download,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  HardDrive,
  FileSpreadsheet,
  Clock,
  Layers,
  Trash2,
  ShieldCheck,
  Check,
  Compass,
  FlaskConical,
} from 'lucide-react';

export const DatabaseExplorer: React.FC = () => {
  const [analytics, setAnalytics] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [pruning, setPruning] = useState(false);
  const [pruneFeedback, setPruneFeedback] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const loadData = async () => {
    try {
      setLoading(true);
      const [anData, ordData] = await Promise.all([
        api.getDatabaseAnalytics().catch(() => null),
        api.getDatabaseOrders(100).catch(() => ({ orders: [] })),
      ]);
      if (anData) setAnalytics(anData);
      if (ordData && ordData.orders) setOrders(ordData.orders);
    } catch (err) {
      console.error('Error loading DB data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrune = async () => {
    try {
      setPruning(true);
      const res = await api.pruneDatabase();
      setPruneFeedback(res.message);
      await loadData();
    } catch (err: any) {
      setPruneFeedback(`Pruning error: ${err?.message || err}`);
    } finally {
      setPruning(false);
      setTimeout(() => setPruneFeedback(null), 4000);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredOrders = orders.filter((o) => {
    if (filterStatus !== 'all' && o.status !== filterStatus) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        (o.id && o.id.toLowerCase().includes(term)) ||
        (o.symbol && o.symbol.toLowerCase().includes(term)) ||
        (o.action && o.action.toLowerCase().includes(term)) ||
        (o.source && o.source.toLowerCase().includes(term)) ||
        (o.deal_ticket && o.deal_ticket.toString().includes(term))
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/30 to-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                <Database className="h-5 w-5" />
              </span>
              <h1 className="text-xl font-extrabold text-white tracking-tight">
                Persistent SQLite Database & Order Archive
              </h1>
            </div>
            <p className="text-sm text-slate-300 mt-2 max-w-3xl leading-relaxed">
              Every market trade dispatched by the external AI (via MCP) or direct manual order, along with
              deal tickets, broker execution prices, slippage latencies, and risk events, is recorded to an
              embedded SQLite database.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
            <button
              onClick={handlePrune}
              disabled={pruning}
              title="Purge unexecuted orders older than 24h & trim old data"
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-800/60 text-xs font-mono flex items-center gap-1.5 transition-colors"
            >
              <Trash2 className={`h-3.5 w-3.5 ${pruning ? 'animate-spin' : ''}`} />
              <span>{pruning ? 'Pruning...' : 'Prune Stale (24h+)'}</span>
            </button>

            <button
              onClick={loadData}
              disabled={loading}
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            <a
              href="/api/database/download"
              download="mt5_bridge.sqlite"
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all shadow-md shadow-indigo-950/50"
            >
              <Download className="h-4 w-4" />
              Download .sqlite DB
            </a>
          </div>
        </div>

        {pruneFeedback && (
          <div className="mt-4 p-2.5 rounded-lg bg-indigo-950/80 border border-indigo-800 text-xs font-mono text-indigo-300 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span>{pruneFeedback}</span>
          </div>
        )}
      </div>

      {/* Retention Policy Banner */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono text-slate-400">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>
            <strong className="text-slate-200">24-Hour Expiration Active:</strong> Unexecuted pending orders older than 24 hours are automatically purged to prevent stale delayed orders from executing in MT5.
          </span>
        </div>
        <div className="text-[11px] text-slate-500 shrink-0">
          Retention: Max 1,000 orders • 5,000 ticks • 2,000 candles • 200 backtests
        </div>
      </div>

      {/* Analytics Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 font-mono">
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 shadow-sm">
          <span className="text-[10px] text-slate-500 uppercase block">Database Storage</span>
          <div className="text-base font-bold text-white mt-1 flex items-center gap-1.5">
            <HardDrive className="h-4 w-4 text-indigo-400" />
            <span>
              {analytics ? `${(analytics.dbSizeBytes / 1024).toFixed(1)} KB` : 'Initializing...'}
            </span>
          </div>
          <span className="text-[10px] text-slate-500 mt-0.5 block truncate">
            data/mt5_bridge.sqlite
          </span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm">
          <span className="text-[10px] text-slate-500 uppercase block">Total Orders Stored</span>
          <div className="text-lg font-bold text-cyan-300 mt-1">
            {analytics?.totalOrders ?? orders.length}
          </div>
          <span className="text-[10px] text-slate-500 mt-0.5 block">
            Indexed by Command ID
          </span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm">
          <span className="text-[10px] text-slate-500 uppercase block">Executed Deals</span>
          <div className="text-lg font-bold text-emerald-400 mt-1">
            {analytics?.executedOrders ?? 0}
          </div>
          <span className="text-[10px] text-slate-500 mt-0.5 block">
            Confirmed with Broker Tickets
          </span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm">
          <span className="text-[10px] text-slate-500 uppercase block">Execution Success Rate</span>
          <div className="text-lg font-bold text-white mt-1">
            {analytics?.executionSuccessRate ?? 100}%
          </div>
          <span className="text-[10px] text-slate-500 mt-0.5 block">
            MT5 OrderSend Accuracy
          </span>
        </div>
      </div>

      {/* Orders Table Panel */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-indigo-400" />
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                Historical Orders Table ({filteredOrders.length})
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Persisted in SQLite orders table with 24-hour expiration rule
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-slate-500 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search orders..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs font-mono text-white focus:border-indigo-500 focus:outline-none w-44"
              />
            </div>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-300 focus:border-indigo-500 focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="executed">Executed</option>
              <option value="failed">Failed</option>
              <option value="dispatched">Dispatched</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="border border-dashed border-slate-800 rounded-lg p-10 text-center text-slate-500 font-mono text-xs space-y-1">
            <p className="text-sm font-bold text-slate-400">Database Ready — 0 Orders Logged</p>
            <p className="text-slate-500">
              When manual orders or external AI MCP tools are dispatched, they will be archived here automatically.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Order ID</th>
                  <th className="py-2.5 px-3">Action</th>
                  <th className="py-2.5 px-3">Symbol / Lots</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Deal Ticket</th>
                  <th className="py-2.5 px-3">Exec Price</th>
                  <th className="py-2.5 px-3">Latency</th>
                  <th className="py-2.5 px-3">Origin</th>
                  <th className="py-2.5 px-3 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredOrders.map((ord) => {
                  const isExecuted = ord.status === 'executed';
                  const isFailed = ord.status === 'failed';

                  return (
                    <tr key={ord.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-2.5 px-3 font-semibold text-slate-300">
                        {ord.id}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-indigo-300 font-bold text-[10px]">
                          {ord.action}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {ord.symbol && (
                            <span className="font-extrabold text-white text-xs bg-slate-950 px-1.5 py-0.5 rounded border border-slate-700">
                              {ord.symbol}
                            </span>
                          )}
                          {ord.order_type && (
                            <span
                              className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                                ord.order_type === 'BUY' || ord.order_type.startsWith('BUY')
                                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                                  : 'bg-rose-950 text-rose-300 border border-rose-800/60'
                              }`}
                            >
                              {ord.order_type}
                            </span>
                          )}
                          {ord.volume !== null && ord.volume !== undefined && (
                            <span className="text-slate-300 font-semibold text-[11px]">
                              {ord.volume} lot{ord.volume === 1 ? '' : 's'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        {isExecuted ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-950/70 border border-emerald-800 px-1.5 py-0.2 rounded">
                            <CheckCircle2 className="h-3 w-3" /> Executed
                          </span>
                        ) : isFailed ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-400 bg-rose-950/70 border border-rose-800 px-1.5 py-0.2 rounded">
                            <AlertCircle className="h-3 w-3" /> Failed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-950/70 border border-amber-800 px-1.5 py-0.2 rounded">
                            <Clock className="h-3 w-3" /> {ord.status}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-300 font-bold">
                        {ord.deal_ticket ? `#${ord.deal_ticket}` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-cyan-300 font-bold">
                        {ord.execution_price ? ord.execution_price : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400">
                        {ord.execution_time_ms ? `${ord.execution_time_ms}ms` : '—'}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-950 border border-slate-800 text-slate-400">
                          {ord.source}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 text-right">
                        {ord.created_at ? new Date(ord.created_at).toLocaleTimeString() : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
