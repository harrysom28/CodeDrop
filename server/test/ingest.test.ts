import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSportyBetShare, sportyBetResolver } from '../src/core/bookies/sportybet.js';
import { memoryCache, ResolverRegistry } from '../src/core/bookies/registry.js';
import { CodeNotFoundError, ResolverUnavailableError, type CodeResolver } from '../src/core/bookies/types.js';
import { ingestPost, memorySpottedStore } from '../src/services/ingest.js';
import type { Slip } from '../src/core/types.js';

const KO = Date.parse('2026-10-31T15:00:00Z');

const sportyBody = {
  bizCode: 10000,
  data: {
    outcomes: [
      {
        eventId: 'sr:match:1',
        homeTeamName: 'Arsenal',
        awayTeamName: 'Brighton',
        estimateStartTime: KO,
        sport: { category: { tournament: { name: 'Premier League' } } },
        markets: [{ desc: 'Over/Under', specifier: 'total=2.5', outcomes: [{ desc: 'Over 2.5', odds: '1.62' }] }],
      },
      {
        eventId: 'sr:match:2',
        homeTeamName: 'Liverpool',
        awayTeamName: 'Fulham',
        estimateStartTime: KO + 3600_000,
        markets: [{ desc: '1X2', outcomes: [{ desc: 'Home', odds: 1.48 }] }],
      },
    ],
  },
};

test('parses a SportyBet share response into a normalised slip', () => {
  const slip = parseSportyBetShare('3F8KQ2', sportyBody);
  assert.equal(slip.legs.length, 2);
  assert.deepEqual(slip.legs[0], {
    eventId: 'sporty:sr:match:1',
    homeTeam: 'Arsenal',
    awayTeam: 'Brighton',
    league: 'Premier League',
    market: 'Over/Under total=2.5',
    selection: 'Over 2.5',
    odds: 1.62,
    kickoff: new Date(KO),
  });
});

test('empty SportyBet response is a not-found, odd shapes are resolver errors', () => {
  assert.throws(() => parseSportyBetShare('X', { data: { outcomes: [] } }), CodeNotFoundError);
  assert.throws(() => parseSportyBetShare('X', { data: { outcomes: [{ nope: 1 }] } }), ResolverUnavailableError);
});

test('registry caches lookups and rate-limits per bookie', async () => {
  let calls = 0;
  const slept: number[] = [];
  let clock = 0;
  const fetchFn = async () => {
    calls++;
    return { ok: true, status: 200, json: async () => sportyBody };
  };
  const reg = new ResolverRegistry([sportyBetResolver(fetchFn)], memoryCache(), {
    minIntervalMs: 1000,
    now: () => clock,
    sleep: async (ms) => {
      slept.push(ms);
      clock += ms;
    },
  });
  await Promise.all([reg.resolve('AAA111', 'sportybet'), reg.resolve('BBB222', 'sportybet')]);
  await reg.resolve('AAA111', 'sportybet');
  assert.equal(calls, 2, 'third call served from cache');
  assert.deepEqual(slept, [1000], 'second request waited for the interval');
});

test('unknown bookie tries each resolver and skips one that is down', async () => {
  const down: CodeResolver = { bookie: 'bet9ja', resolve: async () => { throw new ResolverUnavailableError('bet9ja', 'HTTP 503'); } };
  const up: CodeResolver = { bookie: 'sportybet', resolve: async (code) => parseSportyBetShare(code, sportyBody) };
  const reg = new ResolverRegistry([down, up], memoryCache(), { minIntervalMs: 0 });
  const slip = await reg.resolve('3F8KQ2', 'unknown');
  assert.equal(slip?.bookie, 'sportybet');
});

function fakeResolver(slips: Record<string, Slip>) {
  return { resolve: async (code: string) => slips[code] ?? null };
}

test('ingest: new slip, duplicate from another channel, late post, missing code', async () => {
  const slip = parseSportyBetShare('3F8KQ2', sportyBody);
  const sameSlipOtherCode = { ...slip, code: 'ZZ9ZZ9' };
  const store = memorySpottedStore();
  const deps = { resolver: fakeResolver({ '3F8KQ2': slip, ZZ9ZZ9: sameSlipOtherCode }), store };
  const base = { source: 'telegram' as const, messageId: '1', postedAt: new Date(KO - 3600_000) };

  const a = await ingestPost({ ...base, channel: '@surewin_daily', text: 'SPORTY CODE 3F8KQ2' }, deps);
  assert.equal(a[0]?.status, 'new');

  const b = await ingestPost({ ...base, channel: '@oddsking', postedAt: new Date(KO - 600_000), text: 'sporty ZZ9ZZ9 + code NOPE99' }, deps);
  assert.deepEqual(b.map((x) => x.status), ['duplicate', 'not_found']);

  const c = await ingestPost({ ...base, channel: '@latecomer', postedAt: new Date(KO + 60_000), text: 'sporty 3F8KQ2' }, deps);
  assert.equal(c[0]?.status, 'late');

  const [rec] = store.all();
  assert.equal(store.all().length, 1);
  assert.equal(rec?.firstSighting.channel, '@surewin_daily', 'first poster gets the credit');
  assert.deepEqual(rec?.sightings.map((s) => s.channel), ['@surewin_daily', '@oddsking']);
  assert.equal(rec?.totalOdds, 2.4);
});
