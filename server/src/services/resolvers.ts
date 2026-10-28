import { config } from '../config.js';
import { mongoSlipCache } from '../db.js';
import { ResolverRegistry, type SlipCache } from '../core/bookies/registry.js';
import { sportyBetResolver, DEFAULT_SPORTYBET_SHARE_URL } from '../core/bookies/sportybet.js';

/**
 * Bookies we can decode today. Bet9ja, BetKing, MSport etc. get added here as each lookup is confirmed
 * (or, better, as each partnership API is signed). Codes for bookies without a resolver are skipped.
 */
export function buildRegistry(cache: SlipCache = mongoSlipCache()) {
  return new ResolverRegistry(
    [sportyBetResolver((url, init) => fetch(url, init), config.SPORTYBET_SHARE_URL ?? DEFAULT_SPORTYBET_SHARE_URL)],
    cache,
    { minIntervalMs: config.BOOKIE_MIN_INTERVAL_MS },
  );
}
