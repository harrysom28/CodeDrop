export const BOOKIES = ['sportybet', 'bet9ja', 'betking', 'msport', 'betway', '1xbet', '22bet'] as const;
export type Bookie = (typeof BOOKIES)[number];

export type LegResult = 'pending' | 'won' | 'lost' | 'void';

/** One selection inside a slip, normalised across bookies. */
export interface Leg {
  /** Stable fixture id from our results provider once matched; bookie event id until then. */
  eventId: string;
  homeTeam: string;
  awayTeam: string;
  league?: string;
  market: string;
  selection: string;
  odds: number;
  kickoff: Date;
  result?: LegResult;
  /** Closing odds for this selection, used for CLV. */
  closingOdds?: number;
}

export interface Slip {
  bookie: Bookie;
  code: string;
  legs: Leg[];
}

export type SlipResult = 'pending' | 'won' | 'lost' | 'void';
