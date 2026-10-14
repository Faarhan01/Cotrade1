import { CommandDefinition } from './types.ts';
import { tradeStore } from '@services/tradeStore';
import { readEvents, appendEvent, clearEvents } from '@services/eventBuffer';
import { broadcast } from '@services/websocketServer';

export const systemCommands: CommandDefinition[] = [
  {
    name: 'CONFIGURE_RISK',
    mcpAliases: ['mt5_configure_risk_guard', 'mt5_set_trailing_stop'],
    category: 'system',
    description: 'Update risk guard parameters (lot caps, max drawdown, trailing stops, emergency switch).',
    inputSchema: {
      type: 'object',
      properties: {
        globalTakeProfitUSD: { type: 'number', description: 'Portfolio profit target' },
        globalStopLossUSD: { type: 'number', description: 'Portfolio loss limit' },
        maxLotSizePerTrade: { type: 'number', description: 'Max lots per order' },
        trailingStopEnabled: { type: 'boolean', description: 'Enable trailing stop' },
        trailingStopDistancePoints: { type: 'number', description: 'Trailing distance points' },
        emergencyKillSwitch: { type: 'boolean', description: 'Halt all trading immediately' },
      },
    },
    handler: async (params) => {
      const updates = params.params || params;
      tradeStore.updateRiskGuard(updates);
      broadcast({
        type: 'risk:updated',
        payload: tradeStore.getRiskGuard(),
      });
      return { success: true, riskGuard: tradeStore.getRiskGuard() };
    },
  },
  {
    name: 'TOGGLE_KILL_SWITCH',
    category: 'system',
    description: 'Trigger or release the global Emergency Kill Switch.',
    inputSchema: {
      type: 'object',
      properties: {
        active: { type: 'boolean', description: 'True to activate, false to deactivate' },
      },
      required: ['active'],
    },
    handler: async (params, context) => {
      const active = Boolean(params.active);
      tradeStore.triggerKillSwitch(active);
      context.notify?.('KILL_SWITCH_TOGGLED', { active });
      broadcast({
        type: 'risk:kill_switch',
        payload: { active },
      });
      return { success: true, active, killSwitch: active };
    },
  },
  {
    name: 'EMERGENCY_HALT',
    category: 'system',
    description: 'Instant failsafe: trigger kill switch, halt automated bots, and notify all systems.',
    inputSchema: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Emergency halt explanation' },
      },
    },
    handler: async (params, context) => {
      tradeStore.triggerKillSwitch(true);
      const { botStore } = await import('@features/bot');
      const activeBots = botStore.getActiveBots();
      await Promise.all(activeBots.map((bot) => botStore.updateBotStatus(bot.id, 'PAUSED', 'Emergency halt')));
      const reason = params.reason || 'Manual emergency halt';
      context.notify?.('EMERGENCY_HALT', { reason, pausedBots: activeBots.map((bot) => bot.id) });
      return {
        success: true,
        pausedBots: activeBots.length,
        openPositionsClosed: false,
        message: 'New entries are blocked and active bots are paused. Existing positions remain open.',
      };
    },
  },
  {
    name: 'RESUME',
    mcpAliases: ['mt5_resume_trading'],
    category: 'system',
    description: 'Release the emergency entry lock. Previously paused bots remain paused until explicitly restarted.',
    inputSchema: { type: 'object', properties: {} },
    handler: async (_params, context) => {
      tradeStore.triggerKillSwitch(false);
      context.notify?.('TRADING_RESUMED', { botsRestarted: false });
      broadcast({ type: 'risk:kill_switch', payload: { active: false } });
      return { success: true, killSwitch: false, botsRestarted: false };
    },
  },
  {
    name: 'GET_EVENTS',
    category: 'system',
    description: 'Retrieve buffered telemetry events and audit logs.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Limit events (default: 100)' },
        type: { type: 'string', description: 'Filter by event type' },
      },
    },
    handler: async (params) => {
      const events = readEvents({
        limit: params.limit ? Number(params.limit) : 100,
        type: params.type,
      });
      return { success: true, count: events.length, events };
    },
  },
  {
    name: 'POST_EVENT',
    category: 'system',
    description: 'Append a custom event to the audit buffer.',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', description: 'Event identifier' },
        payload: { type: 'object', description: 'Event payload' },
      },
      required: ['type'],
    },
    handler: async (params) => {
      const event = { ts: Date.now(), type: params.type, payload: params.payload || {} };
      appendEvent(event);
      broadcast({ type: 'daemon:event', payload: event }, { persist: false });
      return { success: true, event };
    },
  },
  {
    name: 'CLEAR_EVENTS',
    category: 'system',
    description: 'Purge the in-memory and disk event buffer.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: async () => {
      clearEvents();
      return { success: true, message: 'Event buffer cleared' };
    },
  },
  {
    name: 'GET_STATUS',
    category: 'system',
    description: 'Get current system operational status and telemetry summary.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: async () => {
      return {
        success: true,
        state: tradeStore.getState(),
      };
    },
  },
];
