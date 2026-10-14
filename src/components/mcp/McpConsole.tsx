import React, { useEffect, useState } from 'react';
import { MCPToolDefinition } from '@/types';
import { api } from '../../lib/api';
import {
  Cpu,
  Terminal,
  Play,
  Copy,
  Check,
  Code2,
  FileJson,
  Sparkles,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';

export const McpConsole: React.FC = () => {
  const [tools, setTools] = useState<MCPToolDefinition[]>([]);
  const [selectedTool, setSelectedTool] = useState<MCPToolDefinition | null>(null);
  const [toolArgsJson, setToolArgsJson] = useState(
    JSON.stringify(
      {
        symbol: 'EURUSD',
        orderType: 'BUY',
        volume: 0.1,
        sl: 1.0825,
        tp: 1.092,
        comment: 'AI_MCP_MOMENTUM',
      },
      null,
      2
    )
  );
  const [testResult, setTestResult] = useState<any>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [copiedConfig, setCopiedConfig] = useState(false);
  const [configType, setConfigType] = useState<'claude' | 'stdio' | 'cli' | 'cursor' | 'python'>('stdio');

  useEffect(() => {
    api.getMcpTools().then(({ tools: availableTools }) => {
      setTools(availableTools);
      setSelectedTool(availableTools.find((tool) => tool.name === 'mt5_execute_trade') || availableTools[0] || null);
    }).catch((error) => {
      setTestResult({ error: error?.message || 'Failed to load command registry' });
    });
  }, []);

  const stdioConfig = JSON.stringify(
    {
      mcpServers: {
        'mt5-bridge': {
          command: 'node',
          args: ['backend/mcp-tool/stdio.js'],
          env: {
            MCP_URL: 'http://127.0.0.1:3000/api/mcp',
          },
        },
      },
    },
    null,
    2
  );

  const claudeDesktopConfig = JSON.stringify(
    {
      mcpServers: {
        'mt5-bridge': {
          url: 'http://127.0.0.1:3000/api/mcp/sse',
        },
      },
    },
    null,
    2
  );

  const cliSnippet = `# Fast AI CLI commands (backend/mcp-tool/cli.js)
# 1. Inspect live status
node backend/mcp-tool/cli.js status

# 2. Get live quote & spread
node backend/mcp-tool/cli.js quote EURUSD

# 3. List active positions & pending orders
node backend/mcp-tool/cli.js positions
node backend/mcp-tool/cli.js orders

# 4. Instant trade dispatch with SL/TP
node backend/mcp-tool/cli.js buy EURUSD 0.10 1.0820 1.0920 "AI_ENTRY"
node backend/mcp-tool/cli.js sell XAUUSD 0.05 2640.50 2615.00 "MOMENTUM"

# 5. Close position or cancel pending order
node backend/mcp-tool/cli.js close 123456
node backend/mcp-tool/cli.js cancel 789101

# 6. Technical indicators & chart history
node backend/mcp-tool/cli.js indicators EURUSD M1
node backend/mcp-tool/cli.js candles EURUSD M1 60

# 7. Purge 24h+ unexecuted orders from database
node backend/mcp-tool/cli.js prune`;

  const pythonSnippet = `# Connect your External Python AI Agent to MT5 Bridge MCP endpoint
import requests

BRIDGE_MCP_URL = "http://127.0.0.1:3000/api/mcp"

def call_mt5_mcp(tool_name: str, args: dict):
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {
            "name": tool_name,
            "arguments": args
        }
    }
    response = requests.post(BRIDGE_MCP_URL, json=payload)
    return response.json()

# 1. External AI inspects live market data from MetaTrader 5
market_data = call_mt5_mcp("mt5_get_market_data", {"symbol": "EURUSD"})
print("Market Price Quote:", market_data)

# 2. External AI inspects real open positions in MT5
open_positions = call_mt5_mcp("mt5_get_open_positions", {})
print("Open Positions:", open_positions)

# 3. External AI executes or modifies trades based on incoming analysis
trade_res = call_mt5_mcp("mt5_execute_trade", {
    "symbol": "EURUSD",
    "orderType": "BUY",
    "volume": 0.1,
    "sl": 1.0820,
    "tp": 1.0920,
    "comment": "EXTERNAL_AI_MCP_SIGNAL"
})
print("Asynchronous Order Dispatched to MetaTrader 5:", trade_res)
`;

  const cursorSnippet = JSON.stringify(
    {
      mcpServers: {
        'mt5-ai-bridge': {
          command: 'node',
          args: ['backend/mcp-tool/stdio.js'],
        },
      },
    },
    null,
    2
  );

  const copyConfigSnippet = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedConfig(true);
    setTimeout(() => setCopiedConfig(false), 2000);
  };

  const handleSelectTool = (tool: MCPToolDefinition) => {
    setSelectedTool(tool);
    // Build default arguments template
    const defaults: Record<string, any> = {};
    if (tool.name === 'mt5_execute_trade') {
      defaults.symbol = 'EURUSD';
      defaults.orderType = 'BUY';
      defaults.volume = 0.1;
      defaults.sl = 1.0825;
      defaults.tp = 1.092;
      defaults.comment = 'AI_TEST_ORDER';
    } else if (tool.name === 'mt5_modify_position') {
      defaults.ticket = 10928374;
      defaults.sl = 1.083;
      defaults.tp = 1.0925;
    } else if (tool.name === 'mt5_close_position') {
      defaults.ticket = 10928374;
      defaults.volume = 0;
    } else if (tool.name === 'mt5_close_all') {
      defaults.symbol = 'ALL';
    } else if (tool.name === 'mt5_get_market_data') {
      defaults.symbol = 'EURUSD';
    } else if (tool.name === 'mt5_configure_risk_guard') {
      defaults.globalTakeProfitUSD = 2000;
      defaults.globalStopLossUSD = 1000;
      defaults.trailingStopEnabled = true;
      defaults.trailingStopDistancePoints = 150;
    }
    setToolArgsJson(JSON.stringify(defaults, null, 2));
    setTestResult(null);
  };

  const handleRunTool = async () => {
    if (!selectedTool) return;
    try {
      setIsRunning(true);
      setTestResult(null);
      let parsedArgs = {};
      try {
        parsedArgs = JSON.parse(toolArgsJson);
      } catch {
        throw new Error('Invalid JSON arguments syntax');
      }

      // Execute via JSON-RPC 2.0 to verify MCP protocol conformity
      const rpcPayload = {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: {
          name: selectedTool.name,
          arguments: parsedArgs,
        },
      };

      const res = await api.callMcpJsonRpc(rpcPayload);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({ error: err?.message || String(err) });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="card-panel flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-indigo-950/80 border border-indigo-700/60 flex items-center justify-center text-indigo-400 shadow-md shrink-0">
            <Cpu className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white tracking-tight">
                Model Context Protocol (MCP) Integration Hub
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed font-mono">
              Connect external AI models (Claude, ChatGPT, Gemini, Cursor, or autonomous Python agents)
              to MetaTrader 5 with full tool-calling capabilities: live tick streaming, asynchronous trade execution,
              position management, and dynamic risk guard enforcement.
            </p>
          </div>
        </div>

        <div className="card-panel text-xs font-mono text-slate-400">
          <span className="text-slate-500 block text-[10px]">MCP JSON-RPC Endpoint:</span>
          <span className="text-indigo-400 font-bold">http://127.0.0.1:3000/api/mcp</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Registered MCP Tools List (4 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="card-panel">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Code2 className="h-4 w-4 text-indigo-400" />
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  Registered MCP Tools ({tools.length})
                </h2>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                JSON-RPC 2.0
              </span>
            </div>

            <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
              {tools.map((tool) => {
                const isSelected = selectedTool?.name === tool.name;
                return (
                  <div
                    key={tool.name}
                    onClick={() => handleSelectTool(tool)}
                    className={`cursor-pointer p-3 rounded-lg border transition-all ${
                      isSelected
                        ? 'bg-slate-800/90 border-indigo-500 shadow-md ring-1 ring-indigo-500/50'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono font-bold text-xs text-indigo-300">
                        {tool.name}
                      </span>
                      {tool.inputSchema.required && tool.inputSchema.required.length > 0 && (
                        <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-slate-800 text-slate-400">
                          {tool.inputSchema.required.length} required
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                      {tool.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Tool Runner & Config Snippets (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Interactive Tool Runner */}
          <div className="card-panel space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 font-mono block">Testing Tool:</span>
                <h3 className="text-base font-bold text-white font-mono flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-indigo-400" />
                  {selectedTool?.name || 'Loading command registry'}
                </h3>
              </div>
              <button
                onClick={handleRunTool}
                disabled={isRunning}
                className="btn btn-primary"
              >
                <Play className="h-3.5 w-3.5" />
                {isRunning ? 'Invoking MCP...' : 'Execute Tool via MCP'}
              </button>
            </div>

            <p className="card-panel text-xs text-slate-300">
              {selectedTool?.description || 'Commands load from the backend registry.'}
            </p>

            {/* Input Arguments Editor */}
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">
                JSON-RPC Arguments (`params.arguments`):
              </label>
              <textarea
                rows={5}
                value={toolArgsJson}
                onChange={(e) => setToolArgsJson(e.target.value)}
                className="input-control w-full"
              />
            </div>

            {/* Execution Result Box */}
            {testResult && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                  <span>Server JSON-RPC Response:</span>
                  <span className="text-emerald-400">Protocol 2024-11-05</span>
                </div>
                <pre className="card-panel text-xs font-mono text-indigo-300 overflow-x-auto max-h-60">
                  {JSON.stringify(testResult, null, 2)}
                </pre>
              </div>
            )}
          </div>

          {/* External AI Configuration Snippet Generator */}
          <div className="card-panel space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  AI Agent Connection Snippet
                </h3>
              </div>

              {/* Snippet Type Selector */}
              <div className="card-panel flex items-center gap-1 flex-wrap">
                <button
                  onClick={() => setConfigType('stdio')}
                  className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
                    configType === 'stdio'
                      ? 'bg-slate-800 text-indigo-300 font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Stdio MCP (stdio.js)
                </button>
                <button
                  onClick={() => setConfigType('cli')}
                  className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
                    configType === 'cli'
                      ? 'bg-slate-800 text-indigo-300 font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  CLI Shortcuts (cli.js)
                </button>
                <button
                  onClick={() => setConfigType('claude')}
                  className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
                    configType === 'claude'
                      ? 'bg-slate-800 text-indigo-300 font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Claude Desktop (SSE)
                </button>
                <button
                  onClick={() => setConfigType('cursor')}
                  className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
                    configType === 'cursor'
                      ? 'bg-slate-800 text-indigo-300 font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Cursor IDE
                </button>
                <button
                  onClick={() => setConfigType('python')}
                  className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
                    configType === 'python'
                      ? 'bg-slate-800 text-indigo-300 font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Python Agent
                </button>
              </div>
            </div>

            <div className="relative">
              <pre className="card-panel text-xs font-mono text-slate-300 overflow-x-auto max-h-64">
                {configType === 'stdio'
                  ? stdioConfig
                  : configType === 'cli'
                  ? cliSnippet
                  : configType === 'claude'
                  ? claudeDesktopConfig
                  : configType === 'cursor'
                  ? cursorSnippet
                  : pythonSnippet}
              </pre>
              <button
                onClick={() =>
                  copyConfigSnippet(
                    configType === 'stdio'
                      ? stdioConfig
                      : configType === 'cli'
                      ? cliSnippet
                      : configType === 'claude'
                      ? claudeDesktopConfig
                      : configType === 'cursor'
                      ? cursorSnippet
                      : pythonSnippet
                  )
                }
                className="btn btn-secondary absolute top-2 right-2 gap-1.5"
              >
                {copiedConfig ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-400" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    <span>Copy Snippet</span>
                  </>
                )}
              </button>
            </div>

            <div className="text-[11px] text-slate-400 leading-relaxed pt-1">
              {configType === 'claude' && (
                <p>
                  Paste into your <code>claude_desktop_config.json</code> under the{' '}
                  <code>mcpServers</code> key. Claude will immediately receive tool definitions to inspect
                  ticks and trade in MT5.
                </p>
              )}
              {configType === 'cursor' && (
                <p>
                  Add to Cursor Settings → Features → MCP Servers. The AI in Cursor composer can
                  query MT5 open positions and review trade outcomes in real-time.
                </p>
              )}
              {configType === 'python' && (
                <p>
                  Use this lightweight Python script to invoke trades from custom algorithmic models,
                  Reinforcement Learning environments, or FinGPT agents.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
