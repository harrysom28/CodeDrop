import { settleMarket, type Scoreline } from '../../core/markets.js';
import { sameFixture } from '../../core/teams.js';
import type { Leg, LegResult } from '../../core/types.js';
import type { ResultsProvider } from '../settle.js';

/**
 * API-Football (api-sports.io) results provider.
 * Needs API_FOOTBALL_KEY. Fixtures are matched by team names + kickoff ±10 min.
 */

export interface ApiFootballFixture {
  fixture: { id: number; timestamp: number; status: { short: string } };
  teams: { home: { name: string }; away: { name: string } };
  goals: { home: number | null; away: number | null };
}

export type FetchLike = (url: string, init?: { headers?: Record<string, string> }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

export interface ApiFootballOpts {
  apiKey: string;
  fetchFn?: FetchLike;
  baseUrl?: string;
  /** Optional cache of fixtures already fetched this run. */
  cache?: Map<string, ApiFootballFixture[]>;
}

const FINISHED = new Set(['FT', 'AET', 'PEN']);

export function apiFootballProvider(opts: ApiFootballOpts): ResultsProvider {
  const fetchFn = opts.fetchFn ?? ((url, init) => fetch(url, init));
  const base = opts.baseUrl ?? 'https://v3.football.api-sports.io';
  const cache = opts.cache ?? new Map<string, ApiFootballFixture[]>();

  async function fixturesForDay(kickoff: Date): Promise<ApiFootballFixture[]> {
    const day = kickoff.toISOString().slice(0, 10);
    const cached = cache.get(day);
    if (cached) return cached;
    const url = `${base}/fixtures?date=${day}`;
    const res = await fetchFn(url, { headers: { 'x-apisports-key': opts.apiKey } });
    if (!res.ok) return [];
    const json = (await res.json()) as { response?: ApiFootballFixture[] };
    const list = json.response ?? [];
    cache.set(day, list);
    return list;
  }

  async function matchFixture(leg: Leg): Promise<ApiFootballFixture | undefined> {
    const list = await fixturesForDay(leg.kickoff);
    return list.find((f) =>
      sameFixture(
        { homeTeam: leg.homeTeam, awayTeam: leg.awayTeam, kickoff: leg.kickoff },
        {
          homeTeam: f.teams.home.name,
          awayTeam: f.teams.away.name,
          kickoff: new Date(f.fixture.timestamp * 1000),
        },
      ),
    );
  }

  function scoreOf(f: ApiFootballFixture): Scoreline {
    return {
      home: f.goals.home ?? 0,
      away: f.goals.away ?? 0,
      finished: FINISHED.has(f.fixture.status.short),
    };
  }

  return {
    async legResult(leg: Leg): Promise<LegResult> {
      const fixture = await matchFixture(leg);
      if (!fixture) return 'pending';
      return settleMarket(leg.market, leg.selection, scoreOf(fixture));
    },
    // API-Football odds-at-close are a paid add-on; never guess — leave undefined.
    async closingOdds() {
      return undefined;
    },
  };
}
