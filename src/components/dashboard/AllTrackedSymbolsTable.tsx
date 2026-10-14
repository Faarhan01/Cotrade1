import React, { useState } from 'react';
import { DetailedSymbolInfo, TickData } from '@/types';
import { Layers, Search, Zap, ExternalLink, ShieldCheck, CheckCircle2 } from 'lucide-react';

interface AllTrackedSymbolsTableProps {
  symbols: DetailedSymbolInfo[];
  ticks: TickData[];
  selectedSymbol: string;
  onSelectSymbol: (symbol: string) => void;
}

export const AllTrackedSymbolsTable: React.FC<AllTrackedSymbolsTableProps> = ({
  symbols,
  ticks,
  selectedSymbol,
  onSelectSymbol,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Fallback to ticks if detailed symbols array is still populating
  const displaySymbols: DetailedSymbolInfo[] =
    symbols && symbols.length > 0
      ? symbols
      : ticks.map((t) => ({
          symbol: t.symbol,
          bid: t.bid,
          ask: t.ask,
          spread: t.spread,
          digits: t.symbol.includes('JPY') ? 3 : 5,
          point: t.symbol.includes('JPY') ? 0.001 : 0.00001,
          minLot: 0.01,
          maxLot: 100.0,
          lotStep: 0.01,
          contractSize: 100000,
          tradeAllowed: true,
          high24h: t.high24h,
          low24h: t.low24h,
        }));

  const filtered = displaySymbols.filter((s) =>
    s.symbol.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="card-panel space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-indigo-400" />
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              All Tracked Broker Symbols ({displaySymbols.length})
            </h2>
            <p className="text-xs text-slate-400 font-mono">
              Real-time broker market specifications & quotes discovered via Peron MT5 Python Package
            </p>
          </div>
        </div>

        <div className="relative">
          <Search className="h-3.5 w-3.5 text-slate-500 absolute left-2.5 top-2.5" />
          <input
            type="text"
            placeholder="Search symbols..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-control w-48"
          />
        </div>
      </div>

      {displaySymbols.length === 0 ? (
        <div className="border border-dashed border-slate-800 rounded-lg p-8 text-center text-slate-400 font-mono text-xs space-y-2">
          <div className="text-sm font-bold text-slate-300">
            Awaiting Broker Symbols via Peron MT5 Package
          </div>
          <p className="text-slate-500 max-w-lg mx-auto">
            Once connected to your local MetaTrader 5 terminal, all market watch symbols will be queried directly via the Python package and populate here with real live quotes and broker specifications.
          </p>
        </div>
      ) : (
        <div className="data-table-container">
          <table className="data-table">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="data-table-th">Symbol</th>
                <th className="data-table-th">Live Bid</th>
                <th className="data-table-th">Live Ask</th>
                <th className="data-table-th">Spread</th>
                <th className="data-table-th">24h / Session Range</th>
                <th className="data-table-th">Min - Max Lot</th>
                <th className="data-table-th">Contract Size</th>
                <th className="data-table-th">Trading</th>
                <th className="data-table-th text-right">Direct Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.map((item) => {
                const isSelected = selectedSymbol.toLowerCase() === item.symbol.toLowerCase();
                const digits = item.digits ?? (item.symbol.toLowerCase().includes('jpy') ? 3 : 5);
const high = item.sessionHigh || item.high24h || ticks.find(t => t.symbol === item.symbol)?.high24h;
      const low = item.sessionLow || item.low24h || ticks.find(t => t.symbol === item.symbol)?.low24h;
                const contractSizeStr = item.contractSize != null ? item.contractSize.toLocaleString() : '100,000';
                const minLot = item.minLot ?? 0.01;
                const maxLot = item.maxLot ?? 100.0;
                const spread = item.spread ?? (item.ask && item.bid ? Math.round((item.ask - item.bid) * Math.pow(10, digits)) : 0);

                return (
                  <tr
                    key={item.symbol}
                    className={`hover:bg-slate-800/50 transition-colors ${
                      isSelected ? 'bg-indigo-950/20' : ''
                    }`}
                  >
                    <td className="data-table-td">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-xs">{item.symbol}</span>
                        {item.isCurrentChart && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/60">
                            Active Chart
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="data-table-td font-semibold text-emerald-400">
                      {item.bid != null && item.bid > 0 ? item.bid.toFixed(digits) : '—'}
                    </td>
                    <td className="data-table-td text-slate-200">
                      {item.ask != null && item.ask > 0 ? item.ask.toFixed(digits) : '—'}
                    </td>
                    <td className="data-table-td text-indigo-300 font-bold">
                      {spread} pts
                    </td>
                    <td className="data-table-td text-slate-400">
                      {high != null && low != null && high > 0 ? (
                        <div className="text-[11px]">
                          <span className="text-rose-400">{low.toFixed(digits)}</span>
                          <span className="text-slate-600 mx-1">→</span>
                          <span className="text-emerald-400">{high.toFixed(digits)}</span>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="data-table-td text-slate-400">
                      {minLot} - {maxLot}
                    </td>
                    <td className="data-table-td text-slate-400">
                      {contractSizeStr}
                    </td>
                    <td className="data-table-td">
                      {item.tradeAllowed ? (
                        <span className="text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-1.5 py-0.5 rounded">
                          Enabled
                        </span>
                      ) : (
                        <span className="text-[10px] text-rose-400 bg-rose-950/60 border border-rose-800/60 px-1.5 py-0.5 rounded">
                          Disabled
                        </span>
                      )}
                    </td>
                    <td className="data-table-td text-right">
                      <button
                        onClick={() => onSelectSymbol(item.symbol)}
                        className={`px-2.5 py-1 rounded text-xs font-bold transition-all inline-flex items-center gap-1 ${
                          isSelected
                            ? 'bg-indigo-600 text-white shadow'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white'
                        }`}
                      >
                        <Zap className="h-3 w-3" />
                        <span>{isSelected ? 'Active Chart' : 'Select'}</span>
                      </button>
                    </td>
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
