import { slipKey } from '../core/commit.js';
import { extractCodes } from '../core/extractCodes.js';
import { lockedBeforeKickoff, totalOdds } from '../core/settlement.js';
import type { Slip } from '../core/types.js';
import { ResolverUnavailableError } from '../core/bookies/types.js';

/**
 * Turns a public post (Telegram channel, X) into "Spotted" slips for the feed.
 *
 * Rules:
 * - every code is resolved through the bookie registry (cached + rate-limited)
 * - a code only counts if it was posted BEFORE the first leg kicks off
 * - identical slips posted in many channels merge into one, credited to whoever posted first;
 *   every channel that posted it before kickoff still gets it on its private record
 */

export type PostSource = 'telegram' | 'x';

export interface IncomingPost {
  source: PostSource;
  channel: string; // @username
  messageId: string;
  url?: string;
  postedAt: Date;
  text: string;
}

export interface Sighting {
  source: PostSource;
  channel: string;
  messageId: string;
  url?: string;
  postedAt: Date;
  bookie: Slip['bookie'];
  code: string;
}

export interface SpottedRecord {
  slipKey: string;
  slip: Slip;
  totalOdds: number;
  firstKickoff: Date;
  firstSighting: Sighting;
  sightings: Sighting[];
}

export interface SpottedStore {
  findBySlipKey(key: string): Promise<SpottedRecord | null>;
  create(rec: SpottedRecord): Promise<void>;
  addSighting(key: string, s: Sighting): Promise<void>;
}

export interface Resolver {
  resolve(code: string, bookie: Slip['bookie'] | 'unknown'): Promise<Slip | null>;
}

export type IngestOutcome =
  | { code: string; status: 'new' | 'duplicate'; slipKey: string }
  | { code: string; status: 'late' | 'not_found' | 'resolver_down'; detail?: string };

export async function ingestPost(
  post: IncomingPost,
  deps: { resolver: Resolver; store: SpottedStore },
): Promise<IngestOutcome[]> {
  const out: IngestOutcome[] = [];

  for (const { code, bookie } of extractCodes(post.text)) {
    let slip: Slip | null;
    try {
      slip = await deps.resolver.resolve(code, bookie);
    } catch (err) {
      if (err instanceof ResolverUnavailableError) {
        out.push({ code, status: 'resolver_down', detail: err.message });
        continue;
      }
      throw err;
    }
    if (!slip || slip.legs.length === 0) {
      out.push({ code, status: 'not_found' });
      continue;
    }
    if (!lockedBeforeKickoff(post.postedAt, slip.legs)) {
      out.push({ code, status: 'late' });
      continue;
    }

    const key = slipKey(slip.legs);
    const sighting: Sighting = {
      source: post.source,
      channel: post.channel,
      messageId: post.messageId,
      url: post.url,
      postedAt: post.postedAt,
      bookie: slip.bookie,
      code,
    };

    const existing = await deps.store.findBySlipKey(key);
    if (existing) {
      const alreadyFromChannel = existing.sightings.some((s) => s.channel === post.channel);
      if (!alreadyFromChannel) await deps.store.addSighting(key, sighting);
      out.push({ code, status: 'duplicate', slipKey: key });
      continue;
    }

    await deps.store.create({
      slipKey: key,
      slip,
      totalOdds: totalOdds(slip.legs),
      firstKickoff: new Date(Math.min(...slip.legs.map((l) => l.kickoff.getTime()))),
      firstSighting: sighting,
      sightings: [sighting],
    });
    out.push({ code, status: 'new', slipKey: key });
  }
  return out;
}

/** In-memory store, used by tests and local dry runs. */
export function memorySpottedStore(): SpottedStore & { all(): SpottedRecord[] } {
  const m = new Map<string, SpottedRecord>();
  return {
    async findBySlipKey(k) {
      return m.get(k) ?? null;
    },
    async create(r) {
      m.set(r.slipKey, r);
    },
    async addSighting(k, s) {
      m.get(k)?.sightings.push(s);
    },
    all: () => [...m.values()],
  };
}
