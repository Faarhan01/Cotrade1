import { Router } from 'express';
import { tradeStore } from '@services/tradeStore';
import { handleMcpJsonRpc } from '@services/mcpServer';
import { addSseClient, removeSseClient, getStreamStats } from '@services/websocketServer';
import { readEvents } from '@services/eventBuffer';
import {
  MT5Controller,
  TradeController,
  StrategyController,
  DatabaseController,
  MCPController,
} from '@controllers/index';

export const apiRouter = Router();

// ==========================================
// 1. Core State & Connection Endpoints
// ==========================================
apiRouter.get('/state', (req, res) => {
  res.json(tradeStore.getState());
});

apiRouter.get('/status', MT5Controller.getStatus);
apiRouter.get('/connection/status', MT5Controller.getStatus);
apiRouter.post('/connection/connect', MT5Controller.connect);
apiRouter.post('/connection/disconnect', MT5Controller.disconnect);
apiRouter.post('/connection/provider', MT5Controller.switchProvider);

// Symbols, Ticks, Candles, Terminal & Account
apiRouter.get('/symbols', MT5Controller.getSymbols);
apiRouter.get('/symbols/:symbol', MT5Controller.getDetailedSymbol);
apiRouter.get('/ticks', MT5Controller.getTicks);
apiRouter.get('/tick-history', (req, res) => {
  res.json({ success: true, history: tradeStore.getTickHistory() });
});
apiRouter.get('/candles', MT5Controller.getCandles);
apiRouter.get('/account', MT5Controller.getAccount);
apiRouter.get('/terminal', MT5Controller.getTerminal);
apiRouter.get('/positions', MT5Controller.getPositions);
apiRouter.get('/orders', MT5Controller.getOrders);
apiRouter.get('/history/deals', MT5Controller.getHistoryDeals);
apiRouter.get('/history/orders', MT5Controller.getHistoryOrders);
apiRouter.get('/market-depth', MT5Controller.getMarketDepth);

// ==========================================
// 2. Trading Operations Endpoints
// ==========================================
apiRouter.post('/commands', TradeController.executeTrade);
apiRouter.post('/trades/execute', TradeController.executeTrade);
apiRouter.post('/positions/:ticket/close', TradeController.closePosition);
apiRouter.post('/positions/:ticket/modify', TradeController.modifyPosition);
apiRouter.post('/orders/:ticket/modify', TradeController.modifyOrder);
apiRouter.post('/orders/:ticket/cancel', TradeController.cancelOrder);

// Candle management endpoints (for testing/debug)
apiRouter.post('/candles/request', TradeController.requestHistoryFromEA);
apiRouter.post('/candles/simulate', TradeController.seedCandles);

apiRouter.post('/orders/check', MT5Controller.checkOrder);
apiRouter.post('/tools/calc-margin', MT5Controller.calcMargin);
apiRouter.post('/tools/calc-profit', MT5Controller.calcProfit);

apiRouter.post('/risk', TradeController.updateRisk);
apiRouter.post('/kill-switch', TradeController.toggleKillSwitch);

// ==========================================
// 3. External AI Live Intercept Stream (SSE)
// ==========================================
apiRouter.get('/stream/live', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders?.();

  // Send initial snapshot event
  const snapshot = tradeStore.getState();
  res.write(`event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`);

  addSseClient(res);

  req.on('close', () => {
    removeSseClient(res);
  });
});

apiRouter.get('/stream/stats', (req, res) => {
  res.json({
    status: 'ok',
    ...getStreamStats(),
  });
});

// ==========================================
// 4. MCP Endpoints (JSON-RPC & SSE)
// ==========================================
const mcpSseClients = new Map<string, any>();

// MCP SSE Transport
apiRouter.get('/mcp/sse', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const sessionId = `mcp-session-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  mcpSseClients.set(sessionId, res);

  res.write(`event: endpoint\ndata: /api/mcp/messages?sessionId=${sessionId}\n\n`);

  req.on('close', () => {
    mcpSseClients.delete(sessionId);
  });
});

apiRouter.post('/mcp/messages', async (req, res) => {
  const sessionId = req.query.sessionId as string;
  const sseClient = mcpSseClients.get(sessionId);

  try {
    const rpcResponse = await handleMcpJsonRpc(req.body);
    if (sseClient) {
      sseClient.write(`event: message\ndata: ${JSON.stringify(rpcResponse)}\n\n`);
      res.status(202).json({ status: 'accepted' });
    } else {
      res.json(rpcResponse);
    }
  } catch (err: any) {
    const errPayload = {
      jsonrpc: '2.0',
      id: req.body?.id || null,
      error: { code: -32603, message: err?.message || 'Internal RPC error' },
    };
    if (sseClient) {
      sseClient.write(`event: message\ndata: ${JSON.stringify(errPayload)}\n\n`);
      res.status(202).json({ status: 'accepted' });
    } else {
      res.status(500).json(errPayload);
    }
  }
});

apiRouter.post('/mcp', MCPController.handleJsonRpc);
apiRouter.get('/mcp/tools', MCPController.listTools);
apiRouter.post('/mcp/tools/execute', MCPController.executeTool);

// ==========================================
// 4. Strategy & Knowledge Base Endpoints
// ==========================================
apiRouter.get('/strategies', StrategyController.getStrategies);
apiRouter.post('/strategies', StrategyController.saveStrategy);
apiRouter.delete('/strategies/:id', StrategyController.deleteStrategy);
apiRouter.post('/strategies/backtest', StrategyController.runBacktest);
apiRouter.get('/strategies/backtest/history', StrategyController.getBacktestHistory);

apiRouter.get('/observations', StrategyController.getObservations);
apiRouter.post('/observations', StrategyController.saveObservation);
apiRouter.delete('/observations/:id', StrategyController.deleteObservation);

// ==========================================
// 5. Database & Audit Endpoints
// ==========================================
apiRouter.get('/database/analytics', DatabaseController.getAnalytics.bind(DatabaseController));
apiRouter.post('/database/prune', DatabaseController.pruneDatabase.bind(DatabaseController));
apiRouter.get('/database/orders', DatabaseController.getOrders.bind(DatabaseController));
apiRouter.get('/database/candles', DatabaseController.getCandles.bind(DatabaseController));
apiRouter.get('/database/ticks', DatabaseController.getTicks.bind(DatabaseController));
apiRouter.get('/database/account', DatabaseController.getAccountHistory.bind(DatabaseController));

// ==========================================
// 6. Event Buffering Endpoints
// ==========================================
apiRouter.get('/events', (req, res) => {
  try {
    const options = {
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      type: req.query.type as string | undefined,
      startTime: req.query.startTime ? parseInt(req.query.startTime as string, 10) : undefined,
      endTime: req.query.endTime ? parseInt(req.query.endTime as string, 10) : undefined,
    };
    
    const events = readEvent(options);
    res.json({
      success: true,
      events,
      count: events.length,
      filtersApplied: options,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve events',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});
