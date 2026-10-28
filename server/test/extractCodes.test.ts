import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractCodes } from '../src/core/extractCodes.js';

test('finds a SportyBet code with emojis and odds noise', () => {
  const r = extractCodes('🔥🔥 SPORTY CODE: 3F8KQ2 🔥 28 odds\nKick off 18:30. Play responsibly');
  assert.deepEqual(r, [{ code: '3F8KQ2', bookie: 'sportybet' }]);
});

test('assigns bookie per line when a post has several', () => {
  const r = extractCodes('Sportybet ➡️ B7K2QX\nBet9ja ➡️ 9J4X7TQ\nBetking: BK2291A');
  assert.deepEqual(r, [
    { code: 'B7K2QX', bookie: 'sportybet' },
    { code: '9J4X7TQ', bookie: 'bet9ja' },
    { code: 'BK2291A', bookie: 'betking' },
  ]);
});

test('uses the post-level bookie when the code line has none', () => {
  const r = extractCodes('TODAY SPORTYBET SURE 5 ODDS\n\n👉 7QW1MZ 👈');
  assert.deepEqual(r, [{ code: '7QW1MZ', bookie: 'sportybet' }]);
});

test('unknown bookie when nothing says which', () => {
  assert.deepEqual(extractCodes('code: 4HZ8PL'), [{ code: '4HZ8PL', bookie: 'unknown' }]);
});

test('ignores ordinary words, market jargon, odds, times and phone numbers', () => {
  const text = 'Over 2.5 and BTTS at 18:30, 1X2 H2H U21 5ODDS today. Call 08031234567. Arsenal Brighton';
  assert.deepEqual(extractCodes(text), []);
});

test('pure digit codes only count next to the word code', () => {
  assert.deepEqual(extractCodes('booking code 2245871'), [{ code: '2245871', bookie: 'unknown' }]);
  assert.deepEqual(extractCodes('we won 2245871 naira'), []);
});

test('deduplicates repeated codes', () => {
  assert.equal(extractCodes('Sporty 3F8KQ2\nagain 3F8KQ2').length, 1);
});
