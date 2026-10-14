import React from 'react';
import { AccountInfo } from '@/types';
import { Wallet, TrendingUp, ShieldCheck, DollarSign, Layers } from 'lucide-react';

interface AccountMetricsBarProps {
  account: AccountInfo | null;
}

export const AccountMetricsBar: React.FC<AccountMetricsBarProps> = ({ account }) => {
  if (!account) return null;

  const isConnected = account.login > 0;
  const isProfitPositive = account.profit >= 0;
  const formatMoney = (value: number) => isConnected
    ? `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '—';
  const marginLevelColor =
    account.marginLevel > 500
      ? 'text-emerald-400'
      : account.marginLevel > 200
      ? 'text-indigo-400'
      : account.marginLevel > 100
      ? 'text-amber-400'
      : 'text-rose-400';

  return (
    <div className="card-panel flex flex-col gap-4">
      <div className="card-panel-header">
        <div className="card-panel-title">
          <Wallet className="w-4 h-4 text-indigo-400" />
          <span>Account High-Level Metrics</span>
        </div>
      </div>
      {!isConnected && (
        <div className="card-panel flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-slate-500" />
            <span className="text-slate-300 font-bold">
              No live MT5 account:
            </span>
            <span className="text-slate-400">
              account metrics will appear after the terminal is connected
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {/* Balance */}
      <div className="metric-box">
        <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-1">
          <span className="metric-label">Balance</span>
          <Wallet className="h-3.5 w-3.5 text-slate-500" />
        </div>
        <div className="metric-val text-white">
          {formatMoney(account.balance)}
        </div>
        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
          {isConnected ? `${account.currency} • ${account.server}` : 'Disconnected'}
        </div>
      </div>

      {/* Equity */}
      <div className="metric-box">
        <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-1">
          <span className="metric-label">Equity</span>
          <TrendingUp className="h-3.5 w-3.5 text-indigo-400" />
        </div>
        <div className="metric-val text-indigo-300">
          {formatMoney(account.equity)}
        </div>
        <div className="text-[11px] text-slate-400 font-mono mt-0.5">
          Net Assets
        </div>
      </div>

      {/* Floating Profit */}
      <div className="metric-box">
        <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-1">
          <span className="metric-label">Floating PnL</span>
          <DollarSign className={`h-3.5 w-3.5 ${isProfitPositive ? 'text-emerald-400' : 'text-rose-400'}`} />
        </div>
        <div className={`metric-val ${!isConnected ? 'text-slate-500' : isProfitPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
          {isConnected ? `${isProfitPositive ? '+' : ''}${formatMoney(account.profit)}` : '—'}
        </div>
        <div className="text-[11px] text-slate-400 font-mono mt-0.5">
          Live MT5 Unrealized
        </div>
      </div>

      {/* Free Margin */}
      <div className="metric-box">
        <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-1">
          <span className="metric-label">Free Margin</span>
          <ShieldCheck className="h-3.5 w-3.5 text-slate-500" />
        </div>
        <div className="metric-val text-slate-200">
          {formatMoney(account.freeMargin)}
        </div>
        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
          Available to Trade
        </div>
      </div>

      {/* Used Margin */}
      <div className="metric-box">
        <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-1">
          <span className="metric-label">Used Margin</span>
          <Layers className="h-3.5 w-3.5 text-slate-500" />
        </div>
        <div className="metric-val text-slate-300">
          {formatMoney(account.margin)}
        </div>
        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
          {isConnected ? `Leverage 1:${account.leverage}` : 'Leverage unavailable'}
        </div>
      </div>

      {/* Margin Level */}
      <div className="metric-box">
        <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-1">
          <span className="metric-label">Margin Level</span>
          <span className="text-[10px] uppercase font-mono px-1 rounded bg-slate-800 text-slate-400">
            {account.tradeMode}
          </span>
        </div>
        <div className={`metric-val ${marginLevelColor}`}>
          {isConnected && account.margin > 0 ? `${account.marginLevel.toFixed(1)}%` : '—'}
        </div>
        <div className="text-[11px] text-slate-400 font-mono mt-0.5">
          {!isConnected || account.margin <= 0 ? 'Health: Unavailable' : account.marginLevel > 200 ? 'Health: Optimal' : 'Health: Caution'}
        </div>
      </div>
    </div>
  </div>
);
};