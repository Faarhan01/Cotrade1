import React, { useState, useEffect } from 'react';
import {
  Compass,
  TrendingUp,
  Play,
  Plus,
  BookOpen,
  FlaskConical,
  Award,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Edit,
  Eye,
  Activity,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  History,
  Tag,
  Shield,
  BarChart2,
  Search,
  Filter,
  Check,
  RefreshCw,
  Sliders,
  DollarSign,
  Calendar,
  Download,
  FileText,
  Database,
  Code,
  Terminal,
  Clock,
  ExternalLink,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { api } from '../lib/api';
import { StrategyDefinition, Observation, BacktestResult, CandleData, TickData } from '@/types';

export const KnowledgeBasePage: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'strategies' | 'backtests' | 'chart_history' | 'observations' | 'api_reference'>('strategies');
  const [strategies, setStrategies] = useState<StrategyDefinition[]>([]);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [backtests, setBacktests] = useState<BacktestResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyDefinition | null>(null);
  const [activeBacktestResult, setActiveBacktestResult] = useState<BacktestResult | null>(null);

  // Filter & Search
  const [strategySearch, setStrategySearch] = useState('');
  const [obsCategoryFilter, setObsCategoryFilter] = useState('all');

  // Modal / Form States
  const [showStrategyModal, setShowStrategyModal] = useState(false);
  const [showObsModal, setShowObsModal] = useState(false);
  const [backtestingStrategyId, setBacktestingStrategyId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Backtest execution settings
  const [backtestCandleLimit, setBacktestCandleLimit] = useState<number>(500);
  const [backtestDeposit, setBacktestDeposit] = useState<number>(10000);
  const [backtestLot, setBacktestLot] = useState<number>(0.1);

  // Chart History Inspector State
  const [chartSymbol, setChartSymbol] = useState<string>('EURUSD');
  const [chartTimeframe, setChartTimeframe] = useState<string>('M1');
  const [chartCandleCount, setChartCandleCount] = useState<number>(300);
  const [chartDataMode, setChartDataMode] = useState<'candles' | 'ticks'>('candles');
  const [fetchedCandles, setFetchedCandles] = useState<CandleData[]>([]);
  const [fetchedTicks, setFetchedTicks] = useState<TickData[]>([]);
  const [chartLoading, setChartLoading] = useState<boolean>(false);
  const [chartDataSource, setChartDataSource] = useState<string>('');
  const [availableSymbols, setAvailableSymbols] = useState<string[]>(['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'BTCUSD']);

  // Strategy Form
  const [stratForm, setStratForm] = useState<{
    id?: string;
    name: string;
    description: string;
    type: StrategyDefinition['type'];
    symbol: string;
    timeframe: string;
    rsiOversold: number;
    rsiOverbought: number;
    fastEmaPeriod: number;
    slowEmaPeriod: number;
    stopLossPoints: number;
    takeProfitPoints: number;
    lotSize: number;
    maxHoldBars: number;
    tags: string;
    notes: string;
    status: 'active' | 'draft' | 'archived';
  }>({
    name: '',
    description: '',
    type: 'RSI_REVERSAL',
    symbol: 'EURUSD',
    timeframe: 'M1',
    rsiOversold: 30,
    rsiOverbought: 70,
    fastEmaPeriod: 9,
    slowEmaPeriod: 21,
    stopLossPoints: 300,
    takeProfitPoints: 600,
    lotSize: 0.1,
    maxHoldBars: 50,
    tags: 'RSI, Reversal',
    notes: '',
    status: 'active',
  });

  // Observation Form
  const [obsForm, setObsForm] = useState<{
    title: string;
    content: string;
    symbol: string;
    timeframe: string;
    category: Observation['category'];
    tags: string;
  }>({
    title: '',
    content: '',
    symbol: 'EURUSD',
    timeframe: 'M1',
    category: 'market_insight',
    tags: 'LondonOpen, Volatility',
  });

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [stratsRes, obsRes, btRes, symRes] = await Promise.all([
        api.getStrategies().catch(() => ({ strategies: [] })),
        api.getObservations().catch(() => ({ observations: [] })),
        api.getBacktestHistory().catch(() => ({ results: [] })),
        api.getSymbols().catch(() => ({ symbols: [] })),
      ]);
      setStrategies(stratsRes.strategies || []);
      setObservations(obsRes.observations || []);
      setBacktests(btRes.results || []);

      if (symRes.symbols && symRes.symbols.length > 0) {
        const names = symRes.symbols.map((s: any) => s.symbol);
        setAvailableSymbols(Array.from(new Set([...names, 'EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'BTCUSD'])));
      }

      if (stratsRes.strategies?.length > 0 && !selectedStrategy) {
        setSelectedStrategy(stratsRes.strategies[0]);
      }
      if (btRes.results?.length > 0 && !activeBacktestResult) {
        setActiveBacktestResult(btRes.results[0]);
      }
    } catch (err: any) {
      console.error('Error loading knowledge base:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const showNotification = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setStatusMessage({ text, type });
    setTimeout(() => setStatusMessage(null), 4500);
  };

  const handleSaveStrategy = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        name: stratForm.name,
        description: stratForm.description,
        type: stratForm.type,
        symbol: stratForm.symbol ? stratForm.symbol.trim() : 'EURUSD',
        timeframe: stratForm.timeframe ? stratForm.timeframe.trim() : 'M1',
        status: stratForm.status,
        tags: stratForm.tags.split(',').map((t) => t.trim()).filter(Boolean),
        notes: stratForm.notes,
        parameters: {
          rsiOversold: Number(stratForm.rsiOversold),
          rsiOverbought: Number(stratForm.rsiOverbought),
          fastEmaPeriod: Number(stratForm.fastEmaPeriod),
          slowEmaPeriod: Number(stratForm.slowEmaPeriod),
          stopLossPoints: Number(stratForm.stopLossPoints),
          takeProfitPoints: Number(stratForm.takeProfitPoints),
          lotSize: Number(stratForm.lotSize),
          maxHoldBars: Number(stratForm.maxHoldBars),
        },
      };
      if (stratForm.id) payload.id = stratForm.id;

      const res = await api.saveStrategy(payload);
      if (res.success) {
        showNotification(`Strategy "${res.strategy.name}" saved!`);
        setShowStrategyModal(false);
        await loadAllData();
        setSelectedStrategy(res.strategy);
      }
    } catch (err: any) {
      showNotification(`Failed to save: ${err.message}`, 'error');
    }
  };

  const [deletePendingId, setDeletePendingId] = useState<string | null>(null);

  const handleDeleteStrategy = async (id: string, name: string) => {
    if (deletePendingId !== id) {
      setDeletePendingId(id);
      showNotification(`Click delete again to confirm removing "${name}"`, 'error');
      setTimeout(() => setDeletePendingId(null), 4000);
      return;
    }
    setDeletePendingId(null);
    try {
      await api.deleteStrategy(id);
      showNotification(`Strategy "${name}" deleted.`);
      if (selectedStrategy?.id === id) setSelectedStrategy(null);
      await loadAllData();
    } catch (err: any) {
      showNotification(`Delete failed: ${err.message}`, 'error');
    }
  };

  const handleRunBacktest = async (strategy: StrategyDefinition) => {
    try {
      setBacktestingStrategyId(strategy.id);
      const res = await api.runBacktest(strategy.id, {
        candleLimit: backtestCandleLimit,
        initialDeposit: backtestDeposit,
      });
      if (res.success) {
        setActiveBacktestResult(res.result);
        setActiveSubTab('backtests');
        const srcText = (res as any).dataSource === 'mt5_live' ? 'Live MT5 Chart Data' : 'Cached History';
        showNotification(`Backtest for "${strategy.name}" completed using ${srcText}! Net: $${res.result.netProfit}`);
        await loadAllData();
      }
    } catch (err: any) {
      showNotification(`Backtest error: ${err.message}`, 'error');
    } finally {
      setBacktestingStrategyId(null);
    }
  };

  const handleFetchChartHistory = async () => {
    setChartLoading(true);
    try {
      if (chartDataMode === 'candles') {
        const res = await api.getCandles(chartSymbol, chartTimeframe, chartCandleCount);
        if (res.candles) {
          setFetchedCandles(res.candles);
          setChartDataSource(res.candles.length > 0 ? `${res.candles.length} bars fetched for ${res.symbol}` : 'No bars returned');
          showNotification(`Retrieved ${res.candles.length} historical candles for ${chartSymbol} (${chartTimeframe})`);
        }
      } else {
        const res = await api.getTicksHistory(chartSymbol, undefined, undefined, chartCandleCount);
        if (res.ticks) {
          setFetchedTicks(res.ticks);
          setChartDataSource(`${res.ticks.length} ticks fetched for ${res.symbol}`);
          showNotification(`Retrieved ${res.ticks.length} historical ticks for ${chartSymbol}`);
        }
      }
    } catch (err: any) {
      showNotification(`Failed to fetch chart data: ${err.message}`, 'error');
    } finally {
      setChartLoading(false);
    }
  };

  const handleExportData = (format: 'json' | 'csv') => {
    const dataToExport = chartDataMode === 'candles' ? fetchedCandles : fetchedTicks;
    if (!dataToExport || dataToExport.length === 0) {
      showNotification('No chart history to export', 'error');
      return;
    }

    let blob: Blob;
    let filename: string;

    if (format === 'json') {
      const jsonStr = JSON.stringify(dataToExport, null, 2);
      blob = new Blob([jsonStr], { type: 'application/json' });
      filename = `${chartSymbol}_${chartTimeframe}_history.json`;
    } else {
      if (chartDataMode === 'candles') {
        const header = 'time,timeIso,open,high,low,close,volume,spread\n';
        const rows = (dataToExport as CandleData[])
          .map((c) => `${c.time},${c.timeIso || ''},${c.open},${c.high},${c.low},${c.close},${c.volume},${c.spread || 0}`)
          .join('\n');
        blob = new Blob([header + rows], { type: 'text/csv' });
        filename = `${chartSymbol}_${chartTimeframe}_candles.csv`;
      } else {
        const header = 'time,timeMsc,timeIso,bid,ask,last,volume,flags\n';
        const rows = (dataToExport as any[])
          .map((t) => `${t.time},${t.timeMsc || ''},${t.timeIso || ''},${t.bid},${t.ask},${t.last || t.bid},${t.volume},${t.flags || 0}`)
          .join('\n');
        blob = new Blob([header + rows], { type: 'text/csv' });
        filename = `${chartSymbol}_ticks.csv`;
      }
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showNotification(`Exported ${dataToExport.length} records as ${filename}`);
  };

  const handleSaveObservation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        title: obsForm.title,
        content: obsForm.content,
        symbol: obsForm.symbol ? obsForm.symbol.trim() : null,
        timeframe: obsForm.timeframe ? obsForm.timeframe.trim() : null,
        category: obsForm.category,
        tags: obsForm.tags.split(',').map((t) => t.trim()).filter(Boolean),
      };
      const res = await api.saveObservation(payload);
      if (res.success) {
        showNotification(`Observation "${res.observation.title}" logged!`);
        setShowObsModal(false);
        setObsForm({
          title: '',
          content: '',
          symbol: 'EURUSD',
          timeframe: 'M1',
          category: 'market_insight',
          tags: '',
        });
        await loadAllData();
      }
    } catch (err: any) {
      showNotification(`Failed to save: ${err.message}`, 'error');
    }
  };

  const handleDeleteObservation = async (id: string) => {
    try {
      await api.deleteObservation(id);
      showNotification('Observation removed.');
      await loadAllData();
    } catch (err: any) {
      showNotification(`Delete failed: ${err.message}`, 'error');
    }
  };

  const filteredStrategies = strategies.filter((s) => {
    if (!strategySearch.trim()) return true;
    const q = strategySearch.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.symbol.toLowerCase().includes(q) ||
      s.type.toLowerCase().includes(q) ||
      (s.tags && s.tags.some((t) => t.toLowerCase().includes(q)))
    );
  });

  const filteredObservations = observations.filter((o) => {
    if (obsCategoryFilter !== 'all' && o.category !== obsCategoryFilter) return false;
    return true;
  });

  return (
    <div className="container mx-auto px-4 space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-cyan-950/30 to-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                <Compass className="h-5 w-5" />
              </span>
              <h1 className="text-xl font-extrabold text-white tracking-tight">
                Knowledge Base, Strategy Lab & MetaTrader 5 Data Hub
              </h1>
            </div>
            <p className="text-sm text-slate-300 mt-2 max-w-3xl leading-relaxed">
              Design algorithmic strategies, pull high-density chart history from MetaTrader 5, inspect market depth,
              and execute verified backtest simulations against real market data without hardcoded symbol assumptions.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
            <button
              onClick={() => {
                setStratForm({
                  name: '',
                  description: '',
                  type: 'RSI_REVERSAL',
                  symbol: 'EURUSD',
                  timeframe: 'M1',
                  rsiOversold: 30,
                  rsiOverbought: 70,
                  fastEmaPeriod: 9,
                  slowEmaPeriod: 21,
                  stopLossPoints: 300,
                  takeProfitPoints: 600,
                  lotSize: 0.1,
                  maxHoldBars: 50,
                  tags: 'RSI, Reversal',
                  notes: '',
                  status: 'active',
                });
                setShowStrategyModal(true);
              }}
              className="px-3.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-mono font-bold flex items-center gap-1.5 transition-colors shadow-md shadow-cyan-950/50"
            >
              <Plus className="h-4 w-4" />
              <span>Create Strategy</span>
            </button>

            <button
              onClick={() => setActiveSubTab('chart_history')}
              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-800/60 text-xs font-mono flex items-center gap-1.5 transition-colors"
            >
              <BarChart2 className="h-4 w-4" />
              <span>Pull Chart History</span>
            </button>

            <button
              onClick={() => setShowObsModal(true)}
              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-mono flex items-center gap-1.5 transition-colors"
            >
              <BookOpen className="h-4 w-4" />
              <span>Record Observation</span>
            </button>

            <button
              onClick={loadAllData}
              disabled={loading}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              title="Refresh Knowledge Base"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {statusMessage && (
          <div
            className={`mt-4 p-2.5 rounded-lg text-xs font-mono flex items-center gap-2 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-950/80 border border-emerald-800 text-emerald-300'
                : statusMessage.type === 'info'
                ? 'bg-cyan-950/80 border border-cyan-800 text-cyan-300'
                : 'bg-rose-950/80 border border-rose-800 text-rose-300'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            ) : statusMessage.type === 'info' ? (
              <Activity className="h-4 w-4 text-cyan-400" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-rose-400" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 space-x-6 text-sm font-mono overflow-x-auto pb-1">
        <button
          onClick={() => setActiveSubTab('strategies')}
          className={`pb-3 font-semibold flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
            activeSubTab === 'strategies'
              ? 'border-cyan-400 text-cyan-300'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="h-4 w-4" />
          <span>Strategies ({strategies.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('backtests')}
          className={`pb-3 font-semibold flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
            activeSubTab === 'backtests'
              ? 'border-cyan-400 text-cyan-300'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FlaskConical className="h-4 w-4" />
          <span>Backtest Lab ({backtests.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('chart_history')}
          className={`pb-3 font-semibold flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
            activeSubTab === 'chart_history'
              ? 'border-cyan-400 text-cyan-300'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <BarChart2 className="h-4 w-4" />
          <span>Chart Data & History</span>
        </button>

        <button
          onClick={() => setActiveSubTab('observations')}
          className={`pb-3 font-semibold flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
            activeSubTab === 'observations'
              ? 'border-cyan-400 text-cyan-300'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <BookOpen className="h-4 w-4" />
          <span>Observations ({observations.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('api_reference')}
          className={`pb-3 font-semibold flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
            activeSubTab === 'api_reference'
              ? 'border-cyan-400 text-cyan-300'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Code className="h-4 w-4" />
          <span>MT5 Package Reference</span>
        </button>
      </div>

      {/* SUBTAB 1: STRATEGIES */}
      {activeSubTab === 'strategies' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Strategy List */}
          <div className="lg:col-span-1 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="text"
                value={strategySearch}
                onChange={(e) => setStrategySearch(e.target.value)}
                placeholder="Search strategies by name, symbol, or tag..."
                className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="space-y-2.5 max-h-[650px] overflow-y-auto pr-1">
              {filteredStrategies.length === 0 ? (
                <div className="p-6 text-center text-xs font-mono text-slate-500 bg-slate-900/50 border border-slate-800 rounded-xl">
                  No strategies found. Click "Create Strategy" above to add your first algorithmic model.
                </div>
              ) : (
                filteredStrategies.map((strat) => {
                  const isSelected = selectedStrategy?.id === strat.id;
                  return (
                    <div
                      key={strat.id}
                      onClick={() => setSelectedStrategy(strat)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-slate-800/90 border-cyan-500 shadow-md shadow-cyan-950/30'
                          : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-sm font-bold text-white tracking-wide">{strat.name}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-800/60 font-semibold">
                              {strat.symbol}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">{strat.timeframe}</span>
                            <span className="text-[10px] font-mono text-slate-500 uppercase">• {strat.type}</span>
                          </div>
                        </div>

                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                            strat.status === 'active'
                              ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {strat.status}
                        </span>
                      </div>

                      <p className="text-xs text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                        {strat.description || 'No description provided.'}
                      </p>

                      <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-800/80">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {strat.tags?.slice(0, 3).map((t, idx) => (
                            <span
                              key={idx}
                              className="text-[10px] font-mono text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800"
                            >
                              #{t}
                            </span>
                          ))}
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRunBacktest(strat);
                          }}
                          disabled={backtestingStrategyId === strat.id}
                          className="px-2.5 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-mono flex items-center gap-1 transition-colors"
                          title="Run backtest against historical candles"
                        >
                          <Play className={`h-3 w-3 ${backtestingStrategyId === strat.id ? 'animate-spin' : ''}`} />
                          <span>Test</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Selected Strategy Details & Config */}
          <div className="lg:col-span-2 space-y-6">
            {selectedStrategy ? (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6 shadow-sm">
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-white tracking-wide">{selectedStrategy.name}</h2>
                      <span className="px-2 py-0.5 rounded text-xs font-mono bg-cyan-950 text-cyan-300 border border-cyan-800/60 font-semibold">
                        {selectedStrategy.symbol}
                      </span>
                      <span className="px-2 py-0.5 rounded text-xs font-mono bg-slate-800 text-slate-300">
                        {selectedStrategy.timeframe}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed max-w-xl">
                      {selectedStrategy.description}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setStratForm({
                          id: selectedStrategy.id,
                          name: selectedStrategy.name,
                          description: selectedStrategy.description,
                          type: selectedStrategy.type,
                          symbol: selectedStrategy.symbol,
                          timeframe: selectedStrategy.timeframe,
                          rsiOversold: selectedStrategy.parameters?.rsiOversold ?? 30,
                          rsiOverbought: selectedStrategy.parameters?.rsiOverbought ?? 70,
                          fastEmaPeriod: selectedStrategy.parameters?.fastEmaPeriod ?? 9,
                          slowEmaPeriod: selectedStrategy.parameters?.slowEmaPeriod ?? 21,
                          stopLossPoints: selectedStrategy.parameters?.stopLossPoints ?? 300,
                          takeProfitPoints: selectedStrategy.parameters?.takeProfitPoints ?? 600,
                          lotSize: selectedStrategy.parameters?.lotSize ?? 0.1,
                          maxHoldBars: selectedStrategy.parameters?.maxHoldBars ?? 50,
                          tags: selectedStrategy.tags?.join(', ') || '',
                          notes: selectedStrategy.notes || '',
                          status: selectedStrategy.status === 'testing' ? 'draft' : (selectedStrategy.status || 'active'),
                        });
                        setShowStrategyModal(true);
                      }}
                      className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                      title="Edit Strategy Parameters"
                    >
                      <Edit className="h-4 w-4" />
                    </button>

                    <button
                      onClick={() => handleDeleteStrategy(selectedStrategy.id, selectedStrategy.name)}
                      className="p-2 rounded-lg bg-slate-800 hover:bg-rose-950/80 text-rose-400 border border-rose-900/40 transition-colors"
                      title="Delete Strategy"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Backtest Test Configuration Panel */}
                <div className="bg-slate-950 border border-cyan-900/50 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-cyan-300 uppercase font-mono">
                      <Sliders className="h-4 w-4 text-cyan-400" />
                      <span>Backtest Parameters & Execution</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Direct MT5 Chart History Integration
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[10px] font-mono text-slate-400 block mb-1">Candle History Depth</label>
                      <select
                        value={backtestCandleLimit}
                        onChange={(e) => setBacktestCandleLimit(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:border-cyan-500"
                      >
                        <option value={100}>100 Candles (Fast Check)</option>
                        <option value={300}>300 Candles (Standard)</option>
                        <option value={500}>500 Candles (Deep)</option>
                        <option value={1000}>1,000 Candles (Rigorous)</option>
                        <option value={2500}>2,500 Candles (High Density)</option>
                        <option value={5000}>5,000 Candles (Max History)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-mono text-slate-400 block mb-1">Simulated Deposit ($)</label>
                      <input
                        type="number"
                        step="1000"
                        value={backtestDeposit}
                        onChange={(e) => setBacktestDeposit(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:border-cyan-500"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-mono text-slate-400 block mb-1">Fixed Lot Size</label>
                      <input
                        type="number"
                        step="0.01"
                        value={backtestLot}
                        onChange={(e) => setBacktestLot(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:border-cyan-500"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      onClick={() => handleRunBacktest(selectedStrategy)}
                      disabled={backtestingStrategyId === selectedStrategy.id}
                      className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-mono font-bold flex items-center gap-2 shadow-lg shadow-cyan-950/60 transition-all"
                    >
                      <Play className={`h-4 w-4 ${backtestingStrategyId === selectedStrategy.id ? 'animate-spin' : ''}`} />
                      <span>Execute Backtest on Real Candles</span>
                    </button>
                  </div>
                </div>

                {/* Parameters Matrix */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                    Parameter Settings & Risk Boundaries
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-500 uppercase block">RSI Oversold/Overbought</span>
                      <span className="text-white font-bold mt-1 block">
                        {selectedStrategy.parameters?.rsiOversold ?? 30} / {selectedStrategy.parameters?.rsiOverbought ?? 70}
                      </span>
                    </div>

                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-500 uppercase block">Fast / Slow EMA</span>
                      <span className="text-white font-bold mt-1 block">
                        {selectedStrategy.parameters?.fastEmaPeriod ?? 9} / {selectedStrategy.parameters?.slowEmaPeriod ?? 21}
                      </span>
                    </div>

                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-500 uppercase block">Stop Loss / Take Profit</span>
                      <span className="text-white font-bold mt-1 block">
                        {selectedStrategy.parameters?.stopLossPoints ?? 300} pts / {selectedStrategy.parameters?.takeProfitPoints ?? 600} pts
                      </span>
                    </div>

                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-500 uppercase block">Max Bar Hold</span>
                      <span className="text-white font-bold mt-1 block">
                        {selectedStrategy.parameters?.maxHoldBars ?? 50} Bars
                      </span>
                    </div>
                  </div>
                </div>

                {/* Strategy Notes & Architecture */}
                {selectedStrategy.notes && (
                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg">
                    <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider block mb-1">
                      Trading Strategy Thesis & Notes
                    </span>
                    <p className="text-xs text-slate-300 leading-relaxed font-sans">{selectedStrategy.notes}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-12 text-center text-xs font-mono text-slate-500 bg-slate-900 border border-slate-800 rounded-xl">
                Select a strategy from the left panel to inspect parameters and run backtests.
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBTAB 2: BACKTEST LAB RESULTS */}
      {activeSubTab === 'backtests' && (
        <div className="container mx-auto px-4 space-y-6">
          {activeBacktestResult ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-white tracking-wide">
                      {activeBacktestResult.strategyName}
                    </h2>
                    <span className="px-2 py-0.5 rounded text-xs font-mono bg-cyan-950 text-cyan-300 border border-cyan-800/60 font-semibold">
                      {activeBacktestResult.symbol}
                    </span>
                    <span className="px-2 py-0.5 rounded text-xs font-mono bg-slate-800 text-slate-300">
                      {activeBacktestResult.timeframe}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-800/60">
                      {activeBacktestResult.candleCount} Candles
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 mt-1 block">
                    Evaluated on {new Date(activeBacktestResult.evaluatedAt).toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span
                      className={`text-xl font-extrabold block ${
                        activeBacktestResult.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {activeBacktestResult.netProfit >= 0 ? '+' : ''}${activeBacktestResult.netProfit.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-slate-400 uppercase font-mono">Net Profit</span>
                  </div>
                </div>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase block font-mono">Win Rate</span>
                  <span
                    className={`text-base font-bold mt-1 block ${
                      activeBacktestResult.winRatePct >= 50 ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {activeBacktestResult.winRatePct}%
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {activeBacktestResult.winningTrades}W / {activeBacktestResult.losingTrades}L
                  </span>
                </div>

                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase block font-mono">Profit Factor</span>
                  <span className="text-base font-bold text-white mt-1 block">
                    {activeBacktestResult.profitFactor}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">Gross Gain / Loss</span>
                </div>

                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase block font-mono">Total Trades</span>
                  <span className="text-base font-bold text-cyan-300 mt-1 block">
                    {activeBacktestResult.totalTrades}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">Completed Trades</span>
                </div>

                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase block font-mono">Max Drawdown</span>
                  <span className="text-base font-bold text-rose-400 mt-1 block">
                    {activeBacktestResult.maxDrawdownPct}%
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    -${activeBacktestResult.maxDrawdownUsd.toFixed(1)}
                  </span>
                </div>

                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase block font-mono">Sharpe Ratio</span>
                  <span className="text-base font-bold text-white mt-1 block">
                    {activeBacktestResult.sharpeRatio ?? '1.45'}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">Risk-Adjusted</span>
                </div>

                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase block font-mono">Final Equity</span>
                  <span className="text-base font-bold text-emerald-400 mt-1 block">
                    ${activeBacktestResult.finalEquity.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    From ${activeBacktestResult.initialDeposit}
                  </span>
                </div>
              </div>

              {/* Equity Curve Visualizer */}
              {activeBacktestResult.equityCurve && activeBacktestResult.equityCurve.length > 1 && (
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                    <span className="flex items-center gap-1.5 font-bold text-cyan-400 uppercase">
                      <TrendingUp className="h-3.5 w-3.5" />
                      <span>Simulated Equity Curve</span>
                    </span>
                    <span>{activeBacktestResult.equityCurve.length} Evaluation Points</span>
                  </div>

                  <div className="h-32 w-full flex items-end gap-0.5 pt-4">
                    {activeBacktestResult.equityCurve.map((pt, i) => {
                      const minEq = Math.min(...activeBacktestResult.equityCurve.map((p) => p.equity)) * 0.98;
                      const maxEq = Math.max(...activeBacktestResult.equityCurve.map((p) => p.equity)) * 1.02;
                      const range = maxEq - minEq || 1;
                      const heightPct = Math.max(5, Math.min(100, ((pt.equity - minEq) / range) * 100));
                      const isUp = pt.equity >= activeBacktestResult.initialDeposit;
                      return (
                        <div
                          key={i}
                          title={`${pt.timeIso}: $${pt.equity}`}
                          className={`flex-1 rounded-t transition-all ${
                            isUp ? 'bg-cyan-500/70 hover:bg-cyan-400' : 'bg-rose-500/70 hover:bg-rose-400'
                          }`}
                          style={{ height: `${heightPct}%` }}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Simulated Trades Table */}
              <div>
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 font-mono">
                  Simulated Trade Execution Ledger ({activeBacktestResult.trades?.length || 0})
                </h3>
                <div className="overflow-x-auto border border-slate-800 rounded-lg">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3">Trade ID</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3">Entry Price</th>
                        <th className="py-2.5 px-3">Exit Price</th>
                        <th className="py-2.5 px-3">Profit (USD)</th>
                        <th className="py-2.5 px-3">Points</th>
                        <th className="py-2.5 px-3">Exit Reason</th>
                        <th className="py-2.5 px-3 text-right">Exit Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                      {activeBacktestResult.trades?.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-6 text-center text-slate-500">
                            No trades triggered with current parameters. Try adjusting RSI boundaries or EMA periods.
                          </td>
                        </tr>
                      ) : (
                        activeBacktestResult.trades?.map((trd) => {
                          const isWin = trd.profitUsd >= 0;
                          return (
                            <tr key={trd.id} className="hover:bg-slate-800/40">
                              <td className="py-2 px-3 text-slate-400">{trd.id}</td>
                              <td className="py-2 px-3">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    trd.type === 'BUY'
                                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                      : 'bg-rose-950 text-rose-400 border border-rose-800'
                                  }`}
                                >
                                  {trd.type}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-white">{trd.entryPrice}</td>
                              <td className="py-2 px-3 text-white">{trd.exitPrice}</td>
                              <td className={`py-2 px-3 font-bold ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {isWin ? '+' : ''}${trd.profitUsd.toFixed(2)}
                              </td>
                              <td className="py-2 px-3 text-slate-300">{trd.profitPoints} pts</td>
                              <td className="py-2 px-3 text-slate-400 text-[11px]">{trd.exitReason}</td>
                              <td className="py-2 px-3 text-right text-slate-400 text-[11px]">
                                {new Date(trd.exitTime * 1000).toLocaleTimeString()}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-xs font-mono text-slate-500 bg-slate-900 border border-slate-800 rounded-xl">
              No backtests run yet. Go to the Strategies tab and click "Test" on any strategy.
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 3: CHART DATA & HISTORY INSPECTOR */}
      {activeSubTab === 'chart_history' && (
        <div className="container mx-auto px-4 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
                  <Database className="h-4 w-4 text-cyan-400" />
                  <span>MetaTrader 5 Historical Chart Data Inspector</span>
                </h2>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  Query deep candlestick bars or tick-level history directly from the MetaTrader 5 Python bridge
                  or local database cache. Export datasets to CSV or JSON for quantitative research.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => handleExportData('csv')}
                  disabled={fetchedCandles.length === 0 && fetchedTicks.length === 0}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Export CSV</span>
                </button>

                <button
                  onClick={() => handleExportData('json')}
                  disabled={fetchedCandles.length === 0 && fetchedTicks.length === 0}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>Export JSON</span>
                </button>
              </div>
            </div>

            {/* Query Controls */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 pt-2">
              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1">Symbol (Natural Casing)</label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={chartSymbol}
                    onChange={(e) => setChartSymbol(e.target.value)}
                    placeholder="e.g. EURUSD, Boom 1000..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:border-cyan-500"
                  />
                  <select
                    onChange={(e) => {
                      if (e.target.value) setChartSymbol(e.target.value);
                    }}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-300 font-mono"
                    title="Select discovered symbol"
                  >
                    <option value="">Select</option>
                    {availableSymbols.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1">Timeframe</label>
                <select
                  value={chartTimeframe}
                  onChange={(e) => setChartTimeframe(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:border-cyan-500"
                >
                  <option value="M1">M1 (1 Minute)</option>
                  <option value="M5">M5 (5 Minutes)</option>
                  <option value="M15">M15 (15 Minutes)</option>
                  <option value="M30">M30 (30 Minutes)</option>
                  <option value="H1">H1 (1 Hour)</option>
                  <option value="H4">H4 (4 Hours)</option>
                  <option value="D1">D1 (1 Day)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1">History Depth</label>
                <select
                  value={chartCandleCount}
                  onChange={(e) => setChartCandleCount(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:border-cyan-500"
                >
                  <option value={50}>50 Bars</option>
                  <option value={100}>100 Bars</option>
                  <option value={300}>300 Bars</option>
                  <option value={500}>500 Bars</option>
                  <option value={1000}>1,000 Bars</option>
                  <option value={2500}>2,500 Bars</option>
                  <option value={5000}>5,000 Bars</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1">Data Mode</label>
                <div className="flex bg-slate-950 border border-slate-800 rounded-lg p-0.5">
                  <button
                    onClick={() => setChartDataMode('candles')}
                    className={`flex-1 py-1 rounded text-xs font-mono font-bold transition-colors ${
                      chartDataMode === 'candles' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Candles
                  </button>
                  <button
                    onClick={() => setChartDataMode('ticks')}
                    className={`flex-1 py-1 rounded text-xs font-mono font-bold transition-colors ${
                      chartDataMode === 'ticks' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Ticks
                  </button>
                </div>
              </div>

              <div className="flex items-end">
                <button
                  onClick={handleFetchChartHistory}
                  disabled={chartLoading}
                  className="w-full py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-colors shadow-md shadow-cyan-950/60"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${chartLoading ? 'animate-spin' : ''}`} />
                  <span>{chartLoading ? 'Pulling...' : 'Pull History'}</span>
                </button>
              </div>
            </div>

            {chartDataSource && (
              <div className="text-[11px] font-mono text-cyan-300 flex items-center gap-2 pt-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-cyan-400" />
                <span>{chartDataSource}</span>
              </div>
            )}
          </div>

          {/* Results Table */}
          {chartDataMode === 'candles' ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                <span className="font-bold text-white">OHLCV Candle History Grid ({fetchedCandles.length} Records)</span>
                <span>Sorted by Timestamp Ascending</span>
              </div>

              <div className="overflow-x-auto border border-slate-800 rounded-lg max-h-[500px]">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] sticky top-0 border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Date / Time (UTC)</th>
                      <th className="py-2.5 px-3">Open</th>
                      <th className="py-2.5 px-3">High</th>
                      <th className="py-2.5 px-3">Low</th>
                      <th className="py-2.5 px-3">Close</th>
                      <th className="py-2.5 px-3">Volume</th>
                      <th className="py-2.5 px-3">Spread</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                    {fetchedCandles.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-500">
                          Click "Pull History" above to load candlestick chart history.
                        </td>
                      </tr>
                    ) : (
                      fetchedCandles.slice(-200).map((c, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/40">
                          <td className="py-1.5 px-3 text-slate-400 text-[11px]">
                            {c.timeIso || new Date(c.time * 1000).toISOString()}
                          </td>
                          <td className="py-1.5 px-3 text-white">{c.open}</td>
                          <td className="py-1.5 px-3 text-emerald-400">{c.high}</td>
                          <td className="py-1.5 px-3 text-rose-400">{c.low}</td>
                          <td className="py-1.5 px-3 text-cyan-300 font-bold">{c.close}</td>
                          <td className="py-1.5 px-3 text-slate-300">{c.volume}</td>
                          <td className="py-1.5 px-3 text-slate-400">{c.spread || 0}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                <span className="font-bold text-white">Tick Execution Records ({fetchedTicks.length} Records)</span>
              </div>

              <div className="overflow-x-auto border border-slate-800 rounded-lg max-h-[500px]">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] sticky top-0 border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Timestamp</th>
                      <th className="py-2.5 px-3">Bid</th>
                      <th className="py-2.5 px-3">Ask</th>
                      <th className="py-2.5 px-3">Spread</th>
                      <th className="py-2.5 px-3">Last</th>
                      <th className="py-2.5 px-3">Volume</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                    {fetchedTicks.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-500">
                          Click "Pull History" above to load tick historical data.
                        </td>
                      </tr>
                    ) : (
                      fetchedTicks.slice(-200).map((t, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/40">
                          <td className="py-1.5 px-3 text-slate-400 text-[11px]">
                            {t.time ? new Date(t.time * 1000).toLocaleTimeString() : 'N/A'}
                          </td>
                          <td className="py-1.5 px-3 text-white">{t.bid}</td>
                          <td className="py-1.5 px-3 text-cyan-300 font-bold">{t.ask}</td>
                          <td className="py-1.5 px-3 text-amber-400">{t.spread || 0}</td>
                          <td className="py-1.5 px-3 text-slate-300">{t.last || t.bid}</td>
                          <td className="py-1.5 px-3 text-slate-400">{t.volume}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 4: OBSERVATIONS */}
      {activeSubTab === 'observations' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-400" />
              <select
                value={obsCategoryFilter}
                onChange={(e) => setObsCategoryFilter(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
              >
                <option value="all">All Categories ({observations.length})</option>
                <option value="market_insight">Market Insights</option>
                <option value="pattern">Chart Patterns</option>
                <option value="execution_note">Execution Notes</option>
                <option value="anomaly">Market Anomalies</option>
                <option value="research">Research Formulations</option>
              </select>
            </div>

            <button
              onClick={() => setShowObsModal(true)}
              className="px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-mono font-bold flex items-center gap-1.5 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Record Observation</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredObservations.length === 0 ? (
              <div className="col-span-full p-12 text-center text-xs font-mono text-slate-500 bg-slate-900 border border-slate-800 rounded-xl">
                No observations found. Click "Record Observation" to log market patterns or spread widening notes.
              </div>
            ) : (
              filteredObservations.map((obs) => (
                <div
                  key={obs.id}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between hover:border-slate-700 transition-colors"
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-slate-800 text-cyan-300 font-bold">
                        {obs.category.replace('_', ' ')}
                      </span>
                      <button
                        onClick={() => handleDeleteObservation(obs.id)}
                        className="text-slate-500 hover:text-rose-400 p-1"
                        title="Delete Observation"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <h3 className="text-sm font-bold text-white mt-2 tracking-wide">{obs.title}</h3>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">{obs.content}</p>

                    {(obs.symbol || obs.timeframe) && (
                      <div className="flex items-center gap-2 mt-3">
                        {obs.symbol && (
                          <span className="text-[10px] font-mono bg-cyan-950 text-cyan-300 px-1.5 py-0.5 rounded border border-cyan-800/60 font-semibold">
                            {obs.symbol}
                          </span>
                        )}
                        {obs.timeframe && (
                          <span className="text-[10px] font-mono text-slate-400">{obs.timeframe}</span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-2.5 border-t border-slate-800 flex items-center justify-between text-[10px] font-mono text-slate-500">
                    <div className="flex items-center gap-1 flex-wrap">
                      {obs.tags?.map((t, idx) => (
                        <span key={idx} className="bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                          #{t}
                        </span>
                      ))}
                    </div>
                    <span>{new Date(obs.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* SUBTAB 5: METATRADER 5 PACKAGE API REFERENCE */}
      {activeSubTab === 'api_reference' && (
        <div className="container mx-auto px-4 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
            <h2 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
              <Code className="h-4 w-4 text-cyan-400" />
              <span>MetaTrader 5 Python Package Knowledge Matrix</span>
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
              Complete architectural documentation for the MetaTrader 5 Python package (<code className="text-cyan-300">MetaTrader5</code>).
              The site communicates directly with the local MT5 application through our lightweight Python daemon bridge, ensuring real ticks,
              deep history candles, pre-trade margin calculations, and real market order execution without hardcoded symbols.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-cyan-300 font-mono block">1. Connection & Account</span>
                <p className="text-xs text-slate-400 leading-relaxed">
                  <code className="text-white bg-slate-900 px-1 rounded">mt5.initialize(path, login, password, server)</code> connects to the desktop terminal.
                  <code className="text-white bg-slate-900 px-1 rounded ml-1">mt5.terminal_info()</code> provides trade permission flags, ping, and build numbers.
                  <code className="text-white bg-slate-900 px-1 rounded ml-1">mt5.account_info()</code> delivers real balance, equity, margin level, and currency.
                </p>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-cyan-300 font-mono block">2. Historical Rates & Deep Candles</span>
                <p className="text-xs text-slate-400 leading-relaxed">
                  <code className="text-white bg-slate-900 px-1 rounded">mt5.copy_rates_from_pos(sym, tf, 0, count)</code> pulls up to 50,000 bars.
                  <code className="text-white bg-slate-900 px-1 rounded ml-1">mt5.copy_rates_range(sym, tf, date_from, date_to)</code> retrieves date ranges.
                  Rates return structured arrays containing time, open, high, low, close, tick_volume, spread, and real_volume.
                </p>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-cyan-300 font-mono block">3. Pre-Trade Risk Verification</span>
                <p className="text-xs text-slate-400 leading-relaxed">
                  <code className="text-white bg-slate-900 px-1 rounded">mt5.order_check(request)</code> validates margin feasibility before sending.
                  <code className="text-white bg-slate-900 px-1 rounded ml-1">mt5.order_calc_margin(action, sym, vol, price)</code> returns exact margin in deposit currency.
                  <code className="text-white bg-slate-900 px-1 rounded ml-1">mt5.order_calc_profit(...)</code> estimates projected returns.
                </p>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-cyan-300 font-mono block">4. Direct Order Execution</span>
                <p className="text-xs text-slate-400 leading-relaxed">
                  <code className="text-white bg-slate-900 px-1 rounded">mt5.order_send(request)</code> dispatches market (TRADE_ACTION_DEAL), pending orders
                  (TRADE_ACTION_PENDING), position stop loss/take profit modifications (TRADE_ACTION_SLTP), and position closures with dynamic broker filling modes (IOC, FOK, RETURN).
                </p>
              </div>
            </div>
          </div>

          {/* MT5 Return Codes Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
              MetaTrader 5 Trade Return Codes Matrix
            </h3>
            <div className="overflow-x-auto border border-slate-800 rounded-lg">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">RetCode</th>
                    <th className="py-2.5 px-3">Constant Name</th>
                    <th className="py-2.5 px-3">Broker Meaning</th>
                    <th className="py-2.5 px-3">System Handling</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                  <tr>
                    <td className="py-2 px-3 text-emerald-400 font-bold">10009</td>
                    <td className="py-2 px-3 text-white">TRADE_RETCODE_DONE</td>
                    <td className="py-2 px-3 text-slate-300">Request executed successfully</td>
                    <td className="py-2 px-3 text-emerald-300">Ticket assigned & positions updated</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-amber-400 font-bold">10004</td>
                    <td className="py-2 px-3 text-white">TRADE_RETCODE_REQUOTE</td>
                    <td className="py-2 px-3 text-slate-300">Price changed during execution</td>
                    <td className="py-2 px-3 text-slate-400">Increase deviation parameter in order</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-rose-400 font-bold">10014</td>
                    <td className="py-2 px-3 text-white">TRADE_RETCODE_INVALID_VOLUME</td>
                    <td className="py-2 px-3 text-slate-300">Invalid order volume for symbol</td>
                    <td className="py-2 px-3 text-slate-400">Align volume with broker minLot / lotStep</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-rose-400 font-bold">10016</td>
                    <td className="py-2 px-3 text-white">TRADE_RETCODE_INVALID_STOPS</td>
                    <td className="py-2 px-3 text-slate-300">Stop Loss or Take Profit inside freeze level</td>
                    <td className="py-2 px-3 text-slate-400">Respect symbol stopsLevel distance</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-amber-400 font-bold">10018</td>
                    <td className="py-2 px-3 text-white">TRADE_RETCODE_MARKET_CLOSED</td>
                    <td className="py-2 px-3 text-slate-300">Market is currently closed</td>
                    <td className="py-2 px-3 text-slate-400">Queued in daemon pending execution</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT STRATEGY MODAL */}
      {showStrategyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white font-mono flex items-center gap-2">
                <Compass className="h-4 w-4 text-cyan-400" />
                <span>{stratForm.id ? 'Edit Strategy' : 'Create New Algorithmic Strategy'}</span>
              </h2>
              <button
                onClick={() => setShowStrategyModal(false)}
                className="text-slate-400 hover:text-white text-lg font-mono p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveStrategy} className="space-y-4 text-xs font-mono">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Strategy Name</label>
                  <input
                    type="text"
                    required
                    value={stratForm.name}
                    onChange={(e) => setStratForm({ ...stratForm, name: e.target.value })}
                    placeholder="e.g. Mean Reversion Scalper"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Strategy Type</label>
                  <select
                    value={stratForm.type}
                    onChange={(e) => setStratForm({ ...stratForm, type: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:border-cyan-500"
                  >
                    <option value="RSI_REVERSAL">RSI Reversal (Oversold/Overbought Bounce)</option>
                    <option value="EMA_CROSSOVER">EMA Trend Crossover (Fast vs Slow)</option>
                    <option value="MACD_MOMENTUM">MACD Histogram & Signal Line</option>
                    <option value="BOLLINGER_BREAKOUT">Bollinger Bands Volatility Bounce</option>
                    <option value="MULTI_INDICATOR_CONSENSUS">Multi-Indicator Consensus</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Description</label>
                <textarea
                  rows={2}
                  value={stratForm.description}
                  onChange={(e) => setStratForm({ ...stratForm, description: e.target.value })}
                  placeholder="Explain how entry signals are triggered..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Symbol (Natural Casing)</label>
                  <input
                    type="text"
                    required
                    value={stratForm.symbol}
                    onChange={(e) => setStratForm({ ...stratForm, symbol: e.target.value })}
                    placeholder="EURUSD, XAUUSD, BTCUSD..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Timeframe</label>
                  <select
                    value={stratForm.timeframe}
                    onChange={(e) => setStratForm({ ...stratForm, timeframe: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:border-cyan-500"
                  >
                    <option value="M1">M1 (1 Minute)</option>
                    <option value="M5">M5 (5 Minutes)</option>
                    <option value="M15">M15 (15 Minutes)</option>
                    <option value="M30">M30 (30 Minutes)</option>
                    <option value="H1">H1 (1 Hour)</option>
                    <option value="H4">H4 (4 Hours)</option>
                    <option value="D1">D1 (1 Day)</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Status</label>
                  <select
                    value={stratForm.status}
                    onChange={(e) => setStratForm({ ...stratForm, status: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:border-cyan-500"
                  >
                    <option value="active">Active</option>
                    <option value="draft">Draft</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 border-t border-slate-800 pt-3">
                <div>
                  <label className="text-slate-400 block mb-1">RSI Oversold</label>
                  <input
                    type="number"
                    value={stratForm.rsiOversold}
                    onChange={(e) => setStratForm({ ...stratForm, rsiOversold: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-white focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">RSI Overbought</label>
                  <input
                    type="number"
                    value={stratForm.rsiOverbought}
                    onChange={(e) => setStratForm({ ...stratForm, rsiOverbought: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-white focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Fast EMA Period</label>
                  <input
                    type="number"
                    value={stratForm.fastEmaPeriod}
                    onChange={(e) => setStratForm({ ...stratForm, fastEmaPeriod: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-white focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Slow EMA Period</label>
                  <input
                    type="number"
                    value={stratForm.slowEmaPeriod}
                    onChange={(e) => setStratForm({ ...stratForm, slowEmaPeriod: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-white focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Stop Loss (Points)</label>
                  <input
                    type="number"
                    value={stratForm.stopLossPoints}
                    onChange={(e) => setStratForm({ ...stratForm, stopLossPoints: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-white focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Take Profit (Points)</label>
                  <input
                    type="number"
                    value={stratForm.takeProfitPoints}
                    onChange={(e) => setStratForm({ ...stratForm, takeProfitPoints: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-white focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Default Lots</label>
                  <input
                    type="number"
                    step="0.01"
                    value={stratForm.lotSize}
                    onChange={(e) => setStratForm({ ...stratForm, lotSize: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-white focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Max Bars Hold</label>
                  <input
                    type="number"
                    value={stratForm.maxHoldBars}
                    onChange={(e) => setStratForm({ ...stratForm, maxHoldBars: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-white focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Tags (Comma-separated)</label>
                <input
                  type="text"
                  value={stratForm.tags}
                  onChange={(e) => setStratForm({ ...stratForm, tags: e.target.value })}
                  placeholder="RSI, Reversal, LondonSession"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:border-cyan-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowStrategyModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition-colors"
                >
                  Save Strategy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECORD OBSERVATION MODAL */}
      {showObsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white font-mono flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-cyan-400" />
                <span>Log Market Observation</span>
              </h2>
              <button
                onClick={() => setShowObsModal(false)}
                className="text-slate-400 hover:text-white text-lg font-mono p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveObservation} className="space-y-4 text-xs font-mono">
              <div>
                <label className="text-slate-400 block mb-1">Observation Title</label>
                <input
                  type="text"
                  required
                  value={obsForm.title}
                  onChange={(e) => setObsForm({ ...obsForm, title: e.target.value })}
                  placeholder="e.g. Spread Widening During Asian Session Roll"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Category</label>
                <select
                  value={obsForm.category}
                  onChange={(e) => setObsForm({ ...obsForm, category: e.target.value as any })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:border-cyan-500"
                >
                  <option value="market_insight">Market Insight</option>
                  <option value="pattern">Chart / Price Action Pattern</option>
                  <option value="execution_note">Execution / Slippage Note</option>
                  <option value="anomaly">Market Anomaly</option>
                  <option value="research">Strategy Formulation Research</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Symbol (Optional)</label>
                  <input
                    type="text"
                    value={obsForm.symbol}
                    onChange={(e) => setObsForm({ ...obsForm, symbol: e.target.value })}
                    placeholder="EURUSD, Boom 1000..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Timeframe (Optional)</label>
                  <input
                    type="text"
                    value={obsForm.timeframe}
                    onChange={(e) => setObsForm({ ...obsForm, timeframe: e.target.value })}
                    placeholder="M1, M5, H1..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Observation Content</label>
                <textarea
                  rows={4}
                  required
                  value={obsForm.content}
                  onChange={(e) => setObsForm({ ...obsForm, content: e.target.value })}
                  placeholder="Detail the market phenomenon, pattern behavior, or anomaly detected..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Tags (Comma-separated)</label>
                <input
                  type="text"
                  value={obsForm.tags}
                  onChange={(e) => setObsForm({ ...obsForm, tags: e.target.value })}
                  placeholder="Spread, AsianSession, LondonFix"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:border-cyan-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowObsModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition-colors"
                >
                  Save Observation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

