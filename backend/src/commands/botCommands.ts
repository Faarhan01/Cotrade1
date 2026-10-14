import { CommandDefinition } from './types.ts';
import { botStore, botEngine } from '@features/bot';

export const botCommands: CommandDefinition[] = [
  {
    name: 'BOT_LIST',
    aliases: ['LIST_BOTS'],
    category: 'bot',
    description: 'List all automated quantitative trading bots with current execution status and win/loss stats.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: async () => {
      const bots = botStore.getAllBots();
      return { success: true, count: bots.length, bots };
    },
  },
  {
    name: 'BOT_CONTROL',
    mcpAliases: ['mt5_bot_control'],
    category: 'bot',
    description: 'Start, pause, stop, or delete a bot by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        botId: { type: 'string' },
        action: { type: 'string', enum: ['START', 'PAUSE', 'STOP', 'DELETE'] },
      },
      required: ['botId', 'action'],
    },
    handler: async (params, context) => {
      const botId = params.botId || params.id;
      const action = String(params.action || '').toUpperCase();
      if (action === 'DELETE') return { success: await botStore.deleteBot(botId) };
      const status = action === 'START' ? 'RUNNING' : action === 'PAUSE' ? 'PAUSED' : action === 'STOP' ? 'STOPPED' : null;
      if (!status) return { success: false, message: `Unknown bot action: ${params.action}` };
      const bot = await botStore.updateBotStatus(botId, status, params.reason || `${action} via ${context.source}`);
      return { success: Boolean(bot), bot };
    },
  },
  {
    name: 'BOT_GET',
    category: 'bot',
    description: 'Retrieve detailed state, configuration, and metrics for a specific bot by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        botId: { type: 'string', description: 'Unique Bot identifier' },
      },
      required: ['botId'],
    },
    handler: async (params) => {
      const botId = params.botId || params.id;
      const bot = botStore.getBot(botId);
      if (!bot) return { success: false, message: 'Bot not found' };
      return { success: true, bot };
    },
  },
  {
    name: 'BOT_CREATE',
    aliases: ['DEPLOY_BOT'],
    category: 'bot',
    description: 'Create and deploy a new automated algorithmic trading bot configured with a strategy and risk caps.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Bot name' },
        strategyId: { type: 'string', description: 'Strategy ID to bind (optional)' },
        strategyName: { type: 'string', description: 'Strategy display name' },
        strategyType: { type: 'string', description: 'Algorithmic strategy type' },
        symbol: { type: 'string', description: 'Target symbol (e.g. EURUSD)' },
        timeframe: { type: 'string', description: 'Timeframe (e.g. M1, M5)' },
        executionMode: { type: 'string', enum: ['LIVE', 'PAPER', 'DRY_RUN'], description: 'Execution mode' },
        allocation: { type: 'object', description: 'Lot sizes and risk caps' },
        trailingStop: { type: 'object', description: 'Dynamic trailing stop parameters' },
      },
      required: ['name', 'symbol'],
    },
    handler: async (params, context) => {
      const created = await botStore.createBot(params.bot || params);
      context.notify?.('BOT_CREATED', { botId: created.id, name: created.name });
      return { success: true, bot: created };
    },
  },
  {
    name: 'BOT_START',
    category: 'bot',
    description: 'Activate an algorithmic trading bot into RUNNING status for automated market scanning and execution.',
    inputSchema: {
      type: 'object',
      properties: {
        botId: { type: 'string', description: 'Bot ID to start' },
      },
      required: ['botId'],
    },
    handler: async (params, context) => {
      const botId = params.botId || params.id;
      const bot = await botStore.updateBotStatus(botId, 'RUNNING', params.reason || `Started via ${context.source}`);
      context.notify?.('BOT_STARTED', { botId });
      return { success: Boolean(bot), bot };
    },
  },
  {
    name: 'BOT_PAUSE',
    category: 'bot',
    description: 'Pause an active bot to temporarily suspend new signal evaluations and order placing.',
    inputSchema: {
      type: 'object',
      properties: {
        botId: { type: 'string', description: 'Bot ID to pause' },
      },
      required: ['botId'],
    },
    handler: async (params, context) => {
      const botId = params.botId || params.id;
      const bot = await botStore.updateBotStatus(botId, 'PAUSED', params.reason || `Paused via ${context.source}`);
      context.notify?.('BOT_PAUSED', { botId });
      return { success: Boolean(bot), bot };
    },
  },
  {
    name: 'BOT_STOP',
    category: 'bot',
    description: 'Halt an active bot into STOPPED status.',
    inputSchema: {
      type: 'object',
      properties: {
        botId: { type: 'string', description: 'Bot ID to stop' },
      },
      required: ['botId'],
    },
    handler: async (params, context) => {
      const botId = params.botId || params.id;
      const bot = await botStore.updateBotStatus(botId, 'STOPPED', params.reason || `Stopped via ${context.source}`);
      context.notify?.('BOT_STOPPED', { botId });
      return { success: Boolean(bot), bot };
    },
  },
  {
    name: 'BOT_DELETE',
    category: 'bot',
    description: 'Permanently remove a bot and clean up its database registry.',
    inputSchema: {
      type: 'object',
      properties: {
        botId: { type: 'string', description: 'Bot ID to delete' },
      },
      required: ['botId'],
    },
    handler: async (params, context) => {
      const botId = params.botId || params.id;
      const deleted = await botStore.deleteBot(botId);
      context.notify?.('BOT_DELETED', { botId });
      return { success: deleted };
    },
  },
  {
    name: 'BOT_EVALUATE',
    category: 'bot',
    description: 'Immediately trigger on-demand market evaluation cycle and signal analysis for a bot.',
    inputSchema: {
      type: 'object',
      properties: {
        botId: { type: 'string', description: 'Bot ID to evaluate' },
      },
      required: ['botId'],
    },
    handler: async (params) => {
      const botId = params.botId || params.id;
      const bot = botStore.getBot(botId);
      if (!bot) return { success: false, message: 'Bot not found' };
      const signal = await botEngine.processBot(bot);
      return { success: true, botId, signal };
    },
  },
  {
    name: 'BOT_FORCE_SIGNAL',
    category: 'bot',
    description: 'Manually force an instant trade signal (BUY or SELL) through a bot engine for testing.',
    inputSchema: {
      type: 'object',
      properties: {
        botId: { type: 'string', description: 'Bot ID' },
        signal: { type: 'string', enum: ['BUY', 'SELL'], description: 'Signal to force' },
      },
      required: ['botId', 'signal'],
    },
    handler: async (params, context) => {
      const botId = params.botId || params.id;
      const sigType = (params.signal || params.orderType || 'BUY').toUpperCase() as 'BUY' | 'SELL';
      const res = await botEngine.forceSignal(botId, sigType);
      context.notify?.('BOT_FORCED_SIGNAL', { botId, signal: sigType });
      return res;
    },
  },
  {
    name: 'BOT_GET_POSITIONS',
    category: 'bot',
    description: 'Get all active live or paper trading positions belonging to a specific bot.',
    inputSchema: {
      type: 'object',
      properties: {
        botId: { type: 'string', description: 'Bot ID' },
      },
      required: ['botId'],
    },
    handler: async (params) => {
      const botId = params.botId || params.id;
      const positions = await botEngine.getBotPositions(botId);
      return { success: true, count: positions.length, positions };
    },
  },
  {
    name: 'BOT_CLOSE_POSITIONS',
    category: 'bot',
    description: 'Liquidate all open positions opened by a specific bot.',
    inputSchema: {
      type: 'object',
      properties: {
        botId: { type: 'string', description: 'Bot ID' },
        reason: { type: 'string', description: 'Closure reason' },
      },
      required: ['botId'],
    },
    handler: async (params) => {
      const botId = params.botId || params.id;
      const result = await botEngine.closeBotPositions(botId, params.reason || 'Bot positions close');
      return { success: true, ...result };
    },
  },
  {
    name: 'BOT_UPDATE_CONFIG',
    category: 'bot',
    description: 'Update allocation, parameters, trailing stops, or execution mode for a bot.',
    inputSchema: {
      type: 'object',
      properties: {
        botId: { type: 'string', description: 'Bot ID' },
        updates: { type: 'object', description: 'Key-value updates' },
      },
      required: ['botId'],
    },
    handler: async (params, context) => {
      const botId = params.botId || params.id;
      const existing = botStore.getBot(botId);
      if (!existing) return { success: false, message: 'Bot not found' };
      const updated = await botStore.saveBot({
        ...existing,
        ...(params.updates || params),
        id: botId,
      });
      context.notify?.('BOT_CONFIG_UPDATED', { botId });
      return { success: true, bot: updated };
    },
  },
  {
    name: 'BOT_GET_EXECUTIONS',
    category: 'bot',
    description: 'Get historical order execution records and logs for a bot.',
    inputSchema: {
      type: 'object',
      properties: {
        botId: { type: 'string', description: 'Bot ID' },
        limit: { type: 'number', description: 'Maximum execution records' },
      },
      required: ['botId'],
    },
    handler: async (params) => {
      const botId = params.botId || params.id;
      const executions = await botStore.getExecutions(botId, params.limit || 50);
      return { success: true, count: executions.length, executions };
    },
  },
  {
    name: 'BOT_GET_LOGS',
    category: 'bot',
    description: 'Get real-time operational log messages for a bot.',
    inputSchema: {
      type: 'object',
      properties: {
        botId: { type: 'string', description: 'Bot ID' },
        limit: { type: 'number', description: 'Maximum logs' },
      },
      required: ['botId'],
    },
    handler: async (params) => {
      const botId = params.botId || params.id;
      const logs = await botStore.getLogs(botId, params.limit || 50);
      return { success: true, count: logs.length, logs };
    },
  },
];
