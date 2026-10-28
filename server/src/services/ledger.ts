import { Types } from 'mongoose';
import { LedgerEntry } from '../models/wallet.js';
import { HttpError } from '../errors.js';

/**
 * Double-entry ledger. Balances are always derived from sum(credit - debit).
 * Never store a mutable wallet balance without a matching ledger row.
 */

export type Account =
  | `user:${string}`
  | `tipster:${string}`
  | `escrow:${string}`
  | 'platform:fees'
  | 'platform:paystack'
  | 'platform:clearing';

export async function balanceOf(account: Account): Promise<number> {
  const rows = await LedgerEntry.aggregate<{ bal: number }>([
    { $match: { account } },
    { $group: { _id: null, bal: { $sum: { $subtract: ['$credit', '$debit'] } } } },
  ]);
  return rows[0]?.bal ?? 0;
}

export async function postEntry(input: {
  account: Account;
  debit?: number;
  credit?: number;
  ref: string;
  memo?: string;
  idempotencyKey?: string;
}) {
  const debit = input.debit ?? 0;
  const credit = input.credit ?? 0;
  if (debit < 0 || credit < 0) throw new HttpError(400, 'Amounts must be non-negative');
  if (debit === 0 && credit === 0) throw new HttpError(400, 'Empty entry');
  if (input.idempotencyKey) {
    const existing = await LedgerEntry.findOne({ idempotencyKey: input.idempotencyKey, account: input.account });
    if (existing) return existing;
  }
  return LedgerEntry.create({
    account: input.account,
    debit,
    credit,
    ref: input.ref,
    memo: input.memo,
    idempotencyKey: input.idempotencyKey,
  });
}

/** Move amount from one account to another as a balanced pair. */
export async function transfer(input: {
  from: Account;
  to: Account;
  amount: number;
  ref: string;
  memo?: string;
  idempotencyKey?: string;
  allowOverdraft?: boolean;
}) {
  if (input.amount <= 0) throw new HttpError(400, 'Amount must be positive');
  if (!input.allowOverdraft) {
    const bal = await balanceOf(input.from);
    if (bal < input.amount) throw new HttpError(402, 'Insufficient balance');
  }
  const key = input.idempotencyKey;
  await postEntry({
    account: input.from,
    debit: input.amount,
    ref: input.ref,
    memo: input.memo,
    idempotencyKey: key ? `${key}:from` : undefined,
  });
  await postEntry({
    account: input.to,
    credit: input.amount,
    ref: input.ref,
    memo: input.memo,
    idempotencyKey: key ? `${key}:to` : undefined,
  });
}

export function userAccount(userId: Types.ObjectId | string): Account {
  return `user:${userId}`;
}
export function tipsterAccount(userId: Types.ObjectId | string): Account {
  return `tipster:${userId}`;
}
export function escrowAccount(subId: Types.ObjectId | string): Account {
  return `escrow:${subId}`;
}
