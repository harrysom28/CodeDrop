import cron from 'node-cron';
import pino from 'pino';
import { config } from './config.js';
import { connectDb } from './db.js';
import { runSettlement } from './jobs/settle.js';
import { snapshotOpenPickOdds } from './services/oddsSnapshots.js';
import { buildResultsProvider } from './services/results/index.js';
import { buildRegistry } from './services/resolvers.js';

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

log.info('cron schedules armed');
