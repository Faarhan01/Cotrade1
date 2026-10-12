import { Router } from 'express';
import { mt5Router } from './mt5Routes';
import { apiRouter } from './apiRoutes';

const indexRouter = Router();
indexRouter.use('/', mt5Router);
indexRouter.use('/api', apiRouter);

export default indexRouter;
