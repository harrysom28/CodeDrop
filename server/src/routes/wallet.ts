import { createHmac, timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { HttpError } from '../errors.js';
import { requireUser } from '../middleware/auth.js';
import { User } from '../models/index.js';
import { LedgerEntry, Subscription } from '../models/wallet.js';
import { balanceOf, postEntry, userAccount } from '../services/ledger.js';
import { setSpendLimit, subscribeToTipster } from '../services/subscriptions.js';
import { verifyUserId } from '../services/idVerify.js';

export function walletRouter() {
  const r = Router();

  r.get('/me/wallet', requireUser, async (req, res) => {
    const balance = await balanceOf(userAccount(req.userId!));
    res.json({
      balanceNaira: balance,
      note: 'For subscriptions and tipster earnings. Never holds bet stakes.',
    });
  });

  r.get('/me/wallet/history', requireUser, async (req, res) => {
    const items = await LedgerEntry.find({ account: userAccount(req.userId!) })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.json({ items });
  });

  /** Dev/test top-up. Production uses Paystack webhook. */
  r.post('/me/wallet/topup-dev', requireUser, async (req, res) => {
    if (config.NODE_ENV === 'production') throw new HttpError(404, 'Not found');
    const body = z.object({ amountNaira: z.number().int().min(100).max(1_000_000) }).parse(req.body);
    await postEntry({
      account: 'platform:paystack',
      debit: body.amountNaira,
      ref: `topup-dev:${req.userId}:${Date.now()}`,
    });
    await postEntry({
      account: userAccount(req.userId!),
      credit: body.amountNaira,
      ref: `topup-dev:${req.userId}:${Date.now()}`,
    });
    res.json({ balanceNaira: await balanceOf(userAccount(req.userId!)) });
  });

  r.post('/webhooks/paystack', async (req, res) => {
    if (!config.PAYSTACK_SECRET_KEY) throw new HttpError(501, 'Paystack not configured');
    const signature = req.header('x-paystack-signature') ?? '';
    const raw = JSON.stringify(req.body);
    const expected = createHmac('sha512', config.PAYSTACK_WEBHOOK_SECRET ?? config.PAYSTACK_SECRET_KEY)
      .update(raw)
      .digest('hex');
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new HttpError(401, 'Invalid signature');

    const event = req.body as { event?: string; data?: { reference?: string; amount?: number; metadata?: { userId?: string } } };
    if (event.event === 'charge.success' && event.data?.reference && event.data.metadata?.userId) {
      const amountNaira = Math.round((event.data.amount ?? 0) / 100);
      const userId = event.data.metadata.userId;
      const key = `paystack:${event.data.reference}`;
      await postEntry({
        account: 'platform:paystack',
        debit: amountNaira,
        ref: key,
        idempotencyKey: `${key}:plat`,
      });
      await postEntry({
        account: userAccount(userId),
        credit: amountNaira,
        ref: key,
        idempotencyKey: `${key}:user`,
      });
    }
    res.sendStatus(200);
  });

  r.post('/me/subscriptions', requireUser, async (req, res) => {
    const body = z
      .object({ tipsterId: z.string(), amountNaira: z.number().int().min(500).max(500_000) })
      .parse(req.body);
    const tipster = await User.findById(body.tipsterId);
    if (!tipster?.idVerified) throw new HttpError(400, 'Tipster must be ID verified to charge');
    const sub = await subscribeToTipster({
      subscriberId: req.userId!,
      tipsterId: tipster._id,
      amountNaira: body.amountNaira,
    });
    res.status(201).json(sub);
  });

  r.get('/me/subscriptions', requireUser, async (req, res) => {
    const items = await Subscription.find({ subscriberId: req.userId }).sort({ createdAt: -1 }).limit(50).lean();
    res.json({ items });
  });

  r.post('/me/limits', requireUser, async (req, res) => {
    const body = z.object({ weeklyLimitNaira: z.number().int().min(0).max(5_000_000) }).parse(req.body);
    const limit = await setSpendLimit(req.userId!, body.weeklyLimitNaira);
    res.json(limit);
  });

  r.post('/me/id-verify', requireUser, async (req, res) => {
    const body = z
      .object({
        idType: z.enum(['bvn', 'nin']),
        idNumber: z.string().min(8).max(20),
        selfieBase64: z.string().optional(),
      })
      .parse(req.body);
    const out = await verifyUserId({ userId: req.userId!.toString(), ...body });
    res.json(out);
  });

  r.post('/me/wallet/withdraw', requireUser, async (req, res) => {
    if (!config.PAYSTACK_SECRET_KEY) throw new HttpError(501, 'Paystack not configured');
    const user = await User.findById(req.userId);
    if (!user?.idVerified) throw new HttpError(403, 'ID verification required to withdraw');
    const body = z
      .object({
        amountNaira: z.number().int().min(100).max(5_000_000),
        accountNumber: z.string().min(10).max(10),
        bankCode: z.string().min(2).max(10),
      })
      .parse(req.body);
    // Resolve account name first — real Paystack call needs credentials.
    throw new HttpError(
      501,
      `Withdrawal queued for review once Paystack transfer is wired (acct ${body.accountNumber}, bank ${body.bankCode}, ₦${body.amountNaira}). See TODO_HARRISON.md.`,
    );
  });

  return r;
}
