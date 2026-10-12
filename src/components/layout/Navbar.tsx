import React, { useState } from 'react';
import {
  Activity,
  Cpu,
  ShieldAlert,
  Terminal,
  Clock,
  Radio,
  Copy,
  Check,
  AlertTriangle,
  Database,
  BookOpen,
  Zap,
  Laptop,
} from 'lucide-react';
import { AppState } from '@/types';
import { api } from '../../lib/api';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  state: AppState | null;
  wsStatus: 'connected' | 'connecting' | 'disconnected';
  lastPingMs: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  state,
  wsStatus,
  lastPingMs,
}) => {
  const [copiedEndpoint, setCopiedEndpoint] = useState(false);
  const [killSwitchLoading, setKillSwitchLoading] = useState(false);

  const isTerminalOnline = state?.connection.isEaConnected ?? false;
  const isKillSwitchActive = state?.riskGuard.emergencyKillSwitch ?? false;

  const copyEndpoint = () => {
    navigator.clipboard.writeText('http://127.0.0.1:8888');
    setCopiedEndpoint(true);
    setTimeout(() => setCopiedEndpoint(false), 2000);
  };

  const handleToggleKillSwitch = async () => {
    try {
      setKillSwitchLoading(true);
      await api.toggleKillSwitch(!isKillSwitchActive);
    } catch (e) {
      console.error(e);
    } finally {
      setKillSwitchLoading(false);
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Terminal' },
    { id: 'knowledge', label: 'Knowledge Base' },
    { id: 'daemon', label: 'AI Daemon' },
    { id: 'mcp', label: 'MCP Hub' },
    { id: 'risk', label: 'Risk Guard' },
    { id: 'database', label: 'Database' },
    { id: 'gateway', label: 'MT5 Gateway' },
    { id: 'logs', label: 'Audit Logs' },
  ];

  return (
    <header className="border-b border-slate-800/80 bg-slate-950/95 sticky top-0 z-50">
      <div className="container-custom">
        <div className="flex items-center justify-between gap-8 h-14">
          {/* Zone 1: Brand Wordmark (Single line, no pills) */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setActiveTab('dashboard')}
              className="text-base font-bold tracking-tight text-white hover:text-cyan-400 transition-colors whitespace-nowrap shrink-0 flex items-center gap-2"
            >
              <span>MetaTrader 5 Copilot</span>
              <span className="text-xs font-mono font-normal text-slate-400">
                / Python IPC
              </span>
            </button>
          </div>

          {/* Zone 2: Navigation Links (Single-line, whitespace-nowrap, subtle hover) */}
          <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-400">
            {navItems.map((item) => {
              const isActive = activeTab === item.id || (item.id === 'gateway' && activeTab === 'ea');
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`transition-colors whitespace-nowrap shrink-0 text-xs font-mono ${
                    isActive
                      ? 'text-cyan-400 font-semibold'
                      : 'hover:text-slate-200'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Telemetry & Primary Action */}
          <div className="flex items-center gap-4 shrink-0">
            {/* Status Telemetry Text (Unboxed) */}
            <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-slate-400">
              <span className={isTerminalOnline ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-medium'}>
                {isTerminalOnline ? 'MT5 Online' : 'MT5 Standby'}
              </span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="text-slate-400 tabular-nums">
                {wsStatus === 'connected' ? `${lastPingMs > 0 ? `${lastPingMs}ms` : 'WS Live'}` : 'WS Syncing'}
              </span>
            </div>

            {/* Primary Action Button */}
            <button
              onClick={handleToggleKillSwitch}
              disabled={killSwitchLoading}
              className={`px-3 py-1.5 rounded-md text-xs font-mono font-semibold transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                isKillSwitchActive
                  ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm'
                  : 'bg-slate-900 hover:bg-rose-950/40 text-slate-300 hover:text-rose-400 border border-slate-800 hover:border-rose-800/60'
              }`}
              title="Emergency liquidation and order halt"
            >
              {isKillSwitchActive ? (
                <AlertTriangle className="h-3.5 w-3.5 text-white" />
              ) : (
                <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />
              )}
              <span>{isKillSwitchActive ? 'HALTED' : 'Emergency Stop'}</span>
            </button>
          </div>
        </div>

        {/* Mobile Nav Row */}
        <div className="flex lg:hidden overflow-x-auto py-2 gap-4 border-t border-slate-900 text-xs font-mono">
          {navItems.map((item) => {
            const isActive = activeTab === item.id || (item.id === 'gateway' && activeTab === 'ea');
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`whitespace-nowrap shrink-0 py-1 ${
                  isActive ? 'text-cyan-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
