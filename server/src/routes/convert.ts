import { Router } from 'express';
import { z } from 'zod';
import { BOOKIES } from '../core/types.js';
import type { ResolverRegistry } from '../core/bookies/registry.js';
import { convertCode } from '../services/convert.js';
import { requireUser } from '../middleware/auth.js';

const Body = z.object({
  code: z.string().trim().min(4).max(16),
  from: z.enum(BOOKIES),
  to: z.enum(BOOKIES),
});

export function convertRouter(registry: ResolverRegistry) {
  const r = Router();

  r.post('/convert', requireUser, async (req, res) => {
    const body = Body.parse(req.body);
    const result = await convertCode(body, { registry });
    res.json(result);
  });

  return r;
}
