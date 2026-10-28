import { Router } from 'express';
import { z } from 'zod';
import { BOOKIES } from '../core/types.js';
import { User } from '../models/index.js';
import { HttpError } from '../errors.js';
import { requireUser } from '../middleware/auth.js';
import { assertValidHandle, normalizeHandle, presentUser } from '../services/users.js';

const Onboarding = z.object({
  over18Confirmed: z.literal(true),
  favouriteClubs: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  mainBookie: z.enum(BOOKIES),
  unitNaira: z.number().int().min(100).max(1_000_000).default(1000),
});

const PatchMe = z
  .object({
    handle: z.string().trim().min(3).max(20).optional(),
    displayName: z.string().trim().min(1).max(60).optional(),
  })
  .refine((v) => v.handle !== undefined || v.displayName !== undefined, {
    message: 'Send handle and/or displayName',
  });

export function meRouter() {
  const r = Router();

  r.get('/me', requireUser, async (req, res) => {
    const user = await User.findById(req.userId).lean();
    if (!user) throw new HttpError(404, 'User not found');
    res.json(presentUser(user));
  });

  r.post('/me/onboarding', requireUser, async (req, res) => {
    const body = Onboarding.parse(req.body);
    const user = await User.findByIdAndUpdate(
      req.userId,
      {
        $set: {
          over18Confirmed: true,
          favouriteClubs: body.favouriteClubs,
          mainBookie: body.mainBookie,
          unitNaira: body.unitNaira,
          onboardedAt: new Date(),
        },
      },
      { new: true },
    ).lean();
    if (!user) throw new HttpError(404, 'User not found');
    res.json(presentUser(user));
  });

  r.patch('/me', requireUser, async (req, res) => {
    const body = PatchMe.parse(req.body);
    const $set: Record<string, string> = {};
    if (body.handle !== undefined) {
      const handle = normalizeHandle(body.handle);
      assertValidHandle(handle);
      const taken = await User.exists({ handle, _id: { $ne: req.userId } });
      if (taken) throw new HttpError(409, 'Handle already taken');
      $set.handle = handle;
    }
    if (body.displayName !== undefined) $set.displayName = body.displayName.trim();

    try {
      const user = await User.findByIdAndUpdate(req.userId, { $set }, { new: true }).lean();
      if (!user) throw new HttpError(404, 'User not found');
      res.json(presentUser(user));
    } catch (err) {
      if ((err as { code?: number }).code === 11000) throw new HttpError(409, 'Handle already taken');
      throw err;
    }
  });

  return r;
}
