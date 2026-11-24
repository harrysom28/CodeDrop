import { Router } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { config } from '../config.js';
import { rankTipsters, scoreTipster, type SettledPickStat } from '../core/ranking.js';
import { Channel, Follow, PickModel, SpottedSlip, User } from '../models/index.js';
import { HttpError } from '../errors.js';
import { requireAdmin, requireUser } from '../middleware/auth.js';
import { channelRecordFor, startChannelClaim } from '../services/claim.js';
import { presentPick } from '../services/picks.js';

function idParam(v: unknown, what: string): Types.ObjectId {
  if (typeof v !== 'string' || !Types.ObjectId.isValid(v)) throw new HttpError(404, `${what} not found`);
  return new Types.ObjectId(v);
}

function usernameParam(v: unknown): string {
  if (typeof v !== 'string' || !/^@?[A-Za-z0-9_]{4,32}$/.test(v)) throw new HttpError(400, 'Invalid channel username');
  return v.replace(/^@/, '').toLowerCase();
}

async function tipsterStats(match: Record<string, unknown>) {
  const rows = await PickModel.aggregate<{ _id: Types.ObjectId; picks: SettledPickStat[] }>([
    { $match: { result: { $in: ['won', 'lost', 'void'] }, ...match } },
    { $sort: { settledAt: 1 } },
    { $group: { _id: '$tipsterId', picks: { $push: { stakeUnits: '$stakeUnits', profitUnits: '$profitUnits', clv: '$clv' } } } },
  ]);
  return rows.map((r) => scoreTipster(r._id.toString(), r.picks));
}

export function socialRouter() {
  const r = Router();

  // ── Feed ──────────────────────────────────────────────────────────────────
  r.get('/feed', async (req, res) => {
    const tab = z.enum(['all', 'following', 'trending', 'spotted']).default('all').parse(req.query.tab);
    const now = new Date();

    if (tab === 'spotted') {
      const items = await SpottedSlip.find({ firstKickoff: { $gt: now } })
        .sort({ 'firstSighting.postedAt': -1 })
        .limit(50)
        .lean();
      return res.json({ tab, items: items.map((s) => ({ ...s, verification: 'unverified' })) });
    }

    const filter: Record<string, unknown> = { firstKickoff: { $gt: now }, result: 'pending' };
    if (tab === 'following') {
      if (!req.userId) throw new HttpError(401, 'Sign in to see who you follow');
      const follows = await Follow.find({ followerId: req.userId }, { tipsterId: 1 }).lean();
      filter.tipsterId = { $in: follows.map((f) => f.tipsterId) };
    }
    const picks = await PickModel.find(filter)
      .sort(tab === 'trending' ? { copyCount: -1 } : { lockedAt: -1 })
      .limit(50)
      .lean();
    res.json({
      tab,
      items: picks.map((p) => presentPick(p, { isOwner: !!req.userId?.equals(p.tipsterId), isSubscriber: false })),
    });
  });

  // ── Follows ───────────────────────────────────────────────────────────────
  r.post('/follows/:tipsterId', requireUser, async (req, res) => {
    const tipsterId = idParam(req.params.tipsterId, 'Tipster');
    if (tipsterId.equals(req.userId!)) throw new HttpError(400, "You can't follow yourself");
    await Follow.updateOne({ followerId: req.userId, tipsterId }, { $setOnInsert: { alerts: true } }, { upsert: true });
    res.status(204).end();
  });

  r.delete('/follows/:tipsterId', requireUser, async (req, res) => {
    await Follow.deleteOne({ followerId: req.userId, tipsterId: idParam(req.params.tipsterId, 'Tipster') });
    res.status(204).end();
  });

  // ── Leaderboard & profiles ────────────────────────────────────────────────
  r.get('/leaderboard', async (req, res) => {
    const days = z.coerce.number().int().min(7).max(365).optional().parse(req.query.days);
    const match = days ? { settledAt: { $gte: new Date(Date.now() - days * 86_400_000) } } : {};
    // Only ID-verified tipsters can rank (one person, one account).
    const verified = await User.find({ idVerified: true }, { _id: 1, handle: 1, displayName: 1 }).lean();
    const byId = new Map(verified.map((u) => [u._id.toString(), u]));
    const scores = (await tipsterStats(match)).filter((s) => byId.has(s.tipsterId));
    const ranked = rankTipsters(scores).map((s) => ({ ...s, tipster: byId.get(s.tipsterId) }));
    res.json({ items: ranked });
  });

  r.get('/tipsters/:id', async (req, res) => {
    const user = await User.findById(idParam(req.params.id, 'Tipster'), { phone: 0 }).lean();
    if (!user) throw new HttpError(404, 'Tipster not found');
    const [score] = await tipsterStats({ tipsterId: user._id });
    const followers = await Follow.countDocuments({ tipsterId: user._id });
    const isFollowing = req.userId ? !!(await Follow.exists({ followerId: req.userId, tipsterId: user._id })) : false;
    res.json({ tipster: user, score: score ?? null, followers, isFollowing });
  });

  // ── Tracked channels (admin) & claim flow ─────────────────────────────────
  r.post('/admin/channels', requireAdmin, async (req, res) => {
    const body = z.object({ usernames: z.array(z.string().regex(/^@?[A-Za-z0-9_]{4,32}$/)).min(1).max(200) }).parse(req.body);
    const ops = body.usernames.map((u) => ({
      updateOne: {
        filter: { source: 'telegram', username: u.replace(/^@/, '').toLowerCase() },
        update: { $setOnInsert: { enabled: true } },
        upsert: true,
      },
    }));
    const result = await Channel.bulkWrite(ops);
    res.json({ added: result.upsertedCount });
  });

  /** Private record of a channel, for the claim screen and our recruiting. */
  r.get('/channels/:username/record', requireAdmin, async (req, res) => {
    res.json(await channelRecordFor(usernameParam(req.params.username)));
  });

  r.post('/channels/:username/claim/start', requireUser, async (req, res) => {
    const out = await startChannelClaim(usernameParam(req.params.username), req.userId!);
    res.json(out);
  });

  /** Claimant's Spotted history for their claimed channel (never mixed into leaderboard). */
  r.get('/me/channel-record', requireUser, async (req, res) => {
    const channel = await Channel.findOne({ claimedBy: req.userId, source: 'telegram' }).lean();
    if (!channel) throw new HttpError(404, 'No claimed channel');
    res.json(await channelRecordFor(channel.username));
  });

  /**
   * Owner asked to be removed: stop ingesting and hide everything from them.
   * Signed-in claimant can opt out their own channel; admins can opt out any.
   */
  r.post('/channels/:username/opt-out', requireUser, async (req, res) => {
    const username = usernameParam(req.params.username);
    const channel = await Channel.findOne({ source: 'telegram', username });
    const isAdmin = config.ADMIN_USER_IDS.includes(req.userId!.toString());
    const isOwner = channel?.claimedBy?.equals(req.userId!) || channel?.claimRequestedBy?.equals(req.userId!);
    if (!isAdmin && !isOwner) throw new HttpError(403, 'Only the claimant or an admin can opt out');
    await Channel.updateOne({ source: 'telegram', username }, { $set: { optedOut: true, enabled: false } }, { upsert: true });
    await SpottedSlip.updateMany({}, { $pull: { sightings: { channel: `@${username}` } } });
    await SpottedSlip.deleteMany({ 'firstSighting.channel': `@${username}`, sightings: { $size: 0 } });
    res.status(204).end();
  });

  return r;
}
