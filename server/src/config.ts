import 'dotenv/config';
import { z } from 'zod';

const Env = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  MONGODB_URI: z.string().default('mongodb://127.0.0.1:27017/codedrop'),

  /** "dev" trusts an x-user-id header. Never use it in production; use AUTH_MODE=firebase. */
  AUTH_MODE: z.enum(['dev', 'firebase']).default('dev'),
  ADMIN_USER_IDS: z.string().default('').transform((s) => s.split(',').map((x) => x.trim()).filter(Boolean)),

  /** Firebase project id (phone auth). Used when AUTH_MODE=firebase. */
  FIREBASE_PROJECT_ID: z.string().optional(),
  /** Optional inline service-account JSON. Prefer GOOGLE_APPLICATION_CREDENTIALS in production. */
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().optional(),

  TELEGRAM_API_ID: z.coerce.number().optional(),
  TELEGRAM_API_HASH: z.string().optional(),
  TELEGRAM_SESSION: z.string().default(''),
  TELEGRAM_JOIN_PER_RUN: z.coerce.number().default(10),

  SPORTYBET_SHARE_URL: z.string().optional(),
  BET9JA_SHARE_URL: z.string().optional(),
  BETKING_SHARE_URL: z.string().optional(),
  MSPORT_SHARE_URL: z.string().optional(),
  BOOKIE_MIN_INTERVAL_MS: z.coerce.number().default(1500),
  /** Comma-separated bookies whose resolvers may run. Unverified ones stay off in production. */
  ENABLED_BOOKIES: z
    .string()
    .default('sportybet')
    .transform((s) => s.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean)),

  /** api-sports.io / API-Football key. Without it, settlement stays pending. */
  API_FOOTBALL_KEY: z.string().optional(),
});

export const config = Env.parse(process.env);
export type Config = typeof config;

/** Test-only override so suites can flip AUTH_MODE without reloading the process. */
let authModeOverride: Config['AUTH_MODE'] | undefined;

export function setAuthModeForTests(mode: Config['AUTH_MODE'] | undefined) {
  authModeOverride = mode;
}

export function authMode(): Config['AUTH_MODE'] {
  return authModeOverride ?? config.AUTH_MODE;
}
