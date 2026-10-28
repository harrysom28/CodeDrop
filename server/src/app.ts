import express, { type NextFunction, type Request, type Response } from 'express';
import { ZodError } from 'zod';
import { HttpError } from './errors.js';
import { authenticate } from './middleware/auth.js';
import { adminRouter } from './routes/admin.js';
import { betsRouter } from './routes/bets.js';
import { convertRouter } from './routes/convert.js';
import { meRouter } from './routes/me.js';
import { picksRouter } from './routes/picks.js';
import { socialRouter } from './routes/social.js';
import type { ResolverRegistry } from './core/bookies/registry.js';
import { ResolverUnavailableError } from './core/bookies/types.js';

export function createApp(deps: { registry: ResolverRegistry }) {
  const app = express();
  app.use(express.json({ limit: '100kb' }));
  app.use(authenticate);

  app.get('/health', (_req, res) => {
    res.json({ ok: true, bookies: deps.registry.supported() });
  });
  app.use(meRouter());
  app.use(betsRouter(deps.registry));
  app.use(convertRouter(deps.registry));
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
