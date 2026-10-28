import { Router } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { BOOKIES, type Leg } from '../core/types.js';
import { Copy, PickModel, User, UserBet } from '../models/index.js';
import { HttpError } from '../errors.js';
import { requireUser } from '../middleware/auth.js';
import { buildLockedPick, PickRejected, presentPick } from '../services/picks.js';
import type { ResolverRegistry } from '../core/bookies/registry.js';

const LegInput = z.object({
  eventId: z.string().min(1),
  homeTeam: z.string().min(1),
  awayTeam: z.string().min(1),
  league: z.string().optional(),
  market: z.string().min(1),
  selection: z.string().min(1),
  odds: z.number().gt(1).lt(1000),
  kickoff: z.coerce.date(),
});

const CreatePick = z
  .object({
    code: z.string().trim().toUpperCase().optional(),
    bookie: z.enum(BOOKIES).optional(),
    legs: z.array(LegInput).optional(),
    stakeUnits: z.number().min(0.1).max(10),
    note: z.string().max(500).optional(),
    visibility: z.enum(['public', 'vip']).default('public'),
  })
  .refine((v) => v.code || v.legs?.length, { message: 'Send a booking code or legs' });

export function picksRouter(registry: ResolverRegistry) {
  const r = Router();

  /** Preview a code before locking: lets the Post-a-pick screen show the legs. */
  r.get('/preview/:bookie/:code', async (req, res) => {
    const bookie = z.enum(BOOKIES).parse(req.params.bookie);
    const slip = await registry.resolve(req.params.code.toUpperCase(), bookie);
    if (!slip) throw new HttpError(404, 'Code not found or expired');
    res.json(slip);
  });

  /** Lock a pick: content is hashed and timestamped; it can never be edited or deleted. */
  r.post('/', requireUser, async (req, res) => {
    const body = CreatePick.parse(req.body);
    const tipster = await User.findById(req.userId);
    if (!tipster) throw new HttpError(404, 'User not found');

    let legs: Leg[] = body.legs ?? [];
    if (body.code) {
      const slip = await registry.resolve(body.code, body.bookie ?? 'unknown');
      if (!slip) throw new HttpError(404, 'Code not found or expired');
      legs = slip.legs;
    }

    try {
      const locked = buildLockedPick({ tipsterId: tipster.id, legs, stakeUnits: body.stakeUnits });
      const pick = await PickModel.create({
        tipsterId: tipster._id,
        bookie: body.bookie,
        code: body.code,
        legs,
        stakeUnits: body.stakeUnits,
        note: body.note,
        visibility: body.visibility,
        ...locked,
      });
      if (tipster.role === 'user') await User.updateOne({ _id: tipster._id }, { $set: { role: 'tipster' } });
      // TODO: anchor pick.commitHash on-chain (batch hashes into a Merkle root every few minutes).
      res.status(201).json(presentPick(pick.toObject(), { isOwner: true, isSubscriber: false }));
    } catch (err) {
      if (err instanceof PickRejected) throw new HttpError(422, err.message);
      throw err;
    }
  });

  r.get('/:id', async (req, res) => {
    if (!Types.ObjectId.isValid(req.params.id)) throw new HttpError(404, 'Pick not found');
    const pick = await PickModel.findById(req.params.id).select('+salt').lean();
    if (!pick) throw new HttpError(404, 'Pick not found');
    const isOwner = !!req.userId?.equals(pick.tipsterId);
    // TODO: real VIP subscription check once escrow subscriptions exist.
    res.json(presentPick(pick, { isOwner, isSubscriber: false }));
  });

  /** Record a copy: feeds copy counts, the follower's own tracker, and later affiliate attribution. */
  r.post('/:id/copy', requireUser, async (req, res) => {
    const body = z
      .object({
        bookie: z.enum(BOOKIES),
        oddsAtCopy: z.number().optional(),
        stakeNaira: z.number().min(1).max(10_000_000).optional(),
      })
      .parse(req.body);
    const pick = await PickModel.findOneAndUpdate(
      { _id: req.params.id, result: 'pending', firstKickoff: { $gt: new Date() } },
      { $inc: { copyCount: 1 } },
      { new: true },
    ).lean();
    if (!pick) throw new HttpError(409, 'Copy closed: games have started or pick not found');
    await Copy.create({ userId: req.userId, pickId: pick._id, bookie: body.bookie, oddsAtCopy: body.oddsAtCopy });
    let betId: string | undefined;
    if (body.stakeNaira) {
      const bet = await UserBet.create({
        userId: req.userId,
        bookie: body.bookie,
        code: pick.code,
        legs: pick.legs,
        stakeNaira: body.stakeNaira,
        source: 'copied',
        pickId: pick._id,
        firstKickoff: pick.firstKickoff,
      });
      betId = bet.id;
    }
    res.json({ copyCount: pick.copyCount, betId });
  });

  return r;
}
