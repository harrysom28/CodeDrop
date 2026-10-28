import { z } from 'zod';
import type { Leg, Slip } from '../types.js';
import { CodeNotFoundError, ResolverUnavailableError, type CodeResolver, type FetchLike } from './types.js';

/**
 * SportyBet booking-code lookup.
 *
 * ⚠️ UNOFFICIAL. SportyBet has no public API. This calls the same request the website makes when a user
 * presses "Load Code". Before going live, open sportybet.com → Load Code → browser dev tools → Network,
 * confirm the URL and response shape, and set SPORTYBET_SHARE_URL. It will break when SportyBet changes
 * their site; replace with a partner API as soon as one is signed. Cache every code and rate-limit lookups.
 */

export const DEFAULT_SPORTYBET_SHARE_URL = 'https://www.sportybet.com/api/ng/orders/share/{code}';

const OutcomeSchema = z.object({ desc: z.string(), odds: z.union([z.string(), z.number()]) });
const MarketSchema = z.object({
  desc: z.string(),
  specifier: z.string().optional().nullable(),
  outcomes: z.array(OutcomeSchema).min(1),
});
const EventSchema = z.object({
  eventId: z.string(),
  homeTeamName: z.string(),
  awayTeamName: z.string(),
  estimateStartTime: z.number(),
  sport: z.object({ category: z.object({ tournament: z.object({ name: z.string() }).optional() }).optional() }).optional(),
  markets: z.array(MarketSchema).min(1),
});
const ResponseSchema = z.object({
  bizCode: z.number().optional(),
  data: z.object({ outcomes: z.array(EventSchema) }).nullable().optional(),
});

export function parseSportyBetShare(code: string, body: unknown): Slip {
  const parsed = ResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new ResolverUnavailableError('sportybet', `unexpected response shape: ${parsed.error.issues[0]?.message}`);
  }
  const events = parsed.data.data?.outcomes ?? [];
  if (events.length === 0) throw new CodeNotFoundError('sportybet', code);

  const legs: Leg[] = events.map((e) => {
    const market = e.markets[0]!;
    const outcome = market.outcomes[0]!;
    return {
      eventId: `sporty:${e.eventId}`,
      homeTeam: e.homeTeamName,
      awayTeam: e.awayTeamName,
      league: e.sport?.category?.tournament?.name,
      market: market.specifier ? `${market.desc} ${market.specifier}` : market.desc,
      selection: outcome.desc,
      odds: Number(outcome.odds),
      kickoff: new Date(e.estimateStartTime),
    };
  });
  return { bookie: 'sportybet', code, legs };
}

export function sportyBetResolver(fetchFn: FetchLike, urlTemplate = DEFAULT_SPORTYBET_SHARE_URL): CodeResolver {
  return {
    bookie: 'sportybet',
    async resolve(code) {
      const url = urlTemplate.replace('{code}', encodeURIComponent(code));
      const res = await fetchFn(url, { headers: { accept: 'application/json', 'user-agent': 'Mozilla/5.0' } });
      if (res.status === 404) throw new CodeNotFoundError('sportybet', code);
      if (!res.ok) throw new ResolverUnavailableError('sportybet', `HTTP ${res.status}`);
      return parseSportyBetShare(code, await res.json());
    },
  };
}
