import React, { useEffect, useState } from 'react';
import { BookOpen, RefreshCw } from 'lucide-react';
import { api } from '../../lib/api';

interface DepthLevel {
  price: number;
  volume: number;
}

interface MarketDepthPanelProps {
  symbol: string;
}

export const MarketDepthPanel: React.FC<MarketDepthPanelProps> = ({ symbol }) => {
  const [bids, setBids] = useState<DepthLevel[]>([]);
  const [asks, setAsks] = useState<DepthLevel[]>([]);
  const [message, setMessage] = useState('Loading broker depth');
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const result = await api.getMarketDepth(symbol);
        if (!active) return;
        const depth = result.depth || { bids: [], asks: [] };
        setBids(depth.bids.slice(0, 8));
        setAsks(depth.asks.slice(0, 8));
        setMessage(result.success && (depth.bids.length || depth.asks.length)
          ? ''
          : 'Depth is unavailable for this symbol or not provided by the broker.');
        setUpdatedAt(Date.now());
      } catch (error: any) {
        if (active) setMessage(error?.message || 'Market depth request failed.');
      }
    };
    refresh();
    const timer = setInterval(refresh, 2500);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [symbol]);

  const maxVolume = Math.max(0.0001, ...bids.map((level) => level.volume), ...asks.map((level) => level.volume));
  const digits = symbol.includes('JPY') ? 3 : symbol.includes('XAU') ? 2 : 5;
  const renderLevels = (levels: DepthLevel[], side: 'bid' | 'ask') => levels.map((level, index) => (
    <div key={`${side}-${level.price}-${index}`} className="relative grid grid-cols-[1fr_auto] items-center gap-3 overflow-hidden py-1.5 font-mono text-xs tabular-nums">
      <span
        className={`absolute inset-y-0 ${side === 'bid' ? 'right-0 bg-emerald-500/10' : 'left-0 bg-rose-500/10'}`}
        style={{ width: `${Math.max(2, (level.volume / maxVolume) * 100)}%` }}
      />
      <span className={`relative ${side === 'bid' ? 'text-emerald-300' : 'text-rose-300'}`}>{level.price.toFixed(digits)}</span>
      <span className="relative text-slate-300">{level.volume.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
    </div>
  ));

  return (
    <section className="card-panel">
      <header className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-indigo-400" />
          <h2 className="text-sm font-bold uppercase text-white">Market Depth</h2>
          <span className="font-mono text-xs text-slate-400">{symbol}</span>
        </div>
        <span className="flex items-center gap-1.5 text-[10px] font-mono text-slate-500">
          <RefreshCw className="h-3 w-3" />
          {updatedAt ? new Date(updatedAt).toLocaleTimeString() : 'Waiting'}
        </span>
      </header>

      {message ? (
        <div className="py-8 text-center text-xs font-mono text-slate-500">{message}</div>
      ) : (
        <div className="grid grid-cols-1 gap-5 pt-3 sm:grid-cols-2">
          {([
            ['Bids', bids, 'bid'],
            ['Asks', asks, 'ask'],
          ] as const).map(([title, levels, side]) => (
            <div key={title}>
              <div className="mb-1 grid grid-cols-[1fr_auto] text-[10px] uppercase tracking-wider text-slate-500">
                <span>{title} ({levels.length})</span><span>Volume</span>
              </div>
              {renderLevels(levels, side)}
            </div>
          ))}
        </div>
      )}
    </section>
  );
};