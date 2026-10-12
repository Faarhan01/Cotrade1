import { Router } from 'express';
import { DaemonController } from '@controllers/daemon';

export const daemonRouter = Router();

daemonRouter.get('/status', DaemonController.getStatus);
daemonRouter.post('/heartbeat', DaemonController.heartbeat);
daemonRouter.post('/dispatch', DaemonController.dispatch);
daemonRouter.get('/events', DaemonController.getEvents);
daemonRouter.post('/events', DaemonController.postEvent);
daemonRouter.post('/clear', DaemonController.clearEvents);
daemonRouter.post('/config', DaemonController.updateConfig);
daemonRouter.post('/watchlist', DaemonController.updateWatchlist);
daemonRouter.get('/stream', DaemonController.stream);
