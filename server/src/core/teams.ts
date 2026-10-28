/**
 * Fuzzy team-name normalisation for matching the same fixture across bookies.
 * Matching rule used by convert: normalised names equal + kickoff within ±10 minutes.
 */

const STRIP = /[^a-z0-9]+/g;

/** Common Nigerian / English club variants → canonical short name. Keys are already stripped. */
const ALIASES: Record<string, string> = {
  arsenal: 'arsenal',
  gunners: 'arsenal',
  chelsea: 'chelsea',
  blues: 'chelsea',
  liverpool: 'liverpool',
  reds: 'liverpool',
  manchesterunited: 'manutd',
  manutd: 'manutd',
  manu: 'manutd',
  manchesterunitedfc: 'manutd',
  manunited: 'manutd',
  manchestercity: 'mancity',
  mancity: 'mancity',
  manc: 'mancity',
  tottenham: 'tottenham',
  tottenhamhotspur: 'tottenham',
  spurs: 'tottenham',
  enyimba: 'enyimba',
  enyimbafc: 'enyimba',
  enyimbaofaba: 'enyimba',
  riversunited: 'riversutd',
  riversutd: 'riversutd',
  kanopillars: 'kanopillars',
  kanopillarsfc: 'kanopillars',
  remostars: 'remostars',
  remostarsfc: 'remostars',
  plateauunited: 'plateauutd',
  plateauutd: 'plateauutd',
  sunshinestars: 'sunshinestars',
  heartland: 'heartland',
  heartlandfc: 'heartland',
};

export function normalizeTeamName(name: string): string {
  const key = name.normalize('NFKD').toLowerCase().replace(STRIP, '');
  return ALIASES[key] ?? key;
}

export function teamsMatch(a: string, b: string): boolean {
  return normalizeTeamName(a) === normalizeTeamName(b);
}

const TEN_MIN_MS = 10 * 60_000;

/** Same fixture across bookies: both teams match (home/away) and kickoffs within ±10 min. */
export function sameFixture(
  a: { homeTeam: string; awayTeam: string; kickoff: Date },
  b: { homeTeam: string; awayTeam: string; kickoff: Date },
): boolean {
  if (!teamsMatch(a.homeTeam, b.homeTeam) || !teamsMatch(a.awayTeam, b.awayTeam)) return false;
  return Math.abs(a.kickoff.getTime() - b.kickoff.getTime()) <= TEN_MIN_MS;
}
