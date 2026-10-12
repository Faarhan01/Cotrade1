import React, { useState } from 'react';
import { useBridgeData } from './hooks/useBridgeData';
import { Navbar } from './components/layout/Navbar';
import { DashboardPage } from './pages/DashboardPage';
import { McpConsole } from './components/mcp/McpConsole';
import { RiskManagementPage } from './pages/RiskManagementPage';
import { DatabaseExplorer } from './components/database/DatabaseExplorer';
import { KnowledgeBasePage } from './pages/KnowledgeBasePage';
import { DaemonPage } from './pages/DaemonPage';
import { MT5GatewayPage } from './components/gateway/MT5GatewayPage';
import { AuditLogPage } from './pages/AuditLogPage';
import { Activity, ShieldCheck, Terminal, Cpu } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const { state, wsStatus, lastPingMs, reloadState } = useBridgeData();

  return (
    <>
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        state={state}
        wsStatus={wsStatus}
        lastPingMs={lastPingMs}
      />

      {/* Main Container */}
      <main className="flex-1 container-custom py-6">
        {activeTab === 'dashboard' && <DashboardPage state={state} onRefresh={reloadState} />}
        {(activeTab === 'knowledge' || activeTab === 'strategies') && <KnowledgeBasePage />}
        {activeTab === 'daemon' && <DaemonPage />}
        {activeTab === 'mcp' && <McpConsole />}
        {activeTab === 'risk' && <RiskManagementPage state={state} />}
        {activeTab === 'database' && <DatabaseExplorer />}
        {(activeTab === 'gateway' || activeTab === 'ea') && <MT5GatewayPage />}
        {activeTab === 'logs' && <AuditLogPage state={state} />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-4 mt-8">
        <div className="container-custom flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono text-slate-500">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-cyan-400"></span>
            <span>MT5 Direct Bridge: <code className="text-slate-400">http://127.0.0.1:8888</code></span>
            <span>•</span>
            <span>Provider: <code className="text-slate-400">Python MetaTrader5 Package</code></span>
          </div>

          <div className="flex items-center gap-4">
            <span>Protocol: MCP 2024-11-05</span>
            <span>•</span>
            <button
              onClick={() => setActiveTab('gateway')}
              className="text-cyan-400 hover:underline"
            >
              MT5 Terminal Direct Gateway
            </button>
          </div>
        </div>
      </footer>
    </>
  );
}