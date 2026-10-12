import React, { useState, useEffect } from 'react';
import { AppState } from '@/types';
import { EaConnectionRadar } from '../components/dashboard/EaConnectionRadar';
import { CurrentChartSymbolCard } from '../components/dashboard/CurrentChartSymbolCard';
import { AccountMetricsBar } from '../components/dashboard/AccountMetricsBar';
import { LiveTickStream } from '../components/dashboard/LiveTickStream';
import { LivePriceChart } from '../components/dashboard/LivePriceChart';
import { OrderExecutionDock } from '../components/dashboard/OrderExecutionDock';
import { OpenPositionsTable } from '../components/dashboard/OpenPositionsTable';
import { AllTrackedSymbolsTable } from '../components/dashboard/AllTrackedSymbolsTable';

interface DashboardPageProps {
  state: AppState | null;
  onRefresh?: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ state, onRefresh }) => {
  const currentChart = state?.currentChart || null;
  const allSymbols = state?.allSymbols || [];
  const ticks = state?.ticks || [];

  const [selectedSymbol, setSelectedSymbol] = useState<string>(
    currentChart?.symbol || (allSymbols[0]?.symbol) || (ticks[0]?.symbol) || 'EURUSD'
  );

  // Dynamically bind to real incoming chart symbol or first discovered broker symbol
  useEffect(() => {
    if (currentChart?.symbol) {
      setSelectedSymbol((prev) => {
        if (!prev || prev === 'EURUSD' || (!allSymbols.some((s) => s.symbol === prev) && !ticks.some((t) => t.symbol === prev))) {
          return currentChart.symbol;
        }
        return prev;
      });
    } else if (allSymbols.length > 0) {
      setSelectedSymbol((prev) => {
        if (!prev || (!allSymbols.some((s) => s.symbol === prev) && prev === 'EURUSD')) {
          return allSymbols[0].symbol;
        }
        return prev;
      });
    } else if (ticks.length > 0) {
      setSelectedSymbol((prev) => {
        if (!prev || prev === 'EURUSD') {
          return ticks[0].symbol;
        }
        return prev;
      });
    }
  }, [currentChart?.symbol, allSymbols, ticks]);

  const currentTick = ticks.find((t) => t.symbol === selectedSymbol) || ticks[0];
  const history = (state?.tickHistory && state.tickHistory[selectedSymbol]) || [];
  const positions = state?.positions || [];
  const account = state?.account || null;
  const riskGuard = state?.riskGuard || null;

  return (
    <div className="space-y-6">
      {/* 1. Real-Time EA Connection Detector */}
      <EaConnectionRadar state={state} onRefresh={onRefresh} />

      {/* 2. Account High-Level Metrics */}
      <AccountMetricsBar account={account} />

      {/* 3. Section for Current Symbol (EA Connected Chart) */}
      <CurrentChartSymbolCard
        currentChart={currentChart}
        onSelectSymbol={setSelectedSymbol}
        onRefresh={onRefresh}
      />

      {/* 4. Real-Time Tick Stream Bar */}
      <LiveTickStream
        ticks={ticks}
        selectedSymbol={selectedSymbol}
        onSelectSymbol={setSelectedSymbol}
      />

      {/* 5. Main Operational Grid: Live Chart + Async Order Pad */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8">
          <LivePriceChart
            symbol={selectedSymbol}
            history={history}
            currentTick={currentTick}
            positions={positions}
          />
        </div>
        <div className="lg:col-span-4">
          <OrderExecutionDock
            selectedSymbol={selectedSymbol}
            ticks={ticks}
            allSymbols={allSymbols}
            riskGuard={riskGuard}
            onSelectSymbol={setSelectedSymbol}
          />
        </div>
      </div>

      {/* 6. Active MT5 Open Positions */}
      <OpenPositionsTable
        positions={positions}
        onSelectSymbol={setSelectedSymbol}
      />

      {/* 7. Section for All Tracked Symbols Sent By MT5 EA */}
      <AllTrackedSymbolsTable
        symbols={allSymbols}
        ticks={ticks}
        selectedSymbol={selectedSymbol}
        onSelectSymbol={setSelectedSymbol}
      />
    </div>
  );
};

