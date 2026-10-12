import React, { useMemo } from 'react';
import { Position, TickData } from '@/types';
import { BarChart3, TrendingUp } from 'lucide-react';

interface LivePriceChartProps {
  symbol: string;
  history: { time: number; bid: number; ask: number }[];
  currentTick?: TickData;
  positions: Position[];
}

export const LivePriceChart: React.FC<LivePriceChartProps> = ({
  symbol,
  history,
  currentTick,
  positions,
}) => {
  const digits = symbol.toLowerCase().includes('jpy') ? 3 : symbol.toLowerCase().includes('usd') && symbol.length <= 7 ? 5 : 2;

  // Compute SVG dimensions and scale
  const chartProps = useMemo(() => {
    if (!history || history.length < 2) {
      return { 
        pathData: '', 
        minPrice: 0, 
        maxPrice: 0, 
        priceRange: 1, 
        lastY: 50, 
        minTime: 0, 
        maxTime: 0,
        width: 600,
        height: 180,
        chartHeight: 150,
        timeLabelHeight: 30
      };
    }

    const bids = history.map((h) => h.bid);
    let min = Math.min(...bids);
    let max = Math.max(...bids);

    // Give 10% breathing room top and bottom
    const pad = (max - min) * 0.15 || 0.0001;
    min -= pad;
    max += pad;
    const range = max - min || 1;

    const times = history.map((h) => h.time);
    let minTime = Math.min(...times);
    let maxTime = Math.max(...times);
    const timeRange = maxTime - minTime || 1; // Avoid division by zero

    const width = 600;
    const height = 180;
    const chartHeight = 150; // Leave space for time labels at bottom
    const timeLabelHeight = 30;

    const points = history.map((pt) => {
      const x = ((pt.time - minTime) / timeRange) * width;
      const y = chartHeight - ((pt.bid - min) / range) * chartHeight;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    const path = `M ${points.join(' L ')}`;
    const lastPoint = history[history.length - 1];
    const curY = chartHeight - ((lastPoint.bid - min) / range) * chartHeight;

    return {
      pathData: path,
      minPrice: min + pad,
      maxPrice: max - pad,
      priceRange: range,
      lastY: curY,
      minTime,
      maxTime,
      width,
      height,
      chartHeight,
      timeLabelHeight
    };
  }, [history]);

  const { pathData, minPrice, maxPrice, priceRange, lastY, minTime, maxTime, width, height, chartHeight, timeLabelHeight } = chartProps;

  const relatedPositions = positions.filter((p) => p.symbol.toLowerCase() === symbol.toLowerCase());

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm flex flex-col justify-between">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-cyan-400" />
          <span className="font-bold text-sm text-white font-mono">{symbol}</span>
          <span className="text-xs text-slate-400 font-mono">Real-Time Tick Movement</span>
        </div>

        {currentTick && (
          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="text-slate-400">
              Sprd: <span className="text-cyan-300 font-bold">{currentTick.spread} pts</span>
            </span>
            <span className="text-slate-400">
              Bid: <span className="text-emerald-400 font-bold">{currentTick.bid.toFixed(digits)}</span>
            </span>
            <span className="text-slate-400">
              Ask: <span className="text-slate-200">{currentTick.ask.toFixed(digits)}</span>
            </span>
          </div>
        )}
      </div>

      {/* SVG Canvas Area */}
      <div className="relative w-full h-[180px] bg-slate-950/70 border border-slate-800/80 rounded-lg overflow-hidden flex items-center justify-center">
        {history && history.length >= 2 ? (
          <>
             <svg
               viewBox={`0 0 ${width} ${height}`}
               preserveAspectRatio="none"
               className="w-full h-full stroke-cyan-400 stroke-2 fill-none overflow-visible"
             >
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line x1="0" y1="45" x2="600" y2="45" stroke="#1e293b" strokeDasharray="3 3" />
              <line x1="0" y1="90" x2="600" y2="90" stroke="#1e293b" strokeDasharray="3 3" />
              <line x1="0" y1="135" x2="600" y2="135" stroke="#1e293b" strokeDasharray="3 3" />

            {/* Area under curve */}
            <path
              d={`${pathData} L ${chartProps.width} ${chartProps.chartHeight} L 0 ${chartProps.chartHeight} Z`}
              fill="url(#chartGradient)"
              stroke="none"
            />

            {/* Horizontal grid lines and labels */}
            <g className="text-[9px] font-mono fill-slate-400">
              {/* Generate 4 horizontal lines (including min and max) */}
              {[0, 0.33, 0.66, 1].map((ratio, i) => {
                const y = chartProps.chartHeight - ratio * chartProps.chartHeight;
                const price = chartProps.minPrice + ratio * chartProps.priceRange;
                return (
                  <React.Fragment key={`h-grid-${i}`}>
                    <line
                      x1="0"
                      y1={y}
                      x2={chartProps.width}
                      y2={y}
                      stroke="#1e293b"
                      strokeDasharray="2 2"
                    />
                    <text x="4" y={y - 4} textAnchor="start">
                      {price.toFixed(digits)}
                    </text>
                  </React.Fragment>
                );
              })}
            </g>

            {/* Vertical time markers at bottom */}
            <g className="text-[8px] font-mono fill-slate-400">
              {/* Generate 5 time markers (including min and max) */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                const x = ratio * chartProps.width;
                const time = new Date(chartProps.minTime + ratio * (chartProps.maxTime - chartProps.minTime));
                const timeString = time.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                return (
                  <React.Fragment key={`v-time-${i}`}>
                    <line
                      x1={x}
                      y1={chartProps.chartHeight}
                      x2={x}
                      y2={chartProps.chartHeight + 4}
                      stroke="#1e293b"
                      strokeWidth="1"
                    />
                    <text x={x} y={chartProps.chartHeight + 16} textAnchor="middle">
                      {timeString}
                    </text>
                  </React.Fragment>
                );
              })}
            </g>

              {/* Tick price line */}
              <path d={pathData} stroke="#22d3ee" strokeWidth="2" strokeLinecap="round" />

               {/* Position markers */}
               {relatedPositions.map((pos) => {
                 const posY = chartProps.chartHeight - ((pos.openPrice - (chartProps.minPrice - 0.0001)) / chartProps.priceRange) * chartProps.chartHeight;
                 if (posY >= 0 && posY <= chartProps.chartHeight) {
                   return (
                     <g key={pos.ticket}>
                       <line
                         x1="0"
                         y1={posY}
                         x2={chartProps.width}
                         y2={posY}
                         stroke={pos.type === 'BUY' ? '#10b981' : '#f43f5e'}
                         strokeWidth="1"
                         strokeDasharray="4 2"
                       />
                     </g>
                   );
                 }
                 return null;
               })}

                {/* Current price marker dot */}
                <circle cx={chartProps.width} cy={chartProps.lastY} r="4" fill="#38bdf8" className="animate-ping" />
                <circle cx={chartProps.width} cy={chartProps.lastY} r="3" fill="#38bdf8" />
            </svg>

            {/* Price labels */}
            <div className="absolute right-2 top-2 bg-slate-900/90 border border-slate-700/80 px-1.5 py-0.5 rounded text-[10px] font-mono text-cyan-300">
              High: {maxPrice.toFixed(digits)}
            </div>
            <div className="absolute right-2 bottom-2 bg-slate-900/90 border border-slate-700/80 px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-400">
              Low: {minPrice.toFixed(digits)}
            </div>

            {/* Position Badges on Chart */}
            {relatedPositions.map((pos) => (
              <div
                key={pos.ticket}
                className={`absolute left-2 top-2 text-[10px] font-mono px-2 py-0.5 rounded border ${
                  pos.type === 'BUY'
                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                    : 'bg-rose-950/80 text-rose-300 border-rose-700'
                }`}
              >
                {pos.type} #{pos.ticket} @ {pos.openPrice.toFixed(digits)} (PnL: ${pos.profit})
              </div>
            ))}
          </>
         ) : (
           <div className="text-slate-400 text-xs font-mono flex flex-col items-center gap-2 p-6 text-center" style={{ height: chartHeight }}>
             <TrendingUp className="h-5 w-5 text-cyan-400" />
             <span>Awaiting real price ticks from MetaTrader 5 for {symbol}</span>
             <span className="text-[11px] text-slate-500">
               Launch your local MetaTrader 5 application to stream live tick trajectory via Peron package
             </span>
           </div>
         )}
      </div>

       <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 mt-2">
         <span>
           Window: {history.length} ticks from{" "}
           {new Date(minTime).toLocaleTimeString()} -{" "}
           {new Date(maxTime).toLocaleTimeString()}
         </span>
         <span>Resolution: Raw Tick Stream</span>
       </div>
    </div>
  );
};
