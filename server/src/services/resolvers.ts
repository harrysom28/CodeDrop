import { config } from '../config.js';
import { mongoSlipCache } from '../db.js';
import { ResolverRegistry, type SlipCache } from '../core/bookies/registry.js';
import { sportyBetResolver, DEFAULT_SPORTYBET_SHARE_URL } from '../core/bookies/sportybet.js';
import { stubBookieResolver } from '../core/bookies/stub.js';
import type { Bookie } from '../core/types.js';
import type { CodeResolver, FetchLike } from '../core/bookies/types.js';

const fetchFn: FetchLike = (url, init) => fetch(url, init);

/**
 * Bookies we can decode today. Unverified resolvers are registered only when listed in
 * ENABLED_BOOKIES, so nothing unverified runs in production by accident.
 */
export function buildRegistry(cache: SlipCache = mongoSlipCache()) {
  const enabled = new Set(config.ENABLED_BOOKIES);
  const resolvers: CodeResolver[] = [];

  if (enabled.has('sportybet')) {
    resolvers.push(
      sportyBetResolver(fetchFn, config.SPORTYBET_SHARE_URL ?? DEFAULT_SPORTYBET_SHARE_URL),
    );
  }

  const stubs: Array<{ bookie: Bookie; url?: string }> = [
    { bookie: 'bet9ja', url: config.BET9JA_SHARE_URL },
    { bookie: 'betking', url: config.BETKING_SHARE_URL },
    { bookie: 'msport', url: config.MSPORT_SHARE_URL },
  ];
  for (const s of stubs) {
    if (!enabled.has(s.bookie) || !s.url) continue;
    resolvers.push(stubBookieResolver({ bookie: s.bookie, urlTemplate: s.url, fetchFn }));
  }

  return new ResolverRegistry(resolvers, cache, { minIntervalMs: config.BOOKIE_MIN_INTERVAL_MS });
}
