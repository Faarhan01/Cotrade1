import React, { useState } from 'react';
import { TradeOrderType, TickData, RiskGuardConfig, DetailedSymbolInfo } from '@/types';
import { api } from '../../lib/api';
import { Send, ArrowUp, ArrowDown, AlertTriangle, CheckCircle2, Info } from 'lucide-react';

interface OrderExecutionDockProps {
  selectedSymbol: string;
  ticks: TickData[];
  allSymbols?: DetailedSymbolInfo[];
  riskGuard: RiskGuardConfig | null;
  onSelectSymbol: (symbol: string) => void;
}

export const OrderExecutionDock: React.FC<OrderExecutionDockProps> = ({
  selectedSymbol,
  ticks,
  allSymbols = [],
  riskGuard,
  onSelectSymbol,
}) => {
  const [orderType, setOrderType] = useState<TradeOrderType>('BUY');
  const [volume, setVolume] = useState<string>('0.10');
  const [price, setPrice] = useState<string>('');
  const [stopLimitPrice, setStopLimitPrice] = useState<string>('');
  const [typeTime, setTypeTime] = useState<'GTC' | 'DAY' | 'SPECIFIED' | 'SPECIFIED_DAY'>('GTC');
  const [expiration, setExpiration] = useState<string>('');
  const [typeFilling, setTypeFilling] = useState<'AUTO' | 'FOK' | 'IOC' | 'RETURN' | 'BOC'>('AUTO');
  const [deviation, setDeviation] = useState<string>('20');
  const [sl, setSl] = useState<string>('');
  const [tp, setTp] = useState<string>('');
  const [riskPercent, setRiskPercent] = useState<string>('1');
  const [comment, setComment] = useState<string>('COPILOT_DESK');
  const [submitting, setSubmitting] = useState(false);
  const [sizing, setSizing] = useState(false);
  const [sizingResult, setSizingResult] = useState<any>(null);
  const [status, setStatus] = useState<{ message: string; error?: boolean } | null>(null);

  const activeTick = ticks.find((t) => t.symbol.toLowerCase() === selectedSymbol.toLowerCase());
  const symbolSpec = allSymbols.find((s) => s.symbol.toLowerCase() === selectedSymbol.toLowerCase());

  const riskMaxLots = riskGuard?.maxLotSizePerTrade || 2.0;
  const maxLots = Math.min(riskMaxLots, symbolSpec?.maxLot ?? riskMaxLots);
  const minLots = symbolSpec?.minLot ?? 0.01;
  const lotStep = symbolSpec?.lotStep ?? 0.01;
  const isKillSwitch = riskGuard?.emergencyKillSwitch || false;
  const isBuy = orderType.startsWith('BUY');
  const isPending = orderType !== 'BUY' && orderType !== 'SELL';
  const isStopLimit = orderType === 'BUY_STOP_LIMIT' || orderType === 'SELL_STOP_LIMIT';
  const riskOrderType = isBuy ? 'BUY' : 'SELL';
  const entryPrice = isPending ? Number(price) : isBuy ? activeTick?.ask : activeTick?.bid;

  const lotNumber = parseFloat(volume) || 0;
  const invalidVolume = lotNumber < minLots || lotNumber > maxLots || Math.abs(lotNumber / lotStep - Math.round(lotNumber / lotStep)) > 1e-7;
  const exceedsRisk = invalidVolume;
  const directionAllowed = isBuy
    ? (symbolSpec?.canOpenBuy ?? symbolSpec?.tradeAllowed ?? true)
    : (symbolSpec?.canOpenSell ?? symbolSpec?.tradeAllowed ?? true);

  const quickLotSizes = ['0.01', '0.05', '0.10', '0.25', '0.50', '1.00'];

  const handleCalculateSize = async () => {
    const stopLossPrice = Number(sl);
    if (!Number.isFinite(stopLossPrice) || stopLossPrice <= 0 || !entryPrice) {
      setSizingResult({ success: false, message: 'Set a stop loss and valid market quote or pending entry price before calculating size.' });
      return;
    }

    try {
      setSizing(true);
      setSizingResult(null);
      const result = await api.executeCommand('CALCULATE_POSITION_SIZE', {
        symbol: selectedSymbol,
        orderType: riskOrderType,
        entryPrice,
        stopLossPrice,
        riskPercent: Number(riskPercent),
      });
      setSizingResult(result);
      if (result.success && result.feasible && result.volume > 0) setVolume(String(result.volume));
    } catch (error: any) {
      setSizingResult({ success: false, message: error?.message || 'Position sizing failed.' });
    } finally {
      setSizing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (exceedsRisk) {
      setStatus({ message: `Volume must be ${minLots}-${maxLots} lots in steps of ${lotStep}`, error: true });
      return;
    }
    if (!directionAllowed) {
      setStatus({ message: `${symbolSpec?.tradeModeName || 'Broker'} settings do not allow opening ${riskOrderType} positions on ${selectedSymbol}.`, error: true });
      return;
    }
    if (isPending && (!Number.isFinite(entryPrice) || (entryPrice ?? 0) <= 0)) {
      setStatus({ message: 'Pending orders require a valid trigger/entry price.', error: true });
      return;
    }
    if (isStopLimit && (!Number.isFinite(Number(stopLimitPrice)) || Number(stopLimitPrice) <= 0)) {
      setStatus({ message: 'Stop-limit orders require a valid limit-leg price.', error: true });
      return;
    }
    if (['SPECIFIED', 'SPECIFIED_DAY'].includes(typeTime) && (!expiration || new Date(expiration).getTime() <= Date.now())) {
      setStatus({ message: 'Set an expiration time in the future.', error: true });
      return;
    }
    if (isKillSwitch) {
      setStatus({ message: 'Emergency Kill Switch is active!', error: true });
      return;
    }

    try {
      setSubmitting(true);
      setStatus(null);

      const res = await api.sendCommand({
        action: 'EXECUTE_TRADE',
        symbol: selectedSymbol,
        orderType,
        volume: lotNumber,
        price: isPending ? entryPrice : undefined,
        stopLimitPrice: isStopLimit ? Number(stopLimitPrice) : undefined,
        typeTime: isPending ? typeTime : undefined,
        expiration: ['SPECIFIED', 'SPECIFIED_DAY'].includes(typeTime) ? Math.floor(new Date(expiration).getTime() / 1000) : undefined,
        typeFilling: typeFilling === 'AUTO' ? undefined : typeFilling,
        deviation: isPending ? undefined : Math.max(0, Number(deviation) || 0),
        sl: sl ? parseFloat(sl) : undefined,
        tp: tp ? parseFloat(tp) : undefined,
        comment,
        source: 'MANUAL_UI',
      });

      if (res.success) {
        setStatus({ message: `Queued #${res.commandId} for MT5 async dispatch!` });
        setSl('');
        setTp('');
      } else {
        setStatus({ message: res.error || 'Failed to dispatch order', error: true });
      }
    } catch (err: any) {
      setStatus({ message: err?.message || 'Execution error', error: true });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Send className="h-4 w-4 text-cyan-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Asynchronous Order Execution
            </h2>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-cyan-400 border border-slate-700">
            Magic #889900
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 font-mono text-xs">
          {/* Symbol & Direction Toggle */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-slate-400 text-[11px] mb-1">Asset Symbol</label>
              <div className="relative">
                <input
                  type="text"
                  value={selectedSymbol}
                  onChange={(e) => onSelectSymbol(e.target.value)}
                  placeholder="e.g. EURUSD or EURUSD.m"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-white font-mono focus:border-cyan-500 focus:outline-none"
                  list="symbol-options"
                />
                <datalist id="symbol-options">
                  {ticks.map((t) => (
                    <option key={`tick-${t.symbol}`} value={t.symbol} />
                  ))}
                  {allSymbols.map((s) => (
                    <option key={`sym-${s.symbol}`} value={s.symbol} />
                  ))}
                </datalist>
              </div>
            </div>

            <div>
              <label className="block text-slate-400 text-[11px] mb-1">Order Type</label>
              <select
                value={orderType}
                onChange={(event) => setOrderType(event.target.value as TradeOrderType)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 font-mono text-white focus:border-cyan-500 focus:outline-none"
              >
                <optgroup label="Market">
                  <option value="BUY" disabled={symbolSpec?.canOpenBuy === false}>Buy Market</option>
                  <option value="SELL" disabled={symbolSpec?.canOpenSell === false}>Sell Market</option>
                </optgroup>
                <optgroup label="Pending Limit">
                  <option value="BUY_LIMIT" disabled={symbolSpec?.canOpenBuy === false}>Buy Limit</option>
                  <option value="SELL_LIMIT" disabled={symbolSpec?.canOpenSell === false}>Sell Limit</option>
                </optgroup>
                <optgroup label="Pending Stop">
                  <option value="BUY_STOP" disabled={symbolSpec?.canOpenBuy === false}>Buy Stop</option>
                  <option value="SELL_STOP" disabled={symbolSpec?.canOpenSell === false}>Sell Stop</option>
                  <option value="BUY_STOP_LIMIT" disabled={symbolSpec?.canOpenBuy === false}>Buy Stop Limit</option>
                  <option value="SELL_STOP_LIMIT" disabled={symbolSpec?.canOpenSell === false}>Sell Stop Limit</option>
                </optgroup>
              </select>
            </div>
          </div>

          {isPending && (
            <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-800 bg-slate-950/60 p-2.5">
              <div>
                <label className="mb-1 block text-[11px] text-slate-400">{isStopLimit ? 'Stop trigger price' : 'Entry price'}</label>
                <input
                  type="number"
                  step={symbolSpec?.point || 'any'}
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                  placeholder={activeTick ? (isBuy ? activeTick.ask : activeTick.bid).toFixed(symbolSpec?.digits ?? 5) : 'Required'}
                  className="w-full rounded border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-mono text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>
              {isStopLimit && (
                <div>
                  <label className="mb-1 block text-[11px] text-slate-400">Limit-leg price</label>
                  <input
                    type="number"
                    step={symbolSpec?.point || 'any'}
                    value={stopLimitPrice}
                    onChange={(event) => setStopLimitPrice(event.target.value)}
                    className="w-full rounded border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-mono text-white focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              )}
              <div>
                <label className="mb-1 block text-[11px] text-slate-400">Time in force</label>
                <select value={typeTime} onChange={(event) => setTypeTime(event.target.value as typeof typeTime)} className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 font-mono text-white">
                  <option value="GTC">Good till cancelled</option>
                  <option value="DAY">End of day</option>
                  <option value="SPECIFIED">Specified time</option>
                  <option value="SPECIFIED_DAY">Specified day</option>
                </select>
              </div>
              {['SPECIFIED', 'SPECIFIED_DAY'].includes(typeTime) && (
                <div>
                  <label className="mb-1 block text-[11px] text-slate-400">Expires at</label>
                  <input type="datetime-local" value={expiration} onChange={(event) => setExpiration(event.target.value)} className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 font-mono text-white" />
                </div>
              )}
              <div className="col-span-2">
                <label className="mb-1 block text-[11px] text-slate-400">Filling policy</label>
                <select value={typeFilling} onChange={(event) => setTypeFilling(event.target.value as typeof typeFilling)} className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 font-mono text-white">
                  <option value="AUTO">Broker default</option>
                  <option value="RETURN">Return remaining volume</option>
                  <option value="IOC">Immediate or cancel</option>
                  <option value="FOK">Fill or kill</option>
                  <option value="BOC">Book or cancel</option>
                </select>
              </div>
            </div>
          )}

          {symbolSpec && (
            <div className="flex items-center justify-between text-[11px] text-slate-400 bg-slate-950/60 px-2 py-1.5 rounded border border-slate-800">
              <span>Lot: <strong className="text-slate-200">{symbolSpec.minLot}</strong> - <strong className="text-slate-200">{symbolSpec.maxLot}</strong></span>
              <span>Step: <strong className="text-slate-200">{symbolSpec.lotStep}</strong></span>
              <span>Digits: <strong className="text-cyan-300">{symbolSpec.digits}</strong></span>
            </div>
          )}
          {symbolSpec && (symbolSpec.tradeModeName || symbolSpec.tickValueLoss !== undefined || symbolSpec.stopsLevel !== undefined) && (
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 border-b border-slate-800 pb-2 text-[10px] font-mono text-slate-500 sm:grid-cols-3">
              <span>Mode: <strong className="text-slate-300">{symbolSpec.tradeModeName || 'Unknown'}</strong></span>
              {symbolSpec.tickValueLoss !== undefined && <span>Tick loss: <strong className="text-slate-300">{symbolSpec.tickValueLoss} {symbolSpec.currencyProfit}</strong></span>}
              {symbolSpec.stopsLevel !== undefined && <span>Min stop: <strong className="text-slate-300">{symbolSpec.stopsLevel} pts</strong></span>}
              {symbolSpec.freezeLevel !== undefined && <span>Freeze: <strong className="text-slate-300">{symbolSpec.freezeLevel} pts</strong></span>}
              {symbolSpec.volumeLimit ? <span>Directional cap: <strong className="text-slate-300">{symbolSpec.volumeLimit}</strong></span> : null}
            </div>
          )}

          {/* Volume / Lot Size */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-slate-400 text-[11px]">Trade Volume (Lots)</label>
              <span className="text-[10px] text-slate-500">
                Risk Cap: {maxLots} Lots
              </span>
            </div>
            <input
              type="number"
              step={lotStep}
              min={minLots}
              max={maxLots}
              value={volume}
              onChange={(e) => setVolume(e.target.value)}
              className={`w-full bg-slate-950 border rounded-lg px-3 py-2 text-white font-mono focus:outline-none ${
                exceedsRisk ? 'border-rose-500 bg-rose-950/20' : 'border-slate-700 focus:border-cyan-500'
              }`}
            />
            {/* Quick lot pills */}
            <div className="flex items-center gap-1.5 mt-1.5">
              {quickLotSizes.map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => setVolume(sz)}
                  className={`text-[10px] px-1.5 py-0.5 rounded border ${
                    volume === sz
                      ? 'bg-cyan-950 text-cyan-300 border-cyan-700'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  {sz}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2 rounded-lg border border-slate-800 bg-slate-950/70 p-2.5">
            <div>
              <label className="mb-1 block text-[11px] text-slate-400">Risk budget (% of equity)</label>
              <input
                type="number"
                min="0.01"
                max="100"
                step="0.1"
                value={riskPercent}
                onChange={(event) => setRiskPercent(event.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 font-mono text-white focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={handleCalculateSize}
              disabled={sizing || !sl || !activeTick}
              className="inline-flex items-center gap-1.5 rounded border border-cyan-800 bg-cyan-950/60 px-3 py-1.5 text-[11px] font-bold text-cyan-200 hover:bg-cyan-900/70 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sizing ? 'Calculating' : 'Size by risk'}
            </button>
            {sizingResult && (
              <div className={`col-span-2 text-[11px] leading-relaxed ${sizingResult.success ? 'text-slate-300' : 'text-rose-300'}`}>
                {sizingResult.success ? (
                  <>
                    <span className="font-semibold text-cyan-200">{sizingResult.volume} lots</span>
                    {' · '}estimated stop loss {sizingResult.estimatedLoss?.toFixed(2)} {sizingResult.riskCurrency}
                    {sizingResult.estimatedMargin != null && <> · margin {sizingResult.estimatedMargin.toFixed(2)} {sizingResult.marginCurrency}</>}
                    {!sizingResult.feasible && <span className="ml-1 text-amber-300">Review margin/risk limits before trading.</span>}
                    {sizingResult.message && <div className="text-slate-500">{sizingResult.message}</div>}
                  </>
                ) : sizingResult.message}
              </div>
            )}
          </div>

          {/* SL & TP */}
            <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-slate-400 text-[11px] mb-1">Stop Loss (Price)</label>
              <input
                type="number"
                step="any"
                placeholder={activeTick ? (activeTick.bid * 0.995).toFixed(4) : 'Optional'}
                value={sl}
                onChange={(e) => setSl(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-[11px] mb-1">Take Profit (Price)</label>
              <input
                type="number"
                step="any"
                placeholder={activeTick ? (activeTick.ask * 1.008).toFixed(4) : 'Optional'}
                value={tp}
                onChange={(e) => setTp(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </div>

          {!isPending && (
            <div>
              <label className="mb-1 block text-[11px] text-slate-400">Maximum deviation (points)</label>
              <input type="number" min="0" step="1" value={deviation} onChange={(event) => setDeviation(event.target.value)} className="w-full rounded border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-mono text-white focus:border-cyan-500 focus:outline-none" />
            </div>
          )}

          {/* Comment / AI Tag */}
          <div>
            <label className="block text-slate-400 text-[11px] mb-1">AI Audit Tag / Comment</label>
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="e.g. AI_SCALPER_RSI_OVERSOLD"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono focus:border-cyan-500 focus:outline-none"
            />
          </div>

          {/* Feedback message */}
          {status && (
            <div
              className={`p-2 rounded text-xs flex items-center gap-1.5 ${
                status.error
                  ? 'bg-rose-950/70 text-rose-300 border border-rose-800/80'
                  : 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/80'
              }`}
            >
              {status.error ? <AlertTriangle className="h-4 w-4 shrink-0" /> : <CheckCircle2 className="h-4 w-4 shrink-0" />}
              <span>{status.message}</span>
            </div>
          )}

          {/* Execution Button */}
          <button
            type="submit"
            disabled={submitting || exceedsRisk || isKillSwitch || !directionAllowed}
            className={`w-full py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 ${
              isKillSwitch
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : isBuy
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30'
                : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/30'
            }`}
          >
            <Send className="h-3.5 w-3.5" />
            {submitting ? 'Dispatching to Queue...' : `Dispatch ${orderType.replaceAll('_', ' ')} ${lotNumber} Lots`}
          </button>
        </form>
      </div>

      <div className="mt-3 pt-2 border-t border-slate-800 text-[10px] text-slate-500 font-mono flex items-center justify-between">
        <span>Channel: Asynchronous WebRequest</span>
        <span>Target: 127.0.0.1:7777</span>
      </div>
    </div>
  );
};
