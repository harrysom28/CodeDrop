import type { Bookie, Slip } from '../types.js';

export class CodeNotFoundError extends Error {
  constructor(public bookie: Bookie, public code: string) {
    super(`${bookie} code ${code} not found or expired`);
  }
}

export class ResolverUnavailableError extends Error {
  constructor(public bookie: Bookie, reason: string) {
    super(`${bookie} resolver unavailable: ${reason}`);
  }
}

/** Turns a bookie's booking code into a normalised slip. */
export interface CodeResolver {
  bookie: Bookie;
  resolve(code: string): Promise<Slip>;
}

export type FetchLike = (url: string, init?: { headers?: Record<string, string> }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;
