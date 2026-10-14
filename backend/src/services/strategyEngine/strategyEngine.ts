import { CandleData } from '@core/types';
import { calculateIndicators } from '@/services/indicatorEngine';

export type StrategyType =
  | 'RSI_REVERSAL'
  | 'EMA_CROSSOVER'
  | 'MACD_MOMENTUM'
  | 'BOLLINGER_BREAKOUT'
  | 'MULTI_INDICATOR_CONSENSUS'
  | 'CUSTOM_RULESET';

export interface StrategyParameters {
  rsiOversold?: number;
  rsiOverbought?: number;
  rsiPeriod?: number;
  fastEmaPeriod?: number;
  slowEmaPeriod?: number;
  macdFast?: number;
  macdSlow?: number;
  macdSignal?: number;
  bollingerPeriod?: number;
  bollingerStdDev?: number;
  stopLossPoints?: number;
  takeProfitPoints?: number;
  trailingStopPoints?: number;
  riskPercent?: number;
  lotSize?: number;
  maxHoldBars?: number;
  customRules?: string;
  [key: string]: any;
}

export interface StrategyDefinition {
  id: string;
  name: string;
  description: string;
  type: StrategyType;
  symbol: string;
  timeframe: string;
  parameters: StrategyParameters;
  status: 'active' | 'draft' | 'archived' | 'testing';
  tags?: string[];
  author?: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface BacktestValuation {
  point?: number;
  tickSize?: number;
  tickValueProfit?: number;
  tickValueLoss?: number;
  currency?: string;
}

export interface Observation {
  id: string;
  title: string;
  content: string;
  symbol?: string;
  timeframe?: string;
  strategyId?: string;
  category: 'market_insight' | 'pattern' | 'execution_note' | 'anomaly' | 'research';
  tags: string[];
  metrics?: Record<string, any>;
  createdAt: number;
  updatedAt: number;
}

export interface SimulatedTrade {
  id: string;
  type: 'BUY' | 'SELL';
  entryIndex: number;
  entryTime: number;
  entryTimeIso: string;
  entryPrice: number;
  exitIndex: number;
  exitTime: number;
  exitTimeIso: string;
  exitPrice: number;
  profitPoints: number;
  profitAmount: number;
  profitUsd?: number;
  profitCurrency: string;
  returnPct: number;
  exitReason: 'TAKE_PROFIT' | 'STOP_LOSS' | 'SIGNAL_REVERSAL' | 'MAX_HOLD_BARS' | 'END_OF_DATA';
  lotSize: number;
  slPrice?: number;
  tpPrice?: number;
}

export interface BacktestResult {
  id: string;
  strategyId: string;
  strategyName: string;
  symbol: string;
  timeframe: string;
  candleCount: number;
  startTime: number;
  startTimeIso: string;
  endTime: number;
  endTimeIso: string;
  initialDeposit: number;
  finalEquity: number;
  netProfit: number;
  profitFactor: number;
  winRatePct: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  maxDrawdownPct: number;
  maxDrawdownUsd: number;
  averageTradeProfit: number;
  averageWin: number;
  averageLoss: number;
  riskRewardRatio: number;
  profitCurrency: string;
  valuationSource: 'BROKER_TICK_VALUE' | 'FIXED_PIP_ESTIMATE';
  dataSource?: string;
  sharpeRatio?: number;
  trades: SimulatedTrade[];
  equityCurve: { time: number; timeIso: string; equity: number }[];
  evaluatedAt: number;
}

/**
 * Technical Strategy Backtester
 * Evaluates strategy rules bar-by-bar across historical candles
 */
export function runStrategyBacktest(
  strategy: StrategyDefinition,
  candles: CandleData[],
  deposit = 10000,
  pointValue = 0.0001,
  valuation?: BacktestValuation
): BacktestResult {
  if (!candles || candles.length < 20) {
    throw new Error(`Insufficient historical candles for backtesting (requires at least 20, got ${candles?.length || 0})`);
  }

  const params = strategy.parameters || {};
  const lotSize = Number(params.lotSize) || 0.1;
  const slPoints = Number(params.stopLossPoints) || 300;
  const tpPoints = Number(params.takeProfitPoints) || 600;
  const maxHoldBars = Number(params.maxHoldBars) || 50;

  // Adapt point value for JPY or Crypto / Metals
  const sym = strategy.symbol || 'EURUSD';
  const symUpper = sym.toUpperCase();
  let effectivePoint = valuation?.point && valuation.point > 0 ? valuation.point : pointValue;
  if (!valuation?.point) {
    if (symUpper.includes('JPY')) effectivePoint = 0.01;
    else if (symUpper.includes('XAU') || symUpper.includes('GOLD')) effectivePoint = 0.01;
    else if (symUpper.includes('BTC') || symUpper.includes('ETH')) effectivePoint = 0.1;
  }
  const hasBrokerValuation = Boolean(
    valuation && valuation.tickSize && valuation.tickSize > 0
      && valuation.tickValueProfit && valuation.tickValueProfit > 0
      && valuation.tickValueLoss && valuation.tickValueLoss > 0
  );
  const profitCurrency = hasBrokerValuation ? valuation?.currency || 'N/A' : 'EST';
  const valuationSource = hasBrokerValuation ? 'BROKER_TICK_VALUE' : 'FIXED_PIP_ESTIMATE';
  const calculateProfit = (type: 'BUY' | 'SELL', entryPrice: number, exitPrice: number, lots: number, pointDiff: number) => {
    if (hasBrokerValuation) {
      const priceMove = type === 'BUY' ? exitPrice - entryPrice : entryPrice - exitPrice;
      const tickValue = priceMove >= 0 ? valuation!.tickValueProfit! : valuation!.tickValueLoss!;
      return Math.round((priceMove / valuation!.tickSize! * tickValue * lots) * 100) / 100;
    }
    return Math.round((pointDiff * lots * 10) * 100) / 100;
  };

  const trades: SimulatedTrade[] = [];
  const equityCurve: { time: number; timeIso: string; equity: number }[] = [];
  let currentEquity = deposit;
  let peakEquity = deposit;
  let maxDrawdownUsd = 0;
  let maxDrawdownPct = 0;

  equityCurve.push({
    time: candles[0].time,
    timeIso: candles[0].timeIso || new Date(candles[0].time * 1000).toISOString(),
    equity: currentEquity,
  });

  let openTrade: {
    type: 'BUY' | 'SELL';
    entryIndex: number;
    entryTime: number;
    entryTimeIso: string;
    entryPrice: number;
    sl: number;
    tp: number;
  } | null = null;

  // Rolling indicator window
  const lookback = 20;

  for (let i = lookback; i < candles.length; i++) {
    const currentBar = candles[i];
    const prevBar = candles[i - 1];
    const barSlice = candles.slice(0, i + 1);
    const indicators = calculateIndicators(barSlice, strategy.symbol, strategy.timeframe);

    // 1. Manage active open trade
    if (openTrade) {
      let exitReason: SimulatedTrade['exitReason'] | null = null;
      let exitPrice = currentBar.close;

      if (openTrade.type === 'BUY') {
        if (currentBar.low <= openTrade.sl) {
          exitPrice = openTrade.sl;
          exitReason = 'STOP_LOSS';
        } else if (currentBar.high >= openTrade.tp) {
          exitPrice = openTrade.tp;
          exitReason = 'TAKE_PROFIT';
        } else if (i - openTrade.entryIndex >= maxHoldBars) {
          exitPrice = currentBar.close;
          exitReason = 'MAX_HOLD_BARS';
        }
      } else {
        // SELL
        if (currentBar.high >= openTrade.sl) {
          exitPrice = openTrade.sl;
          exitReason = 'STOP_LOSS';
        } else if (currentBar.low <= openTrade.tp) {
          exitPrice = openTrade.tp;
          exitReason = 'TAKE_PROFIT';
        } else if (i - openTrade.entryIndex >= maxHoldBars) {
          exitPrice = currentBar.close;
          exitReason = 'MAX_HOLD_BARS';
        }
      }

      if (exitReason) {
        const pointDiff =
          openTrade.type === 'BUY'
            ? (exitPrice - openTrade.entryPrice) / effectivePoint
            : (openTrade.entryPrice - exitPrice) / effectivePoint;

        // Approx profit USD based on lot size (e.g. 0.1 lot = $1/point for FX)
        const profitAmount = calculateProfit(openTrade.type, openTrade.entryPrice, exitPrice, lotSize, pointDiff);
        const returnPct = Math.round((profitAmount / currentEquity) * 10000) / 100;

        currentEquity += profitAmount;
        if (currentEquity > peakEquity) peakEquity = currentEquity;
        const ddUsd = peakEquity - currentEquity;
        const ddPct = (ddUsd / peakEquity) * 100;
        if (ddUsd > maxDrawdownUsd) maxDrawdownUsd = ddUsd;
        if (ddPct > maxDrawdownPct) maxDrawdownPct = ddPct;

        trades.push({
          id: `sim-trd-${trades.length + 1}`,
          type: openTrade.type,
          entryIndex: openTrade.entryIndex,
          entryTime: openTrade.entryTime,
          entryTimeIso: openTrade.entryTimeIso,
          entryPrice: openTrade.entryPrice,
          exitIndex: i,
          exitTime: currentBar.time,
          exitTimeIso: currentBar.timeIso || new Date(currentBar.time * 1000).toISOString(),
          exitPrice: Number(exitPrice.toFixed(5)),
          profitPoints: Math.round(pointDiff),
          profitAmount,
          profitUsd: profitCurrency === 'USD' ? profitAmount : undefined,
          profitCurrency,
          returnPct,
          exitReason,
          lotSize,
          slPrice: openTrade.sl,
          tpPrice: openTrade.tp,
        });

        equityCurve.push({
          time: currentBar.time,
          timeIso: currentBar.timeIso || new Date(currentBar.time * 1000).toISOString(),
          equity: Math.round(currentEquity * 100) / 100,
        });

        openTrade = null;
      }
    }

    // 2. Generate entry signals if no active trade
    if (!openTrade && indicators) {
      let signal: 'BUY' | 'SELL' | null = null;

      switch (strategy.type) {
        case 'RSI_REVERSAL': {
          const oversold = params.rsiOversold ?? 30;
          const overbought = params.rsiOverbought ?? 70;
          if (indicators.rsi14 !== null) {
            if (indicators.rsi14 <= oversold) signal = 'BUY';
            else if (indicators.rsi14 >= overbought) signal = 'SELL';
          }
          break;
        }

        case 'EMA_CROSSOVER': {
          if (indicators.ema9 !== null && indicators.ema21 !== null) {
            if (indicators.ema9 > indicators.ema21 && prevBar.close <= (indicators.ema21 || 0)) {
              signal = 'BUY';
            } else if (indicators.ema9 < indicators.ema21 && prevBar.close >= (indicators.ema21 || 0)) {
              signal = 'SELL';
            }
          }
          break;
        }

        case 'MACD_MOMENTUM': {
          if (indicators.macd) {
            if (indicators.macd.histogram > 0 && indicators.macd.macd > indicators.macd.signal) {
              signal = 'BUY';
            } else if (indicators.macd.histogram < 0 && indicators.macd.macd < indicators.macd.signal) {
              signal = 'SELL';
            }
          }
          break;
        }

        case 'BOLLINGER_BREAKOUT': {
          if (indicators.bollinger) {
            if (currentBar.close < indicators.bollinger.lower) {
              signal = 'BUY'; // Mean reversion bounce
            } else if (currentBar.close > indicators.bollinger.upper) {
              signal = 'SELL';
            }
          }
          break;
        }

        case 'MULTI_INDICATOR_CONSENSUS':
        default: {
          if (indicators.summary === 'STRONG_BUY' || indicators.summary === 'BUY') {
            signal = 'BUY';
            break;
          } else if (indicators.summary === 'STRONG_SELL' || indicators.summary === 'SELL') {
            signal = 'SELL';
          }
          break;
        }
      }

      if (signal) {
        const entryPrice = currentBar.close;
        const sl =
          signal === 'BUY'
            ? entryPrice - slPoints * effectivePoint
            : entryPrice + slPoints * effectivePoint;
        const tp =
          signal === 'BUY'
            ? entryPrice + tpPoints * effectivePoint
            : entryPrice - tpPoints * effectivePoint;

        openTrade = {
          type: signal,
          entryIndex: i,
          entryTime: currentBar.time,
          entryTimeIso: currentBar.timeIso || new Date(currentBar.time * 1000).toISOString(),
          entryPrice,
          sl: Number(sl.toFixed(5)),
          tp: Number(tp.toFixed(5)),
        };
      }
    }
  }

  // Close lingering trade at end of history
  if (openTrade) {
    const lastBar = candles[candles.length - 1];
    const pointDiff =
      openTrade.type === 'BUY'
        ? (lastBar.close - openTrade.entryPrice) / effectivePoint
        : (openTrade.entryPrice - lastBar.close) / effectivePoint;

    const profitAmount = calculateProfit(openTrade.type, openTrade.entryPrice, lastBar.close, lotSize, pointDiff);
    const returnPct = Math.round((profitAmount / currentEquity) * 10000) / 100;
    currentEquity += profitAmount;

     trades.push({
       id: `sim-trd-${trades.length + 1}`,
       type: openTrade.type,
       entryIndex: openTrade.entryIndex,
       entryTime: openTrade.entryTime,
       entryTimeIso: openTrade.entryTimeIso,
       entryPrice: openTrade.entryPrice,
       exitIndex: candles.length - 1,
       exitTime: lastBar.time,
       exitTimeIso: lastBar.timeIso || new Date(lastBar.time * 1000).toISOString(),
       exitPrice: Number(lastBar.close.toFixed(5)),
       profitPoints: Math.round(pointDiff),
      profitAmount,
      profitUsd: profitCurrency === 'USD' ? profitAmount : undefined,
      profitCurrency,
       returnPct,
       exitReason: 'END_OF_DATA',
       lotSize,
       slPrice: openTrade.sl,
       tpPrice: openTrade.tp,
     });
  }

  // Calculate Summary Statistics
  const winningTrades = trades.filter((t) => t.profitAmount > 0);
  const losingTrades = trades.filter((t) => t.profitAmount < 0);
  const totalTrades = trades.length;
  const winRatePct = totalTrades > 0 ? Math.round((winningTrades.length / totalTrades) * 1000) / 10 : 0;

  const grossProfit = winningTrades.reduce((acc, t) => acc + t.profitAmount, 0);
  const grossLoss = Math.abs(losingTrades.reduce((acc, t) => acc + t.profitAmount, 0));
  const profitFactor = grossLoss > 0 ? Math.round((grossProfit / grossLoss) * 100) / 100 : grossProfit > 0 ? 999 : 0;
  const netProfit = Math.round((currentEquity - deposit) * 100) / 100;

  const averageWin = winningTrades.length > 0 ? Math.round((grossProfit / winningTrades.length) * 100) / 100 : 0;
  const averageLoss = losingTrades.length > 0 ? Math.round((grossLoss / losingTrades.length) * 100) / 100 : 0;
  const riskRewardRatio = averageLoss > 0 ? Math.round((averageWin / averageLoss) * 100) / 100 : 0;
  const averageTradeProfit = totalTrades > 0 ? Math.round((netProfit / totalTrades) * 100) / 100 : 0;

  const firstCandle = candles[0];
  const lastCandle = candles[candles.length - 1];

   return {
     id: `bt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
     strategyId: strategy.id,
     strategyName: strategy.name,
     symbol: strategy.symbol,
     timeframe: strategy.timeframe,
     candleCount: candles.length,
     startTime: firstCandle.time,
     startTimeIso: firstCandle.timeIso || new Date(firstCandle.time * 1000).toISOString(),
     endTime: lastCandle.time,
     endTimeIso: lastCandle.timeIso || new Date(lastCandle.time * 1000).toISOString(),
     initialDeposit: deposit,
     finalEquity: Math.round(currentEquity * 100) / 100,
     netProfit,
     profitFactor,
     winRatePct,
     totalTrades,
     winningTrades: winningTrades.length,
     losingTrades: losingTrades.length,
     maxDrawdownPct: Math.round(maxDrawdownPct * 10) / 10,
     maxDrawdownUsd: Math.round(maxDrawdownUsd * 100) / 100,
     averageTradeProfit,
     averageWin,
     averageLoss,
     riskRewardRatio,
    profitCurrency,
    valuationSource,
     sharpeRatio:
       trades.length >= 3
         ? (() => {
             const returns = trades.map((t) => t.profitAmount);
             const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
             const variance =
               returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (returns.length - 1);
             const stdDev = Math.sqrt(variance);
             return stdDev > 0 ? Math.round((mean / stdDev) * Math.sqrt(trades.length) * 100) / 100 : 0;
           })()
         : undefined,
     trades,
     equityCurve,
     evaluatedAt: Date.now(),
   };
}

/**
 * Generates realistic benchmark candles for offline simulation or when terminal is not streaming.
 */
export function generateBenchmarkCandles(
  symbol: string,
  timeframe: string = 'M1',
  count: number = 300
): CandleData[] {
  const symLower = (symbol || 'EURUSD').toLowerCase();
  let basePrice = 1.085;
  let volatility = 0.0003;

  if (symLower.includes('jpy')) {
    basePrice = 154.5;
    volatility = 0.05;
  } else if (symLower.includes('xau') || symLower.includes('gold')) {
    basePrice = 2650.0;
    volatility = 0.8;
  } else if (symLower.includes('btc')) {
    basePrice = 68000.0;
    volatility = 40.0;
  } else if (symLower.includes('eth')) {
    basePrice = 3400.0;
    volatility = 4.0;
  } else if (symLower.includes('index') || symLower.includes('1000') || symLower.includes('500')) {
    basePrice = 5000.0;
    volatility = 3.0;
  }

  const tfSecondsMap: Record<string, number> = {
    M1: 60,
    M5: 300,
    M15: 900,
    M30: 1800,
    H1: 3600,
    H4: 14400,
    D1: 86400,
  };
  const tfSec = tfSecondsMap[timeframe.toUpperCase()] || 60;
  const nowSec = Math.floor(Date.now() / 1000);
  const startSec = nowSec - count * tfSec;

  const candles: CandleData[] = [];
  let currentClose = basePrice;

  for (let i = 0; i < count; i++) {
    const time = startSec + i * tfSec;
    const wave = Math.sin(i / 15) * volatility * 1.5;
    const trend = (i / count - 0.5) * volatility * 2.0;
    const shock = (Math.random() - 0.5) * volatility;

    const open = currentClose;
    const change = wave * 0.3 + trend * 0.2 + shock;
    const close = open + change;
    const high = Math.max(open, close) + Math.random() * volatility * 0.8;
    const low = Math.min(open, close) - Math.random() * volatility * 0.8;
    const volume = Math.floor(50 + Math.random() * 200);

    candles.push({
      time,
      timeIso: new Date(time * 1000).toISOString(),
      open: Number(open.toFixed(basePrice > 100 ? 2 : 5)),
      high: Number(high.toFixed(basePrice > 100 ? 2 : 5)),
      low: Number(low.toFixed(basePrice > 100 ? 2 : 5)),
      close: Number(close.toFixed(basePrice > 100 ? 2 : 5)),
      volume,
    });
    currentClose = close;
  }

  return candles;
}
