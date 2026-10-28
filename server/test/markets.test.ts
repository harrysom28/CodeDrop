import { test } from 'node:test';
import assert from 'node:assert/strict';
import { settleMarket } from '../src/core/markets.js';

const ft = (home: number, away: number) => ({ home, away, finished: true });

test('1X2, double chance, DNB, BTTS, over/under', () => {
  assert.equal(settleMarket('1X2', 'Home', ft(2, 1)), 'won');
  assert.equal(settleMarket('1X2', 'Draw', ft(1, 1)), 'won');
  assert.equal(settleMarket('1X2', 'Away', ft(2, 1)), 'lost');

  assert.equal(settleMarket('Double Chance', '1X', ft(0, 0)), 'won');
  assert.equal(settleMarket('Double Chance', '12', ft(0, 0)), 'lost');
  assert.equal(settleMarket('Double Chance', 'X2', ft(0, 1)), 'won');

  assert.equal(settleMarket('Draw No Bet', 'Home', ft(1, 1)), 'void');
  assert.equal(settleMarket('Draw No Bet', 'Home', ft(2, 0)), 'won');

  assert.equal(settleMarket('BTTS', 'Yes', ft(1, 1)), 'won');
  assert.equal(settleMarket('GG/NG', 'No', ft(2, 0)), 'won');
  assert.equal(settleMarket('BTTS', 'Yes', ft(2, 0)), 'lost');

  assert.equal(settleMarket('Over/Under 2.5', 'Over 2.5', ft(2, 1)), 'won');
  assert.equal(settleMarket('Over/Under total=2.5', 'Under 2.5', ft(1, 0)), 'won');
  assert.equal(settleMarket('Over/Under 2.5', 'Over 2.5', ft(1, 1)), 'lost');
});

test('unknown markets stay pending for manual settlement', () => {
  assert.equal(settleMarket('Correct Score', '2-1', ft(2, 1)), 'pending');
  assert.equal(settleMarket('1X2', 'Home', { home: 0, away: 0, finished: false }), 'pending');
});
