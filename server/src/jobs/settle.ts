import { connectDb } from '../db.js';
import { JobRun, PickModel, SpottedSlip } from '../models/index.js';
import { applyClosingOddsFromSnapshots } from '../services/oddsSnapshots.js';
import { buildResultsProvider } from '../services/results/index.js';
import { settleOne, type ResultsProvider } from '../services/settle.js';
import type { Leg } from '../core/types.js';

/**
 * Settles everything whose first game kicked off more than 2 hours ago. Run every 10 minutes (worker).
 */
export async function runSettlement(provider: ResultsProvider, now = new Date()) {
  const cutoff = new Date(now.getTime() - 2 * 3600_000);
  let settled = 0;
  let pendingManual = 0;

  for await (const pick of PickModel.find({ result: 'pending', firstKickoff: { $lt: cutoff } }).lean().cursor()) {
    let legs = plainLegs(pick.legs as unknown as Leg[]);
    legs = await applyClosingOddsFromSnapshots(pick._id, legs);
    const out = await settleOne({ legs, stakeUnits: pick.stakeUnits }, provider);
    if (out.result === 'pending') {
      if (out.legs.some((l) => l.result === 'pending')) pendingManual++;
      continue;
    }
    const $set: Record<string, unknown> = {
      legs: out.legs,
      result: out.result,
      profitUnits: out.profitUnits,
      settledAt: now,
      revealed: true,
    };
    if (typeof out.clv === 'number' && Number.isFinite(out.clv)) $set.clv = out.clv;
    await PickModel.updateOne({ _id: pick._id }, { $set });
    settled++;
  }

  for await (const s of SpottedSlip.find({ result: 'pending', firstKickoff: { $lt: cutoff } }).lean().cursor()) {
    const out = await settleOne({ legs: plainLegs(s.slip.legs as unknown as Leg[]), stakeUnits: 1 }, provider);
    if (out.result === 'pending') continue;
    await SpottedSlip.updateOne(
      { _id: s._id },
      { $set: { 'slip.legs': out.legs, result: out.result, settledAt: now } },
    );
    settled++;
  }

  await JobRun.create({
    job: 'settle',
    finishedAt: now,
    ok: true,
    detail: { settled, pendingManual },
  });
  return { settled, pendingManual };
}

/** Copy only the Leg fields — spreading a Mongoose subdoc drops odds into NaN. */
function plainLegs(legs: Leg[]): Leg[] {
  return legs.map((l) => ({
    eventId: l.eventId,
    homeTeam: l.homeTeam,
    awayTeam: l.awayTeam,
    league: l.league,
    market: l.market,
    selection: l.selection,
    odds: Number(l.odds),
    kickoff: new Date(l.kickoff),
    result: l.result,
    closingOdds: l.closingOdds !== undefined ? Number(l.closingOdds) : undefined,
  }));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await connectDb();
  const out = await runSettlement(buildResultsProvider());
  console.log(out);
  process.exit(0);
}
