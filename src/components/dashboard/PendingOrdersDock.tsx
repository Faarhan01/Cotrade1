import React, { useState } from 'react';
import { PendingOrder } from '@/types';
import { api } from '../../lib/api';
import {
  Clock,
  XCircle,
  SlidersHorizontal,
  Check,
  AlertCircle,
  ListOrdered,
} from 'lucide-react';

interface PendingOrdersDockProps {
  pendingOrders: PendingOrder[];
  onSelectSymbol?: (symbol: string) => void;
}

export const PendingOrdersDock: React.FC<PendingOrdersDockProps> = ({
  pendingOrders,
  onSelectSymbol,
}) => {
  const [selectedOrder, setSelectedOrder] = useState<PendingOrder | null>(null);
  const [modifyPrice, setModifyPrice] = useState<string>('');
  const [modifySL, setModifySL] = useState<string>('');
  const [modifyTP, setModifyTP] = useState<string>('');
  const [isModifying, setIsModifying] = useState(false);
  const [cancellingTickets, setCancellingTickets] = useState<Record<number, boolean>>({});
  const [actionMessage, setActionMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const handleOpenModify = (order: PendingOrder) => {
    setSelectedOrder(order);
    setModifyPrice(order.priceOpen ? String(order.priceOpen) : '');
    setModifySL(order.sl ? String(order.sl) : '');
    setModifyTP(order.tp ? String(order.tp) : '');
    setActionMessage(null);
  };

  const handleSaveModify = async () => {
    if (!selectedOrder) return;
    try {
      setIsModifying(true);
      const res = await api.modifyPendingOrder(
        selectedOrder.ticket,
        modifyPrice ? parseFloat(modifyPrice) : undefined,
        modifySL ? parseFloat(modifySL) : undefined,
        modifyTP ? parseFloat(modifyTP) : undefined
      );

      if (res.success) {
        setActionMessage({ text: `Order #${selectedOrder.ticket} modified successfully!` });
        setTimeout(() => setSelectedOrder(null), 1200);
      } else {
        setActionMessage({ text: res.message || 'Failed to modify order', error: true });
      }
    } catch (e: any) {
      setActionMessage({ text: e.message || 'Error sending modification', error: true });
    } finally {
      setIsModifying(false);
    }
  };

  const handleCancelOrder = async (ticket: number) => {
    try {
      setCancellingTickets((prev) => ({ ...prev, [ticket]: true }));
      await api.sendCommand({
        action: 'CANCEL_PENDING',
        ticket,
        source: 'MANUAL_UI',
      });
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => {
        setCancellingTickets((prev) => ({ ...prev, [ticket]: false }));
      }, 1500);
    }
  };

  return (
    <div className="card-panel space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListOrdered className="h-4 w-4 text-indigo-400" />
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            Pending Orders ({pendingOrders.length})
          </h2>
        </div>
        <span className="text-xs text-slate-400 font-mono">
          Limits & Stops resting in MetaTrader 5 order book
        </span>
      </div>

      {pendingOrders.length === 0 ? (
        <div className="border border-dashed border-slate-800 rounded-lg p-6 text-center text-slate-400 font-mono text-xs">
          0 Pending Limit or Stop Orders Active in MT5
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
                <th className="data-table-th">Order Price</th>
                <th className="data-table-th">SL</th>
                <th className="data-table-th">TP</th>
                <th className="data-table-th">Comment</th>
                <th className="data-table-th text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {pendingOrders.map((ord) => {
                const isCancelling = cancellingTickets[ord.ticket];
                return (
                  <tr key={ord.ticket} className="btn btn-secondary">
                    <td className="data-table-td font-semibold text-slate-300">#{ord.ticket}</td>
                    <td
                      className="data-table-td font-bold text-white cursor-pointer hover:text-indigo-400"
                      onClick={() => onSelectSymbol?.(ord.symbol)}
                    >
                      {ord.symbol}
                    </td>
                    <td className="data-table-td">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-950/80 text-amber-300 border border-amber-800/60">
                        {ord.type}
                      </span>
                    </td>
                    <td className="data-table-td font-semibold text-slate-200">{ord.volume.toFixed(2)}</td>
                    <td className="data-table-td text-indigo-400 font-bold">{ord.priceOpen.toFixed(5)}</td>
                    <td className="data-table-td text-slate-400">{ord.sl > 0 ? ord.sl.toFixed(5) : '—'}</td>
                    <td className="data-table-td text-slate-400">{ord.tp > 0 ? ord.tp.toFixed(5) : '—'}</td>
                    <td className="data-table-td text-slate-400 text-[11px] truncate max-w-[120px]">
                      {ord.comment || '—'}
                    </td>
                    <td className="data-table-td text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenModify(ord)}
                          title="Modify Price & SL/TP"
                          className="btn btn-secondary p-1"
                        >
                          <SlidersHorizontal className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleCancelOrder(ord.ticket)}
                          disabled={isCancelling}
                          title="Cancel Order"
                          className="px-2 py-1 rounded bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800/80 transition-colors flex items-center gap-1 text-[11px]"
                        >
                          <XCircle className="h-3 w-3" />
                          <span>{isCancelling ? 'Cancelling...' : 'Cancel'}</span>
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

      {/* Modify Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card-panel max-w-md w-full">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-indigo-400" />
                <h3 className="text-base font-bold text-white font-mono">
                  Modify Pending Order #{selectedOrder.ticket}
                </h3>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div className="card-panel text-slate-300 grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-500 block text-[10px]">Symbol / Type</span>
                  <span className="font-bold">
                    {selectedOrder.symbol} ({selectedOrder.type})
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Volume</span>
                  <span className="font-bold">{selectedOrder.volume} Lots</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">New Order Execution Price</label>
                <input
                  type="number"
                  step="any"
                  value={modifyPrice}
                  onChange={(e) => setModifyPrice(e.target.value)}
                  className="input-control w-full"
                />
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
                  onClick={() => setSelectedOrder(null)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveModify}
                  disabled={isModifying}
                  className="btn btn-primary"
                >
                  {isModifying ? 'Updating...' : 'Save & Update in MT5'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
