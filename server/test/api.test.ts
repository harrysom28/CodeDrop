import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.js';
import { memoryCache, ResolverRegistry } from '../src/core/bookies/registry.js';
import { parseSportyBetShare } from '../src/core/bookies/sportybet.js';
import { buildLockedPick, PickRejected, presentPick } from '../src/services/picks.js';
import { verifyCommit } from '../src/core/commit.js';
import type { Leg } from '../src/core/types.js';

const future = Date.now() + 3 * 3600_000;
const body = {
  data: {
    outcomes: [
      {
        eventId: 'sr:match:9',
        homeTeamName: 'Chelsea',
        awayTeamName: 'Spurs',
        estimateStartTime: future,
        markets: [{ desc: 'GG/NG', outcomes: [{ desc: 'Yes', odds: '1.70' }] }],
      },
    ],
  },
};

async function withServer(fn: (base: string) => Promise<void>) {
  const registry = new ResolverRegistry(
    [{ bookie: 'sportybet', resolve: async (code) => parseSportyBetShare(code, code === 'GOOD01' ? body : { data: { outcomes: [] } }) }],
    memoryCache(),
    { minIntervalMs: 0 },
  );
  const server = createApp({ registry }).listen(0);
  try {
    await fn(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
  } finally {
    server.close();
  }
}

test('health lists supported bookies', () =>
  withServer(async (base) => {
    const r = await fetch(`${base}/health`);
    const body = (await r.json()) as { ok: boolean; bookies: string[] };
    assert.equal(body.ok, true);
    assert.deepEqual(body.bookies, ['sportybet']);
  }));

test('preview resolves a code, 404s a dead one, 400s an unknown bookie', () =>
  withServer(async (base) => {
    const ok = await fetch(`${base}/picks/preview/sportybet/good01`);
    assert.equal(ok.status, 200);
    assert.equal(((await ok.json()) as { legs: unknown[] }).legs.length, 1);
    assert.equal((await fetch(`${base}/picks/preview/sportybet/DEAD99`)).status, 404);
    assert.equal((await fetch(`${base}/picks/preview/notabookie/GOOD01`)).status, 400);
  }));

test('locking a pick requires a signed-in user', () =>
  withServer(async (base) => {
    const r = await fetch(`${base}/picks`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    assert.equal(r.status, 401);
  }));

const leg = (kickoff: number): Leg => ({
  eventId: 'e1', homeTeam: 'A', awayTeam: 'B', market: '1X2', selection: 'Home', odds: 2, kickoff: new Date(kickoff),
});

test('buildLockedPick rejects started games and produces a verifiable commit', () => {
  assert.throws(() => buildLockedPick({ tipsterId: 't', legs: [leg(Date.now() - 1000)], stakeUnits: 1 }), PickRejected);
  const now = new Date();
  const locked = buildLockedPick({ tipsterId: 't', legs: [leg(future)], stakeUnits: 1, now });
  assert.ok(
    verifyCommit(
      { tipsterId: 't', stakeUnits: 1, lockedAt: now.toISOString(), legs: [{ eventId: 'e1', market: '1X2', selection: 'Home', odds: 2 }] },
      locked.salt,
      locked.commitHash,
    ),
  );
});

test('VIP picks hide content and salt until settled', () => {
  const base = { _id: '1', tipsterId: 't', visibility: 'vip', legs: [{}], note: 'why', commitHash: 'h', salt: 's' };
  const hidden = presentPick({ ...base, result: 'pending' }, { isOwner: false, isSubscriber: false });
  assert.deepEqual([hidden.legs, hidden.note, hidden.salt, hidden.locked], [[], undefined, undefined, true]);
  const owner = presentPick({ ...base, result: 'pending' }, { isOwner: true, isSubscriber: false });
  assert.equal(owner.legs.length, 1);
  assert.equal(owner.salt, undefined, 'salt never shown before settlement, even to the owner');
  const settled = presentPick({ ...base, result: 'won' }, { isOwner: false, isSubscriber: false });
  assert.equal(settled.salt, 's');
});
