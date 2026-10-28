import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterRoomMessage, slowModeBlocked } from '../src/core/moderation.js';

test('word filter blocks sure odds, fixed, phones and external links', () => {
  assert.equal(filterRoomMessage('Nice pick').ok, true);
  assert.equal(filterRoomMessage('sure odds today').ok, false);
  assert.equal(filterRoomMessage('fixed match 100%').ok, false);
  assert.equal(filterRoomMessage('chat me on t.me/foo').ok, false);
  assert.equal(filterRoomMessage('call 08012345678 now').ok, false);
  assert.equal(filterRoomMessage('x'.repeat(501)).ok, false);
});

test('slow mode enforces gap', () => {
  const now = new Date('2026-10-28T12:00:05Z');
  assert.equal(slowModeBlocked(new Date('2026-10-28T12:00:01Z'), now, 5000), true);
  assert.equal(slowModeBlocked(new Date('2026-10-28T11:59:59Z'), now, 5000), false);
});
