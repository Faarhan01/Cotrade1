import { Request, Response } from 'express';
import { connectorManager } from '../lib/ConnectorManager.js';
import { tradeStore } from '../services/tradeStore.js';
import { broadcast } from '../services/websocketServer.js';
import { normalizeSymbol } from '../utils/symbolUtils.js';

export class TradeController {
  // Execute a trade (Direct execution via connector or queue)
  public static async executeTrade(req: Request, res: Response) {
    const { action, symbol, orderType, volume, sl, tp, price, ticket, magic, comment, source } = req.body;

    const sym = normalizeSymbol(symbol || 'EURUSD');
    const orderData = {
      action: action || 'EXECUTE_TRADE',
      symbol: sym,
      orderType: orderType || 'BUY',
      volume: volume ? Number(volume) : 0.1,
      sl: sl ? Number(sl) : undefined,
      tp: tp ? Number(tp) : undefined,
      price: price ? Number(price) : undefined,
      ticket,
      magic: magic ? Number(magic) : 888123,
      comment: comment || 'Peron_UI',
      source: source || 'MANUAL_UI',
    };

    const connector = connectorManager.getConnector();
    
    // First record in tradeStore
    const queueResult = tradeStore.enqueueCommand(orderData);
    if (!queueResult.success) {
      return res.status(400).json(queueResult);
    }

    // Attempt direct execution via active MT5 connector
    const execResult = await connector.executeOrder(orderData as any);

    if (execResult.success && execResult.ticket) {
      tradeStore.resolveExecutionResult({
        commandId: queueResult.commandId || `cmd-${Date.now()}`,
        success: true,
        dealTicket: execResult.dealTicket || execResult.ticket,
        orderTicket: execResult.ticket,
        executionPrice: execResult.price || 0,
        executionTimeMs: 45,
        errorMessage: execResult.message,
      });

      broadcast({
        type: 'command:result',
        payload: {
          commandId: queueResult.commandId,
          success: true,
          ticket: execResult.ticket,
          price: execResult.price,
        },
      });

      return res.json({
        success: true,
        commandId: queueResult.commandId,
        ticket: execResult.ticket,
        price: execResult.price,
        message: execResult.message || 'Trade executed successfully via Peron MT5 connector',
      });
    }

    // Direct execution failed (e.g. terminal disconnected or order rejected)
    tradeStore.resolveExecutionResult({
      commandId: queueResult.commandId || `cmd-${Date.now()}`,
      success: false,
      errorMessage: execResult.message || 'Execution failed',
    });

    return res.status(400).json({
      success: false,
      commandId: queueResult.commandId,
      message: execResult.message || 'Trade execution failed on MetaTrader 5 terminal',
    });
  }

  // Close an open position
  public static async closePosition(req: Request, res: Response) {
    const ticket = Number(req.params.ticket || req.body.ticket);
    const volume = req.body.volume ? Number(req.body.volume) : undefined;

    if (!ticket) {
      return res.status(400).json({ success: false, message: 'Invalid position ticket' });
    }

    const connector = connectorManager.getConnector();
    const result = await connector.closePosition(ticket, volume);

    if (result.success) {
      tradeStore.addLog(
        'info',
        `Closed Position #${ticket}`,
        result.message || 'Position closed via Peron connector',
        'PERON_CONNECTOR'
      );
      broadcast({
        type: 'position:closed',
        payload: { ticket, result },
      });
      return res.json(result);
    }

    // Fall back to queueing close command
    const queueRes = tradeStore.enqueueCommand({
      action: 'CLOSE_POSITION',
      ticket,
      volume,
      source: 'MANUAL_UI',
    });

    res.json({
      success: true,
      message: 'Position close queued',
      queueRes,
    });
  }

  // Modify position SL/TP
  public static async modifyPosition(req: Request, res: Response) {
    const ticket = Number(req.params.ticket || req.body.ticket);
    const sl = req.body.sl !== undefined ? Number(req.body.sl) : undefined;
    const tp = req.body.tp !== undefined ? Number(req.body.tp) : undefined;

    if (!ticket) {
      return res.status(400).json({ success: false, message: 'Invalid position ticket' });
    }

    const connector = connectorManager.getConnector();
    const result = await connector.modifyPosition(ticket, sl, tp);

    if (result.success) {
      tradeStore.addLog(
        'info',
        `Modified Position #${ticket}`,
        `SL: ${sl ?? 'none'} | TP: ${tp ?? 'none'}`,
        'PERON_CONNECTOR'
      );
      return res.json(result);
    }

    const queueRes = tradeStore.enqueueCommand({
      action: 'MODIFY_POSITION',
      ticket,
      sl,
      tp,
      source: 'MANUAL_UI',
    });

    res.json({
      success: true,
      message: 'Position modify queued',
      queueRes,
    });
  }

  // Cancel a pending order
  public static async cancelOrder(req: Request, res: Response) {
    const ticket = Number(req.params.ticket || req.body.ticket);
    if (!ticket) {
      return res.status(400).json({ success: false, message: 'Invalid order ticket' });
    }

    const connector = connectorManager.getConnector();
    const result = await connector.cancelOrder(ticket);
    res.json(result);
  }

  // Update Risk Guard settings
  public static async updateRisk(req: Request, res: Response) {
    const updates = req.body;
    tradeStore.updateRiskGuard(updates);

    broadcast({
      type: 'risk:updated',
      payload: tradeStore.getRiskGuard(),
    });

    res.json({
      status: 'ok',
      riskGuard: tradeStore.getRiskGuard(),
    });
  }

  // Emergency Kill Switch
  public static async toggleKillSwitch(req: Request, res: Response) {
    const { active } = req.body;
    tradeStore.triggerKillSwitch(Boolean(active));

    broadcast({
      type: 'risk:kill_switch',
      payload: { active: Boolean(active) },
    });

    res.json({
      status: 'ok',
      killSwitch: tradeStore.getRiskGuard().emergencyKillSwitch,
    });
  }
}
