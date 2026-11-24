import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  QUALITY,
  chanceText,
  consistentFeed,
  impliedChance,
  isConsistent,
  rankFeed,
  sourceLabel,
  sourceTier,
  type FeedCandidate,
} from '../src/core/quality.js';

const now = new Date('2026-11-28T12:00:00Z');
const hourAgo = new Date(now.getTime() - 3600_000);

function cand(id: string, odds: number[], extra: Partial<FeedCandidate<{ id: string }>> = {}): FeedCandidate<{ id: string }> {
  return {
    item: { id },
    kind: 'spotted',
    legs: odds.map((o) => ({ odds: o })),
    totalOdds: Math.round(odds.reduce((a, b) => a * b, 1) * 100) / 100,
    postedAt: hourAgo,
    ...extra,
  };
}

test('tiers: new, tracking, proven, and proven by profit despite a low hit rate', () => {
  assert.equal(sourceTier(undefined), 'new');
  assert.equal(sourceTier({ settled: 8, won: 7, profitUnits: 5 }), 'tracking', 'too few results to be proven');
  assert.equal(sourceTier({ settled: 40, won: 22, profitUnits: -3 }), 'proven');
  assert.equal(sourceTier({ settled: 40, won: 6, profitUnits: 12 }), 'proven', 'long-odds tipster who actually profits');
  assert.equal(sourceTier({ settled: 40, won: 8, profitUnits: -20 }), 'tracking');
});

test('implied chance and its wording', () => {
  assert.equal(impliedChance(1.6), 0.625);
  assert.equal(impliedChance(28.4), 0.035);
  assert.equal(chanceText(0.625), 'about 63% chance');
  assert.equal(chanceText(0.035), 'about 3.5% chance');
  assert.equal(chanceText(0.004), 'under 1% chance');
});

test('labels are honest about sample size', () => {
  assert.equal(sourceLabel(undefined, 'codes'), 'New source · no results yet');
  assert.equal(sourceLabel({ settled: 42, won: 24, profitUnits: 3 }, 'codes'), 'Proven · 57% of 42 codes won');
  assert.equal(sourceLabel({ settled: 5, won: 1, profitUnits: -3 }, 'picks'), 'Tracking · 20% of 5 picks won');
});

test('consistent rule: short, low-odds slips only', () => {
  assert.ok(isConsistent([{ odds: 1.4 }, { odds: 1.6 }], 2.24));
  assert.ok(!isConsistent([{ odds: 1.4 }, { odds: 3.1 }], 4.34), 'one long leg');
  assert.ok(!isConsistent(Array.from({ length: 6 }, () => ({ odds: 1.3 })), 4.83), 'too many legs');
  assert.ok(!isConsistent([], 1));
});

test('rankFeed keeps everything and puts a proven source above a poor one', () => {
  const proven = cand('proven', [1.8, 2.0], { source: { settled: 50, won: 28, profitUnits: 6 } });
  const poor = cand('poor', [1.8, 2.0], { source: { settled: 50, won: 5, profitUnits: -30 } });
  const fresh = cand('new', [1.8, 2.0]);
  const out = rankFeed([poor, fresh, proven], now);
  assert.deepEqual(out.map((x) => x.id), ['proven', 'new', 'poor']);
  assert.equal(out.length, 3, 'nothing dropped');
  assert.equal(out[0]?.quality.tier, 'proven');
});

test('higher-chance slips rank above lottery accas from equal sources', () => {
  const single = cand('single', [1.5]);
  const acca = cand('acca', [2, 2, 2, 2, 2]);
  assert.deepEqual(rankFeed([acca, single], now).map((x) => x.id), ['single', 'acca']);
});

test('consistent tab relaxes instead of going empty, and flags it', () => {
  const strict = cand('strict', [1.3, 1.5]);
  const loose = cand('loose', [1.5, 2.4]); // a 2.4 leg fails strict, passes relaxed
  const longshot = cand('longshot', [3, 4, 5]);
  const out = consistentFeed([longshot, loose, strict], now);
  assert.equal(out.relaxed, true);
  assert.deepEqual(out.items.map((x) => x.id), ['strict', 'loose', 'longshot'], 'strict, then relaxed, then best of the rest');
});

test('consistent tab is strict when there are enough matches, and never shows hidden VIP picks', () => {
  const many = Array.from({ length: QUALITY.consistentMinItems }, (_, i) => cand(`s${i}`, [1.3, 1.4]));
  const vip = cand('vip', [1.2], { kind: 'pick', hidden: true });
  const out = consistentFeed([...many, vip, cand('acca', [3, 3, 3])], now);
  assert.equal(out.relaxed, false);
  assert.equal(out.items.length, QUALITY.consistentMinItems);
  assert.ok(!out.items.some((x) => x.id === 'vip' || x.id === 'acca'));
});
