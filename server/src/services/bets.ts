import type { Bookie, Leg, SlipResult } from '../core/types.js';
import { settleSlip } from '../core/settlement.js';

export type BetSource = 'copied' | 'own' | 'imported';

export interface BetSummaryInput {
  legs: Array<Pick<Leg, 'odds' | 'result'>>;
  stakeNaira: number;
  returnNaira?: number | null;
  result: SlipResult;
  source: BetSource;
}

export interface MonthSummary {
  month: string;
  totalPlNaira: number;
  singlesPlNaira: number;
  longAccasPlNaira: number;
  copiedPlNaira: number;
  insight: string;
}

function plNaira(b: BetSummaryInput): number {
  if (b.result === 'pending' || b.result === 'void') return 0;
  if (typeof b.returnNaira === 'number') return b.returnNaira - b.stakeNaira;
  if (b.result === 'lost') return -b.stakeNaira;
  const odds = settleSlip(b.legs, 1).odds;
  return Math.round(b.stakeNaira * (odds - 1) * 100) / 100;
}

export function summariseMonth(month: string, bets: BetSummaryInput[]): MonthSummary {
  let total = 0;
  let singles = 0;
  let longAccas = 0;
  let copied = 0;

  for (const b of bets) {
    if (b.result === 'pending') continue;
    const pl = plNaira(b);
    total += pl;
    const liveLegs = b.legs.filter((l) => l.result !== 'void').length;
    if (liveLegs <= 1) singles += pl;
    if (liveLegs >= 5) longAccas += pl;
    if (b.source === 'copied') copied += pl;
  }

  const r = (n: number) => Math.round(n * 100) / 100;
  return {
    month,
    totalPlNaira: r(total),
    singlesPlNaira: r(singles),
    longAccasPlNaira: r(longAccas),
    copiedPlNaira: r(copied),
    insight: insightLine({ singles: r(singles), longAccas: r(longAccas), copied: r(copied), total: r(total) }),
  };
}

function insightLine(p: { singles: number; longAccas: number; copied: number; total: number }): string {
  const fmt = (n: number) => `₦${Math.abs(Math.round(n)).toLocaleString('en-NG')}`;
  // Prefer the largest absolute drag when explaining a losing month.
  if (p.longAccas <= p.copied && p.longAccas < -1000) {
    return p.singles > 0
      ? `Your long accas cost you ${fmt(p.longAccas)} this month. Your singles are profitable.`
      : `Your long accas cost you ${fmt(p.longAccas)} this month.`;
  }
  if (p.copied < -1000) {
    return `Copied tips cost you ${fmt(p.copied)} this month. Your own singles held up better.`;
  }
  if (p.total > 0) {
    return `You're up ${fmt(p.total)} this month. Keep stakes sized to your unit.`;
  }
  if (p.total < 0) {
    return `You're down ${fmt(p.total)} this month. Review open limits if the run feels heavy.`;
  }
  return 'No settled bets in this month yet.';
}

export function computeBetReturn(legs: Array<Pick<Leg, 'odds' | 'result'>>, stakeNaira: number, result: SlipResult): number {
  if (result === 'pending') return 0;
  if (result === 'lost') return 0;
  if (result === 'void') return stakeNaira;
  const odds = settleSlip(legs, 1).odds;
  return Math.round(stakeNaira * odds * 100) / 100;
}

export type { Bookie };
