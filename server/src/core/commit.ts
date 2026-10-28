import { createHash, randomBytes } from 'node:crypto';
import type { Leg } from './types.js';

/**
 * Commit–reveal for picks.
 *
 * When a tipster locks a pick we hash its content with a secret salt and publish only the hash
 * (to our DB now, anchored on-chain later). VIP picks stay private, yet anyone can later check that
 * the revealed pick matches the hash committed before kickoff.
 */

export interface PickPayload {
  tipsterId: string;
  stakeUnits: number;
  legs: Array<Pick<Leg, 'eventId' | 'market' | 'selection' | 'odds'>>;
  lockedAt: string; // ISO timestamp
}

/** Deterministic JSON: sorted keys, legs in a stable order, so the same pick always hashes the same. */
export function canonicalize(p: PickPayload): string {
  const legs = [...p.legs]
    .map((l) => ({ eventId: l.eventId, market: l.market, odds: Number(l.odds.toFixed(2)), selection: l.selection }))
    .sort((a, b) => (a.eventId + a.market + a.selection).localeCompare(b.eventId + b.market + b.selection));
  return JSON.stringify({ legs, lockedAt: p.lockedAt, stakeUnits: p.stakeUnits, tipsterId: p.tipsterId });
}

export function newSalt(): string {
  return randomBytes(16).toString('hex');
}

export function commitHash(p: PickPayload, salt: string): string {
  return createHash('sha256').update(`${canonicalize(p)}|${salt}`).digest('hex');
}

export function verifyCommit(p: PickPayload, salt: string, hash: string): boolean {
  return commitHash(p, salt) === hash;
}

/** Identity of a slip regardless of who posted it or which bookie code: used to merge duplicates. */
export function slipKey(legs: Array<Pick<Leg, 'eventId' | 'market' | 'selection'>>): string {
  const parts = legs.map((l) => `${l.eventId}|${l.market}|${l.selection}`.toLowerCase()).sort();
  return createHash('sha256').update(parts.join('#')).digest('hex').slice(0, 32);
}
