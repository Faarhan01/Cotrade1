import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { HistoryDeal } from '@/types';
import {
  History,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Filter,
  DollarSign,
  Award,
  CheckCircle2,
  Clock,
} from 'lucide-react';

interface TradeHistoryViewerProps {
  onSelectSymbol?: (symbol: string) => void;
}

export const TradeHistoryViewer: React.FC<TradeHistoryViewerProps> = ({ onSelectSymbol }) => {
  const [deals, setDeals] = useState<HistoryDeal[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterSymbol, setFilterSymbol] = useState<string>('ALL');
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d' | 'all'>('7d');
  const [lastFetched, setLastFetched] = useState<number>(0);

  const fetchDeals = async () => {
    try {
      setLoading(true);
      const nowSec = Math.floor(Date.now() / 1000);
      let fromSec: number | undefined;
      if (timeRange === '24h') fromSec = nowSec - 86400;
      else if (timeRange === '7d') fromSec = nowSec - 7 * 86400;
      else if (timeRange === '30d') fromSec = nowSec - 30 * 86400;

      const res = await api.getHistoryDeals({ from: fromSec, count: 100 });
      if (res && Array.isArray(res.deals)) {
        setDeals(res.deals);
      }
      setLastFetched(Date.now());
    } catch (e) {
      console.error('Failed to fetch MT5 history deals:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeals();
  }, [timeRange]);

  const symbols = Array.from(new Set(deals.map((d) => d.symbol))).filter(Boolean);

  const filteredDeals = deals.filter((d) => {
    if (filterSymbol !== 'ALL' && d.symbol !== filterSymbol) return false;
    return true;
  });

  // Calculate high-level stats from real MT5 deals
  const totalProfit = filteredDeals.reduce((acc, d) => acc + (d.profit || 0), 0);
  const totalCommission = filteredDeals.reduce((acc, d) => acc + (d.commission || 0), 0);
  const totalSwap = filteredDeals.reduce((acc, d) => acc + (d.swap || 0), 0);
  const netPnL = totalProfit + totalCommission + totalSwap;
  const profitableDeals = filteredDeals.filter((d) => (d.profit || 0) > 0).length;
  const losingDeals = filteredDeals.filter((d) => (d.profit || 0) < 0).length;
  const winRate =
    filteredDeals.length > 0 ? ((profitableDeals / (profitableDeals + losingDeals || 1)) * 100).toFixed(1) : '0.0';

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-cyan-400" />
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              MT5 Trade History & Closed Deals
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                {filteredDeals.length} deals
              </span>
            </h2>
            <p className="text-xs text-slate-400 font-mono">
              Live historical trades and executed deals directly from MetaTrader 5 terminal
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Time range selector */}
          <div className="flex items-center bg-slate-950 rounded-lg p-0.5 border border-slate-800 text-xs font-mono">
            {(['24h', '7d', '30d', 'all'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-2 py-1 rounded transition-colors ${
                  timeRange === range
                    ? 'bg-cyan-500/20 text-cyan-300 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {range.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Symbol Filter */}
          {symbols.length > 0 && (
            <select
              value={filterSymbol}
              onChange={(e) => setFilterSymbol(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs font-mono text-slate-300 focus:outline-none focus:border-cyan-500"
            >
              <option value="ALL">All Symbols ({symbols.length})</option>
              {symbols.map((sym) => (
                <option key={sym} value={sym}>
                  {sym}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={fetchDeals}
            disabled={loading}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            title="Refresh history from MT5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Performance Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/70 border border-slate-800/80 rounded-lg p-3 font-mono text-xs">
        <div>
          <span className="text-slate-500 text-[10px] block uppercase">Net Realized PnL</span>
          <span
            className={`text-sm font-bold flex items-center gap-1 ${
              netPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {netPnL >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            {netPnL >= 0 ? '+' : ''}${netPnL.toFixed(2)}
          </span>
        </div>

        <div>
          <span className="text-slate-500 text-[10px] block uppercase">Win Rate</span>
          <span className="text-sm font-bold text-white flex items-center gap-1">
            <Award className="h-3.5 w-3.5 text-amber-400" />
            {winRate}%
            <span className="text-[10px] text-slate-400 font-normal">
              ({profitableDeals}W / {losingDeals}L)
            </span>
          </span>
        </div>

        <div>
          <span className="text-slate-500 text-[10px] block uppercase">Gross Profit / Loss</span>
          <span className="text-xs text-slate-300">
            <span className="text-emerald-400">+${totalProfit.toFixed(2)}</span>
            {' • '}
            <span className="text-rose-400">-${Math.abs(totalCommission + totalSwap).toFixed(2)} fee</span>
          </span>
        </div>

        <div>
          <span className="text-slate-500 text-[10px] block uppercase">Sync Status</span>
          <span className="text-xs text-cyan-400 flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            {lastFetched ? `${Math.floor((Date.now() - lastFetched) / 1000)}s ago` : 'Connected'}
          </span>
        </div>
      </div>

      {/* Deals Table */}
      {filteredDeals.length === 0 ? (
        <div className="border border-dashed border-slate-800 rounded-lg p-8 text-center text-slate-400 font-mono text-xs space-y-2">
          <Clock className="h-8 w-8 text-slate-600 mx-auto" />
          <div className="text-sm font-bold text-slate-300">No MT5 Deals In Selected Range</div>
          <p className="text-slate-500 max-w-md mx-auto">
            Executed broker deals from MetaTrader 5 will be displayed here with accurate execution tickets, volumes,
            realized profit, commissions, and exit prices.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Deal #</th>
                <th className="py-2.5 px-3">Order #</th>
                <th className="py-2.5 px-3">Symbol</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Direction</th>
                <th className="py-2.5 px-3">Volume</th>
                <th className="py-2.5 px-3">Exec Price</th>
                <th className="py-2.5 px-3">Commission</th>
                <th className="py-2.5 px-3">Swap</th>
                <th className="py-2.5 px-3">Profit ($)</th>
                <th className="py-2.5 px-3">Date / Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredDeals.map((deal) => {
                const isProfit = (deal.profit || 0) >= 0;
                const timeStr = deal.time
                  ? new Date(deal.time * 1000).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })
                  : '—';

                return (
                  <tr key={deal.ticket} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-2 px-3 font-semibold text-slate-300">#{deal.ticket}</td>
                    <td className="py-2 px-3 text-slate-400">{deal.order ? `#${deal.order}` : '—'}</td>
                    <td
                      className="py-2 px-3 font-bold text-white cursor-pointer hover:text-cyan-400"
                      onClick={() => onSelectSymbol?.(deal.symbol)}
                    >
                      {deal.symbol}
                    </td>
                    <td className="py-2 px-3">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          deal.type === 'BUY'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                            : 'bg-rose-950 text-rose-300 border border-rose-800/60'
                        }`}
                      >
                        {deal.type}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-400 text-[11px]">{deal.entry || 'IN/OUT'}</td>
                    <td className="py-2 px-3 font-semibold text-slate-200">
                      {deal.volume !== undefined ? deal.volume.toFixed(2) : '—'}
                    </td>
                    <td className="py-2 px-3 text-slate-200 font-bold">{deal.price ? deal.price.toFixed(5) : '—'}</td>
                    <td className="py-2 px-3 text-slate-400">
                      {deal.commission ? `-$${Math.abs(deal.commission).toFixed(2)}` : '$0.00'}
                    </td>
                    <td className="py-2 px-3 text-slate-400">
                      {deal.swap ? `${deal.swap >= 0 ? '+' : ''}$${deal.swap.toFixed(2)}` : '$0.00'}
                    </td>
                    <td className="py-2 px-3 font-bold">
                      <span className={isProfit ? 'text-emerald-400' : 'text-rose-400'}>
                        {isProfit ? '+' : ''}${deal.profit !== undefined ? deal.profit.toFixed(2) : '0.00'}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-400 text-[11px] whitespace-nowrap">{timeStr}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
