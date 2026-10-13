import { Router } from 'express';
import { BotController } from './botController.ts';

export const botRouter = Router();

botRouter.get('/', BotController.listBots);
botRouter.post('/', BotController.createBot);
botRouter.get('/:id', BotController.getBot);
botRouter.put('/:id', BotController.updateBot);
botRouter.delete('/:id', BotController.deleteBot);

botRouter.post('/:id/start', BotController.startBot);
botRouter.post('/:id/pause', BotController.pauseBot);
botRouter.post('/:id/stop', BotController.stopBot);
botRouter.post('/:id/evaluate', BotController.evaluateBot);
botRouter.post('/:id/close-positions', BotController.closePositions);

botRouter.get('/:id/executions', BotController.getExecutions);
botRouter.get('/:id/logs', BotController.getLogs);
