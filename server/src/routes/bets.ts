import { Router } from 'express';
import { z } from 'zod';
import { BOOKIES, type Leg } from '../core/types.js';
import type { ResolverRegistry } from '../core/bookies/registry.js';
import { HttpError } from '../errors.js';
import { requireUser } from '../middleware/auth.js';
import { UserBet } from '../models/index.js';
import { summariseMonth, type BetSummaryInput } from '../services/bets.js';

const CreateBet = z.object({
  code: z.string().trim().toUpperCase().min(4).max(16),
  bookie: z.enum(BOOKIES),
  stakeNaira: z.number().min(1).max(10_000_000),
  source: z.enum(['copied', 'own', 'imported']).default('imported'),
  pickId: z.string().optional(),
});

export function betsRouter(registry: ResolverRegistry) {
  const r = Router();

  r.post('/me/bets', requireUser, async (req, res) => {
    const body = CreateBet.parse(req.body);
    const slip = await registry.resolve(body.code, body.bookie);
    if (!slip) throw new HttpError(404, 'Code not found or expired');
    const firstKickoff = new Date(Math.min(...slip.legs.map((l) => l.kickoff.getTime())));
    const bet = await UserBet.create({
      userId: req.userId,
      bookie: slip.bookie,
      code: slip.code,
      legs: slip.legs,
      stakeNaira: body.stakeNaira,
      source: body.source,
      pickId: body.pickId,
      firstKickoff,
    });
    res.status(201).json(bet);
  });

  r.get('/me/bets', requireUser, async (req, res) => {
    const status = z.enum(['open', 'settled']).default('open').parse(req.query.status);
    const filter =
      status === 'open'
        ? { userId: req.userId, result: 'pending' }
        : { userId: req.userId, result: { $in: ['won', 'lost', 'void'] } };
    const items = await UserBet.find(filter).sort({ createdAt: -1 }).limit(100).lean();
    res.json({ status, items });
  });

  r.get('/me/bets/summary', requireUser, async (req, res) => {
    const month = z
      .string()
      .regex(/^\d{4}-\d{2}$/)
      .parse(req.query.month ?? new Date().toISOString().slice(0, 7));
    const [y, m] = month.split('-').map(Number) as [number, number];
    const from = new Date(Date.UTC(y, m - 1, 1));
    const to = new Date(Date.UTC(y, m, 1));
    const bets = await UserBet.find({
      userId: req.userId,
      result: { $in: ['won', 'lost', 'void'] },
      settledAt: { $gte: from, $lt: to },
    }).lean();

    const inputs: BetSummaryInput[] = bets.map((b) => ({
      legs: b.legs as unknown as Leg[],
      stakeNaira: b.stakeNaira,
      returnNaira: b.returnNaira,
      result: b.result as BetSummaryInput['result'],
      source: b.source as BetSummaryInput['source'],
    }));
    res.json(summariseMonth(month, inputs));
  });

  return r;
}
