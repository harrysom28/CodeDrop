import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summariseMonth } from '../src/services/bets.js';

test('month summary splits singles, long accas and copied with an insight', () => {
  const summary = summariseMonth('2026-10', [
    {
      legs: [{ odds: 2, result: 'won' }],
      stakeNaira: 1000,
      returnNaira: 2000,
      result: 'won',
      source: 'own',
    },
    {
      legs: [
        { odds: 1.5, result: 'lost' },
        { odds: 1.5, result: 'won' },
        { odds: 1.5, result: 'won' },
        { odds: 1.5, result: 'won' },
        { odds: 1.5, result: 'won' },
      ],
      stakeNaira: 5000,
      result: 'lost',
      source: 'own',
    },
    {
      legs: [{ odds: 1.8, result: 'lost' }],
      stakeNaira: 2000,
      result: 'lost',
      source: 'copied',
    },
  ]);

  assert.equal(summary.month, '2026-10');
  assert.equal(summary.singlesPlNaira, 1000 - 2000);
  assert.equal(summary.longAccasPlNaira, -5000);
  assert.equal(summary.copiedPlNaira, -2000);
  assert.equal(summary.totalPlNaira, 1000 - 5000 - 2000);
  assert.match(summary.insight, /long accas/i);
});
