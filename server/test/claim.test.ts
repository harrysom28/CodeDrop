import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Channel, User } from '../src/models/index.js';
import {
  claimVerifyLine,
  completeClaim,
  extractClaimToken,
  startChannelClaim,
} from '../src/services/claim.js';
import { clearCollections, startTestMongo, stopTestMongo } from './helpers/mongo.js';

before(async () => {
  await startTestMongo('claim');
});
after(async () => {
  await stopTestMongo();
});
beforeEach(async () => {
  await clearCollections();
});

test('extractClaimToken finds the verify line', () => {
  assert.equal(extractClaimToken('hello\ncodedrop-verify K7Q2\n'), 'K7Q2');
  assert.equal(extractClaimToken('nope'), undefined);
});

test('claim start issues a one-time token and completeClaim links the user', async () => {
  const user = await User.create({ phone: '+2348012345678', handle: 'claimer' });
  await Channel.create({ source: 'telegram', username: 'besttipsng', enabled: true });

  const started = await startChannelClaim('besttipsng', user._id);
  assert.match(started.verifyLine, /^codedrop-verify [A-Z0-9]{4}$/);
  assert.equal(started.verifyLine, claimVerifyLine(started.token));

  const pending = await Channel.findOne({ username: 'besttipsng' }).lean();
  assert.equal(pending?.claimToken, started.token);
  assert.equal(pending?.claimRequestedBy?.toString(), user.id);

  const done = await completeClaim('besttipsng', `Please verify\n${started.verifyLine}`);
  assert.equal(done.claimed, true);
  assert.equal(done.userId?.toString(), user.id);

  const claimed = await Channel.findOne({ username: 'besttipsng' }).lean();
  assert.equal(claimed?.claimedBy?.toString(), user.id);
  assert.equal(claimed?.claimToken, undefined);
});
