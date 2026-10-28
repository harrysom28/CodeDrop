import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { setAuthModeForTests } from '../src/config.js';
import { createApp } from '../src/app.js';
import { memoryCache, ResolverRegistry } from '../src/core/bookies/registry.js';
import { User } from '../src/models/index.js';
import { setTokenVerifier } from '../src/services/firebaseAuth.js';
import { upsertFirebaseUser, presentUser } from '../src/services/users.js';
import { clearCollections, startTestMongo, stopTestMongo } from './helpers/mongo.js';

before(async () => {
  await startTestMongo();
});

after(async () => {
  setTokenVerifier(undefined);
  setAuthModeForTests(undefined);
  await stopTestMongo();
});

beforeEach(async () => {
  await clearCollections();
  setTokenVerifier(undefined);
  setAuthModeForTests(undefined);
});

function appServer() {
  const registry = new ResolverRegistry([], memoryCache(), { minIntervalMs: 0 });
  return createApp({ registry }).listen(0);
}

async function withServer(fn: (base: string) => Promise<void>) {
  const server = appServer();
  try {
    await fn(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
  } finally {
    server.close();
  }
}

test('GET /me requires auth', () =>
  withServer(async (base) => {
    assert.equal((await fetch(`${base}/me`)).status, 401);
  }));

test('dev auth: onboarding, get me, patch handle', () =>
  withServer(async (base) => {
    const user = await User.create({ phone: '+2348011111111' });
    const headers = { 'content-type': 'application/json', 'x-user-id': user.id };

    const badAge = await fetch(`${base}/me/onboarding`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ over18Confirmed: false, mainBookie: 'sportybet' }),
    });
    assert.equal(badAge.status, 400);

    const onboard = await fetch(`${base}/me/onboarding`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        over18Confirmed: true,
        favouriteClubs: ['Enyimba'],
        mainBookie: 'sportybet',
        unitNaira: 2000,
      }),
    });
    assert.equal(onboard.status, 200);
    const onboarded = (await onboard.json()) as { over18Confirmed: boolean; unitNaira: number; onboardedAt: string };
    assert.equal(onboarded.over18Confirmed, true);
    assert.equal(onboarded.unitNaira, 2000);
    assert.ok(onboarded.onboardedAt);

    const me = await fetch(`${base}/me`, { headers: { 'x-user-id': user.id } });
    assert.equal(me.status, 200);
    assert.equal(((await me.json()) as { mainBookie: string }).mainBookie, 'sportybet');

    const badHandle = await fetch(`${base}/me`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ handle: 'AB' }),
    });
    assert.equal(badHandle.status, 400);

    const patch = await fetch(`${base}/me`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ handle: 'Tip_King', displayName: 'Tip King' }),
    });
    assert.equal(patch.status, 200);
    const patched = (await patch.json()) as { handle: string; displayName: string };
    assert.equal(patched.handle, 'tip_king');
    assert.equal(patched.displayName, 'Tip King');

    const other = await User.create({ phone: '+2348022222222' });
    const clash = await fetch(`${base}/me`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'x-user-id': other.id },
      body: JSON.stringify({ handle: 'tip_king' }),
    });
    assert.equal(clash.status, 409);
  }));

test('upsertFirebaseUser is idempotent and links by phone', async () => {
  const id = await upsertFirebaseUser({ firebaseUid: 'fb_abc', phone: '+2348033333333' });
  const again = await upsertFirebaseUser({ firebaseUid: 'fb_abc', phone: '+2348033333333' });
  assert.equal(id.toString(), again.toString());
  const user = await User.findById(id).lean();
  assert.ok(user);
  assert.equal(presentUser(user!).phone, '+2348033333333');

  await User.deleteMany({});
  const prior = await User.create({ phone: '+2348044444444' });
  const linked = await upsertFirebaseUser({ firebaseUid: 'fb_link', phone: '+2348044444444' });
  assert.equal(linked.toString(), prior.id);
  assert.equal((await User.findById(prior.id))?.firebaseUid, 'fb_link');
});

test('firebase auth: Bearer token upserts user and serves /me', () =>
  withServer(async (base) => {
    setAuthModeForTests('firebase');
    setTokenVerifier(async (token) => {
      if (token !== 'good-token') throw new Error('bad');
      return { firebaseUid: 'fb_http', phone: '+2348055555555' };
    });

    assert.equal((await fetch(`${base}/me`, { headers: { authorization: 'Bearer bad' } })).status, 401);

    const me = await fetch(`${base}/me`, { headers: { authorization: 'Bearer good-token' } });
    assert.equal(me.status, 200);
    const body = (await me.json()) as { phone: string; id: string };
    assert.equal(body.phone, '+2348055555555');
    assert.equal(await User.countDocuments({ firebaseUid: 'fb_http' }), 1);
  }));
