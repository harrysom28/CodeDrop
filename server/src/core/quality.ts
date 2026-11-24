/**
 * Feed quality: decides ORDER and LABELS, never hides a slip on its own.
 *
 * Early on we have few settled results, so every rule here is deliberately lenient:
 * - unknown sources start at a neutral prior instead of being filtered out
 * - "proven" needs only a modest sample and a hit rate a bit above the prior
 * - the Consistent tab relaxes its own rules when too few slips qualify, so it is never empty
 *
 * Tune the numbers in QUALITY as real data comes in.
 */

export const QUALITY = {
  /** Settled codes/picks before a source can be called proven. */
  minTracked: 15,
  /** Shrunk hit rate needed for "proven" (or any positive profit over the sample). */
  provenHitRate: 0.4,
  /** Every source is treated as if it already had PRIOR_N results at PRIOR_HIT. */
  priorN: 10,
  priorHit: 0.3,
  /** Short, low-odds slips: the "wins often, pays small" tab. */
  consistent: { maxLegs: 4, minLegOdds: 1.15, maxLegOdds: 2.1, maxTotalOdds: 6 },
  /** Looser rules used when the strict ones leave the tab thin. */
  consistentRelaxed: { maxLegs: 5, minLegOdds: 1.05, maxLegOdds: 2.6, maxTotalOdds: 10 },
  /** Below this many strict matches, the Consistent tab relaxes. */
  consistentMinItems: 10,
} as const;

export interface SourceStats {
  settled: number;
  won: number;
  profitUnits: number;
}

export type SourceTier = 'proven' | 'tracking' | 'new';

export interface QualityInfo {
  tier: SourceTier;
  /** Raw hit rate over settled results, null when nothing has settled. */
  hitRate: number | null;
  tracked: number;
  /** Implied win chance from the total odds, 0–1. */
  chance: number;
  consistent: boolean;
  /** One line for the card, e.g. "Proven · 58% of 42 won". */
  label: string;
  score: number;
}

export function shrunkHitRate(s: SourceStats | undefined): number {
  const settled = s?.settled ?? 0;
  const won = s?.won ?? 0;
  return (won + QUALITY.priorHit * QUALITY.priorN) / (settled + QUALITY.priorN);
}

export function sourceTier(s: SourceStats | undefined): SourceTier {
  if (!s || s.settled === 0) return 'new';
  if (s.settled >= QUALITY.minTracked && (shrunkHitRate(s) >= QUALITY.provenHitRate || s.profitUnits > 0)) {
    return 'proven';
  }
  return 'tracking';
}

export function impliedChance(totalOdds: number): number {
  if (!Number.isFinite(totalOdds) || totalOdds <= 1) return 1;
  return Math.round((1 / totalOdds) * 1000) / 1000;
}

type Rules = { maxLegs: number; minLegOdds: number; maxLegOdds: number; maxTotalOdds: number };

export function isConsistent(legs: Array<{ odds: number }>, totalOdds: number, rules: Rules = QUALITY.consistent): boolean {
  if (legs.length === 0 || legs.length > rules.maxLegs) return false;
  if (totalOdds > rules.maxTotalOdds) return false;
  return legs.every((l) => l.odds >= rules.minLegOdds && l.odds <= rules.maxLegOdds);
}

export function chanceText(chance: number): string {
  const pct = chance * 100;
  if (pct < 1) return 'under 1% chance';
  return `about ${pct < 10 ? pct.toFixed(1) : Math.round(pct)}% chance`;
}

export function sourceLabel(s: SourceStats | undefined, noun: 'codes' | 'picks'): string {
  const tier = sourceTier(s);
  if (tier === 'new' || !s) return 'New source · no results yet';
  const pct = Math.round((s.won / s.settled) * 100);
  const head = tier === 'proven' ? 'Proven' : 'Tracking';
  return `${head} · ${pct}% of ${s.settled} ${noun} won`;
}

/**
 * Ranking score, higher first. Source quality dominates, then how likely the slip is to win,
 * then freshness. A new source sits at the prior, so it ranks above a source with a bad record.
 */
export function qualityScore(input: { source?: SourceStats; chance: number; postedAt: Date; now: Date }): number {
  const q = shrunkHitRate(input.source);
  const tierBoost = sourceTier(input.source) === 'proven' ? 0.15 : 0;
  const ageHours = Math.max(0, (input.now.getTime() - input.postedAt.getTime()) / 3600_000);
  const fresh = Math.max(0, 1 - ageHours / 12);
  return Math.round((0.6 * q + tierBoost + 0.3 * input.chance + 0.1 * fresh) * 10_000) / 10_000;
}

export interface FeedCandidate<T> {
  item: T;
  kind: 'pick' | 'spotted';
  legs: Array<{ odds: number }>;
  totalOdds: number;
  postedAt: Date;
  source?: SourceStats;
  /** Legs hidden from this viewer (VIP): never offered in the Consistent tab. */
  hidden?: boolean;
}

export function annotate<T>(c: FeedCandidate<T>, now: Date): T & { kind: 'pick' | 'spotted'; quality: QualityInfo } {
  const chance = impliedChance(c.totalOdds);
  const s = c.source;
  return {
    ...c.item,
    kind: c.kind,
    quality: {
      tier: sourceTier(s),
      hitRate: s && s.settled ? Math.round((s.won / s.settled) * 1000) / 1000 : null,
      tracked: s?.settled ?? 0,
      chance,
      consistent: !c.hidden && isConsistent(c.legs, c.totalOdds),
      label: sourceLabel(s, c.kind === 'pick' ? 'picks' : 'codes'),
      score: qualityScore({ source: s, chance, postedAt: c.postedAt, now }),
    },
  };
}

/** Everything, best first. Nothing is dropped. */
export function rankFeed<T>(cands: FeedCandidate<T>[], now: Date, limit = 50) {
  return cands
    .map((c) => annotate(c, now))
    .sort((a, b) => b.quality.score - a.quality.score)
    .slice(0, limit);
}

/**
 * The Consistent tab: strict rules first; if that leaves fewer than consistentMinItems,
 * add slips matching the relaxed rules; if still thin, top up with the highest-chance slips left.
 * `relaxed` tells the app to show a note.
 */
export function consistentFeed<T>(cands: FeedCandidate<T>[], now: Date, limit = 50) {
  const visible = cands.filter((c) => !c.hidden);
  const strict = visible.filter((c) => isConsistent(c.legs, c.totalOdds));
  let picked = strict;
  let relaxed = false;

  if (picked.length < QUALITY.consistentMinItems) {
    relaxed = true;
    const loose = visible.filter((c) => !strict.includes(c) && isConsistent(c.legs, c.totalOdds, QUALITY.consistentRelaxed));
    picked = [...strict, ...loose];
  }
  if (picked.length < QUALITY.consistentMinItems) {
    const rest = visible
      .filter((c) => !picked.includes(c))
      .sort((a, b) => impliedChance(b.totalOdds) - impliedChance(a.totalOdds))
      .slice(0, QUALITY.consistentMinItems - picked.length);
    picked = [...picked, ...rest];
  }

  const rank = (c: FeedCandidate<T>) => (strict.includes(c) ? 2 : isConsistent(c.legs, c.totalOdds, QUALITY.consistentRelaxed) ? 1 : 0);
  const items = picked
    .map((c) => ({ c, a: annotate(c, now) }))
    .sort((x, y) => rank(y.c) - rank(x.c) || y.a.quality.score - x.a.quality.score)
    .slice(0, limit)
    .map((x) => x.a);
  return { items, relaxed };
}
