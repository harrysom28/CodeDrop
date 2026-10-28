import { OddsSnapshot, PickModel } from '../models/index.js';
import type { ResolverRegistry } from '../core/bookies/registry.js';
import type { Bookie, Leg } from '../core/types.js';

/**
 * Every 15 minutes, re-resolve open picks that still have a booking code and store the
 * current prices. The last snapshot taken before each leg's kickoff becomes closingOdds
 * for CLV. If we never got a pre-kickoff price, CLV stays undefined — never invent it.
 */

export async function snapshotOpenPickOdds(registry: ResolverRegistry, now = new Date()) {
  let snapped = 0;
  const open = PickModel.find({
    result: 'pending',
    firstKickoff: { $gt: now },
    code: { $exists: true, $ne: null },
    bookie: { $exists: true, $ne: null },
  }).cursor();

  for await (const pick of open) {
    if (!pick.code || !pick.bookie) continue;
    try {
      const slip = await registry.resolve(pick.code, pick.bookie as Bookie);
      if (!slip) continue;
      await OddsSnapshot.create({
        pickId: pick._id,
        bookie: pick.bookie,
        code: pick.code,
        capturedAt: now,
        legs: slip.legs.map((l) => ({
          eventId: l.eventId,
          market: l.market,
          selection: l.selection,
          odds: l.odds,
          kickoff: l.kickoff,
        })),
      });
      snapped++;
    } catch {
      // Bookie down — skip this pick this round.
    }
  }
  return snapped;
}

/** Attach the last pre-kickoff snapshot odds onto legs that lack closingOdds. */
export async function applyClosingOddsFromSnapshots(pickId: unknown, legs: Leg[]): Promise<Leg[]> {
  const snaps = await OddsSnapshot.find({ pickId }).sort({ capturedAt: -1 }).lean();
  if (snaps.length === 0) return legs;

  return legs.map((leg) => {
    if (leg.closingOdds != null) return leg;
    for (const snap of snaps) {
      if (snap.capturedAt.getTime() >= leg.kickoff.getTime()) continue;
      const match = snap.legs.find(
        (l) =>
          l.eventId === leg.eventId &&
          (l.market ?? '').toLowerCase() === leg.market.toLowerCase() &&
          (l.selection ?? '').toLowerCase() === leg.selection.toLowerCase(),
      );
      if (match?.odds != null) return { ...leg, closingOdds: match.odds };
    }
    return leg;
  });
}
