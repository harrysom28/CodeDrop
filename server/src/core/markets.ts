import type { LegResult } from './types.js';

/**
 * Map a finished scoreline to a leg result for the markets we settle automatically.
 * Anything we don't recognise returns 'pending' so an admin can settle it by hand.
 */

export interface Scoreline {
  home: number;
  away: number;
  /** True when the match is finished (FT). */
  finished: boolean;
}

export function settleMarket(market: string, selection: string, score: Scoreline): LegResult {
  if (!score.finished) return 'pending';

  const m = market.toLowerCase().replace(/\s+/g, ' ').trim();
  const s = selection.toLowerCase().replace(/\s+/g, ' ').trim();
  const { home, away } = score;
  const total = home + away;
  const diff = home - away;

  // 1X2 / match result
  if (is1x2(m)) {
    if (isHome(s)) return diff > 0 ? 'won' : 'lost';
    if (isAway(s)) return diff < 0 ? 'won' : 'lost';
    if (isDraw(s)) return diff === 0 ? 'won' : 'lost';
    return 'pending';
  }

  // Double chance
  if (/double\s*chance|dc\b/.test(m) || /^(1x|12|x2)$/.test(s)) {
    if (s === '1x' || /home\s*or\s*draw/.test(s)) return diff >= 0 ? 'won' : 'lost';
    if (s === '12' || /home\s*or\s*away/.test(s)) return diff !== 0 ? 'won' : 'lost';
    if (s === 'x2' || /draw\s*or\s*away/.test(s)) return diff <= 0 ? 'won' : 'lost';
    return 'pending';
  }

  // Draw no bet
  if (/draw\s*no\s*bet|dnb/.test(m)) {
    if (diff === 0) return 'void';
    if (isHome(s)) return diff > 0 ? 'won' : 'lost';
    if (isAway(s)) return diff < 0 ? 'won' : 'lost';
    return 'pending';
  }

  // BTTS / GG/NG
  if (/btts|both\s*teams|gg\s*\/\s*ng|goal\s*goal/.test(m) || /^(yes|no|gg|ng)$/.test(s)) {
    const both = home > 0 && away > 0;
    if (/^(yes|gg)$/.test(s) || /both\s*teams\s*to\s*score.*yes|gg\b/.test(s)) return both ? 'won' : 'lost';
    if (/^(no|ng)$/.test(s) || /both\s*teams\s*to\s*score.*no|ng\b/.test(s)) return both ? 'lost' : 'won';
    return 'pending';
  }

  // Over/Under goals — direction comes from the selection, not the market title ("Over/Under").
  const line = parseGoalLine(m, s);
  if (line !== undefined) {
    const over = /over|ov\s*\d|o\d/.test(s);
    const under = /under|un\s*\d|u\d/.test(s);
    if (over && !under) return total > line ? 'won' : 'lost';
    if (under && !over) return total < line ? 'won' : 'lost';
    return 'pending';
  }

  return 'pending';
}

export function isAutoSettleableMarket(market: string, selection: string): boolean {
  // Probe with a finished 0-0; if still pending, we don't know this market.
  return settleMarket(market, selection, { home: 0, away: 0, finished: true }) !== 'pending'
    || settleMarket(market, selection, { home: 2, away: 1, finished: true }) !== 'pending'
    || settleMarket(market, selection, { home: 1, away: 1, finished: true }) !== 'pending';
}

function is1x2(m: string) {
  return /^(1x2|match\s*result|full\s*time\s*result|ft\s*result|result)$/.test(m) || m === '1x2';
}

function isHome(s: string) {
  return /^(1|home|w1|hw)$/.test(s) || s.includes('home');
}
function isAway(s: string) {
  return /^(2|away|w2|aw)$/.test(s) || s.includes('away');
}
function isDraw(s: string) {
  return /^(x|draw|d)$/.test(s) || s.includes('draw');
}

function parseGoalLine(market: string, selection: string): number | undefined {
  const fromSel = selection.match(/(\d+(?:\.\d+)?)/);
  const fromMkt = market.match(/(?:over\/?under|o\/u|total)[^\d]*(\d+(?:\.\d+)?)/i)
    ?? market.match(/total=(\d+(?:\.\d+)?)/i);
  const raw = fromSel?.[1] ?? fromMkt?.[1];
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}
