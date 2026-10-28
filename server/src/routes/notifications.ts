import { Router } from 'express';
import { z } from 'zod';
import { requireUser } from '../middleware/auth.js';
import { HttpError } from '../errors.js';
import { Notification, User } from '../models/index.js';
import { DEFAULT_PUSH_PREFS } from '../services/notifications.js';

export function notificationsRouter() {
  const r = Router();

  r.get('/me/notifications', requireUser, async (req, res) => {
    const items = await Notification.find({ userId: req.userId }).sort({ createdAt: -1 }).limit(50).lean();
    res.json({ items });
  });

  r.post('/me/devices', requireUser, async (req, res) => {
    const body = z.object({ expoPushToken: z.string().min(8).max(200) }).parse(req.body);
    await User.updateOne({ _id: req.userId }, { $addToSet: { expoPushTokens: body.expoPushToken } });
    res.status(204).end();
  });

  r.delete('/me/devices', requireUser, async (req, res) => {
    const body = z.object({ expoPushToken: z.string().min(8).max(200) }).parse(req.body);
    await User.updateOne({ _id: req.userId }, { $pull: { expoPushTokens: body.expoPushToken } });
    res.status(204).end();
  });

  r.get('/me/notification-prefs', requireUser, async (req, res) => {
    const user = await User.findById(req.userId).lean();
    if (!user) throw new HttpError(404, 'User not found');
    res.json({ ...DEFAULT_PUSH_PREFS, ...(user.pushPrefs ?? {}) });
  });

  r.patch('/me/notification-prefs', requireUser, async (req, res) => {
    const body = z
      .object({
        tipsterPick: z.boolean().optional(),
        betSettled: z.boolean().optional(),
        roomLive: z.boolean().optional(),
        mention: z.boolean().optional(),
        escrow: z.boolean().optional(),
        quietHoursStart: z.number().int().min(0).max(23).optional(),
        quietHoursEnd: z.number().int().min(0).max(23).optional(),
      })
      .parse(req.body);
    const $set: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body)) {
      if (v !== undefined) $set[`pushPrefs.${k}`] = v;
    }
    const user = await User.findByIdAndUpdate(req.userId, { $set }, { new: true }).lean();
    if (!user) throw new HttpError(404, 'User not found');
    res.json({ ...DEFAULT_PUSH_PREFS, ...(user.pushPrefs ?? {}) });
  });

  return r;
}
