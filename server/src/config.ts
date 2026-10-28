import 'dotenv/config';
import { z } from 'zod';

const Env = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  MONGODB_URI: z.string().default('mongodb://127.0.0.1:27017/codedrop'),

  /** "dev" trusts an x-user-id header. Never use it in production; wire Firebase phone auth instead. */
  AUTH_MODE: z.enum(['dev', 'firebase']).default('dev'),
  ADMIN_USER_IDS: z.string().default('').transform((s) => s.split(',').map((x) => x.trim()).filter(Boolean)),

  TELEGRAM_API_ID: z.coerce.number().optional(),
  TELEGRAM_API_HASH: z.string().optional(),
  TELEGRAM_SESSION: z.string().default(''),
  TELEGRAM_JOIN_PER_RUN: z.coerce.number().default(10),

  SPORTYBET_SHARE_URL: z.string().optional(),
  BOOKIE_MIN_INTERVAL_MS: z.coerce.number().default(1500),
});

export const config = Env.parse(process.env);
export type Config = typeof config;
