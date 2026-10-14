import React from "react";
import { AlertTriangle, ShieldAlert, RefreshCw, Zap } from "lucide-react";
import { AppState } from "@/types";

export interface MobileNavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export interface MobileDrawerProps {
  isOpen: boolean;
  state: AppState | null;
  wsStatus: 'connected' | 'connecting' | 'disconnected';
  lastPingMs: number;
  currentNavTab: string;
  navItems: MobileNavItem[];
  killSwitchLoading: boolean;
  onClose: () => void;
  onSetNavTab: (tab: string) => void;
  onToggleKillSwitch: () => Promise<void>;
}

export const MobileDrawer: React.FC<MobileDrawerProps> = ({
  isOpen,
  state,
  wsStatus,
  lastPingMs,
  currentNavTab,
  navItems,
  killSwitchLoading,
  onClose,
  onSetNavTab,
  onToggleKillSwitch,
}) => {
  if (!isOpen) return null;

  const isTerminalOnline = state?.connection.isEaConnected ?? false;
  const isKillSwitchActive = state?.riskGuard.emergencyKillSwitch ?? false;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 top-16 bg-slate-950/70 backdrop-blur-xs z-40 md:hidden animate-fade-in"
        onClick={onClose}
      />
      {/* Slide-down Mobile Menu */}
      <div className="card-panel fixed top-16 left-0 right-0 max-h-[calc(100vh-4rem)] overflow-y-auto sm:p-5 flex flex-col gap-4 z-40 md:hidden animate-fade-in">
        {/* 1. Mobile Emergency Control Card */}
        <div className="card-panel flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
              Emergency Control
            </span>
            <span
              className={`badge ${
                isKillSwitchActive ? "badge-danger" : "badge-neutral"
              }`}
            >
              {isKillSwitchActive ? "Halted" : "Armed"}
            </span>
          </div>
          <button
            type="button"
            onClick={async () => {
              await onToggleKillSwitch();
              onClose();
            }}
            disabled={killSwitchLoading}
            className={`w-full py-3 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md ${
              isKillSwitchActive ? "btn-danger" : "btn-secondary text-rose-400 hover:text-rose-300"
            }`}
          >
            {isKillSwitchActive ? (
              <>
                <AlertTriangle className="w-4 h-4 fill-white" />
                <span>Resume Trading</span>
              </>
            ) : (
              <>
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                <span>Emergency Stop</span>
              </>
            )}
          </button>
        </div>

        {/* 2. Mobile Real-Time Statuses Hub */}
        <div className="card-panel flex flex-col gap-2.5">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
            System &amp; Network Status
          </span>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {/* MT5 EA */}
            <div className="card-panel flex flex-col gap-1">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider">
                MetaTrader 5
              </span>
              <div className="flex items-center gap-1.5">
                <span
                  className={`h-2 w-2 rounded-full ${
                    isTerminalOnline ? "bg-cyan-400 animate-pulse" : "bg-slate-500"
                  }`}
                />
                <span
                  className={`font-mono text-[11px] font-bold ${
                    isTerminalOnline ? "text-cyan-300" : "text-slate-400"
                  }`}
                >
                  {isTerminalOnline ? "ONLINE" : "STANDBY"}
                </span>
              </div>
            </div>

            {/* Feed Mode */}
            <div className="card-panel flex flex-col gap-1">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider">
                Feed Mode
              </span>
              <div className="flex items-center gap-1.5">
                <span
                  className={`h-2 w-2 rounded-full ${
                    wsStatus === "connected" ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
                  }`}
                />
                <span
                  className={`font-mono text-[11px] font-bold ${
                    wsStatus === "connected" ? "text-emerald-400" : "text-amber-400"
                  }`}
                >
                  {wsStatus === "connected"
                    ? `STREAM ${lastPingMs > 0 ? `(${lastPingMs}ms)` : ""}`
                    : "POLLING"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Mobile Navigation Menu Links */}
        <div className="card-panel flex flex-col gap-2">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono mb-1">
            Navigation
          </span>
          {navItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = currentNavTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSetNavTab(item.id);
                  onClose();
                }}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-sm font-bold"
                    : "text-slate-300 hover:text-white hover:bg-slate-800"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <IconComponent className="w-4 h-4" />
                  <span>{item.label}</span>
                </div>
                {isActive && (
                  <span className="badge bg-indigo-700 text-indigo-100 border-indigo-600">
                    ACTIVE
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
};