import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoryCache, ResolverRegistry } from '../src/core/bookies/registry.js';
import { parseSportyBetShare } from '../src/core/bookies/sportybet.js';
import { convertCode } from '../src/services/convert.js';
import { HttpError } from '../src/errors.js';

const KO = Date.parse('2026-10-31T15:00:00Z');
const body = {
  data: {
    outcomes: [
      {
        eventId: '1',
        homeTeamName: 'Arsenal',
        awayTeamName: 'Brighton',
        estimateStartTime: KO,
        markets: [{ desc: '1X2', outcomes: [{ desc: 'Home', odds: '1.55' }] }],
      },
      {
        eventId: '2',
        homeTeamName: 'Enyimba FC',
        awayTeamName: 'Remo Stars',
        estimateStartTime: KO + 3600_000,
        markets: [{ desc: 'BTTS', outcomes: [{ desc: 'Yes', odds: '1.80' }] }],
      },
    ],
  },
};

function registry() {
  return new ResolverRegistry(
    [{ bookie: 'sportybet', resolve: async (code) => parseSportyBetShare(code, body) }],
    memoryCache(),
    { minIntervalMs: 0 },
  );
}

test('convert reports per-leg availability against a target catalogue', async () => {
  const result = await convertCode(
    { code: 'ABC123', from: 'sportybet', to: 'bet9ja' },
    {
      registry: registry(),
      targetCatalogue: [
        {
          homeTeam: 'Arsenal',
          awayTeam: 'Brighton',
          market: '1X2',
          selection: 'Home',
          odds: 1.5,
          kickoff: new Date(KO),
        },
        // second leg missing on bet9ja
      ],
    },
  );
  assert.equal(result.legsTotal, 2);
  assert.equal(result.legsAvailable, 1);
  assert.equal(result.legs[0]?.available, true);
  assert.equal(result.legs[1]?.available, false);
  assert.equal(result.convertedCode, undefined);
  assert.match(result.note, /1 of 2/);
});

test('convert rejects same bookie and missing codes', async () => {
  await assert.rejects(() => convertCode({ code: 'X', from: 'sportybet', to: 'sportybet' }, { registry: registry() }), HttpError);
  const empty = new ResolverRegistry(
    [{ bookie: 'sportybet', resolve: async () => parseSportyBetShare('X', { data: { outcomes: [] } }) }],
    memoryCache(),
    { minIntervalMs: 0 },
  );
  await assert.rejects(() => convertCode({ code: 'DEAD', from: 'sportybet', to: 'bet9ja' }, { registry: empty }), HttpError);
});
