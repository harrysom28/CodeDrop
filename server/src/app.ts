import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';
import { config } from './config.js';
import { HttpError } from './errors.js';
import { authenticate } from './middleware/auth.js';
import { adminRouter } from './routes/admin.js';
import { betsRouter } from './routes/bets.js';
import { convertRouter } from './routes/convert.js';
import { meRouter } from './routes/me.js';
import { notificationsRouter } from './routes/notifications.js';
import { picksRouter } from './routes/picks.js';
import { roomsRouter } from './routes/rooms.js';
import { socialRouter } from './routes/social.js';
import { walletRouter } from './routes/wallet.js';
import type { ResolverRegistry } from './core/bookies/registry.js';
import { ResolverUnavailableError } from './core/bookies/types.js';
import { JobRun } from './models/index.js';
import mongoose from 'mongoose';

export function createApp(deps: { registry: ResolverRegistry }) {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(
    cors({
      origin: config.CORS_ORIGINS.length ? config.CORS_ORIGINS : true,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use((req, res, next) => {
    const id = (req.headers['x-request-id'] as string) || randomUUID();
    req.headers['x-request-id'] = id;
    res.setHeader('x-request-id', id);
    next();
  });
  app.use(authenticate);

  const strict = rateLimit({ windowMs: 60_000, max: 30, standardHeaders: true, legacyHeaders: false });
  app.use('/convert', strict);
  app.use('/picks/preview', strict);
  app.use('/me/onboarding', strict);

  app.get('/health', async (_req, res) => {
    const dbOk = mongoose.connection.readyState === 1;
    let lastSettlement: Date | null = null;
    let telegramHeartbeat: Date | null = null;
    if (dbOk) {
      try {
        const [lastSettle, heartbeat] = await Promise.all([
          JobRun.findOne({ job: 'settle' }).sort({ finishedAt: -1 }).lean(),
          JobRun.findOne({ job: 'telegram_heartbeat' }).sort({ finishedAt: -1 }).lean(),
        ]);
        lastSettlement = lastSettle?.finishedAt ?? null;
        telegramHeartbeat = heartbeat?.finishedAt ?? null;
      } catch {
        /* health still answers */
      }
    }
    res.json({
      ok: true,
      bookies: deps.registry.supported(),
      db: dbOk ? 'up' : 'down',
      lastSettlement,
      telegramHeartbeat,
    });
  });
  app.use(meRouter());
  app.use(notificationsRouter());
  app.use(betsRouter(deps.registry));
  app.use(convertRouter(deps.registry));
  app.use(roomsRouter());
  app.use(walletRouter());
  app.use(adminRouter());
  app.use('/picks', picksRouter(deps.registry));
  app.use('/', socialRouter());

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) return res.status(400).json({ error: 'Invalid request', issues: err.issues });
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    if (err instanceof ResolverUnavailableError) {
      return res.status(503).json({ error: "We couldn't reach the bookie just now. Try again shortly." });
    }
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  });
  return app;
}
