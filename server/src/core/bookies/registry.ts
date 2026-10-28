import type { Bookie, Slip } from '../types.js';
import { CodeNotFoundError, ResolverUnavailableError, type CodeResolver } from './types.js';

/**
 * Wraps the per-bookie resolvers with:
 * - a cache (a code's contents never change, so each code is fetched once)
 * - a per-bookie minimum interval between requests, so we don't hammer bookie sites and get blocked
 * - "unknown bookie" handling: try each resolver in turn
 */

export interface SlipCache {
  get(bookie: Bookie, code: string): Promise<Slip | null | undefined>; // null = known-missing
  set(bookie: Bookie, code: string, slip: Slip | null): Promise<void>;
}

export function memoryCache(): SlipCache {
  const m = new Map<string, Slip | null>();
  return {
    async get(b, c) {
      return m.get(`${b}:${c}`);
    },
    async set(b, c, s) {
      m.set(`${b}:${c}`, s);
    },
  };
}

export interface RegistryOptions {
  minIntervalMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export class ResolverRegistry {
  private last = new Map<Bookie, number>();
  private chains = new Map<Bookie, Promise<unknown>>();
  private minInterval: number;
  private now: () => number;
  private sleep: (ms: number) => Promise<void>;

  constructor(
    private resolvers: CodeResolver[],
    private cache: SlipCache,
    opts: RegistryOptions = {},
  ) {
    this.minInterval = opts.minIntervalMs ?? 1500;
    this.now = opts.now ?? Date.now;
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  supported(): Bookie[] {
    return this.resolvers.map((r) => r.bookie);
  }

  async resolve(code: string, bookie: Bookie | 'unknown'): Promise<Slip | null> {
    const candidates = bookie === 'unknown' ? this.resolvers : this.resolvers.filter((r) => r.bookie === bookie);
    let lastError: unknown;
    for (const r of candidates) {
      try {
        const slip = await this.resolveWith(r, code);
        if (slip) return slip;
      } catch (err) {
        // With an unknown bookie, one site being down shouldn't stop us trying the others.
        if (bookie !== 'unknown') throw err;
        lastError = err;
      }
    }
    if (lastError) throw lastError;
    return null;
  }

  private async resolveWith(r: CodeResolver, code: string): Promise<Slip | null> {
    const cached = await this.cache.get(r.bookie, code);
    if (cached !== undefined) return cached;

    // Serialise requests per bookie so the rate limit holds under concurrency.
    const prev = this.chains.get(r.bookie) ?? Promise.resolve();
    const job = prev.then(async () => {
      const last = this.last.get(r.bookie);
      const wait = last === undefined ? 0 : last + this.minInterval - this.now();
      if (wait > 0) await this.sleep(wait);
      this.last.set(r.bookie, this.now());
      try {
        const slip = await r.resolve(code);
        await this.cache.set(r.bookie, code, slip);
        return slip;
      } catch (err) {
        if (err instanceof CodeNotFoundError) {
          await this.cache.set(r.bookie, code, null);
          return null;
        }
        if (err instanceof ResolverUnavailableError) throw err;
        throw new ResolverUnavailableError(r.bookie, (err as Error).message);
      }
    });
    this.chains.set(r.bookie, job.catch(() => undefined));
    return job;
  }
}
