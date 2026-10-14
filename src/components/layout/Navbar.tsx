import React, { useState } from 'react';
import {
  TrendingUp,
  Zap,
  RefreshCw,
  Wifi,
  WifiOff,
  Square,
  Play,
  Menu,
  X,
  ShieldAlert,
  AlertTriangle,
  Radio,
} from "lucide-react";
import { AppState } from '@/types';
import { api } from '../../lib/api';

export interface NavbarProps {
  state: AppState | null;
  wsStatus: 'connected' | 'connecting' | 'disconnected';
  lastPingMs: number;
  isMobileMenuOpen: boolean;
  onToggleMobileMenu: () => void;
  killSwitchLoading: boolean;
  onToggleKillSwitch: () => Promise<void>;
}

export const Navbar: React.FC<NavbarProps> = ({
  state,
  wsStatus,
  lastPingMs,
  isMobileMenuOpen,
  onToggleMobileMenu,
  onToggleKillSwitch,
  killSwitchLoading,
}) => {
  const isTerminalOnline = state?.connection.isEaConnected ?? false;
  const isKillSwitchActive = state?.riskGuard.emergencyKillSwitch ?? false;

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-50 px-4 sm:px-6 lg:px-8 flex items-center justify-between">
      {/* Brand / Logo */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-md shadow-indigo-600/25 shrink-0">
          <TrendingUp className="w-4.5 h-4.5 text-white" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-base font-bold tracking-tight text-white">MetaTrader 5 Copilot</span>
          <span className="hidden xs:inline-block text-[10px] font-mono px-1.5 py-0.5 bg-indigo-500/15 border border-indigo-500/30 rounded text-indigo-300 font-medium">
            {isTerminalOnline ? 'LIVE' : 'STANDBY'}
          </span>
        </div>
      </div>

      {/* Desktop Controls (Hidden on Mobile) */}
      <div className="hidden md:flex items-center gap-3">
        <div className="telemetry-strip">
          {/* MetaTrader 5 Sync Indicator */}
          <div className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${isTerminalOnline ? "bg-cyan-400 animate-pulse" : "bg-slate-500"}`} />
            <span className={`font-semibold uppercase text-[10px] ${isTerminalOnline ? "text-cyan-300" : "text-slate-400"}`}>
              {isTerminalOnline ? 'MT5 Online' : 'MT5 Standby'}
            </span>
          </div>

          <span className="telemetry-divider" aria-hidden="true">·</span>

          {/* WebSocket Real-time Stream Indicator */}
          <div className="flex items-center gap-1.5">
            {wsStatus === "connected" ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="font-semibold text-emerald-400 text-[10px] tracking-wide flex items-center gap-1">
                  <Zap className="w-3 h-3 text-emerald-400 inline" />
                  WS LIVE {lastPingMs > 0 ? `${lastPingMs}ms` : ""}
                </span>
              </>
            ) : (
              <>
                <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                <span className="font-semibold text-amber-400 text-[10px] tracking-wide flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 text-amber-400 inline" />
                  WS Syncing
                </span>
              </>
            )}
          </div>
        </div>

        {/* Emergency Stop Button */}
        <button
          type="button"
          onClick={onToggleKillSwitch}
          disabled={killSwitchLoading}
          className={`btn btn-sm ${
            isKillSwitchActive ? "btn-danger" : "btn-secondary text-rose-400 hover:text-rose-300 hover:border-rose-800/60"
          }`}
          title="Emergency liquidation and order halt"
        >
          {isKillSwitchActive ? (
            <>
              <AlertTriangle className="w-3.5 h-3.5 fill-white" />
              <span>HALTED</span>
            </>
          ) : (
            <>
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              <span>Emergency Stop</span>
            </>
          )}
        </button>
      </div>

      {/* Mobile Screen Controls (Quick Stop Mini Button + Hamburger Menu Toggle) */}
      <div className="flex md:hidden items-center gap-2">
        {/* Quick Stop Mini Button */}
        <button
          type="button"
          onClick={onToggleKillSwitch}
          disabled={killSwitchLoading}
          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
            isKillSwitchActive ? "bg-rose-600/90 text-white" : "bg-slate-800 text-rose-400 border border-slate-700/80"
          }`}
        >
          {isKillSwitchActive ? (
            <>
              <AlertTriangle className="w-3 h-3 fill-white" />
              <span>Halt</span>
            </>
          ) : (
            <>
              <ShieldAlert className="w-3 h-3 text-rose-400" />
              <span>Stop</span>
            </>
          )}
        </button>

        {/* Mobile Menu Icon Toggle Button */}
        <button
          type="button"
          onClick={onToggleMobileMenu}
          className="btn btn-secondary p-2 cursor-pointer"
          aria-label="Toggle navigation menu"
        >
          {isMobileMenuOpen ? (
            <X className="w-5 h-5 text-indigo-400" />
          ) : (
            <Menu className="w-5 h-5 text-slate-200" />
          )}
        </button>
      </div>
    </header>
  );
};
