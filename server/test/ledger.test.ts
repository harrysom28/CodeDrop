import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Types } from 'mongoose';
import { config } from '../src/config.js';
import { User } from '../src/models/index.js';
import { Subscription } from '../src/models/wallet.js';
import { balanceOf, postEntry, transfer, userAccount, tipsterAccount, escrowAccount } from '../src/services/ledger.js';
import { settleEscrowMonth } from '../src/services/subscriptions.js';
import { clearCollections, startTestMongo, stopTestMongo } from './helpers/mongo.js';

before(async () => {
  await startTestMongo('ledger');
});
after(async () => {
  await stopTestMongo();
});
beforeEach(async () => {
  await clearCollections();
});

test('double-entry transfer moves balance', async () => {
  const uid = new Types.ObjectId();
  await postEntry({ account: 'platform:paystack', debit: 5000, ref: 't1' });
  await postEntry({ account: userAccount(uid), credit: 5000, ref: 't1' });
  assert.equal(await balanceOf(userAccount(uid)), 5000);
  await transfer({ from: userAccount(uid), to: 'platform:fees', amount: 1000, ref: 'fee' });
  assert.equal(await balanceOf(userAccount(uid)), 4000);
  assert.equal(await balanceOf('platform:fees'), 1000);
});

test('escrow positive month releases to tipster minus fee; negative refunds 50%', async () => {
  // Force feature flag for this process via config object mutation isn't available —
  // call settleEscrowMonth on a hand-built subscription funded via ledger.
  const subscriber = await User.create({ phone: '+2348010000001', handle: 'sub1' });
  const tipster = await User.create({ phone: '+2348010000002', handle: 'tip1', idVerified: true });

  await postEntry({ account: 'platform:paystack', debit: 10_000, ref: 'fund' });
  await postEntry({ account: userAccount(subscriber._id), credit: 10_000, ref: 'fund' });

  // Positive path
  const subPos = await Subscription.create({
    subscriberId: subscriber._id,
    tipsterId: tipster._id,
    amountNaira: 10_000,
    periodStart: new Date('2026-09-01'),
    periodEnd: new Date('2026-09-30'),
    status: 'escrow',
  });
  await transfer({
    from: userAccount(subscriber._id),
    to: escrowAccount(subPos.id),
    amount: 10_000,
    ref: `subscribe:${subPos.id}`,
  });

  // Seed a winning pick in the period so profit > 0
  const { PickModel } = await import('../src/models/index.js');
  await PickModel.create({
    tipsterId: tipster._id,
    legs: [
      {
        eventId: 'e',
        homeTeam: 'A',
        awayTeam: 'B',
        market: '1X2',
        selection: 'Home',
        odds: 2,
        kickoff: new Date('2026-09-10'),
        result: 'won',
      },
    ],
    totalOdds: 2,
    stakeUnits: 1,
    lockedAt: new Date('2026-09-09'),
    firstKickoff: new Date('2026-09-10'),
    commitHash: 'h'.repeat(64),
    salt: 's'.repeat(32),
    result: 'won',
    profitUnits: 5,
    settledAt: new Date('2026-09-11'),
    revealed: true,
  });

  const pos = await settleEscrowMonth(subPos._id, new Date('2026-10-01'));
  assert.equal(pos.status, 'released');
  const feeBps = config.PLATFORM_FEE_BPS;
  const fee = Math.floor((10_000 * feeBps) / 10_000);
  assert.equal(await balanceOf(tipsterAccount(tipster._id)), 10_000 - fee);
  assert.equal(await balanceOf('platform:fees'), fee);
  assert.equal(await balanceOf(escrowAccount(subPos.id)), 0);

  // Negative path
  await clearCollections();
  const subscriber2 = await User.create({ phone: '+2348010000003', handle: 'sub2' });
  const tipster2 = await User.create({ phone: '+2348010000004', handle: 'tip2', idVerified: true });
  await postEntry({ account: 'platform:paystack', debit: 10_000, ref: 'fund2' });
  await postEntry({ account: userAccount(subscriber2._id), credit: 10_000, ref: 'fund2' });
  const subNeg = await Subscription.create({
    subscriberId: subscriber2._id,
    tipsterId: tipster2._id,
    amountNaira: 10_000,
    periodStart: new Date('2026-09-01'),
    periodEnd: new Date('2026-09-30'),
    status: 'escrow',
  });
  await transfer({
    from: userAccount(subscriber2._id),
    to: escrowAccount(subNeg.id),
    amount: 10_000,
    ref: `subscribe:${subNeg.id}`,
  });
  await PickModel.create({
    tipsterId: tipster2._id,
    legs: [
      {
        eventId: 'e2',
        homeTeam: 'A',
        awayTeam: 'B',
        market: '1X2',
        selection: 'Home',
        odds: 2,
        kickoff: new Date('2026-09-10'),
        result: 'lost',
      },
    ],
    totalOdds: 2,
    stakeUnits: 1,
    lockedAt: new Date('2026-09-09'),
    firstKickoff: new Date('2026-09-10'),
    commitHash: 'i'.repeat(64),
    salt: 't'.repeat(32),
    result: 'lost',
    profitUnits: -3,
    settledAt: new Date('2026-09-11'),
    revealed: true,
  });

  const neg = await settleEscrowMonth(subNeg._id, new Date('2026-10-01'));
  assert.equal(neg.status, 'partial_refund');
  assert.equal(await balanceOf(userAccount(subscriber2._id)), 5000);
});
