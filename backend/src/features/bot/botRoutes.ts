import { Router } from 'express';
import { executeCommand } from '@commands';

export const botRouter = Router();

const dispatch = (action: string, mapParams: (req: any) => Record<string, any> = (req) => req.body || {}) => async (req: any, res: any) => {
	const result = await executeCommand(action, mapParams(req), { source: 'UI' });
	const data = result.data && typeof result.data === 'object' ? result.data : { data: result.data };
	res.status(result.success ? 200 : 400).json({ ...data, success: result.success });
};

botRouter.get('/', dispatch('BOT_LIST'));
botRouter.post('/', dispatch('BOT_CREATE'));
botRouter.get('/:id', dispatch('BOT_GET', (req) => ({ botId: req.params.id })));
botRouter.put('/:id', dispatch('BOT_UPDATE_CONFIG', (req) => ({ botId: req.params.id, updates: req.body })));
botRouter.delete('/:id', dispatch('BOT_DELETE', (req) => ({ botId: req.params.id })));

botRouter.post('/:id/start', dispatch('BOT_START', (req) => ({ botId: req.params.id, ...req.body })));
botRouter.post('/:id/pause', dispatch('BOT_PAUSE', (req) => ({ botId: req.params.id, ...req.body })));
botRouter.post('/:id/stop', dispatch('BOT_STOP', (req) => ({ botId: req.params.id, ...req.body })));
botRouter.post('/:id/evaluate', dispatch('BOT_EVALUATE', (req) => ({ botId: req.params.id })));
botRouter.post('/:id/close-positions', dispatch('BOT_CLOSE_POSITIONS', (req) => ({ botId: req.params.id, ...req.body })));

botRouter.get('/:id/executions', dispatch('BOT_GET_EXECUTIONS', (req) => ({ botId: req.params.id, limit: req.query.limit })));
botRouter.get('/:id/logs', dispatch('BOT_GET_LOGS', (req) => ({ botId: req.params.id, limit: req.query.limit })));
botRouter.get('/:id/positions', dispatch('BOT_GET_POSITIONS', (req) => ({ botId: req.params.id })));
botRouter.post('/:id/force-signal', dispatch('BOT_FORCE_SIGNAL', (req) => ({ botId: req.params.id, ...req.body })));
