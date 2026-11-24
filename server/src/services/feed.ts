import type { Types } from 'mongoose';
import type { FeedCandidate, SourceStats } from '../core/quality.js';
import { shrunkHitRate } from '../core/quality.js';
import { PickModel, SpottedSlip } from '../models/index.js';
import { presentPick } from './picks.js';

/** How many upcoming items we score before cutting to the page size. */
const POOL = 200;

type Viewer = { userId?: Types.ObjectId };

/** Settled record per channel handle ("@name"), from every Spotted slip it posted before kickoff. */
export async function channelStats(handles: string[]): Promise<Map<string, SourceStats>> {
  const out = new Map<string, SourceStats>();
  if (handles.length === 0) return out;
  const rows = await SpottedSlip.aggregate<{ _id: string; settled: number; won: number; profitUnits: number }>([
    { $match: { result: { $in: ['won', 'lost'] }, 'sightings.channel': { $in: handles } } },
    { $unwind: '$sightings' },
    { $match: { 'sightings.channel': { $in: handles } } },
    // A channel that posted the same slip twice still counts it once.
    { $group: { _id: { ch: '$sightings.channel', slip: '$_id' }, result: { $first: '$result' }, odds: { $first: '$totalOdds' } } },
    {
      $group: {
        _id: '$_id.ch',
        settled: { $sum: 1 },
        won: { $sum: { $cond: [{ $eq: ['$result', 'won'] }, 1, 0] } },
        profitUnits: { $sum: { $cond: [{ $eq: ['$result', 'won'] }, { $subtract: ['$odds', 1] }, -1] } },
      },
    },
  ]);
  for (const r of rows) out.set(r._id, { settled: r.settled, won: r.won, profitUnits: r.profitUnits });
  return out;
}

/** Settled record per tipster id, from locked picks (stake-weighted profit, count-based hit rate). */
export async function tipsterStats(ids: Types.ObjectId[]): Promise<Map<string, SourceStats>> {
  const out = new Map<string, SourceStats>();
  if (ids.length === 0) return out;
  const rows = await PickModel.aggregate<{ _id: Types.ObjectId; settled: number; won: number; profitUnits: number }>([
    { $match: { tipsterId: { $in: ids }, result: { $in: ['won', 'lost'] } } },
    {
      $group: {
        _id: '$tipsterId',
        settled: { $sum: 1 },
        won: { $sum: { $cond: [{ $eq: ['$result', 'won'] }, 1, 0] } },
        profitUnits: { $sum: '$profitUnits' },
      },
    },
  ]);
  for (const r of rows) out.set(r._id.toString(), { settled: r.settled, won: r.won, profitUnits: r.profitUnits });
  return out;
}

/** The best record among every channel that posted the slip: "also posted by a proven channel" counts. */
function bestSource(handles: string[], stats: Map<string, SourceStats>): SourceStats | undefined {
  let best: SourceStats | undefined;
  for (const h of handles) {
    const s = stats.get(h);
    if (s && (!best || shrunkHitRate(s) > shrunkHitRate(best))) best = s;
  }
  return best;
}

export async function spottedCandidates(now: Date): Promise<FeedCandidate<Record<string, unknown>>[]> {
  const slips = await SpottedSlip.find({ firstKickoff: { $gt: now } })
    .sort({ 'firstSighting.postedAt': -1 })
    .limit(POOL)
    .lean();
  const handles = [...new Set(slips.flatMap((s) => s.sightings.map((x) => x.channel)))];
  const stats = await channelStats(handles);
  return slips.map((s) => ({
    item: { ...s, verification: 'unverified', alsoPostedBy: Math.max(0, new Set(s.sightings.map((x) => x.channel)).size - 1) },
    kind: 'spotted' as const,
    legs: s.slip.legs.map((l) => ({ odds: Number(l.odds) })),
    totalOdds: s.totalOdds,
    postedAt: new Date(s.firstSighting.postedAt),
    source: bestSource(s.sightings.map((x) => x.channel), stats),
  }));
}

export async function pickCandidates(
  filter: Record<string, unknown>,
  viewer: Viewer,
): Promise<FeedCandidate<Record<string, unknown>>[]> {
  const picks = await PickModel.find(filter).sort({ lockedAt: -1 }).limit(POOL).lean();
  const stats = await tipsterStats([...new Map(picks.map((p) => [p.tipsterId.toString(), p.tipsterId])).values()]);
  return picks.map((p) => {
    const presented = presentPick(p, { isOwner: !!viewer.userId?.equals(p.tipsterId), isSubscriber: false });
    return {
      item: presented as Record<string, unknown>,
      kind: 'pick' as const,
      legs: p.legs.map((l) => ({ odds: Number(l.odds) })),
      totalOdds: p.totalOdds,
      postedAt: new Date(p.lockedAt),
      source: stats.get(p.tipsterId.toString()),
      hidden: presented.locked,
    };
  });
}

/**
 * Recent winners for the top of the feed. Looks back `hours` first; if nothing won in that
 * window (early days, quiet midweek), widens to 7 days so the strip still has something real.
 */
export async function recentWinners(now: Date, hours = 36, limit = 10) {
  for (const window of [hours, 7 * 24]) {
    const since = new Date(now.getTime() - window * 3600_000);
    const [picks, spotted] = await Promise.all([
      PickModel.find({ result: 'won', visibility: 'public', settledAt: { $gte: since } })
        .sort({ totalOdds: -1 })
        .limit(limit)
        .lean(),
      SpottedSlip.find({ result: 'won', settledAt: { $gte: since } })
        .sort({ totalOdds: -1 })
        .limit(limit)
        .lean(),
    ]);
    const items = [
      ...picks.map((p) => ({
        kind: 'pick' as const,
        _id: p._id,
        totalOdds: p.totalOdds,
        legs: p.legs.length,
        profitUnits: p.profitUnits,
        tipsterId: p.tipsterId,
        settledAt: p.settledAt,
        verification: p.verification,
      })),
      ...spotted.map((s) => ({
        kind: 'spotted' as const,
        _id: s._id,
        totalOdds: s.totalOdds,
        legs: s.slip.legs.length,
        channel: s.firstSighting.channel,
        url: s.firstSighting.url,
        code: s.firstSighting.code,
        bookie: s.firstSighting.bookie,
        settledAt: s.settledAt,
        verification: 'unverified',
      })),
    ]
      // Verified picks first, then by odds: a won 1.5 from a locked pick beats a won 20-odds spotted acca.
      .sort((a, b) => Number(b.kind === 'pick') - Number(a.kind === 'pick') || b.totalOdds - a.totalOdds)
      .slice(0, limit);
    if (items.length) return { windowHours: window, items };
  }
  return { windowHours: 7 * 24, items: [] };
}
