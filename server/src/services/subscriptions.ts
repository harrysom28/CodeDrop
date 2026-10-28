import { Types } from 'mongoose';
import { config } from '../config.js';
import { HttpError } from '../errors.js';
import { PickModel } from '../models/index.js';
import { SpendLimit, Subscription } from '../models/wallet.js';
import {
  balanceOf,
  escrowAccount,
  tipsterAccount,
  transfer,
  userAccount,
} from './ledger.js';

/**
 * Month-end escrow release:
 * - tipster verified month positive → release to tipster minus PLATFORM_FEE_BPS
 * - negative → refund 50% to subscriber, release the rest to tipster (fee still applies to tipster share)
 */
export async function settleEscrowMonth(subId: Types.ObjectId | string, now = new Date()) {
  const sub = await Subscription.findById(subId);
  if (!sub || sub.status !== 'escrow') throw new HttpError(404, 'Escrow subscription not found');
  if (sub.periodEnd > now) throw new HttpError(400, 'Period not finished');

  const profit = await tipsterMonthProfit(sub.tipsterId, sub.periodStart, sub.periodEnd);
  const escrow = escrowAccount(sub.id);
  const amount = await balanceOf(escrow);
  if (amount <= 0) {
    sub.status = 'cancelled';
    await sub.save();
    return { status: sub.status, profit };
  }

  const feeBps = config.PLATFORM_FEE_BPS;
  if (profit > 0) {
    const fee = Math.floor((amount * feeBps) / 10_000);
    const toTipster = amount - fee;
    await transfer({
      from: escrow,
      to: tipsterAccount(sub.tipsterId),
      amount: toTipster,
      ref: `escrow-release:${sub.id}`,
      allowOverdraft: true,
    });
    if (fee > 0) {
      await transfer({
        from: escrow,
        to: 'platform:fees',
        amount: fee,
        ref: `escrow-fee:${sub.id}`,
        allowOverdraft: true,
      });
    }
    sub.status = 'released';
  } else {
    const refund = Math.floor(amount * 0.5);
    const remainder = amount - refund;
    const fee = Math.floor((remainder * feeBps) / 10_000);
    const toTipster = remainder - fee;
    if (refund > 0) {
      await transfer({
        from: escrow,
        to: userAccount(sub.subscriberId),
        amount: refund,
        ref: `escrow-refund:${sub.id}`,
        allowOverdraft: true,
      });
    }
    if (toTipster > 0) {
      await transfer({
        from: escrow,
        to: tipsterAccount(sub.tipsterId),
        amount: toTipster,
        ref: `escrow-release:${sub.id}`,
        allowOverdraft: true,
      });
    }
    if (fee > 0) {
      await transfer({
        from: escrow,
        to: 'platform:fees',
        amount: fee,
        ref: `escrow-fee:${sub.id}`,
        allowOverdraft: true,
      });
    }
    sub.status = 'partial_refund';
  }
  await sub.save();
  return { status: sub.status, profit, amount };
}

async function tipsterMonthProfit(tipsterId: Types.ObjectId, from: Date, to: Date) {
  const picks = await PickModel.find({
    tipsterId,
    result: { $in: ['won', 'lost', 'void'] },
    settledAt: { $gte: from, $lt: to },
  }).lean();
  return picks.reduce((s, p) => s + (p.profitUnits ?? 0), 0);
}

export async function subscribeToTipster(input: {
  subscriberId: Types.ObjectId;
  tipsterId: Types.ObjectId;
  amountNaira: number;
  now?: Date;
}) {
  if (!config.SUBSCRIPTIONS_ENABLED) throw new HttpError(403, 'Subscriptions are disabled');
  if (input.subscriberId.equals(input.tipsterId)) throw new HttpError(400, "Can't subscribe to yourself");
  await assertWithinSpendLimit(input.subscriberId, input.amountNaira, input.now);
  const now = input.now ?? new Date();
  const periodEnd = new Date(now);
  periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1);
  const sub = await Subscription.create({
    subscriberId: input.subscriberId,
    tipsterId: input.tipsterId,
    amountNaira: input.amountNaira,
    periodStart: now,
    periodEnd,
    status: 'escrow',
  });
  await transfer({
    from: userAccount(input.subscriberId),
    to: escrowAccount(sub.id),
    amount: input.amountNaira,
    ref: `subscribe:${sub.id}`,
    idempotencyKey: `subscribe:${sub.id}`,
  });
  return sub;
}

export async function assertWithinSpendLimit(userId: Types.ObjectId, amount: number, now = new Date()) {
  let limit = await SpendLimit.findOne({ userId });
  if (!limit) {
    limit = await SpendLimit.create({ userId, weeklyLimitNaira: 50_000 });
  }
  if (limit.pendingLimitNaira != null && limit.pendingLimitEffectiveAt && limit.pendingLimitEffectiveAt <= now) {
    limit.weeklyLimitNaira = limit.pendingLimitNaira;
    limit.pendingLimitNaira = undefined;
    limit.pendingLimitEffectiveAt = undefined;
    await limit.save();
  }
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
  // Approximate weekly spend: debits from user account with subscribe refs in the last 7 days.
  const spent = await balanceOf(userAccount(userId)); // not ideal — use ledger query instead
  void spent;
  const { LedgerEntry } = await import('../models/wallet.js');
  const rows = await LedgerEntry.aggregate<{ total: number }>([
    {
      $match: {
        account: userAccount(userId),
        debit: { $gt: 0 },
        createdAt: { $gte: weekAgo },
        ref: { $regex: /^subscribe:/ },
      },
    },
    { $group: { _id: null, total: { $sum: '$debit' } } },
  ]);
  const weekSpend = rows[0]?.total ?? 0;
  if (weekSpend + amount > limit.weeklyLimitNaira) {
    throw new HttpError(403, 'Weekly spend limit reached');
  }
}

export async function setSpendLimit(userId: Types.ObjectId, weeklyLimitNaira: number, now = new Date()) {
  let limit = await SpendLimit.findOne({ userId });
  if (!limit) limit = await SpendLimit.create({ userId, weeklyLimitNaira: 50_000 });
  if (weeklyLimitNaira < limit.weeklyLimitNaira) {
    limit.weeklyLimitNaira = weeklyLimitNaira;
    limit.pendingLimitNaira = undefined;
    limit.pendingLimitEffectiveAt = undefined;
  } else if (weeklyLimitNaira > limit.weeklyLimitNaira) {
    limit.pendingLimitNaira = weeklyLimitNaira;
    limit.pendingLimitEffectiveAt = new Date(now.getTime() + 24 * 3600_000);
  }
  await limit.save();
  return limit;
}
