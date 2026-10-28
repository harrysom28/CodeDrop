import { connectDb } from '../db.js';
import { PickModel, SpottedSlip } from '../models/index.js';
import { noResultsYet, settleOne, type ResultsProvider } from '../services/settle.js';
import type { Leg } from '../core/types.js';

/**
 * Settles everything whose first game kicked off more than 2 hours ago. Run every 10–15 minutes (cron).
 * Swap `noResultsYet` for a real ResultsProvider once the results feed is chosen.
 */
export async function runSettlement(provider: ResultsProvider, now = new Date()) {
  const cutoff = new Date(now.getTime() - 2 * 3600_000);
  let settled = 0;

  for await (const pick of PickModel.find({ result: 'pending', firstKickoff: { $lt: cutoff } }).cursor()) {
    const out = await settleOne({ legs: pick.legs as unknown as Leg[], stakeUnits: pick.stakeUnits }, provider);
    if (out.result === 'pending') continue;
    await PickModel.updateOne(
      { _id: pick._id },
      { $set: { legs: out.legs, result: out.result, profitUnits: out.profitUnits, clv: out.clv, settledAt: now, revealed: true } },
    );
    settled++;
  }

  for await (const s of SpottedSlip.find({ result: 'pending', firstKickoff: { $lt: cutoff } }).cursor()) {
    const out = await settleOne({ legs: s.slip.legs as unknown as Leg[], stakeUnits: 1 }, provider);
    if (out.result === 'pending') continue;
    await SpottedSlip.updateOne({ _id: s._id }, { $set: { 'slip.legs': out.legs, result: out.result, settledAt: now } });
    settled++;
  }
  return settled;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await connectDb();
  const n = await runSettlement(noResultsYet);
  console.log(`settled ${n}`);
  process.exit(0);
}
