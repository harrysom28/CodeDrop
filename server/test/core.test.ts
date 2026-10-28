import { test } from 'node:test';
import assert from 'node:assert/strict';
import { commitHash, newSalt, slipKey, verifyCommit, type PickPayload } from '../src/core/commit.js';
import { lockedBeforeKickoff, settleSlip, slipClv } from '../src/core/settlement.js';
import { MIN_SETTLED_PICKS, rankTipsters, scoreTipster } from '../src/core/ranking.js';

const pick: PickPayload = {
  tipsterId: 't1',
  stakeUnits: 1,
  lockedAt: '2026-10-31T13:38:00.000Z',
  legs: [
    { eventId: 'e2', market: '1X2', selection: 'Home', odds: 1.48 },
    { eventId: 'e1', market: 'Over/Under 2.5', selection: 'Over', odds: 1.62 },
  ],
};

test('commit hash verifies and is independent of leg order', () => {
  const salt = newSalt();
  const h = commitHash(pick, salt);
  assert.ok(verifyCommit({ ...pick, legs: [...pick.legs].reverse() }, salt, h));
  assert.ok(!verifyCommit({ ...pick, stakeUnits: 2 }, salt, h));
  assert.ok(!verifyCommit(pick, newSalt(), h));
});

test('slipKey merges the same selections across codes and bookies', () => {
  const a = slipKey([{ eventId: 'E1', market: 'BTTS', selection: 'Yes' }, { eventId: 'E2', market: '1X2', selection: 'Home' }]);
  const b = slipKey([{ eventId: 'e2', market: '1x2', selection: 'home' }, { eventId: 'e1', market: 'btts', selection: 'yes' }]);
  assert.equal(a, b);
});

test('settlement: lost, pending, won, void legs', () => {
  assert.deepEqual(settleSlip([{ odds: 1.5, result: 'won' }, { odds: 2, result: 'lost' }], 1).result, 'lost');
  assert.equal(settleSlip([{ odds: 1.5, result: 'lost' }, { odds: 2 }], 2).profitUnits, -2);
  assert.equal(settleSlip([{ odds: 1.5, result: 'won' }, { odds: 2 }], 1).result, 'pending');
  assert.deepEqual(settleSlip([{ odds: 1.5, result: 'won' }, { odds: 2, result: 'won' }], 1), { result: 'won', odds: 3, profitUnits: 2 });
  assert.deepEqual(settleSlip([{ odds: 1.5, result: 'won' }, { odds: 2, result: 'void' }], 2), { result: 'won', odds: 1.5, profitUnits: 1 });
  assert.equal(settleSlip([{ odds: 1.5, result: 'void' }], 1).result, 'void');
});

test('CLV positive when posted price beats close', () => {
  assert.equal(slipClv([{ odds: 2.1, closingOdds: 1.9 }]), 0.1053);
  assert.equal(slipClv([{ odds: 2.1 }]), undefined);
});

test('pick must be locked before the first kickoff', () => {
  const legs = [{ kickoff: new Date('2026-10-31T16:00:00Z') }, { kickoff: new Date('2026-10-31T15:00:00Z') }];
  assert.ok(lockedBeforeKickoff(new Date('2026-10-31T14:59:00Z'), legs));
  assert.ok(!lockedBeforeKickoff(new Date('2026-10-31T15:00:00Z'), legs));
});

test('a lucky short run does not outrank a steady long record', () => {
  const lucky = scoreTipster('lucky', Array.from({ length: MIN_SETTLED_PICKS }, (_, i) => ({
    stakeUnits: 1, profitUnits: i < 13 ? 8 : -1, // +17% ROI over the bare minimum sample
  })));
  const steady = scoreTipster('steady', Array.from({ length: 400 }, (_, i) => ({
    stakeUnits: 1, profitUnits: i % 2 ? 1.2 : -1, clv: 0.03, // +10% ROI over 400 picks
  })));
  const fresh = scoreTipster('fresh', Array.from({ length: 12 }, () => ({ stakeUnits: 1, profitUnits: 9 })));

  assert.equal(fresh.ranked, false);
  assert.equal(fresh.picksToRank, MIN_SETTLED_PICKS - 12);
  const ranked = rankTipsters([lucky, steady, fresh]);
  assert.deepEqual(ranked.map((r) => r.tipsterId), ['steady', 'lucky']);
  assert.ok(lucky.roi > steady.roi, 'raw ROI favours the lucky run');
});

test('max drawdown tracks the worst peak-to-trough run', () => {
  const s = scoreTipster('t', [3, -1, -1, -1, 2, -4, 1].map((p) => ({ stakeUnits: 1, profitUnits: p })));
  assert.equal(s.maxDrawdownUnits, 5);
});
