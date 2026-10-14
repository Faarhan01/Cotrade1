import React, { useState } from 'react';
import { useBridgeData } from './hooks/useBridgeData';
import { Navbar } from './components/layout/Navbar';
import { MobileDrawer, MobileNavItem } from './components/layout/MobileDrawer';
import { DashboardPage } from './pages/DashboardPage';
import { McpConsole } from './components/mcp/McpConsole';
import { RiskManagementPage } from './pages/RiskManagementPage';
import { DatabaseExplorer } from './components/database/DatabaseExplorer';
import { KnowledgeBasePage } from './pages/KnowledgeBasePage';
import { DaemonPage } from './pages/DaemonPage';
import { BotStudioPage } from './pages/BotStudioPage';
import { MT5GatewayPage } from './components/gateway/MT5GatewayPage';
import { AuditLogPage } from './pages/AuditLogPage';
import { Terminal, Cpu, BookOpen, Radio, ShieldAlert, Database, Laptop, Clock, Activity } from 'lucide-react';
import { api } from './lib/api';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [killSwitchLoading, setKillSwitchLoading] = useState<boolean>(false);
  const { state, wsStatus, lastPingMs, reloadState } = useBridgeData();

  const handleToggleKillSwitch = async () => {
    try {
      setKillSwitchLoading(true);
      await api.toggleKillSwitch(!(state?.riskGuard.emergencyKillSwitch ?? false));
    } catch (e) {
      console.error(e);
    } finally {
      setKillSwitchLoading(false);
    }
  };

  const navItems: MobileNavItem[] = [
    { id: 'dashboard', label: 'Terminal', icon: Terminal },
    { id: 'knowledge', label: 'Knowledge Base', icon: BookOpen },
    { id: 'bots', label: 'Bot Studio', icon: Cpu },
    { id: 'daemon', label: 'AI Daemon', icon: Activity },
    { id: 'mcp', label: 'MCP Hub', icon: Radio },
    { id: 'risk', label: 'Risk Guard', icon: ShieldAlert },
    { id: 'database', label: 'Database', icon: Database },
    { id: 'gateway', label: 'MT5 Gateway', icon: Laptop },
    { id: 'logs', label: 'Audit Logs', icon: Clock },
  ];

  return (
    <div id="app-container" className="min-h-screen bg-slate-900 text-slate-100 font-sans flex flex-col selection:bg-indigo-500 selection:text-white antialiased">
      {/* Top Header */}
      <Navbar
        state={state}
        wsStatus={wsStatus}
        lastPingMs={lastPingMs}
        isMobileMenuOpen={isMobileMenuOpen}
        onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        onToggleKillSwitch={handleToggleKillSwitch}
        killSwitchLoading={killSwitchLoading}
      />

      {/* Mobile Navigation Drawer */}
      <MobileDrawer
        isOpen={isMobileMenuOpen}
        state={state}
        wsStatus={wsStatus}
        lastPingMs={lastPingMs}
        currentNavTab={activeTab}
        navItems={navItems}
        killSwitchLoading={killSwitchLoading}
        onClose={() => setIsMobileMenuOpen(false)}
        onSetNavTab={(tab) => setActiveTab(tab)}
        onToggleKillSwitch={handleToggleKillSwitch}
      />

      {/* Tab Navigation Bar */}
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <nav className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto py-1">
            {navItems.map((item) => {
              const IconComp = item.icon;
              const isActive = activeTab === item.id || (item.id === 'gateway' && activeTab === 'ea');
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`nav-tab-btn ${isActive ? "nav-tab-active" : ""}`}
                >
                  <IconComp className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {activeTab === 'dashboard' && <DashboardPage state={state} onRefresh={reloadState} />}
        {(activeTab === 'knowledge' || activeTab === 'strategies') && <KnowledgeBasePage />}
        {activeTab === 'bots' && <BotStudioPage />}
        {activeTab === 'daemon' && <DaemonPage />}
        {activeTab === 'mcp' && <McpConsole />}
        {activeTab === 'risk' && <RiskManagementPage state={state} />}
        {activeTab === 'database' && <DatabaseExplorer />}
        {(activeTab === 'gateway' || activeTab === 'ea') && <MT5GatewayPage />}
        {activeTab === 'logs' && <AuditLogPage state={state} />}
      </main>

      {/* Footer */}
      <footer className="py-2.5 border-t border-slate-800 flex flex-wrap items-center px-4 sm:px-8 bg-slate-950/95 text-[11px] text-slate-400 gap-y-2 gap-x-6 font-mono mt-8">
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <span className="w-2 h-2 rounded-full bg-indigo-500 shadow-xs shadow-indigo-500/50"></span>
          <span>MT5 DIRECT BRIDGE: <strong className="text-slate-200">127.0.0.1:8888</strong></span>
        </div>

        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <span className="w-2 h-2 bg-slate-500 rounded-full"></span>
          <span>PROVIDER: <strong className="text-slate-200">PYTHON METATRADER5 PACKAGE</strong></span>
        </div>

        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <span className="w-2 h-2 bg-slate-500 rounded-full"></span>
          <span>PROTOCOL: <strong className="text-slate-200">MCP 2024-11-05</strong></span>
        </div>

        <div className="sm:ml-auto flex gap-4 uppercase font-bold tracking-tight text-[10px] whitespace-nowrap">
          <button
            onClick={() => setActiveTab('gateway')}
            className="text-indigo-300 hover:underline"
          >
            MT5 Terminal Direct Gateway
          </button>
          <span className="text-slate-500">Live Workspace</span>
        </div>
      </footer>
    </div>
  );
}