import cron from 'node-cron';
import pino from 'pino';
import { config } from './config.js';
import { connectDb } from './db.js';
import { runAnchoring } from './jobs/anchor.js';
import { runSettlement } from './jobs/settle.js';
import { snapshotOpenPickOdds } from './services/oddsSnapshots.js';
import { buildResultsProvider } from './services/results/index.js';
import { buildRegistry } from './services/resolvers.js';
import { Subscription } from './models/wallet.js';
import { settleEscrowMonth } from './services/subscriptions.js';

/**
 * Background worker: settlement every 10 minutes, odds snapshots every 15.
 * Run as a separate process from the API (`npm run worker`).
 */
const log = pino({ name: 'worker' });

await connectDb();
const provider = buildResultsProvider();
const registry = buildRegistry();
log.info({ auth: config.AUTH_MODE, hasResults: !!config.API_FOOTBALL_KEY }, 'worker starting');

cron.schedule('*/10 * * * *', () => {
  void runSettlement(provider)
    .then((out) => log.info(out, 'settlement'))
    .catch((err) => log.error({ err }, 'settlement failed'));
});

cron.schedule('*/15 * * * *', () => {
  void snapshotOpenPickOdds(registry)
    .then((n) => log.info({ snapped: n }, 'odds snapshots'))
    .catch((err) => log.error({ err }, 'odds snapshot failed'));
});

cron.schedule('*/10 * * * *', () => {
  void runAnchoring()
    .then((out) => log.info(out, 'anchoring'))
    .catch((err) => log.error({ err }, 'anchoring failed'));
});

cron.schedule('5 0 * * *', () => {
  void (async () => {
    const due = await Subscription.find({ status: 'escrow', periodEnd: { $lte: new Date() } }).limit(200);
    for (const sub of due) {
      try {
        const out = await settleEscrowMonth(sub._id);
        log.info({ subId: sub.id, ...out }, 'escrow settled');
      } catch (err) {
        log.error({ err, subId: sub.id }, 'escrow settle failed');
      }
    }
  })();
});

log.info('cron schedules armed');
