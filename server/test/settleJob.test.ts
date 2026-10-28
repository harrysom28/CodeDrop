import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { runSettlement } from '../src/jobs/settle.js';
import { PickModel, User } from '../src/models/index.js';
import { buildLockedPick } from '../src/services/picks.js';
import type { Leg, LegResult } from '../src/core/types.js';
import type { ResultsProvider } from '../src/services/settle.js';
import { clearCollections, startTestMongo, stopTestMongo } from './helpers/mongo.js';

before(async () => {
  await startTestMongo('settle');
});
after(async () => {
  await stopTestMongo();
});
beforeEach(async () => {
  await clearCollections();
});

test('settlement job settles picks via a fake provider and reveals salt', async () => {
  const tipster = await User.create({ phone: '+2348099990001', handle: 'settler' });
  const kickoff = new Date(Date.now() - 3 * 3600_000);
  const legs: Leg[] = [
    {
      eventId: 'e1',
      homeTeam: 'A',
      awayTeam: 'B',
      market: '1X2',
      selection: 'Home',
      odds: 2,
      kickoff,
    },
  ];
  const locked = buildLockedPick({ tipsterId: tipster.id, legs, stakeUnits: 1, now: new Date(kickoff.getTime() - 3600_000) });
  const pick = await PickModel.create({
    tipsterId: tipster._id,
    legs,
    stakeUnits: 1,
    visibility: 'public',
    ...locked,
  });

  const provider: ResultsProvider = {
    async legResult(): Promise<LegResult> {
      return 'won';
    },
    async closingOdds() {
      return 1.8;
    },
  };

  const out = await runSettlement(provider, new Date());
  assert.equal(out.settled, 1);

  const settled = await PickModel.findById(pick._id).select('+salt').lean();
  assert.equal(settled?.result, 'won');
  assert.equal(settled?.revealed, true);
  assert.equal(settled?.profitUnits, 1);
  assert.ok(settled?.clv !== undefined);
  assert.ok(settled?.salt);
});
