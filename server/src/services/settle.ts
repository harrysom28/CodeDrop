import { settleSlip, slipClv } from '../core/settlement.js';
import type { Leg, LegResult } from '../core/types.js';

/**
 * Settles picks and spotted slips once their games finish.
 *
 * The results feed is behind an interface so we can start with a cheap provider (API-Football) and move to
 * Sportradar/Genius later. Matching a bookie's event to the provider's fixture is the provider's job.
 */
export interface ResultsProvider {
  /** Returns the leg's result, or 'pending' if the game isn't finished. */
  legResult(leg: Leg): Promise<LegResult>;
  /** Closing odds for the selection, if the provider has them. */
  closingOdds?(leg: Leg): Promise<number | undefined>;
}

export interface SettleablePick {
  legs: Leg[];
  stakeUnits: number;
}

export async function settleOne(item: SettleablePick, provider: ResultsProvider) {
  const legs: Leg[] = [];
  for (const leg of item.legs) {
    const result = leg.result && leg.result !== 'pending' ? leg.result : await provider.legResult(leg);
    const closingOdds = leg.closingOdds ?? (await provider.closingOdds?.(leg));
    legs.push({ ...leg, result, closingOdds });
  }
  const settled = settleSlip(legs, item.stakeUnits);
  return { legs, ...settled, clv: slipClv(legs) };
}

/** Placeholder until a results feed is chosen and paid for. Keeps everything pending. */
export const noResultsYet: ResultsProvider = {
  async legResult() {
    return 'pending';
  },
};
