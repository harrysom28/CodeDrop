import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  allowTipsterPush,
  inQuietHours,
  resetTipsterPushRateLimit,
  DEFAULT_PUSH_PREFS,
} from '../src/services/notifications.js';

test('quiet hours default 1am–7am Lagos', () => {
  const prefs = { ...DEFAULT_PUSH_PREFS };
  // 03:00 Lagos is quiet; 12:00 Lagos is not.
  assert.equal(inQuietHours(prefs, new Date('2026-10-28T02:00:00Z')), true); // 03:00 WAT
  assert.equal(inQuietHours(prefs, new Date('2026-10-28T11:00:00Z')), false); // 12:00 WAT
});

test('tipster push rate limit is one per 10 minutes per user', () => {
  resetTipsterPushRateLimit();
  const t0 = 1_000_000;
  assert.equal(allowTipsterPush('u1', 't1', t0), true);
  assert.equal(allowTipsterPush('u1', 't1', t0 + 60_000), false);
  assert.equal(allowTipsterPush('u1', 't2', t0 + 60_000), true);
  assert.equal(allowTipsterPush('u1', 't1', t0 + 10 * 60_000), true);
});
