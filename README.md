# MT5 AI Copilot & MCP Bridge Terminal

An open-source, full-stack bridge and real-time operational terminal connecting **MetaTrader 5 (MT5)** to **External AI Models** (such as Claude Desktop, Cursor, OpenAI Agents, Gemini, or custom Python agents) via the **Model Context Protocol (MCP)**, REST APIs, and low-latency **WebSockets**. The system uses the **Peron Python package** for direct MT5 integration, eliminating the need for Expert Advisors and ensuring reliable, low-latency communication.

Designed for **real account & broker execution** without synthetic or fake simulated trades.

---

## ðŸ›ï¸ System Architecture

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”                 â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚      External AI Agent          â”‚                 â”‚     Manual User Terminal       â”‚
â”‚  (Claude, Cursor, Python, etc.) â”‚                 â”‚  (React + Tailwind Dashboard)  â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜                 â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                 â”‚                                                  â”‚
                 â”‚ JSON-RPC 2.0 / SSE                               â”‚ REST & WebSocket
                 â–¼                                                  â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                    Node.js & Express Bridge Server (Port 3000)                     â”‚
â”‚                                                                                    â”‚
â”‚  â€¢ MCP Server (/api/mcp, /api/mcp/sse)    â€¢ WebSocket Broadcaster (/ws)            â”‚
â”‚  â€¢ Async Order Queue & Dispatcher         â€¢ Dynamic Risk Guard & Trailing Engine   â”‚
â”‚  â€¢ Persistent SQLite Database (data/mt5_bridge.sqlite via WASM SQL)                â”‚
â”‚  â€¢ Peron Python Package Integration         â€¢ MT5 Connection Management            â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                                         â”‚
                                         â”‚ Direct MT5 Communication via Peron Package
                                         â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                     MetaTrader 5 Terminal & Peron Python Package                   â”‚
â”‚                            (Direct API Integration)                                â”‚
â”‚                                                                                    â”‚
â”‚  â€¢ Real-time Market Data (Ticks, Symbols, OHLCV)                                   â”‚
â”‚  â€¢ Account & Position Management                                                   â”‚
â”‚  â€¢ Order Execution & Position Modification                                         â”‚
â”‚  â€¢ History & Historical Data Access                                                â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

---

## âœ¨ Key Features

- **No Fake / Simulated Data**: Initialized with clean states. All ticks, chart trajectories, and positions are populated exclusively from your live MT5 broker via the Peron Python package.
- **Model Context Protocol (MCP)**: Native support for both standard HTTP JSON-RPC 2.0 (`/api/mcp`) and Server-Sent Events (`/api/mcp/sse`), enabling any external AI agent to inspect market conditions, execute orders, and modify positions.
- **Dual-Listener Network**:
  - `http://localhost:3000`: Web UI, WebSocket server, REST API, and MCP endpoints.
  - `http://127.0.0.1:7777`: Peron Python Bridge for MT5 communication.
- **Asynchronous Execution Pipeline**: Every order moves through a monitored state machine (`pending` â†’ `dispatched` â†’ `executed` / `failed`), returning deal tickets and broker latency in milliseconds.
- **Connected Chart Symbol Section**: Automatically detects the exact symbol and timeframe the user selects, complete with broker contract specifications, min/max lot limits, and live spreads.
- **All Tracked Symbols Matrix**: Live table displaying real-time quotes, lot step constraints, and trading permissions for all symbols available from MT5.
- **Embedded SQLite Database (`data/mt5_bridge.sqlite`)**: Persistent storage for orders, execution logs, account history, and risk settings with 1-click database binary downloads.
- **Risk Guard & Trailing Stop Engine**: Global portfolio Take Profit ($), Stop Loss ($), maximum position caps, margin call cutoff protection, and emergency kill switch.

## ðŸ› ï¸ Recent Improvements

- Fixed close position functionality: The close position button in the UI now correctly calls the `/api/positions/:ticket/close` endpoint.
- Fixed chart data display: The Live Price Chart now correctly shows tick history data from the Peron MT5 connector.
- Fixed All Tracked Symbols table: The table now falls back to tick data for 24h high/low when symbol data doesn't provide it.
- Fixed candle endpoints: Added `/api/candles/request` and `/api/candles/simulate` endpoints for the CurrentChartSymbolCard component.

---

## ðŸ› ï¸ Prerequisites

1. **Node.js** (v18.0.0 or higher) and **npm**
2. **Python 3.7+** (for the Peron Python package)
3. **MetaTrader 5 Desktop Terminal** (Windows, or via Wine/CrossOver on macOS/Linux)
4. **MetaTrader5 Python Package** (Faarhan01/peron) - Must be available at the path specified in the PERON_PACKAGE_PATH environment variable (see setup below). The package is included in the repository at Workspaces/Tools/peron/metatrader5_package for convenience, but you can also install it separately.
5. Any MT5 broker account (Demo or Live)## ðŸš€ Local Installation & Setup

