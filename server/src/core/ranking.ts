/**
 * Leaderboard scoring that a lucky weekend can't game.
 *
 * - Minimum sample before a tipster is ranked at all.
 * - ROI is shrunk towards break-even: we pretend every tipster also placed PRIOR_STAKE units at 0% ROI,
 *   so 12–0 over two weekends scores far below a steady +8% over 400 picks.
 * - Ties broken by average CLV.
 */

export const MIN_SETTLED_PICKS = 100;
export const PRIOR_STAKE_UNITS = 150;

export interface SettledPickStat {
  stakeUnits: number;
  profitUnits: number;
  clv?: number;
}

export interface TipsterScore {
  tipsterId: string;
  settled: number;
  profitUnits: number;
  roi: number;
  adjustedRoi: number;
  avgClv?: number;
  maxDrawdownUnits: number;
  ranked: boolean;
  picksToRank: number;
}

export function scoreTipster(tipsterId: string, picks: SettledPickStat[]): TipsterScore {
  const staked = sum(picks.map((p) => p.stakeUnits));
  const profit = sum(picks.map((p) => p.profitUnits));
  const clvs = picks.map((p) => p.clv).filter((c): c is number => typeof c === 'number');

  let peak = 0;
  let running = 0;
  let maxDd = 0;
  for (const p of picks) {
    running += p.profitUnits;
    peak = Math.max(peak, running);
    maxDd = Math.max(maxDd, peak - running);
  }

  return {
    tipsterId,
    settled: picks.length,
    profitUnits: r(profit),
    roi: staked ? r(profit / staked, 4) : 0,
    adjustedRoi: r(profit / (staked + PRIOR_STAKE_UNITS), 4),
    avgClv: clvs.length ? r(sum(clvs) / clvs.length, 4) : undefined,
    maxDrawdownUnits: r(maxDd),
    ranked: picks.length >= MIN_SETTLED_PICKS,
    picksToRank: Math.max(0, MIN_SETTLED_PICKS - picks.length),
  };
}

export function rankTipsters(scores: TipsterScore[]): Array<TipsterScore & { rank: number }> {
  return scores
    .filter((s) => s.ranked)
    .sort((a, b) => b.adjustedRoi - a.adjustedRoi || (b.avgClv ?? -1) - (a.avgClv ?? -1))
    .map((s, i) => ({ ...s, rank: i + 1 }));
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const r = (n: number, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp;
