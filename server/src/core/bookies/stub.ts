import { z } from 'zod';
import type { Bookie, Leg, Slip } from '../types.js';
import { CodeNotFoundError, ResolverUnavailableError, type CodeResolver, type FetchLike } from './types.js';

/**
 * Generic "share/load code" resolver for bookies whose real response shape is not yet verified.
 * Schemas are best-effort placeholders; run `npm run bookie:probe -- <bookie> <CODE>`, save the
 * fixture, then tighten the zod schema and add a fixture test before enabling in production.
 */

const GenericLeg = z.object({
  eventId: z.union([z.string(), z.number()]).transform(String),
  homeTeam: z.string(),
  awayTeam: z.string(),
  league: z.string().optional(),
  market: z.string(),
  selection: z.string(),
  odds: z.union([z.string(), z.number()]).transform(Number),
  kickoff: z.union([z.string(), z.number()]).transform((v) => new Date(v)),
});

const GenericResponse = z.object({
  legs: z.array(GenericLeg).optional(),
  data: z
    .object({
      legs: z.array(GenericLeg).optional(),
      selections: z.array(GenericLeg).optional(),
    })
    .optional(),
});

export function parseGenericShare(bookie: Bookie, code: string, body: unknown): Slip {
  const parsed = GenericResponse.safeParse(body);
  if (!parsed.success) {
    throw new ResolverUnavailableError(bookie, `unexpected response shape: ${parsed.error.issues[0]?.message}`);
  }
  const raw = parsed.data.legs ?? parsed.data.data?.legs ?? parsed.data.data?.selections ?? [];
  if (raw.length === 0) throw new CodeNotFoundError(bookie, code);

  const legs: Leg[] = raw.map((l) => ({
    eventId: `${bookie}:${l.eventId}`,
    homeTeam: l.homeTeam,
    awayTeam: l.awayTeam,
    league: l.league,
    market: l.market,
    selection: l.selection,
    odds: l.odds,
    kickoff: l.kickoff,
  }));
  return { bookie, code, legs };
}

export interface StubResolverOpts {
  bookie: Bookie;
  urlTemplate: string;
  fetchFn: FetchLike;
}

export function stubBookieResolver(opts: StubResolverOpts): CodeResolver {
  const { bookie, urlTemplate, fetchFn } = opts;
  return {
    bookie,
    async resolve(code) {
      const url = urlTemplate.replace('{code}', encodeURIComponent(code));
      const res = await fetchFn(url, { headers: { accept: 'application/json', 'user-agent': 'Mozilla/5.0' } });
      if (res.status === 404) throw new CodeNotFoundError(bookie, code);
      if (!res.ok) throw new ResolverUnavailableError(bookie, `HTTP ${res.status}`);
      return parseGenericShare(bookie, code, await res.json());
    },
  };
}