### 1. Clone & Install Dependencies

`ash
git clone https://github.com/your-username/mt5-ai-copilot-mcp.git
cd mt5-ai-copilot-mcp

# Install Node.js dependencies
npm install

# The Peron Python package is included in the repository at:
# Workspaces/Tools/peron/metatrader5_package
# No separate installation needed - it's bundled with the project
`

### 2. Configure Environment Variables

Before running, create a .env file in the root directory with the following (adjust paths as necessary for your system):

`
# Path to the MetaTrader5/Peron package directory
PERON_PACKAGE_PATH=/absolute/path/to/your/metatrader5_package
# Python executable to use (usually 'python' or 'python3')
PYTHON_PATH=python
# Optional: set to true to use native SQLite (recommended for performance)
USE_NATIVE_SQLITE=true
# Database path (relative to project root)
DB_PATH="./data/mt5_bridge.sqlite"
# Other optional variables from .env.example (GEMINI_API_KEY, APP_URL) can be left as placeholders or set in AI Studio
`

### 3. Start the Local Bridge & Web Terminal

`ash
npm run dev
`

The application will start:
- **Web Terminal & MCP Hub**: http://localhost:3000
- **Peron Python Bridge**: http://127.0.0.1:8888 (communicates with MT5)
- **WebSocket Feed**: ws://localhost:3000/ws

Note: The Peron Python bridge will automatically attempt to connect to your running MetaTrader 5 terminal.
Ensure MetaTrader 5 is running and logged into your account before starting the bridge.## 1. Clone & Install Dependencies

```bash
git clone https://github.com/your-username/mt5-ai-copilot-mcp.git
cd mt5-ai-copilot-mcp

# Install Node.js dependencies
npm install

# The Peron Python package is included in the repository at:
# Workspaces/Tools/peron/metatrader5_package
# No separate installation needed - it's bundled with the project
```

### 2. Start the Local Bridge & Web Terminal

```bash
npm run dev
```

The application will start:
- **Web Terminal & MCP Hub**: `http://localhost:3000`
- **Peron Python Bridge**: `http://127.0.0.1:8888` (communicates with MT5)
- **WebSocket Feed**: `ws://localhost:3000/ws`

### 3. Configure MetaTrader 5 Terminal

The Peron Python package connects directly to your running MT5 terminal:
1. Ensure MetaTrader 5 is running and logged into your account
2. The Peron bridge will automatically attempt to connect to the terminal
3. You should see "Connected to MetaTrader 5 Terminal" in the bridge logs
4. No Expert Advisor or WebRequest configuration is needed in MT5

### 4. Verify Connection

Check the bridge status:
- Visit `http://localhost:3000` - the UI should show connection status
- Visit `http://localhost:8888/health` - should show connected: true
- The UI will display real-time data from your MT5 terminal

---

## ðŸ¤– Connecting External AI via MCP

### A. Claude Desktop
Add the following to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mt5-bridge": {
      "url": "http://127.0.0.1:3000/api/mcp/sse"
    }
  }
}
```

### B. Cursor IDE
In Cursor **Settings â†’ Features â†’ MCP**, add a new server:
- **Name**: `mt5-bridge`
- **Type**: `sse`
- **URL**: `http://127.0.0.1:3000/api/mcp/sse`

### C. Python AI Agent (HTTP JSON-RPC 2.0)

```python
import requests

MCP_ENDPOINT = "http://127.0.0.1:3000/api/mcp"

def call_mt5_tool(tool_name: str, arguments: dict):
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {
            "name": tool_name,
            "arguments": arguments
        }
    }
    res = requests.post(MCP_ENDPOINT, json=payload)
    return res.json()["result"]

# 1. Inspect live account equity & balance
account = call_mt5_tool("mt5_get_account_info", {})
print("Account Status:", account)

# 2. Get current active chart symbol & market spread
chart = call_mt5_tool("mt5_get_current_chart", {})
print("Active Chart:", chart)

# 3. Execute an AI-directed order
order = call_mt5_tool("mt5_execute_trade", {
    "symbol": "EURUSD",
    "orderType": "BUY",
    "volume": 0.1,
    "sl": 1.0820,
    "tp": 1.0920,
    "comment": "PYTHON_AI_COPILOT"
})
print("Order Queued:", order)
```

---

## ðŸ§° Available MCP Tools (21 Comprehensive Tools)

