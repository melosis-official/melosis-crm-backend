import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { apiRouter, subRouters } from './routes';
import { setupSwagger } from './config/swagger';
import { errorHandler, notFound } from './middleware/errors';
import { checkOrigin } from './middleware/origin';
import { isAllowedOrigin } from './config/origins';

export const app = express();
if (env.TRUST_PROXY === 'true') app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: (origin, callback) => callback(null, !origin || isAllowedOrigin(origin)), credentials: true, methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'X-CSRF-Token'] }));
app.use(express.json({ limit: '6mb' }));
app.use(cookieParser());
app.use(checkOrigin);

// Mount interactive Swagger UI & raw OpenAPI specification
setupSwagger(app, subRouters);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Too many sign-in attempts. Try again later.' } });
app.use('/api/v1/auth/login', loginLimiter);
app.use('/api/v1', apiRouter);
app.use(notFound);
app.use(errorHandler);

