import React from 'react';
import { TradeCommand } from '@/types';
import { GitCommit, Clock, CheckCircle2, AlertCircle, Send, ArrowRight } from 'lucide-react';

interface AsyncQueueMonitorProps {
  queue: TradeCommand[];
}

export const AsyncQueueMonitor: React.FC<AsyncQueueMonitorProps> = ({ queue }) => {
  return (
    <div className="card-panel space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <GitCommit className="h-5 w-5 text-indigo-400" />
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              Asynchronous Order Pipeline Monitor
            </h2>
            <p className="text-xs text-slate-400 font-mono">
              Real-time dispatch & execution status between AI Bridge and MetaTrader 5 Terminal
            </p>
          </div>
        </div>

        <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
          Queue Size: {queue.length}
        </span>
      </div>

      {queue.length === 0 ? (
        <div className="border border-dashed border-slate-800 rounded-lg p-8 text-center text-slate-500 font-mono text-xs">
          No orders in queue. The queue populates automatically when external AI or manual orders are dispatched.
        </div>
      ) : (
        <div className="data-table-container">
          <table className="data-table">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="data-table-th">Command ID</th>
                <th className="data-table-th">Action</th>
                <th className="data-table-th">Parameters</th>
                <th className="data-table-th">Source</th>
                <th className="data-table-th">Pipeline Status</th>
                <th className="data-table-th">MT5 Deal / Price</th>
                <th className="data-table-th">Latency</th>
                <th className="data-table-th text-right">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {queue.map((cmd) => {
                const isExecuted = cmd.status === 'executed';
                const isFailed = cmd.status === 'failed';
                const isDispatched = cmd.status === 'dispatched';
                const isPending = cmd.status === 'pending';

                return (
                  <tr key={cmd.id} className="btn btn-secondary">
                    <td className="data-table-td font-semibold text-slate-300">
                      {cmd.id}
                    </td>
                    <td className="data-table-td">
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-indigo-300 font-bold text-[10px]">
                        {cmd.action}
                      </span>
                    </td>
                    <td className="data-table-td text-slate-200">
                      {cmd.symbol && <span className="font-bold mr-1">{cmd.symbol}</span>}
                      {cmd.orderType && (
                        <span
                          className={`mr-1 font-bold ${
                            cmd.orderType === 'BUY' ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {cmd.orderType}
                        </span>
                      )}
                      {cmd.volume && <span>{cmd.volume} lots</span>}
                      {cmd.ticket && <span>Ticket #{cmd.ticket}</span>}
                    </td>
                    <td className="data-table-td">
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-950 text-slate-400 border border-slate-800">
                        {cmd.source}
                      </span>
                    </td>
                    <td className="data-table-td">
                      {isExecuted && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/70 border border-emerald-800 px-2 py-0.5 rounded">
                          <CheckCircle2 className="h-3 w-3" /> Executed
                        </span>
                      )}
                      {isDispatched && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-400 bg-indigo-950/70 border border-indigo-800 px-2 py-0.5 rounded animate-pulse">
                          <Send className="h-3 w-3" /> In MT5
                        </span>
                      )}
                      {isPending && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-amber-950/70 border border-amber-800 px-2 py-0.5 rounded">
                          <Clock className="h-3 w-3" /> Queued
                        </span>
                      )}
                      {isFailed && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-400 bg-rose-950/70 border border-rose-800 px-2 py-0.5 rounded">
                          <AlertCircle className="h-3 w-3" /> Failed
                        </span>
                      )}
                    </td>
                    <td className="data-table-td text-slate-300">
                      {cmd.result ? (
                        cmd.result.success ? (
                          <span>
                            Deal #{cmd.result.dealTicket || 'OK'} @{' '}
                            <span className="text-indigo-300">{cmd.result.executionPrice || 'Market'}</span>
                          </span>
                        ) : (
                          <span className="text-rose-400 truncate max-w-[150px] block" title={cmd.result.errorMessage}>
                            {cmd.result.errorMessage || `Code ${cmd.result.errorCode}`}
                          </span>
                        )
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="data-table-td text-slate-400">
                      {cmd.result?.executionTimeMs ? `${cmd.result.executionTimeMs} ms` : '—'}
                    </td>
                    <td className="data-table-td text-slate-500 text-right">
                      {new Date(cmd.createdAt).toLocaleTimeString()}
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