| Tool Name | Description |
| :--- | :--- |
| `mt5_get_account_info` | Retrieves balance, equity, margin, free margin, margin level %, currency, and floating PnL. |
| `mt5_get_current_chart` | Returns the active symbol and timeframe selected in the UI, along with broker specifications. |
| `mt5_get_all_symbols` | Returns quotes, spreads, and broker lot rules for all symbols available from MT5. |
| `mt5_get_market_data` | Live bid, ask, spread, volume for tracked symbols. |
| `mt5_get_open_positions` | Open tickets, volume, open price, SL, TP, floating profit, and magic numbers. |
| `mt5_execute_trade` | Asynchronously dispatches `BUY`, `SELL`, `BUY_LIMIT`, `SELL_LIMIT`, `BUY_STOP`, `SELL_STOP` orders. |
| `mt5_modify_position` | Adjusts Stop Loss and Take Profit levels for an open position ticket. |
| `mt5_close_position` | Closes full or partial lot volume for a specific ticket. |
| `mt5_close_all` | Liquidates all open positions or all positions for a specific symbol. |
| `mt5_get_pending_orders` | Retrieves all active pending limit & stop orders in MT5. |
| `mt5_cancel_pending_order` | Cancels an active pending order ticket in MT5. |
| `mt5_get_chart_history` | Returns multi-timeframe OHLCV candles (M1, M5, M15, H1, H4, D1) with precomputed technical indicators. |
| `mt5_get_technical_indicators` | Precalculated RSI(14), EMA(9, 21, 50, 200), SMA(20, 50), MACD(12,26,9), Bollinger Bands, ATR(14), and consensus summary. |
| `mt5_request_chart_history` | Triggers an on-demand historical candle pull from MT5 for any symbol and timeframe. |
| `mt5_get_tick_history` | Retrieves persisted sub-second tick stream data from SQLite database. |
| `mt5_get_account_history` | Queries historical equity & balance snapshots persisted over time. |
| `mt5_query_trade_history` | Queries historical trade orders from the persistent SQLite database. |
| `mt5_get_performance_analytics` | Retrieves execution success rate, order counts, and database storage metrics. |
| `mt5_configure_risk_guard` | Granularly updates global dollar TP/SL, max lot sizes, and trailing stop distance. |
| `mt5_get_execution_queue` | Inspects in-flight commands (`pending` â†’ `dispatched` â†’ `executed` / `failed`). |
| `mt5_simulate_candles` | Seeds synthetic historical OHLCV data & indicators for instant testing and backtesting without waiting for live ticks. |

---

## ðŸŒ REST Endpoints

- `GET /api/state` - Complete real-time snapshot of connection, account, positions, ticks, orders, and chart
- `POST /api/commands` - Enqueue an order for execution in MT5 (`EXECUTE_TRADE`, `MODIFY_POSITION`, `CLOSE_POSITION`, `CLOSE_ALL`, `CANCEL_PENDING`)
- `GET /api/database/candles` - Query stored candles by symbol (`?symbol=EURUSD&timeframe=M1&limit=100`)
- `GET /api/database/ticks` - Query stored ticks by symbol (`?symbol=EURUSD&limit=100`)
- `GET /api/database/account-history` - Query stored equity/balance snapshots (`?limit=50`)
- `GET /api/database/orders` - Query order execution audit history
- `POST /api/candles/simulate` - Seed synthetic candles and indicators for testing
- `POST /api/candles/request` - Request historical bars for a symbol and timeframe (simulated for testing)
- `GET /api/mcp/tools` - List all 21 MCP tool schemas
- `POST /api/mcp` - JSON-RPC 2.0 direct MCP tool execution
- `GET /api/mcp/sse` - Server-Sent Events transport for Claude Desktop / Cursor
- `GET /api/tick-history` - Get persisted tick history from SQLite database

---

## ðŸ—„ï¸ Database & Storage

The bridge uses an embedded, zero-configuration **SQLite WASM** database stored at:
```text
data/mt5_bridge.sqlite
```
- **Tables**: `orders`, `positions_history`, `account_history`, `symbol_ticks`, `risk_settings`, `audit_logs`.
- **Export**: Download the SQLite binary directly through the **Database & SQLite** tab or via `GET /api/database/download`.

---

## â“ Troubleshooting

### 1. Peron Python Bridge Connection Issues
- Ensure MetaTrader 5 terminal is running and logged in
- Check that the Peron bridge (`http://localhost:8888/health`) shows `connected: true`
- Verify Python can import MetaTrader5 package (check bridge logs)

### 2. UI Not Showing MT5 Data
- Confirm the Peron bridge is running on port 8888
- Check browser console for WebSocket connection errors
- Verify `http://localhost:3000/api/state` returns live data

### 3. Order Execution Failures
- Ensure MT5 terminal is connected and logged in
- Check that your account has sufficient margin for trades
- Verify symbol selection is valid in your MT5 market watch

---

## ðŸ“„ License

MIT License. Free for personal, algorithmic, and commercial trading integration.

