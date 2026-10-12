import React, { useState } from 'react';
import { useBridgeData } from './hooks/useBridgeData';
import { Navbar } from './components/layout/Navbar';
import { DashboardPage } from './pages/DashboardPage';
import { McpConsole } from './components/mcp/McpConsole';
import { RiskManagementPage } from './pages/RiskManagementPage';
import { EaSetupGuide } from './components/ea/EaSetupGuide';
import { AuditLogPage } from './pages/AuditLogPage';
import { DatabaseExplorer } from './components/database/DatabaseExplorer';
import { KnowledgeBasePage } from './pages/KnowledgeBasePage';
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
        {activeTab === 'strategies' && <KnowledgeBasePage />}
        {activeTab === 'mcp' && <McpConsole />}
        {activeTab === 'risk' && <RiskManagementPage state={state} />}
        {activeTab === 'database' && <DatabaseExplorer />}
        {activeTab === 'ea' && <EaSetupGuide />}
        {activeTab === 'logs' && <AuditLogPage state={state} />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-4 mt-8">
        <div className="container-custom flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono text-slate-500">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-cyan-400"></span>
            <span>MT5 Direct Bridge: <code className="text-slate-400">http://127.0.0.1:8888</code></span>
            <span>•</span>
            <span>Provider: <code className="text-slate-400">Peron Python MT5 Connector</code></span>
          </div>

          <div className="flex items-center gap-4">
            <span>Protocol: MCP 2024-11-05</span>
            <span>•</span>
            <button
              onClick={() => setActiveTab('ea')}
              className="text-cyan-400 hover:underline"
            >
              MT5 Connection Guide
            </button>
          </div>
        </div>
      </footer>
    </>
  );
}