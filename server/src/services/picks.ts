import { commitHash, newSalt, type PickPayload } from '../core/commit.js';
import { lockedBeforeKickoff, totalOdds } from '../core/settlement.js';
import type { Leg } from '../core/types.js';

/** What a viewer may see of a pick. VIP picks stay hidden from non-subscribers until they settle. */
export function presentPick(
  pick: {
    _id: unknown;
    tipsterId: unknown;
    visibility: string;
    result: string;
    legs: unknown[];
    note?: string | null;
    commitHash: string;
    salt?: string;
    [k: string]: unknown;
  },
  viewer: { isOwner: boolean; isSubscriber: boolean },
) {
  const { salt, ...rest } = pick;
  const settled = pick.result !== 'pending';
  const canSeeContent = pick.visibility === 'public' || viewer.isOwner || viewer.isSubscriber || settled;
  return {
    ...rest,
    legs: canSeeContent ? pick.legs : [],
    note: canSeeContent ? pick.note : undefined,
    locked: !canSeeContent,
    // Salt is revealed only after settlement, so anyone can re-hash the pick and check the commit.
    salt: settled ? salt : undefined,
  };
}

export class PickRejected extends Error {}

export function buildLockedPick(input: {
  tipsterId: string;
  legs: Leg[];
  stakeUnits: number;
  now?: Date;
}) {
  const lockedAt = input.now ?? new Date();
  if (input.legs.length === 0) throw new PickRejected('A pick needs at least one leg');
  if (input.legs.length > 20) throw new PickRejected('Maximum 20 legs');
  if (!lockedBeforeKickoff(lockedAt, input.legs)) {
    throw new PickRejected('A game in this slip has already started. Picks must be locked before kickoff.');
  }
  const payload: PickPayload = {
    tipsterId: input.tipsterId,
    stakeUnits: input.stakeUnits,
    lockedAt: lockedAt.toISOString(),
    legs: input.legs.map((l) => ({ eventId: l.eventId, market: l.market, selection: l.selection, odds: l.odds })),
  };
  const salt = newSalt();
  return {
    lockedAt,
    salt,
    commitHash: commitHash(payload, salt),
    totalOdds: totalOdds(input.legs),
    firstKickoff: new Date(Math.min(...input.legs.map((l) => l.kickoff.getTime()))),
  };
}
