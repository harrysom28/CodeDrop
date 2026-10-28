import { z } from 'zod';

export const BOOKIES = ['sportybet', 'bet9ja', 'betking', 'msport', 'betway', '1xbet', '22bet'] as const;
export const BookieSchema = z.enum(BOOKIES);
export type Bookie = z.infer<typeof BookieSchema>;

export const LegResultSchema = z.enum(['pending', 'won', 'lost', 'void']);
export type LegResult = z.infer<typeof LegResultSchema>;

export const LegSchema = z.object({
  eventId: z.string(),
  homeTeam: z.string(),
  awayTeam: z.string(),
  league: z.string().optional(),
  market: z.string(),
  selection: z.string(),
  odds: z.number(),
  kickoff: z.coerce.date(),
  result: LegResultSchema.optional(),
  closingOdds: z.number().optional(),
});
export type Leg = z.infer<typeof LegSchema>;

export const SlipResultSchema = z.enum(['pending', 'won', 'lost', 'void']);

export const OnboardingBody = z.object({
  over18Confirmed: z.literal(true),
  favouriteClubs: z.array(z.string()).max(20).default([]),
  mainBookie: BookieSchema,
  unitNaira: z.number().int().min(100).max(1_000_000).default(1000),
});

export const PatchMeBody = z.object({
  handle: z.string().trim().min(3).max(20).optional(),
  displayName: z.string().trim().min(1).max(60).optional(),
});

export const UserSchema = z.object({
  id: z.string(),
  phone: z.string().nullable(),
  handle: z.string().nullable(),
  displayName: z.string().nullable(),
  role: z.string(),
  idVerified: z.boolean(),
  over18Confirmed: z.boolean(),
  mainBookie: z.string().nullable(),
  favouriteClubs: z.array(z.string()),
  unitNaira: z.number(),
  onboardedAt: z.coerce.date().nullable().optional(),
});
export type ApiUser = z.infer<typeof UserSchema>;

export const ConvertBody = z.object({
  code: z.string().trim().min(4).max(16),
  from: BookieSchema,
  to: BookieSchema,
});

export const CreatePickBody = z.object({
  code: z.string().trim().toUpperCase().optional(),
  bookie: BookieSchema.optional(),
  stakeUnits: z.number().min(0.1).max(10),
  note: z.string().max(500).optional(),
  visibility: z.enum(['public', 'vip']).default('public'),
});

export const CopyPickBody = z.object({
  bookie: BookieSchema,
  oddsAtCopy: z.number().optional(),
  stakeNaira: z.number().min(1).optional(),
});

export const CreateBetBody = z.object({
  code: z.string().trim().toUpperCase().min(4).max(16),
  bookie: BookieSchema,
  stakeNaira: z.number().min(1).max(10_000_000),
  source: z.enum(['copied', 'own', 'imported']).default('imported'),
  pickId: z.string().optional(),
});

export const BOOKIE_LABELS: Record<Bookie, string> = {
  sportybet: 'SportyBet',
  bet9ja: 'Bet9ja',
  betking: 'BetKing',
  msport: 'MSport',
  betway: 'BetWay',
  '1xbet': '1xBet',
  '22bet': '22Bet',
};

export const RESPONSIBLE_GAMBLING_FOOTER = '18+ only. Bet with money you can afford to lose.';
