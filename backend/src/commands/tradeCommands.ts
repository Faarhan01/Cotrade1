import { CommandDefinition } from './types.ts';
import { connectorManager } from '@features/mt5';
import { tradeStore } from '@services/tradeStore';
import { normalizeSymbol } from '@core/utils';
import { broadcast } from '@services/websocketServer';

export const tradeCommands: CommandDefinition[] = [
  {
    name: 'EXECUTE_TRADE',
    aliases: ['BUY', 'SELL', 'PLACE_ORDER', 'EXECUTE_ORDER'],
    mcpAliases: ['mt5_execute_trade'],
    category: 'trading',
    description: 'Execute a direct market or pending trade on MetaTrader 5 with lots, SL, and TP.',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: 'Symbol to trade (e.g. EURUSD, XAUUSD, BTCUSD)' },
        orderType: { type: 'string', enum: ['BUY', 'SELL', 'BUY_LIMIT', 'SELL_LIMIT', 'BUY_STOP', 'SELL_STOP', 'BUY_STOP_LIMIT', 'SELL_STOP_LIMIT'], description: 'Order type' },
        volume: { type: 'number', description: 'Order volume in standard lots (e.g. 0.01, 0.1)' },
        price: { type: 'number', description: 'Pending trigger/entry price; required for pending orders' },
        stopLimitPrice: { type: 'number', description: 'Required limit-leg price for BUY_STOP_LIMIT and SELL_STOP_LIMIT' },
        typeTime: { type: 'string', enum: ['GTC', 'DAY', 'SPECIFIED', 'SPECIFIED_DAY'], description: 'Pending-order lifetime' },
        expiration: { type: 'number', description: 'Unix timestamp in seconds; required for SPECIFIED expiration' },
        typeFilling: { type: 'string', enum: ['FOK', 'IOC', 'RETURN', 'BOC'], description: 'Optional broker-supported order filling policy' },
        deviation: { type: 'number', description: 'Maximum market execution deviation in points' },
        sl: { type: 'number', description: 'Stop Loss price level' },
        tp: { type: 'number', description: 'Take Profit price level' },
        magic: { type: 'number', description: 'Expert Advisor / Bot Magic Number tag' },
        comment: { type: 'string', description: 'Trade comment or strategy rationale tag' },
      },
      required: ['symbol'],
    },
    handler: async (params, context) => {
      const connector = connectorManager.getConnector();
      const sym = normalizeSymbol(params.symbol || 'EURUSD');
      const actionUpper = (params.action || '').toUpperCase();
      let orderTypeVal = params.orderType ? String(params.orderType).toUpperCase() : (actionUpper === 'SELL' ? 'SELL' : 'BUY');
      const volume = Number(params.volume ?? 0.1);
      const pendingTypes = ['BUY_LIMIT', 'SELL_LIMIT', 'BUY_STOP', 'SELL_STOP', 'BUY_STOP_LIMIT', 'SELL_STOP_LIMIT'];
      const isPending = pendingTypes.includes(orderTypeVal);
      const price = params.price !== undefined ? Number(params.price) : undefined;
      const stopLimitPrice = params.stopLimitPrice !== undefined ? Number(params.stopLimitPrice) : undefined;
      const typeTime = params.typeTime || 'GTC';
      const expiration = params.expiration !== undefined ? Number(params.expiration) : undefined;
      const allowedOrderTypes = ['BUY', 'SELL', 'BUY_LIMIT', 'SELL_LIMIT', 'BUY_STOP', 'SELL_STOP', 'BUY_STOP_LIMIT', 'SELL_STOP_LIMIT'];
      const allowedTimeTypes = ['GTC', 'DAY', 'SPECIFIED', 'SPECIFIED_DAY'];
      if (!allowedOrderTypes.includes(orderTypeVal)) {
        return { success: false, message: `Unsupported MT5 order type: ${orderTypeVal}` };
      }
      if (!Number.isFinite(volume) || volume <= 0) {
        return { success: false, message: 'Trade volume must be a positive number of lots.' };
      }
      if (!allowedTimeTypes.includes(typeTime)) {
        return { success: false, message: `Unsupported MT5 order time policy: ${typeTime}` };
      }
      if (isPending && (!Number.isFinite(price) || (price ?? 0) <= 0)) {
        return { success: false, message: 'Pending orders require a positive trigger/entry price.' };
      }
      if (['BUY_STOP_LIMIT', 'SELL_STOP_LIMIT'].includes(orderTypeVal) && (!Number.isFinite(stopLimitPrice) || (stopLimitPrice ?? 0) <= 0)) {
        return { success: false, message: 'Stop-limit orders require a positive stopLimitPrice.' };
      }
      if (['SPECIFIED', 'SPECIFIED_DAY'].includes(typeTime) && (!Number.isFinite(expiration) || (expiration ?? 0) <= Date.now() / 1000)) {
        return { success: false, message: 'Specified expiration must be a future Unix timestamp in seconds.' };
      }

      const orderData = {
        action: 'EXECUTE_TRADE' as const,
        symbol: sym,
        orderType: orderTypeVal as any,
        volume,
        price: isPending ? price : undefined,
        stopLimitPrice,
        typeTime,
        expiration,
        typeFilling: params.typeFilling,
        deviation: params.deviation !== undefined ? Number(params.deviation) : undefined,
        sl: params.sl ? Number(params.sl) : undefined,
        tp: params.tp ? Number(params.tp) : undefined,
        source: (context.source === 'DAEMON' || context.source === 'MCP' ? 'AI_MCP' : context.source === 'BOT' ? 'BOT' : 'MANUAL_UI') as any,
        comment: params.comment || `${context.source}_${params.confidence ? Math.round(params.confidence * 100) : 90}%`,
        magic: params.magic ? Number(params.magic) : 889900,
      };

      const spec = await connector.getDetailedSymbol(sym);
      if (!spec) {
        return { success: false, message: `Broker specifications are unavailable for ${sym}; order was not sent.` };
      }
      if (!spec.tradeAllowed || (orderTypeVal.startsWith('BUY') && spec.canOpenBuy === false) || (orderTypeVal.startsWith('SELL') && spec.canOpenSell === false)) {
        return { success: false, message: `The broker does not allow ${orderTypeVal} orders on ${sym}.` };
      }
      const volumeSteps = volume / spec.lotStep;
      if (volume < spec.minLot || volume > spec.maxLot || Math.abs(volumeSteps - Math.round(volumeSteps)) > 1e-7) {
        return { success: false, message: `Volume must be ${spec.minLot}-${spec.maxLot} lots in steps of ${spec.lotStep} for ${sym}.` };
      }
      const requiredOrderMode = orderTypeVal === 'BUY' || orderTypeVal === 'SELL'
        ? 1
        : orderTypeVal.endsWith('LIMIT') && !orderTypeVal.endsWith('STOP_LIMIT')
          ? 2
          : orderTypeVal.endsWith('STOP_LIMIT') ? 8 : 4;
      if (spec.orderMode !== undefined && (spec.orderMode & requiredOrderMode) === 0) {
        return { success: false, message: `The broker symbol settings do not support ${orderTypeVal} for ${sym}.` };
      }
      if ((spec.volumeLimit || 0) > 0) {
        const [positions, orders] = await Promise.all([
          connector.getPositions(sym),
          connector.getOrders(sym),
        ]);
        const directionalExposure = positions
          .filter((position) => position.type === (orderTypeVal.startsWith('BUY') ? 'BUY' : 'SELL'))
          .reduce((total, position) => total + position.volume, 0)
          + orders
            .filter((order) => order.type.startsWith(orderTypeVal.startsWith('BUY') ? 'BUY' : 'SELL'))
            .reduce((total, order) => total + order.volume, 0);
        if (directionalExposure + volume > (spec.volumeLimit || 0) + 1e-9) {
          return { success: false, message: `Order would exceed the broker's ${spec.volumeLimit}-lot directional limit for ${sym}. Current same-direction exposure is ${directionalExposure} lots.` };
        }
      }

      const preflight = await connector.checkOrder(orderData as any);
      if (!preflight.feasible) {
        return { success: false, message: preflight.message || preflight.comment || 'Broker rejected the order preflight; no order was sent.', preflight };
      }

      const queueResult = tradeStore.enqueueCommand(orderData);
      if (!queueResult.success) {
        return { success: false, message: queueResult.error || 'Trade rejected by risk controls' };
      }
      const execResult = await connector.executeOrder(orderData as any);

      if (execResult.success && execResult.ticket) {
        tradeStore.resolveExecutionResult({
          commandId: queueResult.commandId || `cmd-${Date.now()}`,
          success: true,
          dealTicket: execResult.dealTicket || execResult.ticket,
          orderTicket: execResult.ticket,
          executionPrice: execResult.price || 0,
          executionTimeMs: 35,
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
      }

      if (!execResult.success) {
        tradeStore.resolveExecutionResult({
          commandId: queueResult.commandId || `cmd-${Date.now()}`,
          success: false,
          errorMessage: execResult.message || execResult.error || 'Execution failed',
        });
      }

      context.notify?.('ORDER_EXECUTED', {
        success: execResult.success,
        ticket: execResult.ticket,
        dealTicket: execResult.dealTicket,
        price: execResult.price,
        message: execResult.message,
        commandId: queueResult.commandId,
      });

      return {
        success: execResult.success,
        ticket: execResult.ticket,
        dealTicket: execResult.dealTicket,
        price: execResult.price,
        message: execResult.message,
        commandId: queueResult.commandId,
      };
    },
  },
  {
    name: 'CLOSE_POSITION',
    mcpAliases: ['mt5_close_position'],
    category: 'trading',
    description: 'Close an open MetaTrader 5 position ticket (full or partial lots).',
    inputSchema: {
      type: 'object',
      properties: {
        ticket: { type: 'number', description: 'Unique position ticket number to close' },
        volume: { type: 'number', description: 'Partial volume to close. Omit to close entire position.' },
      },
      required: ['ticket'],
    },
    handler: async (params, context) => {
      const ticket = Number(params.ticket);
      if (!ticket) return { success: false, message: 'Ticket number is required to close position' };
      const connector = connectorManager.getConnector();
      const res = await connector.closePosition(ticket, params.volume ? Number(params.volume) : undefined);
      context.notify?.('POSITION_CLOSED', { ticket, ...res });
      return res;
    },
  },
  {
    name: 'CLOSE_ALL',
    mcpAliases: ['mt5_close_all'],
    category: 'trading',
    description: 'Emergency liquidation: Close all open positions, optionally filtered by symbol.',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: 'Optional symbol filter (e.g. EURUSD). Leave blank to close all portfolio positions.' },
      },
    },
    handler: async (params, context) => {
      const connector = connectorManager.getConnector();
      if (typeof (connector as any).closeAllPositions === 'function' && !params.symbol) {
        const res = await (connector as any).closeAllPositions();
        context.notify?.('CLOSE_ALL_COMPLETED', res);
        return res;
      }
      const positions = tradeStore.getPositions();
      const targetSym = params.symbol ? normalizeSymbol(params.symbol) : null;
      const results = [];
      for (const p of positions) {
        if (!targetSym || p.symbol === targetSym) {
          const res = await connector.closePosition(p.ticket, p.volume);
          results.push({ ticket: p.ticket, symbol: p.symbol, ...res });
        }
      }
      context.notify?.('CLOSE_ALL_COMPLETED', { closedCount: results.length, results });
      return { success: true, closedCount: results.length, closedPositions: results };
    },
  },
  {
    name: 'CLOSE_BY',
    category: 'trading',
    description: 'Close a hedged position against an opposing position ticket without paying double spread.',
    inputSchema: {
      type: 'object',
      properties: {
        ticket: { type: 'number', description: 'First position ticket' },
        oppositeTicket: { type: 'number', description: 'Opposing position ticket' },
      },
      required: ['ticket', 'oppositeTicket'],
    },
    handler: async (params, context) => {
      const ticket = Number(params.ticket);
      const oppositeTicket = Number(params.oppositeTicket);
      if (!ticket || !oppositeTicket) {
        return { success: false, message: 'Both ticket and oppositeTicket are required' };
      }
      const connector = connectorManager.getConnector();
      if (typeof (connector as any).closeByPosition === 'function') {
        const res = await (connector as any).closeByPosition(ticket, oppositeTicket);
        context.notify?.('CLOSE_BY_EXECUTED', { ticket, oppositeTicket, res });
        return res;
      }
      return { success: false, message: 'Close-by is not supported by current connector' };
    },
  },
  {
    name: 'CLOSE_POSITIONS_BATCH',
    category: 'trading',
    description: 'Batch close open positions filtered by symbol, magic number, or order direction.',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: 'Filter by symbol' },
        magic: { type: 'number', description: 'Filter by EA / Bot Magic number' },
        type: { type: 'string', enum: ['BUY', 'SELL'], description: 'Filter by position type' },
      },
    },
    handler: async (params, context) => {
      const connector = connectorManager.getConnector();
      if (typeof (connector as any).closePositionsBatch === 'function') {
        const res = await (connector as any).closePositionsBatch({
          symbol: params.symbol ? normalizeSymbol(params.symbol) : undefined,
          magic: params.magic ? Number(params.magic) : undefined,
          type: params.type,
        });
        context.notify?.('BATCH_POSITIONS_CLOSED', res);
        return res;
      }
      return { success: false, message: 'Batch close is not supported by current connector' };
    },
  },
  {
    name: 'MODIFY_POSITION',
    mcpAliases: ['mt5_modify_position'],
    category: 'trading',
    description: 'Modify Stop Loss (SL) and Take Profit (TP) price levels for an open position ticket.',
    inputSchema: {
      type: 'object',
      properties: {
        ticket: { type: 'number', description: 'Unique position ticket number' },
        sl: { type: 'number', description: 'New Stop Loss absolute price level' },
        tp: { type: 'number', description: 'New Take Profit absolute price level' },
      },
      required: ['ticket'],
    },
    handler: async (params, context) => {
      const ticket = Number(params.ticket);
      if (!ticket) return { success: false, message: 'Ticket number is required to modify position' };
      const connector = connectorManager.getConnector();
      const res = await connector.modifyPosition(
        ticket,
        params.sl !== undefined ? Number(params.sl) : undefined,
        params.tp !== undefined ? Number(params.tp) : undefined
      );
      context.notify?.('POSITION_MODIFIED', { ticket, ...res });
      return res;
    },
  },
  {
    name: 'MODIFY_ORDER',
    mcpAliases: ['mt5_modify_pending_order'],
    category: 'trading',
    description: 'Modify entry price, Stop Loss, and Take Profit for an active pending order.',
    inputSchema: {
      type: 'object',
      properties: {
        ticket: { type: 'number', description: 'Unique pending order ticket number' },
        price: { type: 'number', description: 'New open price' },
        sl: { type: 'number', description: 'New Stop Loss price level' },
        tp: { type: 'number', description: 'New Take Profit price level' },
      },
      required: ['ticket'],
    },
    handler: async (params, context) => {
      const ticket = Number(params.ticket);
      if (!ticket) return { success: false, message: 'Ticket number is required to modify order' };
      const connector = connectorManager.getConnector();
      const res = await connector.modifyOrder(
        ticket,
        params.price !== undefined ? Number(params.price) : undefined,
        params.sl !== undefined ? Number(params.sl) : undefined,
        params.tp !== undefined ? Number(params.tp) : undefined
      );
      context.notify?.('ORDER_MODIFIED', { ticket, ...res });
      return res;
    },
  },
  {
    name: 'CANCEL_ORDER',
    aliases: ['DELETE_ORDER'],
    mcpAliases: ['mt5_cancel_pending_order'],
    category: 'trading',
    description: 'Cancel an active pending limit or stop order by ticket ID.',
    inputSchema: {
      type: 'object',
      properties: {
        ticket: { type: 'number', description: 'Pending order ticket ID to cancel' },
      },
      required: ['ticket'],
    },
    handler: async (params, context) => {
      const ticket = Number(params.ticket);
      if (!ticket) return { success: false, message: 'Ticket number is required to cancel pending order' };
      const connector = connectorManager.getConnector();
      const res = await connector.cancelOrder(ticket);
      context.notify?.('ORDER_CANCELLED', { ticket, ...res });
      return res;
    },
  },
  {
    name: 'CANCEL_ORDERS_BATCH',
    category: 'trading',
    description: 'Batch cancel all pending orders matching symbol, magic number, or order type.',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: 'Filter by symbol' },
        magic: { type: 'number', description: 'Filter by EA / Bot Magic number' },
        type: { type: 'string', description: 'Filter by order type (e.g. BUY_LIMIT, SELL_LIMIT)' },
      },
    },
    handler: async (params, context) => {
      const connector = connectorManager.getConnector();
      if (typeof (connector as any).cancelOrdersBatch === 'function') {
        const res = await (connector as any).cancelOrdersBatch({
          symbol: params.symbol ? normalizeSymbol(params.symbol) : undefined,
          magic: params.magic ? Number(params.magic) : undefined,
          type: params.type,
        });
        context.notify?.('BATCH_ORDERS_CANCELLED', res);
        return res;
      }
      return { success: false, message: 'Batch cancel is not supported by current connector' };
    },
  },
  {
    name: 'CHECK_ORDER',
    mcpAliases: ['mt5_check_order'],
    category: 'trading',
    description: 'Pre-trade feasibility check against MetaTrader 5 broker validation and free margin.',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: 'Symbol ticker' },
        orderType: { type: 'string', enum: ['BUY', 'SELL'], description: 'Order direction' },
        volume: { type: 'number', description: 'Volume in lots' },
        price: { type: 'number', description: 'Order price' },
      },
      required: ['symbol'],
    },
    handler: async (params) => {
      const connector = connectorManager.getConnector();
      const sym = normalizeSymbol(params.symbol || 'EURUSD');
      return await connector.checkOrder({
        symbol: sym,
        orderType: (params.orderType || 'BUY') as any,
        volume: Number(params.volume) || 0.1,
        price: params.price ? Number(params.price) : undefined,
      });
    },
  },
  {
    name: 'CALC_MARGIN',
    mcpAliases: ['mt5_calc_margin'],
    category: 'trading',
    description: 'Calculate the broker margin required to open an order in account deposit currency.',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: 'Symbol to calculate margin for' },
        orderType: { type: 'string', enum: ['BUY', 'SELL'], description: 'Order type' },
        volume: { type: 'number', description: 'Volume in lots' },
        price: { type: 'number', description: 'Execution price (optional)' },
      },
      required: ['symbol', 'volume'],
    },
    handler: async (params) => {
      const connector = connectorManager.getConnector();
      const sym = normalizeSymbol(params.symbol || 'EURUSD');
      return await connector.calcMargin(
        params.orderType || 'BUY',
        sym,
        Number(params.volume) || 0.1,
        params.price ? Number(params.price) : undefined
      );
    },
  },
  {
    name: 'CALC_PROFIT',
    mcpAliases: ['mt5_calc_profit'],
    category: 'trading',
    description: 'Calculate projected gross profit or loss between open price and close price.',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: 'Symbol ticker' },
        orderType: { type: 'string', enum: ['BUY', 'SELL'], description: 'Order direction' },
        volume: { type: 'number', description: 'Volume in lots' },
        priceOpen: { type: 'number', description: 'Open / entry price' },
        priceClose: { type: 'number', description: 'Close / target price' },
      },
      required: ['symbol', 'volume', 'priceOpen', 'priceClose'],
    },
    handler: async (params) => {
      const connector = connectorManager.getConnector();
      const sym = normalizeSymbol(params.symbol || 'EURUSD');
      return await connector.calcProfit(
        params.orderType || 'BUY',
        sym,
        Number(params.volume) || 0.1,
        Number(params.priceOpen || 0),
        Number(params.priceClose || 0)
      );
    },
  },
  {
    name: 'CALCULATE_POSITION_SIZE',
    category: 'trading',
    description: 'Calculate a broker-constrained lot size from account equity, risk percentage, entry, and stop loss. Uses MT5 profit and margin calculations; never places an order.',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: 'Broker symbol, including any suffix' },
        orderType: { type: 'string', enum: ['BUY', 'SELL'], description: 'Trade direction' },
        entryPrice: { type: 'number', description: 'Planned entry price' },
        stopLossPrice: { type: 'number', description: 'Stop loss price' },
        riskPercent: { type: 'number', description: 'Percent of account equity to risk (for example, 1 means 1%)' },
      },
      required: ['symbol', 'orderType', 'entryPrice', 'stopLossPrice', 'riskPercent'],
    },
    handler: async (params) => {
      const symbol = normalizeSymbol(String(params.symbol || ''));
      const orderType = String(params.orderType || '').toUpperCase();
      const entryPrice = Number(params.entryPrice);
      const stopLossPrice = Number(params.stopLossPrice);
      const riskPercent = Number(params.riskPercent);

      if (!symbol || !['BUY', 'SELL'].includes(orderType)) {
        return { success: false, message: 'A valid symbol and BUY or SELL direction are required.' };
      }
      if (!Number.isFinite(entryPrice) || entryPrice <= 0 || !Number.isFinite(stopLossPrice) || stopLossPrice <= 0) {
        return { success: false, message: 'Entry and stop-loss prices must be positive numbers.' };
      }
      if (!Number.isFinite(riskPercent) || riskPercent <= 0 || riskPercent > 100) {
        return { success: false, message: 'Risk percent must be greater than 0 and no more than 100.' };
      }
      if ((orderType === 'BUY' && stopLossPrice >= entryPrice) || (orderType === 'SELL' && stopLossPrice <= entryPrice)) {
        return { success: false, message: 'Stop loss must be below entry for BUY and above entry for SELL.' };
      }

      const connector = connectorManager.getConnector();
      const [account, spec, positions, orders] = await Promise.all([
        connector.getAccountInfo(),
        connector.getDetailedSymbol(symbol),
        connector.getPositions(symbol),
        connector.getOrders(symbol),
      ]);
      if (!account || !Number.isFinite(account.equity) || account.equity <= 0) {
        return { success: false, message: 'Live account equity is unavailable; risk sizing cannot be calculated safely.' };
      }
      if (!spec || !spec.tradeAllowed || !Number.isFinite(spec.minLot) || !Number.isFinite(spec.maxLot) || !Number.isFinite(spec.lotStep) || spec.lotStep <= 0) {
        return { success: false, message: `Valid broker trading specifications are unavailable for ${symbol}.` };
      }
      const directionAllowed = orderType === 'BUY'
        ? spec.canOpenBuy !== false
        : spec.canOpenSell !== false;
      if (!directionAllowed) {
        return { success: false, message: `The broker does not allow opening ${orderType} positions on ${symbol}.` };
      }

      const riskAmount = account.equity * riskPercent / 100;
      const oneLotLoss = await connector.calcProfit(orderType, symbol, 1, entryPrice, stopLossPrice);
      if (!oneLotLoss.success || !Number.isFinite(oneLotLoss.profit) || oneLotLoss.profit >= 0) {
        return { success: false, message: oneLotLoss.message || 'MT5 could not calculate a loss at this stop price.' };
      }

      const riskBasedVolume = riskAmount / Math.abs(oneLotLoss.profit);
      const riskGuard = tradeStore.getRiskGuard();
      const directionalExposure = positions
        .filter((position) => position.type === orderType)
        .reduce((total, position) => total + position.volume, 0)
        + orders
          .filter((order) => order.type.startsWith(orderType))
          .reduce((total, order) => total + order.volume, 0);
      const directionalRoom = (spec.volumeLimit || 0) > 0
        ? Math.max(0, (spec.volumeLimit || 0) - directionalExposure)
        : spec.maxLot;
      const allowedMax = Math.min(spec.maxLot, riskGuard.maxLotSizePerTrade || spec.maxLot, directionalRoom);
      if (allowedMax < spec.minLot) {
        return {
          success: false,
          feasible: false,
          directionalExposure,
          volumeLimit: spec.volumeLimit || 0,
          message: `Existing ${orderType} exposure has reached the broker volume limit for ${symbol}.`,
        };
      }
      const uncappedVolume = Math.min(riskBasedVolume, allowedMax);
      const stepDecimals = Math.max(0, (String(spec.lotStep).split('.')[1] || '').length);
      const volume = Number((Math.floor((uncappedVolume + spec.lotStep * 1e-9) / spec.lotStep) * spec.lotStep).toFixed(stepDecimals));
      if (volume < spec.minLot) {
        return {
          success: false,
          feasible: false,
          riskAmount,
          riskCurrency: account.currency,
          suggestedVolume: 0,
          minimumVolume: spec.minLot,
          minimumVolumeRisk: Math.abs(oneLotLoss.profit) * spec.minLot,
          message: `Risk budget is below the broker minimum lot risk for ${symbol}.`,
        };
      }

      const estimatedLoss = Math.abs(oneLotLoss.profit) * volume;
      const margin = await connector.calcMargin(orderType, symbol, volume, entryPrice);
      const marginSufficient = !margin.success || margin.margin <= account.freeMargin;
      return {
        success: true,
        feasible: estimatedLoss <= riskAmount && marginSufficient,
        symbol,
        orderType,
        entryPrice,
        stopLossPrice,
        riskPercent,
        equity: account.equity,
        riskAmount,
        riskCurrency: account.currency,
        oneLotStopLoss: oneLotLoss.profit,
        volume,
        estimatedLoss,
        estimatedMargin: margin.success ? margin.margin : null,
        freeMargin: account.freeMargin,
        marginCurrency: margin.currency,
        volumeMin: spec.minLot,
        volumeMax: allowedMax,
        volumeStep: spec.lotStep,
        directionalExposure,
        volumeLimit: spec.volumeLimit,
        message: !margin.success
          ? `Volume calculated, but MT5 margin estimate is unavailable: ${margin.message || 'unknown error'}`
          : marginSufficient ? 'Risk-based volume calculated from broker data.' : 'Estimated margin exceeds current free margin.',
      };
    },
  },
];
