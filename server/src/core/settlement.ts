import type { Leg, SlipResult } from './types.js';

export interface Settled {
  result: SlipResult;
  /** Effective odds after removing void legs. */
  odds: number;
  /** Profit in units for the given stake; 0 while pending. */
  profitUnits: number;
}

export function totalOdds(legs: Pick<Leg, 'odds'>[]): number {
  return round(legs.reduce((acc, l) => acc * l.odds, 1));
}

export function settleSlip(legs: Pick<Leg, 'odds' | 'result'>[], stakeUnits: number): Settled {
  if (legs.length === 0) throw new Error('slip has no legs');
  const results = legs.map((l) => l.result ?? 'pending');

  if (results.includes('lost')) {
    return { result: 'lost', odds: totalOdds(legs), profitUnits: round(-stakeUnits) };
  }
  if (results.includes('pending')) {
    return { result: 'pending', odds: totalOdds(legs), profitUnits: 0 };
  }
  const live = legs.filter((l) => l.result !== 'void');
  if (live.length === 0) return { result: 'void', odds: 1, profitUnits: 0 };

  const odds = totalOdds(live);
  return { result: 'won', odds, profitUnits: round(stakeUnits * (odds - 1)) };
}

/**
 * Closing line value: how much better the posted price was than the final price before kickoff.
 * Positive CLV over many picks is the strongest short-run sign of real skill.
 */
export function slipClv(legs: Pick<Leg, 'odds' | 'closingOdds'>[]): number | undefined {
  if (legs.some((l) => !l.closingOdds)) return undefined;
  const posted = totalOdds(legs);
  const closing = totalOdds(legs.map((l) => ({ odds: l.closingOdds as number })));
  return round(posted / closing - 1, 4);
}

/** Picks only count if every leg was locked before its kickoff. */
export function lockedBeforeKickoff(lockedAt: Date, legs: Pick<Leg, 'kickoff'>[]): boolean {
  const first = Math.min(...legs.map((l) => l.kickoff.getTime()));
  return lockedAt.getTime() < first;
}

function round(n: number, dp = 2): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}
