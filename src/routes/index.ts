import { Router } from 'express';
import { authRouter } from '../controllers/auth';
import { dashboardRouter } from '../controllers/dashboard';
import { leadsRouter } from '../controllers/leads';
import { tasksRouter } from '../controllers/tasks';
import { transferRouter } from '../controllers/import-export';
import { usersRouter } from '../controllers/users';
import { bridgeRouter } from '../controllers/bridge';
import { requireAuth, optionalAuth } from '../middleware/auth';
import { requireCsrf } from '../middleware/csrf';
export const subRouters = [
  { prefix: '/auth', router: authRouter, tag: 'Auth', description: 'Authentication & Credentials' },
  { prefix: '/bridge', router: bridgeRouter, tag: 'Phone Bridge', description: 'Real-time Mobile Click-to-Call Bridge' },
  { prefix: '/dashboard', router: dashboardRouter, tag: 'Dashboard', description: 'Metrics & Pipeline Overview' },
  { prefix: '', router: transferRouter, tag: 'Import / Export', description: 'CSV Lead Ingestion & Data Export' },
  { prefix: '/leads', router: leadsRouter, tag: 'Leads', description: 'Institute Leads Directory' },
  { prefix: '/tasks', router: tasksRouter, tag: 'Tasks', description: 'Follow-ups & Scheduling' },
  { prefix: '/users', router: usersRouter, tag: 'Users', description: 'Staff & Team Management' },
];

export const apiRouter = Router();
apiRouter.use('/auth', authRouter);
apiRouter.use('/bridge', optionalAuth, bridgeRouter);
apiRouter.use(requireAuth);
apiRouter.use((req, res, next) => ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? next() : requireCsrf(req, res, next));
apiRouter.use('/dashboard', dashboardRouter);
// Register static transfer paths before /leads/:id so "export" is not read as a lead ID.
apiRouter.use('/', transferRouter);
apiRouter.use('/leads', leadsRouter);
apiRouter.use('/tasks', tasksRouter);
apiRouter.use('/users', usersRouter);

