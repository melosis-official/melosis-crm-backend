import { Router } from 'express';
import { authRouter } from '../controllers/auth';
import { dashboardRouter } from '../controllers/dashboard';
import { leadsRouter } from '../controllers/leads';
import { tasksRouter } from '../controllers/tasks';
import { transferRouter } from '../controllers/import-export';
import { usersRouter } from '../controllers/users';
import { requireAuth } from '../middleware/auth';
import { requireCsrf } from '../middleware/csrf';
export const apiRouter=Router();
apiRouter.use('/auth',authRouter);
apiRouter.use(requireAuth);
apiRouter.use((req,res,next)=>['GET','HEAD','OPTIONS'].includes(req.method)?next():requireCsrf(req,res,next));
apiRouter.use('/dashboard',dashboardRouter);
// Register static transfer paths before /leads/:id so "export" is not read as a lead ID.
apiRouter.use('/',transferRouter);
apiRouter.use('/leads',leadsRouter);
apiRouter.use('/tasks',tasksRouter);
apiRouter.use('/users',usersRouter);
