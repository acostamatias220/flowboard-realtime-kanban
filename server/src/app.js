import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { db } from './db/knex.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { apiRouter } from './modules/index.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.get('/api/health', async (_req, res) => {
    await db.raw('select 1');
    res.json({ status: 'ok', uptime: Math.round(process.uptime()) });
  });

  app.use('/api', apiLimiter);
  app.use('/api/auth', authRouter);
  app.use('/api', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
