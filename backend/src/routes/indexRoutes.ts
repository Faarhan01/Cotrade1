import { Router } from 'express';
import { mt5Router } from '../../routes/mt5Routes.js';
import { apiRouter } from '../../routes/apiRoutes.js';

const indexRouter = Router();
indexRouter.use('/', mt5Router);
indexRouter.use('/api', apiRouter);

export default indexRouter;
