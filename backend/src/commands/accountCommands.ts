import { CommandDefinition } from './types.ts';
import { connectorManager, MT5PackageDetector } from '@/gateway';
import { tradeStore } from '@services/tradeStore';
import { normalizeSymbol } from '@core/utils';

export const accountCommands: CommandDefinition[] = [
  {
    name: 'GET_ACCOUNT',
    aliases: ['ACCOUNT_INFO'],
    mcpAliases: ['mt5_get_account_info'],
    category: 'account',
    description: 'Retrieve real-time MetaTrader 5 account metrics (balance, equity, margin, free margin, margin level, leverage).',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: async () => {
      const connector = connectorManager.getConnector();
      const acc = await connector.getAccountInfo();
      return acc || tradeStore.getAccount();
    },
  },
  {
    name: 'GET_TERMINAL',
    mcpAliases: ['mt5_get_terminal'],
    category: 'account',
    description: 'Retrieve MetaTrader 5 terminal process telemetry (build, name, company, trade permission, path).',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: async () => {
      const connector = connectorManager.getConnector();
      return await connector.getTerminalInfo();
    },
  },
  {
    name: 'GET_POSITIONS',
    mcpAliases: ['mt5_get_open_positions'],
    category: 'account',
    description: 'Retrieve currently open trading positions with floating profit, tickets, lots, and open prices.',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: 'Optional symbol filter' },
        ticket: { type: 'number', description: 'Optional exact MT5 position ticket filter' },
      },
    },
    handler: async (params) => {
      const connector = connectorManager.getConnector();
      const symbol = params.symbol ? normalizeSymbol(params.symbol) : undefined;
      const ticket = params.ticket !== undefined ? Number(params.ticket) : undefined;
      if (connector.getStatus().terminalConnected || connector.getStatus().connected) {
        return await connector.getPositions(symbol, ticket);
      }
      const positions = tradeStore.getPositions();
      return positions.filter((position) => (!symbol || position.symbol === symbol) && (ticket === undefined || position.ticket === ticket));
    },
  },
  {
    name: 'GET_ORDERS',
    aliases: ['GET_PENDING_ORDERS'],
    mcpAliases: ['mt5_get_pending_orders'],
    category: 'account',
    description: 'Retrieve active pending orders (BUY_LIMIT, SELL_LIMIT, BUY_STOP, SELL_STOP).',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: 'Optional symbol filter' },
        ticket: { type: 'number', description: 'Optional exact MT5 pending-order ticket filter' },
      },
    },
    handler: async (params) => {
      const connector = connectorManager.getConnector();
      const symbol = params.symbol ? normalizeSymbol(params.symbol) : undefined;
      const ticket = params.ticket !== undefined ? Number(params.ticket) : undefined;
      if (connector.getStatus().terminalConnected || connector.getStatus().connected) {
        return await connector.getOrders(symbol, ticket);
      }
      const orders = tradeStore.getPendingOrders();
      return orders.filter((order) => (!symbol || order.symbol === symbol) && (ticket === undefined || order.ticket === ticket));
    },
  },
  {
    name: 'GET_HISTORY_DEALS',
    mcpAliases: ['mt5_get_history_deals'],
    category: 'account',
    description: 'Retrieve historical executed deals directly from MetaTrader 5 with profit, commission, and swap.',
    inputSchema: {
      type: 'object',
      properties: {
        dateFrom: { type: 'number', description: 'Start timestamp in seconds (optional)' },
        dateTo: { type: 'number', description: 'End timestamp in seconds (optional)' },
        count: { type: 'number', description: 'Maximum deals to return (default: 100)' },
        ticket: { type: 'number', description: 'Filter by broker order/deal ticket (optional)' },
        position: { type: 'number', description: 'Filter by associated position identifier (optional)' },
      },
    },
    handler: async (params) => {
      const connector = connectorManager.getConnector();
      return await connector.getHistoryDeals({
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
        count: params.count || 100,
        ticket: params.ticket !== undefined ? Number(params.ticket) : undefined,
        position: params.position !== undefined ? Number(params.position) : undefined,
      });
    },
  },
  {
    name: 'GET_HISTORY_ORDERS',
    mcpAliases: ['mt5_get_history_orders'],
    category: 'account',
    description: 'Retrieve historical filled, cancelled, or expired orders from MetaTrader 5.',
    inputSchema: {
      type: 'object',
      properties: {
        dateFrom: { type: 'number', description: 'Start timestamp in seconds (optional)' },
        dateTo: { type: 'number', description: 'End timestamp in seconds (optional)' },
        count: { type: 'number', description: 'Maximum orders to return (default: 100)' },
        ticket: { type: 'number', description: 'Filter by exact broker order ticket (optional)' },
        position: { type: 'number', description: 'Filter by associated position identifier (optional)' },
      },
    },
    handler: async (params) => {
      const connector = connectorManager.getConnector();
      return await connector.getHistoryOrders({
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
        count: params.count || 100,
        ticket: params.ticket !== undefined ? Number(params.ticket) : undefined,
        position: params.position !== undefined ? Number(params.position) : undefined,
      });
    },
  },
  {
    name: 'GET_HISTORY_TOTALS',
    category: 'account',
    description: 'Get exact broker-side counts of historical deals and orders between two timestamps, distinct from the number of rows fetched.',
    inputSchema: {
      type: 'object',
      properties: {
        dateFrom: { type: 'number', description: 'Start timestamp in seconds (defaults to 30 days ago)' },
        dateTo: { type: 'number', description: 'End timestamp in seconds (defaults to now)' },
      },
    },
    handler: async (params) => {
      const connector = connectorManager.getConnector();
      if (!connector.getHistoryTotals) {
        return { success: false, message: 'Broker history totals are not supported by the active connector.' };
      }
      return await connector.getHistoryTotals({
        dateFrom: params.dateFrom !== undefined ? Number(params.dateFrom) : undefined,
        dateTo: params.dateTo !== undefined ? Number(params.dateTo) : undefined,
      });
    },
  },
  {
    name: 'CONNECT_MT5',
    mcpAliases: ['mt5_connect_mt5'],
    category: 'account',
    description: 'Initialize connection to the MetaTrader 5 desktop application with credentials or auto-discovery.',
    inputSchema: {
      type: 'object',
      properties: {
        login: { type: 'number', description: 'MT5 account login number' },
        password: { type: 'string', description: 'Account password' },
        server: { type: 'string', description: 'Broker trade server name' },
        path: { type: 'string', description: 'Path to terminal64.exe' },
      },
    },
    handler: async (params, context) => {
      const connector = connectorManager.getConnector();
      const res = await connector.connect({
        login: params.login,
        password: params.password,
        server: params.server,
        path: params.path,
      });
      context.notify?.('MT5_CONNECTED', res);
      return res;
    },
  },
  {
    name: 'DISCONNECT_MT5',
    mcpAliases: ['mt5_disconnect_mt5'],
    category: 'account',
    description: 'Gracefully shutdown and disconnect from the active MetaTrader 5 session.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: async (_params, context) => {
      const connector = connectorManager.getConnector();
      const res = await connector.disconnect();
      context.notify?.('MT5_DISCONNECTED', res);
      return res;
    },
  },
  {
    name: 'SWITCH_PROVIDER',
    mcpAliases: ['mt5_switch_provider'],
    category: 'account',
    description: 'Switch the active MT5 connectivity provider (peron, remote, mock).',
    inputSchema: {
      type: 'object',
      properties: {
        provider: { type: 'string', enum: ['peron', 'remote', 'mock'], description: 'Provider name' },
      },
      required: ['provider'],
    },
    handler: async (params) => {
      const success = await connectorManager.setProvider(params.provider, params.config);
      return {
        success,
        provider: connectorManager.getProviderName(),
        status: connectorManager.getConnector().getStatus(),
      };
    },
  },
  {
    name: 'GET_GATEWAY_DIAGNOSTICS',
    mcpAliases: ['mt5_get_gateway_diagnostics'],
    category: 'account',
    description: 'Inspect full gateway status, Python executable, MetaTrader5 native package version, and terminal paths.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: async () => {
      const packageInfo = await MT5PackageDetector.inspect();
      const connector = connectorManager.getConnector();
      const status = connector.getStatus();
      const terminal = await connector.getTerminalInfo();
      return {
        success: true,
        package: packageInfo,
        connectorStatus: status,
        terminal,
      };
    },
  },
  {
    name: 'GET_NATIVE_MT5_DIAGNOSTICS',
    mcpAliases: ['mt5_get_native_diagnostics'],
    category: 'account',
    description: 'Read native MT5 package and terminal versions, last native API error, and live symbol/order/position totals.',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => {
      const connector = connectorManager.getConnector();
      if (!connector.getNativeDiagnostics) return { available: false, message: 'Native diagnostics are not supported by this provider.' };
      return connector.getNativeDiagnostics();
    },
  },
];
