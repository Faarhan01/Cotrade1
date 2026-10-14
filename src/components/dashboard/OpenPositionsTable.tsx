import React, { useState } from 'react';
import { Position } from '@/types';
import { api } from '../../lib/api';
import {
  SlidersHorizontal,
  XCircle,
  TrendingUp,
  Shield,
  Layers,
  Check,
  AlertCircle,
} from 'lucide-react';

interface OpenPositionsTableProps {
  positions: Position[];
  onSelectSymbol?: (symbol: string) => void;
}

export const OpenPositionsTable: React.FC<OpenPositionsTableProps> = ({
  positions,
  onSelectSymbol,
}) => {
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [modifySL, setModifySL] = useState<string>('');
  const [modifyTP, setModifyTP] = useState<string>('');
  const [isModifying, setIsModifying] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [closingTickets, setClosingTickets] = useState<Record<number, boolean>>({});
  const [confirmingCloseAll, setConfirmingCloseAll] = useState(false);

  const handleOpenModifyModal = (pos: Position) => {
    setSelectedPosition(pos);
    setModifySL(pos.sl > 0 ? pos.sl.toString() : '');
    setModifyTP(pos.tp > 0 ? pos.tp.toString() : '');
    setActionMessage(null);
  };

  const handleSaveModification = async () => {
    if (!selectedPosition) return;
    try {
      setIsModifying(true);
      const res = await api.modifyPosition(
        selectedPosition.ticket,
        modifySL ? parseFloat(modifySL) : undefined,
        modifyTP ? parseFloat(modifyTP) : undefined
      );

      if (res.success) {
        setActionMessage({ text: `Position #${selectedPosition.ticket} modified!` });
        setTimeout(() => setSelectedPosition(null), 1200);
      } else {
        setActionMessage({ text: res.message || 'Failed to modify', error: true });
      }
    } catch (e: any) {
      setActionMessage({ text: e.message || 'Error sending modification', error: true });
    } finally {
      setIsModifying(false);
    }
  };

  const handleClosePosition = async (ticket: number) => {
    try {
      setClosingTickets((prev) => ({ ...prev, [ticket]: true }));
      const res = await api.closePosition(ticket);
      if (!res.success) {
        console.error('Close position failed:', res.message);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => {
        setClosingTickets((prev) => ({ ...prev, [ticket]: false }));
      }, 1500);
    }
  };

  const handleCloseAll = async () => {
    if (!confirmingCloseAll) {
      setConfirmingCloseAll(true);
      setTimeout(() => setConfirmingCloseAll(false), 4000);
      return;
    }
    setConfirmingCloseAll(false);
    for (const pos of positions) {
      try {
        await api.closePosition(pos.ticket);
      } catch (e) {
        console.error(`Failed to close position #${pos.ticket}`, e);
      }
    }
  };

  const totalLots = positions.reduce((acc, p) => acc + p.volume, 0);
  const totalProfit = positions.reduce((acc, p) => acc + p.profit, 0);

  return (
    <div className="card-panel">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-indigo-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Open Positions ({positions.length})
            </h2>
          </div>
          <div className="text-xs text-slate-400 font-mono mt-0.5">
            Total Exposure: <span className="text-white font-bold">{totalLots.toFixed(2)} Lots</span> • Net PnL:{' '}
            <span
              className={`font-bold ${
                totalProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {totalProfit >= 0 ? '+' : ''}${totalProfit.toFixed(2)}
            </span>
          </div>
        </div>

        {positions.length > 0 && (
          <button
            onClick={handleCloseAll}
            className={`self-start sm:self-auto px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              confirmingCloseAll
                ? 'bg-rose-600 hover:bg-rose-700 text-white border border-rose-500 animate-pulse'
                : 'bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/80'
            }`}
          >
            <XCircle className="h-3.5 w-3.5" />
            {confirmingCloseAll ? 'Confirm Close All (Click Again)' : 'Close All Positions'}
          </button>
        )}
      </div>

      {positions.length === 0 ? (
        <div className="border border-dashed border-slate-800 rounded-lg p-8 text-center text-slate-400 font-mono text-xs space-y-2">
          <div className="text-sm font-bold text-slate-300">
            0 Active Positions in MetaTrader 5
          </div>
          <p className="text-slate-500 max-w-lg mx-auto">
            No simulated or fake trades are generated. Live positions appear here in real-time as soon as trades
            are executed by your external AI agent via MCP or manually dispatched via the Order Execution Dock.
          </p>
        </div>
      ) : (
        <div className="data-table-container">
          <table className="data-table">
            <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="data-table-th">Ticket</th>
                <th className="data-table-th">Symbol</th>
                <th className="data-table-th">Type</th>
                <th className="data-table-th">Lots</th>
                <th className="data-table-th">Open Price</th>
                <th className="data-table-th">Current</th>
                <th className="data-table-th">SL</th>
                <th className="data-table-th">TP</th>
                <th className="data-table-th">PnL ($)</th>
                <th className="data-table-th">Trailing</th>
                <th className="data-table-th">Comment / AI</th>
                <th className="data-table-th text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {positions.map((pos) => {
                const digits = pos.symbol.includes('JPY') ? 3 : pos.symbol.includes('USD') && pos.symbol.length <= 6 ? 5 : 2;
                const isProfit = pos.profit >= 0;
                const isClosing = closingTickets[pos.ticket];

                return (
                  <tr
                    key={pos.ticket}
                    className="btn btn-secondary group"
                  >
                    <td className="data-table-td font-semibold text-slate-300">
                      #{pos.ticket}
                    </td>
                    <td
                      className="data-table-td font-bold text-white cursor-pointer hover:text-indigo-400"
                      onClick={() => onSelectSymbol?.(pos.symbol)}
                    >
                      {pos.symbol}
                    </td>
                    <td className="data-table-td">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          pos.type === 'BUY'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                            : 'bg-rose-950 text-rose-300 border border-rose-800/60'
                        }`}
                      >
                        {pos.type}
                      </span>
                    </td>
                    <td className="data-table-td font-semibold text-slate-200">
                      {pos.volume.toFixed(2)}
                    </td>
                    <td className="data-table-td text-slate-300">
                      {pos.openPrice.toFixed(digits)}
                    </td>
                    <td className="data-table-td text-slate-200 font-bold">
                      {pos.currentPrice.toFixed(digits)}
                    </td>
                    <td className="data-table-td text-slate-400">
                      {pos.sl > 0 ? pos.sl.toFixed(digits) : '—'}
                    </td>
                    <td className="data-table-td text-slate-400">
                      {pos.tp > 0 ? pos.tp.toFixed(digits) : '—'}
                    </td>
                    <td className="data-table-td font-bold">
                      <span className={isProfit ? 'text-emerald-400' : 'text-rose-400'}>
                        {isProfit ? '+' : ''}${pos.profit.toFixed(2)}
                      </span>
                    </td>
                    <td className="data-table-td">
                      {pos.trailingEnabled ? (
                        <span className="flex items-center gap-1 text-[10px] text-indigo-300 bg-indigo-950/70 border border-indigo-800/50 px-1.5 py-0.5 rounded">
                          <Shield className="h-2.5 w-2.5" /> Active
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500">Off</span>
                      )}
                    </td>
                    <td className="data-table-td text-slate-400 text-[11px] truncate max-w-[130px]">
                      {pos.comment || '—'}
                    </td>
                    <td className="data-table-td text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenModifyModal(pos)}
                          title="Modify Stop Loss & Take Profit"
                          className="btn btn-secondary p-1"
                        >
                          <SlidersHorizontal className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleClosePosition(pos.ticket)}
                          disabled={isClosing}
                          title="Close Position in MT5"
                          className="px-2 py-1 rounded bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800/80 transition-colors flex items-center gap-1 text-[11px]"
                        >
                          <XCircle className="h-3 w-3" />
                          <span>{isClosing ? 'Closing...' : 'Close'}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modify SL/TP Modal */}
      {selectedPosition && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card-panel max-w-md w-full">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-indigo-400" />
                <h3 className="text-base font-bold text-white font-mono">
                  Modify Position #{selectedPosition.ticket}
                </h3>
              </div>
              <button
                onClick={() => setSelectedPosition(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div className="card-panel grid grid-cols-2 gap-2 text-slate-300">
                <div>
                  <span className="text-slate-500 block text-[10px]">Symbol</span>
                  <span className="font-bold">{selectedPosition.symbol}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Type / Lots</span>
                  <span className="font-bold">{selectedPosition.type} {selectedPosition.volume} Lots</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Open Price</span>
                  <span>{selectedPosition.openPrice}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Current Price</span>
                  <span className="font-bold text-indigo-400">{selectedPosition.currentPrice}</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">New Stop Loss (SL)</label>
                <input
                  type="number"
                  step="any"
                  value={modifySL}
                  onChange={(e) => setModifySL(e.target.value)}
                  placeholder="0 (disabled)"
                  className="input-control w-full"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">New Take Profit (TP)</label>
                <input
                  type="number"
                  step="any"
                  value={modifyTP}
                  onChange={(e) => setModifyTP(e.target.value)}
                  placeholder="0 (disabled)"
                  className="input-control w-full"
                />
              </div>

              {actionMessage && (
                <div
                  className={`p-2 rounded flex items-center gap-1.5 text-xs ${
                    actionMessage.error
                      ? 'bg-rose-950/80 text-rose-300 border border-rose-800'
                      : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                  }`}
                >
                  {actionMessage.error ? <AlertCircle className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                  <span>{actionMessage.text}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedPosition(null)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveModification}
                  disabled={isModifying}
                  className="btn btn-primary gap-1.5"
                >
                  {isModifying ? 'Modifying on MT5...' : 'Save & Dispatch'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
