import type { Bookie, Leg, Slip } from '../core/types.js';
import type { ResolverRegistry } from '../core/bookies/registry.js';
import { sameFixture } from '../core/teams.js';
import { HttpError } from '../errors.js';

export interface ConvertLegStatus {
  source: Pick<Leg, 'homeTeam' | 'awayTeam' | 'market' | 'selection' | 'odds' | 'kickoff'>;
  available: boolean;
  matchedOdds?: number;
}

export interface ConvertResult {
  from: Bookie;
  to: Bookie;
  code: string;
  /** Present when the target bookie can mint a new booking code (none can yet). */
  convertedCode?: string;
  legsAvailable: number;
  legsTotal: number;
  legs: ConvertLegStatus[];
  oddsSource: number;
  oddsMatched?: number;
  note: string;
}

/**
 * Resolve a source slip, then either ask the target bookie to mint a code (unsupported today)
 * or return per-leg availability by matching fixtures via teams + kickoff ±10 min.
 *
 * Without a live catalogue of open markets on the target bookie, "available" means we found a
 * same-fixture candidate in an optional catalogue; if no catalogue is provided every leg is
 * reported available:false so the app can still show "0 of N" honestly.
 */
export async function convertCode(
  input: { code: string; from: Bookie; to: Bookie },
  deps: {
    registry: ResolverRegistry;
    /** Open selections on the target bookie, if we have a feed. */
    targetCatalogue?: Array<Pick<Leg, 'homeTeam' | 'awayTeam' | 'market' | 'selection' | 'odds' | 'kickoff'>>;
    createBookingCode?: (to: Bookie, legs: Leg[]) => Promise<string | null>;
  },
): Promise<ConvertResult> {
  if (input.from === input.to) throw new HttpError(400, 'Pick two different bookies');

  const slip = await deps.registry.resolve(input.code.toUpperCase(), input.from);
  if (!slip) throw new HttpError(404, 'Code not found or expired');

  const catalogue = deps.targetCatalogue ?? [];
  const legs: ConvertLegStatus[] = slip.legs.map((leg) => {
    const match = catalogue.find(
      (c) =>
        sameFixture(leg, c) &&
        c.market.toLowerCase() === leg.market.toLowerCase() &&
        c.selection.toLowerCase() === leg.selection.toLowerCase(),
    );
    return {
      source: {
        homeTeam: leg.homeTeam,
        awayTeam: leg.awayTeam,
        market: leg.market,
        selection: leg.selection,
        odds: leg.odds,
        kickoff: leg.kickoff,
      },
      available: !!match,
      matchedOdds: match?.odds,
    };
  });

  const legsAvailable = legs.filter((l) => l.available).length;
  const oddsSource = round(slip.legs.reduce((a, l) => a * l.odds, 1));
  const oddsMatched =
    legsAvailable === legs.length && legs.every((l) => l.matchedOdds)
      ? round(legs.reduce((a, l) => a * (l.matchedOdds as number), 1))
      : undefined;

  let convertedCode: string | undefined;
  if (deps.createBookingCode && legsAvailable === legs.length) {
    const minted = await deps.createBookingCode(input.to, slip.legs);
    if (minted) convertedCode = minted;
  }

  return {
    from: input.from,
    to: input.to,
    code: slip.code,
    convertedCode,
    legsAvailable,
    legsTotal: legs.length,
    legs,
    oddsSource,
    oddsMatched,
    note: convertedCode
      ? `Converted to a ${input.to} code.`
      : catalogue.length === 0
        ? `Resolved ${legs.length} legs on ${input.from}. Target-bookie market catalogue not wired yet — open ${input.to} and place the legs manually, or capture a fixture for TODO_HARRISON.`
        : `${legsAvailable} of ${legs.length} legs available on ${input.to}.`,
  };
}

export type { Slip };

function round(n: number, dp = 2): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}
